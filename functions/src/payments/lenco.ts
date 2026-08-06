import {createHash, createHmac, timingSafeEqual} from "node:crypto";
import {defineSecret} from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import {HttpsError, onCall, onRequest} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";

import {requireActiveUser, requireAdmin} from "../core/auth";
import {
  requireIdempotencyKey,
  requirePositiveInteger,
  requireString,
} from "../core/errors";
import {admin, db} from "../core/firebase";
import {calculatePurchasePoints} from "../core/economyMath";
import {deterministicId} from "../core/idempotency";
import {getEconomySettings, requireEconomyEnabled} from "../core/settings";
import {getSystemAccount, postLedgerTransaction} from "../wallet/ledger";
import {recordSystemActivity} from "../quests/engine";

const lencoSecretKey = defineSecret("LENCO_SECRET_KEY");
const apiBase = process.env.LENCO_API_BASE || "https://api.lenco.co/access/v2";

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const normalized = digits.startsWith("0") ? `260${digits.slice(1)}` : digits;
  if (!/^260\d{9}$/.test(normalized)) {
    throw new HttpsError("invalid-argument", "Enter a valid Zambian mobile number.");
  }
  return normalized;
}

function normalizeOperator(value: string): "mtn" | "airtel" | "zamtel" {
  const operator = value.toLowerCase();
  if (!(["mtn", "airtel", "zamtel"] as string[]).includes(operator)) {
    throw new HttpsError("invalid-argument", "Mobile money operator is invalid.");
  }
  return operator as "mtn" | "airtel" | "zamtel";
}

async function lencoRequest(
  path: string,
  body?: Record<string, unknown>,
  method: "GET" | "POST" = "POST"
) {
  const secret = lencoSecretKey.value();
  if (!secret) throw new HttpsError("failed-precondition", "Lenco is not configured.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${apiBase}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${secret}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      ...(body ? {body: JSON.stringify(body)} : {}),
    });
    const payload = await response.json() as Record<string, unknown>;
    if (!response.ok) {
      logger.warn("Lenco request rejected", {status: response.status, payload});
      throw new HttpsError("unavailable", "Payment provider rejected the request.");
    }
    return payload;
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Lenco request failed", {error});
    throw new HttpsError("unavailable", "Payment provider is temporarily unavailable.");
  } finally {
    clearTimeout(timeout);
  }
}

async function creditPointPurchase(input: {
  paymentId: string;
  userId: string;
  points: number;
  providerTransactionId: string;
}) {
  const result = await postLedgerTransaction({
    transactionId: deterministicId("point_purchase", input.userId, input.paymentId),
    type: "point_purchase",
    status: "completed",
    senderWalletId: null,
    receiverWalletId: input.userId,
    participants: [input.userId],
    amount: input.points,
    fee: 0,
    referenceType: "payment",
    referenceId: input.paymentId,
    createdBy: "lenco_webhook",
    idempotencyKey: input.providerTransactionId,
    entries: [
      {
        accountId: getSystemAccount("purchases", input.paymentId),
        bucket: "available",
        amount: -input.points,
      },
      {accountId: input.userId, bucket: "available", amount: input.points},
    ],
    metadata: {provider: "lenco", providerTransactionId: input.providerTransactionId},
  });
  await recordSystemActivity({
    type: "purchase.completed",
    userId: input.userId,
    sourceType: "payment",
    sourceId: input.paymentId,
    metadata: {points: input.points, provider: "lenco"},
  });
  return result;
}

export const initiatePointPurchase = onCall({
  cors: true,
  invoker: "public",
  enforceAppCheck: process.env.ENFORCE_APP_CHECK !== "false",
  secrets: [lencoSecretKey],
}, async (request) => {
  const actor = await requireActiveUser(request);
  const data = request.data as Record<string, unknown>;
  const idempotencyKey = requireIdempotencyKey(data.idempotencyKey);
  const amountNgwee = requirePositiveInteger(data.amountNgwee, "Amount", 100000000);
  const phone = normalizePhone(requireString(data.phone, "Phone", {min: 9, max: 20}));
  const operator = normalizeOperator(requireString(data.operator, "Operator"));
  const settings = await getEconomySettings();
  requireEconomyEnabled(settings, "purchases");
  if (
    !settings.pointsPerZmw ||
    !settings.minPurchaseNgwee ||
    !settings.maxPurchaseNgwee ||
    amountNgwee < settings.minPurchaseNgwee ||
    amountNgwee > settings.maxPurchaseNgwee
  ) {
    throw new HttpsError("invalid-argument", "Purchase amount is outside configured limits.");
  }
  const points = calculatePurchasePoints(amountNgwee, settings.pointsPerZmw);
  if (!Number.isSafeInteger(points) || points <= 0) {
    throw new HttpsError("failed-precondition", "This amount does not purchase any points.");
  }

  const paymentId = deterministicId("points_payment", actor.uid, idempotencyKey);
  const paymentRef = db.collection("payments").doc(paymentId);
  const existing = await paymentRef.get();
  if (existing.exists) {
    const current = existing.data() || {};
    if (current.userId !== actor.uid || current.amountNgwee !== amountNgwee) {
      throw new HttpsError("already-exists", "This request key was already used.");
    }
    return {paymentId, status: current.status, points: current.points};
  }

  await paymentRef.create({
    userId: actor.uid,
    provider: "lenco",
    purpose: "point_purchase",
    amountNgwee,
    currency: "ZMW",
    points,
    conversionRate: settings.pointsPerZmw,
    configurationVersion: settings.version,
    phone,
    operator,
    status: "initiated",
    idempotencyKey,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  try {
    const response = await lencoRequest("/collections/mobile-money", {
      amount: (amountNgwee / 100).toFixed(2),
      currency: "ZMW",
      phone,
      operator,
      reference: paymentId,
    });
    const collection = (response.data || {}) as Record<string, unknown>;
    const providerStatus = String(collection.status || "pending").toLowerCase();
    const providerTransactionId = String(collection.id || paymentId);
    await paymentRef.set({
      providerTransactionId,
      providerStatus,
      status: providerStatus === "failed" ? "failed" : "pending",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
    return {paymentId, status: providerStatus === "failed" ? "failed" : "pending", points};
  } catch (error) {
    await paymentRef.set({
      status: "pending_verification",
      requestError: error instanceof Error ? error.message : "Provider request failed",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
    throw error;
  }
});

function validWebhookSignature(rawBody: Buffer, signature: string, secret: string): boolean {
  const webhookHashKey = createHash("sha256").update(secret).digest("hex");
  const expected = createHmac("sha512", webhookHashKey).update(rawBody).digest("hex");
  const receivedBuffer = Buffer.from(signature.toLowerCase(), "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer);
}

export const lencoPointsWebhook = onRequest({
  invoker: "public",
  secrets: [lencoSecretKey],
}, async (request, response) => {
  if (request.method !== "POST") {
    response.set("Allow", "POST").status(405).send("Method Not Allowed");
    return;
  }
  const signature = request.get("x-lenco-signature") || "";
  const rawBody = (request as {rawBody?: Buffer}).rawBody;
  if (!rawBody || !signature || !validWebhookSignature(
    rawBody,
    signature,
    lencoSecretKey.value()
  )) {
    logger.warn("Rejected Lenco webhook", {hasBody: Boolean(rawBody), hasSignature: Boolean(signature)});
    response.status(403).send("Forbidden");
    return;
  }

  const body = request.body as Record<string, unknown>;
  const event = String(body.event || "");
  const data = (body.data || {}) as Record<string, unknown>;
  const paymentId = String(data.clientReference || data.reference || "");
  const providerTransactionId = String(data.id || data.transactionReference || "");
  const eventId = deterministicId(
    "lenco_event",
    event,
    `${providerTransactionId}:${signature}`
  );
  const eventRef = db.collection("paymentEvents").doc(eventId);
  const existingEvent = await eventRef.get();
  if (existingEvent.data()?.status === "processed") {
    response.status(200).send("OK");
    return;
  }
  await eventRef.set({
    provider: "lenco", event, paymentId, providerTransactionId,
    payloadHash: createHash("sha256").update(rawBody).digest("hex"),
    status: "received",
    receivedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});

  const paymentRef = db.collection("payments").doc(paymentId);
  const payment = await paymentRef.get();
  if (!payment.exists || payment.data()?.purpose !== "point_purchase") {
    await eventRef.set({status: "ignored", reason: "unknown_payment"}, {merge: true});
    response.status(200).send("OK");
    return;
  }
  const paymentData = payment.data() || {};
  const webhookAmountNgwee = Math.round(Number(data.amount) * 100);
  const currency = String(data.currency || paymentData.currency || "").toUpperCase();
  if (
    webhookAmountNgwee !== paymentData.amountNgwee ||
    currency !== "ZMW" ||
    paymentData.userId === undefined
  ) {
    await Promise.all([
      eventRef.set({status: "rejected", reason: "payment_mismatch"}, {merge: true}),
      paymentRef.set({status: "review_required"}, {merge: true}),
    ]);
    response.status(200).send("OK");
    return;
  }

  const successfulEvent = [
    "transaction.successful",
    "collection.successful",
  ].includes(event);
  const failedEvent = [
    "transaction.failed",
    "collection.failed",
  ].includes(event);

  if (successfulEvent) {
    await creditPointPurchase({
      paymentId,
      userId: String(paymentData.userId),
      points: Number(paymentData.points),
      providerTransactionId,
    });
    await paymentRef.set({
      status: "successful",
      providerStatus: "successful",
      providerTransactionId,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
  } else if (failedEvent) {
    await paymentRef.set({
      status: "failed",
      providerStatus: "failed",
      failureReason: String(data.reasonForFailure || "Payment failed"),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
  } else {
    await eventRef.set({status: "ignored", reason: "unsupported_event"}, {merge: true});
    response.status(200).send("OK");
    return;
  }
  await eventRef.set({status: "processed", processedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
  response.status(200).send("OK");
});

async function refreshPointPayment(paymentId: string) {
  const paymentRef = db.collection("payments").doc(paymentId);
  const payment = await paymentRef.get();
  if (!payment.exists) throw new HttpsError("not-found", "Payment not found.");
  const current = payment.data() || {};
  if (["successful", "failed", "refunded"].includes(current.status)) {
    return {paymentId, status: current.status, points: current.points};
  }
  const response = await lencoRequest(
    `/collections/status/${encodeURIComponent(paymentId)}`,
    undefined,
    "GET"
  );
  const collection = (response.data || {}) as Record<string, unknown>;
  const providerStatus = String(collection.status || "pending").toLowerCase();
  const providerTransactionId = String(collection.id || current.providerTransactionId || paymentId);
  const successful = ["successful", "completed", "success"].includes(providerStatus);
  const failed = ["failed", "declined", "cancelled"].includes(providerStatus);
  if (successful) {
    const amountNgwee = Math.round(Number(collection.amount) * 100);
    if (amountNgwee !== Number(current.amountNgwee)) {
      await paymentRef.set({status: "review_required"}, {merge: true});
      throw new HttpsError("data-loss", "Provider payment amount does not match.");
    }
    await creditPointPurchase({
      paymentId,
      userId: String(current.userId),
      points: Number(current.points),
      providerTransactionId,
    });
  }
  const status = successful ? "successful" : failed ? "failed" : "pending";
  await paymentRef.set({
    status, providerStatus, providerTransactionId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(successful ? {completedAt: admin.firestore.FieldValue.serverTimestamp()} : {}),
  }, {merge: true});
  return {paymentId, status, points: current.points};
}

export const checkPointPurchaseStatus = onCall({
  cors: true,
  invoker: "public",
  enforceAppCheck: process.env.ENFORCE_APP_CHECK !== "false",
  secrets: [lencoSecretKey],
}, async (request) => {
  const actor = await requireActiveUser(request);
  const paymentId = requireString(
    (request.data as Record<string, unknown>).paymentId,
    "Payment",
    {min: 32, max: 128}
  );
  const payment = await db.collection("payments").doc(paymentId).get();
  if (payment.data()?.userId !== actor.uid) {
    throw new HttpsError("permission-denied", "Payment does not belong to you.");
  }
  return refreshPointPayment(paymentId);
});

export const reconcilePendingPointPayments = onSchedule({
  schedule: "every 15 minutes",
  secrets: [lencoSecretKey],
}, async () => {
  const pending = await db.collection("payments")
    .where("status", "in", ["initiated", "pending", "pending_verification"])
    .limit(25)
    .get();
  for (const payment of pending.docs) {
    try {
      await refreshPointPayment(payment.id);
    } catch (error) {
      logger.warn("Pending point payment reconciliation failed", {
        paymentId: payment.id,
        error,
      });
    }
  }
});

export const adminRecordPointPurchaseRefund = onCall({
  cors: true,
  invoker: "public",
  enforceAppCheck: process.env.ENFORCE_APP_CHECK !== "false",
}, async (request) => {
  const actor = await requireAdmin(request);
  const input = request.data as Record<string, unknown>;
  const paymentId = requireString(input.paymentId, "Payment", {min: 32, max: 128});
  const providerRefundId = requireString(
    input.providerRefundId,
    "Provider refund ID",
    {min: 4, max: 256}
  );
  const reason = requireString(input.reason, "Reason", {min: 10, max: 1000});
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
  const payment = await db.collection("payments").doc(paymentId).get();
  if (!payment.exists) throw new HttpsError("not-found", "Payment not found.");
  const current = payment.data() || {};
  if (current.status !== "successful") {
    throw new HttpsError("failed-precondition", "Only successful payments can be refunded.");
  }
  const points = Number(current.points);
  const originalTransactionId = deterministicId(
    "point_purchase",
    String(current.userId),
    paymentId
  );
  const result = await postLedgerTransaction({
    transactionId: deterministicId("point_purchase_refund", actor.uid, idempotencyKey),
    type: "point_purchase_refund",
    status: "completed",
    senderWalletId: String(current.userId),
    receiverWalletId: null,
    participants: [String(current.userId)],
    amount: points,
    fee: 0,
    referenceType: "payment",
    referenceId: paymentId,
    createdBy: actor.uid,
    idempotencyKey,
    reversesTransactionId: originalTransactionId,
    entries: [
      {accountId: String(current.userId), bucket: "available", amount: -points},
      {accountId: getSystemAccount("purchases", paymentId), bucket: "available", amount: points},
    ],
    auditData: {paymentId, providerRefundId, reason, points},
    documentPreconditions: [{
      collection: "payments", id: paymentId, field: "status", equals: "successful",
    }],
    linkedWrites: [{
      collection: "payments", id: paymentId, mode: "update", data: {
        status: "refunded",
        providerRefundId,
        refundReason: reason,
        refundedBy: actor.uid,
        refundedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    }],
  });
  return {...result, paymentId, status: "refunded", points};
});
