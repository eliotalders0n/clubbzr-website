import * as admin from "firebase-admin";
import {randomBytes} from "node:crypto";
import {defineSecret} from "firebase-functions/params";
import {setGlobalOptions} from "firebase-functions/v2";
import {onDocumentCreated, onDocumentUpdated} from "firebase-functions/v2/firestore";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

admin.initializeApp();
setGlobalOptions({maxInstances: 10});

const db = admin.firestore();
const lencoSecretKey = defineSecret("LENCO_SECRET_KEY");

const LENCO_API_BASE = "https://api.lenco.co/access/v2";
const DEFAULT_CURRENCY = "ZMW";
const DEFAULT_ADMIN_NOTIFICATION_EMAIL = "clubbzrzm@gmail.com";
const APP_BASE_URL = process.env.APP_BASE_URL || "https://clubbzr.com";
const SESSIONS_COLLECTION = "sessions";
const SESSION_REGISTRATIONS_COLLECTION = "sessionRegistrations";
const SESSION_PAYMENT_TRANSACTIONS_COLLECTION = "sessionPaymentTransactions";
const MAIL_COLLECTION = "mail";

type MobileMoneyOperator = "mtn" | "airtel" | "zamtel";
type PaymentStatus = "pending" | "processing" | "completed" | "failed";

interface ChargeMobileMoneyData {
  sessionId?: string;
  registrationId?: string;
  phone?: string;
  operator?: string;
  currency?: string;
  reference?: string;
}

interface CheckMomoStatusData {
  transactionId?: string;
  reference?: string;
}

interface SessionPaymentMetadata {
  source: "club-bzr-web";
  sessionId: string;
  registrationId: string;
}

interface SessionEmailSummary {
  title: string;
  dateText: string;
  locationText: string;
}

interface QueuedEmail {
  to: string[];
  subject: string;
  text: string;
  html: string;
  tag: string;
  metadata: Record<string, string | null>;
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requireString(value: unknown, message: string): string {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    throw new HttpsError("invalid-argument", message);
  }
  return normalized;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (digits.startsWith("260") && digits.length === 12) {
    return digits;
  }

  if (digits.startsWith("0") && digits.length === 10) {
    return `260${digits.slice(1)}`;
  }

  if (digits.length === 9) {
    return `260${digits}`;
  }

  throw new HttpsError(
    "invalid-argument",
    "Enter a valid Zambian mobile money number."
  );
}

function mapOperator(value: string): MobileMoneyOperator {
  const operator = value.trim().toLowerCase();

  if (["mtn", "mtn zm", "momo"].includes(operator)) {
    return "mtn";
  }

  if (["airtel", "airtel zm", "airtel money"].includes(operator)) {
    return "airtel";
  }

  if (operator === "zamtel") {
    return "zamtel";
  }

  throw new HttpsError(
    "invalid-argument",
    "Select a supported mobile money operator."
  );
}

function mapCollectionStatus(status: unknown): PaymentStatus {
  const normalizedStatus = String(status ?? "").trim().toLowerCase();

  if (
    [
      "successful",
      "completed",
      "complete",
      "success",
      "succeeded",
      "paid",
      "settled",
      "approved",
      "captured",
    ].includes(normalizedStatus)
  ) {
    return "completed";
  }

  if (["failed", "declined", "cancelled"].includes(normalizedStatus)) {
    return "failed";
  }

  if (normalizedStatus === "processing") {
    return "processing";
  }

  return "pending";
}

function getFailureReason(data: Record<string, unknown>): string | null {
  const reasonForFailure = normalizeOptionalString(data.reasonForFailure);
  const failureReason = normalizeOptionalString(data.failureReason);
  return reasonForFailure ?? failureReason;
}

function getMessageForStatus(status: PaymentStatus): string {
  if (status === "completed") {
    return "Payment completed successfully.";
  }

  if (status === "failed") {
    return "Payment failed.";
  }

  if (status === "processing") {
    return "Payment is processing. Check your phone for updates.";
  }

  return "Charge initiated. Approve the prompt on your phone.";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error || "Unknown error");
}

function getFallbackPaymentStatus(
  value: unknown
): PaymentStatus {
  const status = mapCollectionStatus(value);
  return status === "completed" || status === "failed" || status === "processing" ?
    status :
    "pending";
}

function isRecoverablePaymentProviderError(error: unknown): boolean {
  if (!(error instanceof HttpsError)) {
    return true;
  }

  return [
    "deadline-exceeded",
    "internal",
    "resource-exhausted",
    "unavailable",
  ].includes(error.code);
}

function isRecentFirestoreTimestamp(value: unknown, maxAgeMs: number): boolean {
  if (!(value instanceof admin.firestore.Timestamp)) {
    return false;
  }

  return Date.now() - value.toMillis() <= maxAgeMs;
}

function generateReference(): string {
  return `club_bzr_${Date.now()}_${randomBytes(4).toString("hex")}`;
}

function normalizePaymentReference(value: unknown): string | null {
  const reference = normalizeOptionalString(value);
  if (!reference) return null;

  if (!/^[A-Za-z0-9_-]{8,96}$/.test(reference)) {
    throw new HttpsError("invalid-argument", "Payment reference is invalid.");
  }

  return reference;
}

function getAdminNotificationEmails(): string[] {
  const configured = process.env.ADMIN_NOTIFICATION_EMAILS ||
    DEFAULT_ADMIN_NOTIFICATION_EMAIL;

  return configured
    .split(",")
    .map((email) => email.trim())
    .filter((email) => email.includes("@"));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToHtml(value: string): string {
  return value
    .split("\n")
    .map((line) => escapeHtml(line))
    .join("<br>");
}

function formatMoney(amount: unknown, currency: unknown): string {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return "No payment amount recorded";
  }

  const resolvedCurrency = normalizeOptionalString(currency) ?? DEFAULT_CURRENCY;
  return `${resolvedCurrency.toUpperCase()} ${roundCurrency(numericAmount).toFixed(2)}`;
}

function formatSessionDate(value: unknown): string {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toLocaleString("en-ZM", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Africa/Lusaka",
    });
  }

  return "Date to be confirmed";
}

function getRegistrationName(
  registrationData: FirebaseFirestore.DocumentData
): string {
  return normalizeOptionalString(registrationData.displayName) ??
    normalizeOptionalString(registrationData.email) ??
    "Club BZR member";
}

async function getSessionEmailSummary(
  sessionId: string | null
): Promise<SessionEmailSummary> {
  if (!sessionId) {
    return {
      title: "Club BZR session",
      dateText: "Date to be confirmed",
      locationText: "Location to be confirmed",
    };
  }

  const sessionSnapshot = await db
    .collection(SESSIONS_COLLECTION)
    .doc(sessionId)
    .get();
  const sessionData = sessionSnapshot.data() || {};
  const location = sessionData.location as
    Partial<{name: string; address: string}> | undefined;

  return {
    title: normalizeOptionalString(sessionData.title) ?? "Club BZR session",
    dateText: formatSessionDate(sessionData.date),
    locationText: sessionData.isOnline === true ?
      "Online" :
      normalizeOptionalString(location?.name) ??
        normalizeOptionalString(location?.address) ??
        "Location to be confirmed",
  };
}

async function queueEmail(input: QueuedEmail): Promise<void> {
  if (input.to.length === 0) {
    logger.warn("Email notification skipped: no recipients", {
      tag: input.tag,
      metadata: input.metadata,
    });
    return;
  }

  await db.collection(MAIL_COLLECTION).add({
    to: input.to,
    message: {
      subject: input.subject,
      text: input.text,
      html: input.html,
    },
    tag: input.tag,
    metadata: input.metadata,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function queueAdminSignupEmail(input: {
  registrationId: string;
  registrationData: FirebaseFirestore.DocumentData;
}): Promise<void> {
  const sessionId = normalizeOptionalString(input.registrationData.sessionId);
  const session = await getSessionEmailSummary(sessionId);
  const memberName = getRegistrationName(input.registrationData);
  const memberEmail = normalizeOptionalString(input.registrationData.email) ??
    "No email recorded";
  const status = normalizeOptionalString(input.registrationData.status) ??
    "unknown";
  const paymentStatus =
    normalizeOptionalString(input.registrationData.paymentStatus) ?? "unknown";
  const amount = formatMoney(
    input.registrationData.paymentAmount,
    input.registrationData.paymentCurrency
  );

  const text = [
    `${memberName} signed up for ${session.title}.`,
    "",
    `Session: ${session.title}`,
    `When: ${session.dateText}`,
    `Where: ${session.locationText}`,
    `Member: ${memberName}`,
    `Email: ${memberEmail}`,
    `Signup status: ${status}`,
    `Payment status: ${paymentStatus}`,
    `Amount: ${amount}`,
    "",
    `Review signups: ${APP_BASE_URL}/admin/sessions`,
  ].join("\n");

  await queueEmail({
    to: getAdminNotificationEmails(),
    subject: `New session signup: ${session.title}`,
    text,
    html: textToHtml(text),
    tag: "session_signup_admin",
    metadata: {
      sessionId,
      registrationId: input.registrationId,
      userId: normalizeOptionalString(input.registrationData.userId),
    },
  });
}

async function queueAdminPaymentReadyEmail(input: {
  registrationId: string;
  registrationData: FirebaseFirestore.DocumentData;
}): Promise<void> {
  const sessionId = normalizeOptionalString(input.registrationData.sessionId);
  const session = await getSessionEmailSummary(sessionId);
  const memberName = getRegistrationName(input.registrationData);
  const amount = formatMoney(
    input.registrationData.paymentAmount,
    input.registrationData.paymentCurrency
  );
  const reference =
    normalizeOptionalString(input.registrationData.paymentReference) ??
    "No reference recorded";

  const text = [
    `${memberName} has a paid session signup ready for admin confirmation.`,
    "",
    `Session: ${session.title}`,
    `When: ${session.dateText}`,
    `Member: ${memberName}`,
    `Email: ${normalizeOptionalString(input.registrationData.email) ?? "No email recorded"}`,
    `Amount: ${amount}`,
    `Reference: ${reference}`,
    "",
    `Confirm the spot here: ${APP_BASE_URL}/admin/sessions`,
  ].join("\n");

  await queueEmail({
    to: getAdminNotificationEmails(),
    subject: `Payment ready to confirm: ${session.title}`,
    text,
    html: textToHtml(text),
    tag: "session_payment_ready_admin",
    metadata: {
      sessionId,
      registrationId: input.registrationId,
      userId: normalizeOptionalString(input.registrationData.userId),
    },
  });
}

async function queueUserConfirmationEmail(input: {
  registrationId: string;
  registrationData: FirebaseFirestore.DocumentData;
}): Promise<void> {
  const recipient = normalizeOptionalString(input.registrationData.email);
  if (!recipient) {
    logger.warn("Session confirmation email skipped: missing member email", {
      registrationId: input.registrationId,
    });
    return;
  }

  const sessionId = normalizeOptionalString(input.registrationData.sessionId);
  const session = await getSessionEmailSummary(sessionId);
  const memberName = getRegistrationName(input.registrationData);

  const text = [
    `Hi ${memberName},`,
    "",
    `Your spot is confirmed for ${session.title}.`,
    "",
    `When: ${session.dateText}`,
    `Where: ${session.locationText}`,
    "",
    "See you there.",
    "Club BZR",
  ].join("\n");

  await queueEmail({
    to: [recipient],
    subject: `You're confirmed for ${session.title}`,
    text,
    html: textToHtml(text),
    tag: "session_confirmation_user",
    metadata: {
      sessionId,
      registrationId: input.registrationId,
      userId: normalizeOptionalString(input.registrationData.userId),
    },
  });
}

async function lencoRequest(
  path: string,
  init: RequestInit,
  secret: string
): Promise<Record<string, unknown>> {
  if (!secret) {
    throw new HttpsError(
      "failed-precondition",
      "Lenco is not configured for this project."
    );
  }

  const response = await fetch(`${LENCO_API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${secret}`,
      ...(init.headers || {}),
    },
  });

  const parsedResponse = await response.json().catch(() => ({}));
  const responseData = parsedResponse as Record<string, unknown>;

  if (!response.ok) {
    logger.error("Lenco API request failed", {
      path,
      status: response.status,
      responseData,
    });

    const message = normalizeOptionalString(responseData.message) ??
      "Lenco request failed.";

    const errorCode: "failed-precondition" | "unavailable" =
      response.status === 408 || response.status === 429 || response.status >= 500 ?
        "unavailable" :
        "failed-precondition";

    throw new HttpsError(errorCode, message);
  }

  return responseData;
}

async function isAdminUser(uid: string): Promise<boolean> {
  const userSnapshot = await db.collection("users").doc(uid).get();
  return userSnapshot.exists && userSnapshot.data()?.role === "admin";
}

async function requirePaymentAccess(
  uid: string,
  transactionData: FirebaseFirestore.DocumentData
): Promise<void> {
  if (transactionData.userId === uid) return;
  if (await isAdminUser(uid)) return;

  throw new HttpsError(
    "permission-denied",
    "You do not have access to this payment."
  );
}

export const notifyAdminsOnSessionRegistration = onDocumentCreated(
  `${SESSION_REGISTRATIONS_COLLECTION}/{registrationId}`,
  async (event) => {
    const registrationData = event.data?.data();
    const registrationId = event.params.registrationId;

    if (!registrationData) {
      logger.warn("Session registration notification skipped: missing data", {
        registrationId,
      });
      return;
    }

    await queueAdminSignupEmail({registrationId, registrationData});

    if (registrationData.status === "confirmed") {
      await queueUserConfirmationEmail({registrationId, registrationData});
      await event.data?.ref.set(
        {
          confirmationEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true}
      );
    }
  }
);

export const notifyOnSessionRegistrationUpdate = onDocumentUpdated(
  `${SESSION_REGISTRATIONS_COLLECTION}/{registrationId}`,
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    const registrationId = event.params.registrationId;

    if (!beforeData || !afterData) {
      logger.warn("Session registration update notification skipped", {
        registrationId,
      });
      return;
    }

    if (
      beforeData.status !== "paid_pending_confirmation" &&
      afterData.status === "paid_pending_confirmation"
    ) {
      await queueAdminPaymentReadyEmail({registrationId, registrationData: afterData});
    }

    if (beforeData.status !== "confirmed" && afterData.status === "confirmed") {
      await queueUserConfirmationEmail({registrationId, registrationData: afterData});
      await event.data?.after.ref.set(
        {
          confirmationEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true}
      );
    }
  }
);

async function findSessionPaymentTransaction(input: {
  transactionId: string | null;
  reference: string | null;
}): Promise<{
  docRef: FirebaseFirestore.DocumentReference;
  snapshot: FirebaseFirestore.DocumentSnapshot;
}> {
  if (input.transactionId) {
    const docRef = db
      .collection(SESSION_PAYMENT_TRANSACTIONS_COLLECTION)
      .doc(input.transactionId);
    const snapshot = await docRef.get();

    if (snapshot.exists) {
      return {docRef, snapshot};
    }
  }

  if (input.reference) {
    const querySnapshot = await db
      .collection(SESSION_PAYMENT_TRANSACTIONS_COLLECTION)
      .where("reference", "==", input.reference)
      .limit(1)
      .get();

    if (!querySnapshot.empty) {
      return {
        docRef: querySnapshot.docs[0].ref,
        snapshot: querySnapshot.docs[0],
      };
    }
  }

  throw new HttpsError("not-found", "Payment transaction not found.");
}

async function markRegistrationPaid(input: {
  transactionId: string;
  reference: string;
  metadata: SessionPaymentMetadata;
  amount: number | null;
  currency: string;
}): Promise<void> {
  const registrationRef = db
    .collection(SESSION_REGISTRATIONS_COLLECTION)
    .doc(input.metadata.registrationId);
  const registrationSnapshot = await registrationRef.get();

  if (!registrationSnapshot.exists) {
    throw new HttpsError("not-found", "Session registration not found.");
  }

  await registrationRef.set(
    {
      status: "paid_pending_confirmation",
      paymentStatus: "paid_online",
      paymentMethod: "mobile_money",
      paymentTransactionId: input.transactionId,
      paymentReference: input.reference,
      paymentAmount: input.amount,
      paymentCurrency: input.currency,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {merge: true}
  );
}

export const chargeSessionMobileMoney = onCall(
  {
    cors: true,
    invoker: "public",
    secrets: [lencoSecretKey],
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign in before paying.");
    }

    const data = (request.data || {}) as ChargeMobileMoneyData;
    const sessionId = requireString(data.sessionId, "Session ID is required.");
    const registrationId = requireString(
      data.registrationId,
      "Registration ID is required."
    );
    const phone = formatPhoneNumber(
      requireString(data.phone, "Phone number is required.")
    );
    const operator = mapOperator(
      requireString(data.operator, "Mobile money operator is required.")
    );

    const registrationRef = db
      .collection(SESSION_REGISTRATIONS_COLLECTION)
      .doc(registrationId);
    const registrationSnapshot = await registrationRef.get();

    if (!registrationSnapshot.exists) {
      throw new HttpsError("not-found", "Session registration not found.");
    }

    const registrationData = registrationSnapshot.data() || {};
    if (registrationData.userId !== uid) {
      throw new HttpsError(
        "permission-denied",
        "You can only pay for your own registration."
      );
    }

    if (registrationData.sessionId !== sessionId) {
      throw new HttpsError(
        "invalid-argument",
        "Registration does not belong to this session."
      );
    }

    const sessionSnapshot = await db
      .collection(SESSIONS_COLLECTION)
      .doc(sessionId)
      .get();

    if (!sessionSnapshot.exists) {
      throw new HttpsError("not-found", "Session not found.");
    }

    const sessionData = sessionSnapshot.data() || {};
    const paymentMode = sessionData.paymentMode ?? (
      sessionData.isFree === false || Number(sessionData.price) > 0 ?
        "paid" :
        "free"
    );
    const paymentProvider = sessionData.paymentProvider ?? "manual_external";
    const amount = Number(sessionData.price);
    const currency = normalizeOptionalString(data.currency) ??
      normalizeOptionalString(sessionData.currency) ??
      DEFAULT_CURRENCY;

    if (paymentMode !== "paid" || paymentProvider !== "lenco") {
      throw new HttpsError(
        "failed-precondition",
        "Online payment is not enabled for this session."
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new HttpsError(
        "failed-precondition",
        "This session does not have a valid payment amount."
      );
    }

    const reference = normalizePaymentReference(data.reference) ??
      generateReference();
    const metadata: SessionPaymentMetadata = {
      source: "club-bzr-web",
      sessionId,
      registrationId,
    };
    const roundedAmount = roundCurrency(amount);
    const normalizedCurrency = currency.toUpperCase();
    const email = normalizeOptionalString(request.auth?.token.email);
    const transactionRef = db
      .collection(SESSION_PAYMENT_TRANSACTIONS_COLLECTION)
      .doc(reference);
    const existingTransactionSnapshot = await transactionRef.get();

    if (existingTransactionSnapshot.exists) {
      const existingTransaction = existingTransactionSnapshot.data() || {};

      if (
        existingTransaction.userId !== uid ||
        existingTransaction.sessionId !== sessionId ||
        existingTransaction.registrationId !== registrationId
      ) {
        throw new HttpsError(
          "permission-denied",
          "Payment reference belongs to another registration."
        );
      }

      const existingStatus = getFallbackPaymentStatus(
        existingTransaction.status
      );
      const existingGatewayStatus = normalizeOptionalString(
        existingTransaction.gatewayStatus
      );
      const isRecentRequestStarted =
        existingGatewayStatus === "request_started" &&
        isRecentFirestoreTimestamp(existingTransaction.updatedAt, 120000);
      const shouldReturnExisting =
        existingStatus === "completed" ||
        existingStatus === "failed" ||
        existingStatus === "processing" ||
        (
          existingStatus === "pending" &&
          (
            isRecentRequestStarted ||
            (
              existingGatewayStatus !== "request_started" &&
              existingGatewayStatus !== "request_error"
            )
          )
        );

      if (shouldReturnExisting) {
        const existingTransactionId =
          normalizeOptionalString(existingTransaction.transactionId) ??
          reference;
        const existingMessage =
          normalizeOptionalString(existingTransaction.message) ??
          getMessageForStatus(existingStatus);

        return {
          success: existingStatus === "completed",
          transactionId: existingTransactionId,
          reference,
          status: existingStatus,
          message: existingMessage,
          failureReason: normalizeOptionalString(
            existingTransaction.failureReason
          ),
          recoverable: existingStatus === "pending" ||
            existingStatus === "processing",
        };
      }
    }

    const initialTransactionData: FirebaseFirestore.DocumentData = {
      transactionId: reference,
      reference,
      sessionId,
      registrationId,
      userId: uid,
      email,
      phone,
      operator,
      amount: roundedAmount,
      currency: normalizedCurrency,
      gatewayStatus: "request_started",
      status: "pending",
      message: getMessageForStatus("pending"),
      failureReason: null,
      metadata,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (!existingTransactionSnapshot.exists) {
      initialTransactionData.createdAt =
        admin.firestore.FieldValue.serverTimestamp();
    }

    await transactionRef.set(
      initialTransactionData,
      {merge: true}
    );

    await registrationRef.set(
      {
        paymentStatus: "pending",
        paymentMethod: "mobile_money",
        paymentTransactionId: reference,
        paymentReference: reference,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true}
    );

    let responseData: Record<string, unknown>;

    try {
      responseData = await lencoRequest(
        "/collections/mobile-money",
        {
          method: "POST",
          body: JSON.stringify({
            amount: roundedAmount.toFixed(2),
            currency: normalizedCurrency,
            phone,
            operator,
            reference,
          }),
        },
        lencoSecretKey.value()
      );
    } catch (chargeError) {
      const errorMessage = getErrorMessage(chargeError);
      const isRecoverable = isRecoverablePaymentProviderError(chargeError);

      logger.warn("Lenco charge request unavailable", {
        reference,
        sessionId,
        registrationId,
        isRecoverable,
        errorMessage,
      });

      await transactionRef.set(
        {
          status: isRecoverable ? "pending" : "failed",
          gatewayStatus: "request_error",
          message: isRecoverable ?
            "Charge request could not be confirmed. We will keep checking this payment." :
            getMessageForStatus("failed"),
          failureReason: isRecoverable ? null : errorMessage,
          chargeRequestError: errorMessage,
          lastStatusCheckFailedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true}
      );

      await registrationRef.set(
        {
          paymentStatus: isRecoverable ? "pending" : "failed",
          paymentMethod: "mobile_money",
          paymentTransactionId: reference,
          paymentReference: reference,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true}
      );

      if (!isRecoverable) {
        throw chargeError;
      }

      return {
        success: false,
        transactionId: reference,
        reference,
        status: "pending",
        message: "We could not confirm that the payment provider received the request. If you get a mobile money prompt, approve it. We will keep checking this payment.",
        failureReason: null,
        recoverable: true,
      };
    }

    const collection = (responseData.data || {}) as Record<string, unknown>;
    const transactionId = normalizeOptionalString(collection.id) ?? reference;
    const status = mapCollectionStatus(collection.status);
    const failureReason = getFailureReason(collection);

    await transactionRef.set(
      {
        transactionId,
        reference,
        sessionId,
        registrationId,
        userId: uid,
        email,
        phone,
        operator,
        amount: roundedAmount,
        currency: normalizedCurrency,
        gatewayStatus: normalizeOptionalString(collection.status),
        status,
        message: getMessageForStatus(status),
        failureReason,
        metadata,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true}
    );

    await registrationRef.set(
      {
        paymentStatus: status === "failed" ? "failed" : "pending",
        paymentMethod: "mobile_money",
        paymentTransactionId: transactionId,
        paymentReference: reference,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true}
    );

    if (status === "completed") {
      await markRegistrationPaid({
        transactionId,
        reference,
        metadata,
        amount: roundedAmount,
        currency: normalizedCurrency,
      });
    }

    return {
      success: status === "completed",
      transactionId,
      reference,
      status,
      message: getMessageForStatus(status),
      failureReason,
    };
  }
);

export const checkSessionMomoStatus = onCall(
  {
    cors: true,
    invoker: "public",
    secrets: [lencoSecretKey],
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign in before checking payment.");
    }

    const data = (request.data || {}) as CheckMomoStatusData;
    const transactionId = normalizeOptionalString(data.transactionId);
    const referenceInput = normalizeOptionalString(data.reference);

    if (!transactionId && !referenceInput) {
      throw new HttpsError(
        "invalid-argument",
        "Transaction ID or reference is required."
      );
    }

    const transactionRecord = await findSessionPaymentTransaction({
      transactionId,
      reference: referenceInput,
    });
    const existingTransactionData = transactionRecord.snapshot.data() || {};
    await requirePaymentAccess(uid, existingTransactionData);

    const reference = normalizeOptionalString(existingTransactionData.reference) ??
      referenceInput ??
      transactionId;

    if (!reference) {
      throw new HttpsError("failed-precondition", "Payment reference is missing.");
    }

    let responseData: Record<string, unknown>;

    try {
      responseData = await lencoRequest(
        `/collections/status/${reference}`,
        {method: "GET"},
        lencoSecretKey.value()
      );
    } catch (statusError) {
      const existingStatus = getFallbackPaymentStatus(
        existingTransactionData.status
      );
      const fallbackStatus = existingStatus === "processing" ?
        "pending" :
        existingStatus;
      const fallbackTransactionId = transactionId ??
        normalizeOptionalString(existingTransactionData.transactionId) ??
        transactionRecord.snapshot.id;
      const errorMessage = getErrorMessage(statusError);

      logger.warn("Lenco status check unavailable", {
        transactionId: fallbackTransactionId,
        reference,
        errorMessage,
      });

      await transactionRecord.docRef.set(
        {
          status: fallbackStatus,
          statusCheckError: errorMessage,
          lastStatusCheckFailedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true}
      );

      return {
        success: fallbackStatus === "completed",
        transactionId: fallbackTransactionId,
        reference,
        status: fallbackStatus,
        message: fallbackStatus === "failed" ?
          getMessageForStatus("failed") :
          "We could not reach the payment provider. Your payment is still pending and we will keep checking.",
        failureReason: fallbackStatus === "failed" ?
          normalizeOptionalString(existingTransactionData.failureReason) :
          null,
        recoverable: fallbackStatus === "pending",
      };
    }

    const collection = (responseData.data || {}) as Record<string, unknown>;
    const resolvedTransactionId = normalizeOptionalString(collection.id) ??
      transactionId ??
      transactionRecord.snapshot.id;
    const status = mapCollectionStatus(collection.status);
    const failureReason = getFailureReason(collection);
    const paymentReference = normalizeOptionalString(collection.reference) ??
      reference;
    const amount = typeof collection.amount === "string" ?
      Number(collection.amount) :
      Number(existingTransactionData.amount);
    const currency = normalizeOptionalString(collection.currency) ??
      normalizeOptionalString(existingTransactionData.currency) ??
      DEFAULT_CURRENCY;

    await transactionRecord.docRef.set(
      {
        transactionId: resolvedTransactionId,
        reference: paymentReference,
        amount: Number.isFinite(amount) ? roundCurrency(amount) : null,
        currency: currency.toUpperCase(),
        gatewayStatus: normalizeOptionalString(collection.status),
        status,
        message: getMessageForStatus(status),
        failureReason,
        completedAt: status === "completed" ?
          admin.firestore.FieldValue.serverTimestamp() :
          null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true}
    );

    const metadata = existingTransactionData.metadata as
      Partial<SessionPaymentMetadata> | undefined;
    const sessionId = normalizeOptionalString(metadata?.sessionId);
    const registrationId = normalizeOptionalString(metadata?.registrationId);

    if (status === "completed" && sessionId && registrationId) {
      await markRegistrationPaid({
        transactionId: resolvedTransactionId,
        reference: paymentReference,
        metadata: {
          source: "club-bzr-web",
          sessionId,
          registrationId,
        },
        amount: Number.isFinite(amount) ? roundCurrency(amount) : null,
        currency: currency.toUpperCase(),
      });
    }

    if (status === "failed" && registrationId) {
      await db
        .collection(SESSION_REGISTRATIONS_COLLECTION)
        .doc(registrationId)
        .set(
          {
            paymentStatus: "failed",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          {merge: true}
        );
    }

    return {
      success: status === "completed",
      transactionId: resolvedTransactionId,
      reference: paymentReference,
      status,
      message: getMessageForStatus(status),
      failureReason,
    };
  }
);
