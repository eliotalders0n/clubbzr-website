import {HttpsError, onCall} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";

import {requireActiveUser, requireAdmin} from "../core/auth";
import {calculateCommercialFee} from "../core/economyMath";
import {requireIdempotencyKey, requirePositiveInteger, requireString} from "../core/errors";
import {admin, db} from "../core/firebase";
import {deterministicId} from "../core/idempotency";
import {getEconomySettings, requireEconomyEnabled} from "../core/settings";
import {getSystemAccount, postLedgerTransaction} from "../wallet/ledger";
import {recordSystemActivity} from "../quests/engine";

const options = {
  cors: true,
  invoker: "public" as const,
  enforceAppCheck: process.env.ENFORCE_APP_CHECK !== "false",
};

async function getTrade(tradeId: string) {
  const snapshot = await db.collection("trades").doc(tradeId).get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Trade not found.");
  return {ref: snapshot.ref, data: snapshot.data() || {}};
}

function requireParticipant(data: Record<string, unknown>, uid: string) {
  if (!Array.isArray(data.participants) || !data.participants.includes(uid)) {
    throw new HttpsError("permission-denied", "You are not part of this trade.");
  }
}

export const createTrade = onCall(options, async (request) => {
  const actor = await requireActiveUser(request);
  const input = request.data as Record<string, unknown>;
  const sellerId = requireString(input.sellerId, "Seller", {min: 6, max: 128});
  if (sellerId === actor.uid) throw new HttpsError("invalid-argument", "Buyer and seller must differ.");
  const kind = requireString(input.kind, "Trade type", {min: 4, max: 32});
  if (!["commission", "digital_download", "marketplace_purchase"].includes(kind)) {
    throw new HttpsError("invalid-argument", "Trade type is invalid.");
  }
  const amount = requirePositiveInteger(input.amount, "Amount", 100000000);
  const referenceId = requireString(input.referenceId, "Reference", {min: 1, max: 256});
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
  const settings = await getEconomySettings();
  requireEconomyEnabled(settings, "trading");
  const seller = await db.collection("wallets").doc(sellerId).get();
  if (seller.data()?.status !== "active") throw new HttpsError("failed-precondition", "Seller is unavailable.");

  const tradeId = deterministicId("trade", actor.uid, idempotencyKey);
  const fee = calculateCommercialFee(amount, settings.tradeFeeBasisPoints);
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  const expiresAt = admin.firestore.Timestamp.fromMillis(
    Date.now() + settings.escrowTimeoutHours * 60 * 60 * 1000
  );
  const result = await postLedgerTransaction({
    transactionId: deterministicId("escrow_lock", actor.uid, tradeId),
    type: "escrow_lock",
    status: "completed",
    senderWalletId: actor.uid,
    receiverWalletId: null,
    participants: [actor.uid, sellerId],
    amount,
    fee: 0,
    referenceType: "trade",
    referenceId: tradeId,
    createdBy: actor.uid,
    idempotencyKey,
    entries: [
      {accountId: actor.uid, bucket: "available", amount: -amount},
      {accountId: actor.uid, bucket: "locked", amount},
    ],
    linkedWrites: [
      {collection: "trades", id: tradeId, mode: "create", data: {
        buyerId: actor.uid, sellerId, participants: [actor.uid, sellerId],
        kind, referenceId, amount, fee, feeBasisPoints: settings.tradeFeeBasisPoints,
        status: "funded", expiresAt, createdAt: timestamp, updatedAt: timestamp,
      }},
      {collection: "escrows", id: tradeId, mode: "create", data: {
        tradeId, buyerId: actor.uid, sellerId, participants: [actor.uid, sellerId],
        amount, status: "locked", expiresAt, createdAt: timestamp, updatedAt: timestamp,
      }},
    ],
  });
  return {...result, tradeId, amount, fee, status: "funded"};
});

async function transitionTrade(input: {
  tradeId: string; actorId: string; actorRole: "buyer" | "seller" | "participant";
  from: string[]; to: string; extra?: Record<string, unknown>;
}) {
  const tradeRef = db.collection("trades").doc(input.tradeId);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(tradeRef);
    if (!snapshot.exists) throw new HttpsError("not-found", "Trade not found.");
    const trade = snapshot.data() || {};
    if (input.actorRole === "buyer" && trade.buyerId !== input.actorId) throw new HttpsError("permission-denied", "Buyer action required.");
    if (input.actorRole === "seller" && trade.sellerId !== input.actorId) throw new HttpsError("permission-denied", "Seller action required.");
    if (input.actorRole === "participant") requireParticipant(trade, input.actorId);
    if (!input.from.includes(trade.status)) throw new HttpsError("failed-precondition", "Trade cannot make this transition.");
    transaction.update(tradeRef, {
      status: input.to, ...input.extra,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

export const acceptTrade = onCall(options, async (request) => {
  const actor = await requireActiveUser(request);
  const tradeId = requireString((request.data as Record<string, unknown>).tradeId, "Trade");
  await transitionTrade({tradeId, actorId: actor.uid, actorRole: "seller", from: ["funded"], to: "accepted", extra: {acceptedAt: admin.firestore.FieldValue.serverTimestamp()}});
  return {success: true, tradeId, status: "accepted"};
});

export const markTradeDelivered = onCall(options, async (request) => {
  const actor = await requireActiveUser(request);
  const tradeId = requireString((request.data as Record<string, unknown>).tradeId, "Trade");
  await transitionTrade({tradeId, actorId: actor.uid, actorRole: "seller", from: ["accepted"], to: "delivered", extra: {deliveredAt: admin.firestore.FieldValue.serverTimestamp()}});
  return {success: true, tradeId, status: "delivered"};
});

async function settleTrade(tradeId: string, actorId: string, outcome: "release" | "refund") {
  const {data: trade} = await getTrade(tradeId);
  const amount = Number(trade.amount);
  const fee = outcome === "release" ? Number(trade.fee || 0) : 0;
  const sellerAmount = amount - fee;
  const type = outcome === "release" ? "escrow_release" : "escrow_refund";
  const result = await postLedgerTransaction({
    transactionId: deterministicId(type, actorId, tradeId),
    type,
    status: "completed",
    senderWalletId: trade.buyerId,
    receiverWalletId: outcome === "release" ? trade.sellerId : trade.buyerId,
    participants: trade.participants,
    amount,
    fee,
    referenceType: "trade",
    referenceId: tradeId,
    createdBy: actorId,
    idempotencyKey: tradeId,
    entries: outcome === "release" ? [
      {accountId: trade.buyerId, bucket: "locked", amount: -amount},
      {accountId: trade.sellerId, bucket: "available", amount: sellerAmount},
      ...(fee > 0 ? [{accountId: getSystemAccount("fees", tradeId), bucket: "available" as const, amount: fee}] : []),
    ] : [
      {accountId: trade.buyerId, bucket: "locked", amount: -amount},
      {accountId: trade.buyerId, bucket: "available", amount},
    ],
    documentPreconditions: [{collection: "trades", id: tradeId, field: "status", equals: outcome === "release" ? ["accepted", "delivered", "disputed"] : ["funded", "disputed"]}],
    linkedWrites: [
      {collection: "trades", id: tradeId, mode: "update", data: {status: outcome === "release" ? "completed" : "cancelled", settledAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp()}},
      {collection: "escrows", id: tradeId, mode: "update", data: {status: outcome === "release" ? "released" : "refunded", settledAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp()}},
    ],
  });
  if (outcome === "release") {
    await Promise.all([
      recordSystemActivity({
        type: "trade.completed",
        userId: String(trade.buyerId),
        sourceType: "trade",
        sourceId: tradeId,
        metadata: {role: "buyer", kind: trade.kind},
      }),
      recordSystemActivity({
        type: "trade.completed",
        userId: String(trade.sellerId),
        sourceType: "trade",
        sourceId: tradeId,
        metadata: {role: "seller", kind: trade.kind},
      }),
    ]);
  }
  return result;
}

export const completeTrade = onCall(options, async (request) => {
  const actor = await requireActiveUser(request);
  const tradeId = requireString((request.data as Record<string, unknown>).tradeId, "Trade");
  const {data} = await getTrade(tradeId);
  if (data.buyerId !== actor.uid) throw new HttpsError("permission-denied", "Buyer action required.");
  await settleTrade(tradeId, actor.uid, "release");
  return {success: true, tradeId, status: "completed"};
});

export const cancelTrade = onCall(options, async (request) => {
  const actor = await requireActiveUser(request);
  const tradeId = requireString((request.data as Record<string, unknown>).tradeId, "Trade");
  const {data} = await getTrade(tradeId);
  if (data.buyerId !== actor.uid) throw new HttpsError("permission-denied", "Buyer action required.");
  await settleTrade(tradeId, actor.uid, "refund");
  return {success: true, tradeId, status: "cancelled"};
});

export const disputeTrade = onCall(options, async (request) => {
  const actor = await requireActiveUser(request);
  const input = request.data as Record<string, unknown>;
  const tradeId = requireString(input.tradeId, "Trade");
  const reason = requireString(input.reason, "Reason", {min: 10, max: 1000});
  await transitionTrade({tradeId, actorId: actor.uid, actorRole: "participant", from: ["accepted", "delivered"], to: "disputed", extra: {disputedBy: actor.uid, disputeReason: reason, disputedAt: admin.firestore.FieldValue.serverTimestamp()}});
  return {success: true, tradeId, status: "disputed"};
});

export const resolveTradeDispute = onCall(options, async (request) => {
  const actor = await requireAdmin(request);
  const input = request.data as Record<string, unknown>;
  const tradeId = requireString(input.tradeId, "Trade");
  const resolution = requireString(input.resolution, "Resolution");
  const reason = requireString(input.reason, "Reason", {min: 10, max: 1000});
  if (!["release", "refund"].includes(resolution)) throw new HttpsError("invalid-argument", "Resolution is invalid.");
  await settleTrade(tradeId, actor.uid, resolution as "release" | "refund");
  await db.collection("auditLogs").add({actorId: actor.uid, action: "trade_dispute_resolved", targetType: "trade", targetId: tradeId, data: {resolution, reason}, createdAt: admin.firestore.FieldValue.serverTimestamp()});
  return {success: true, tradeId, status: resolution === "release" ? "completed" : "cancelled"};
});

export const expireStaleTrades = onSchedule(
  {schedule: "every 30 minutes", timeZone: "Africa/Lusaka"},
  async () => {
    const stale = await db.collection("trades")
      .where("status", "==", "funded")
      .where("expiresAt", "<=", admin.firestore.Timestamp.now())
      .limit(50)
      .get();
    for (const trade of stale.docs) {
      try {
        await settleTrade(trade.id, "escrow_timeout", "refund");
      } catch (error) {
        if (error instanceof HttpsError && error.code === "failed-precondition") {
          continue;
        }
        throw error;
      }
    }
  }
);
