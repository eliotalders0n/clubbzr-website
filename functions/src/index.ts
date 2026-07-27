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
const LENCO_REQUEST_TIMEOUT_MS = 15000;
const LENCO_DASHBOARD_REQUEST_TIMEOUT_MS = 6000;
const DEFAULT_CURRENCY = "ZMW";
const DEFAULT_ADMIN_NOTIFICATION_EMAIL = "clubbzrzm@gmail.com";
const APP_BASE_URL = process.env.APP_BASE_URL || "https://clubbzr.com";
const SESSIONS_COLLECTION = "sessions";
const SESSION_REGISTRATIONS_COLLECTION = "sessionRegistrations";
const SESSION_PAYMENT_TRANSACTIONS_COLLECTION = "sessionPaymentTransactions";
const SESSION_PAYMENT_RETURNS_COLLECTION = "sessionPaymentReturns";
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
  source: "club-bzr-web" | "club-bzr-admin";
  sessionId: string;
  registrationId: string;
}

interface AdminPaymentsDashboardData {
  sessionId?: string;
  limit?: number;
}

interface AdminCollectSessionPaymentData {
  sessionId?: string;
  registrationId?: string;
  phone?: string;
  operator?: string;
  amount?: number | string;
  currency?: string;
  displayName?: string;
  email?: string;
  note?: string;
  reference?: string;
}

interface AdminRecordPaymentReturnData {
  sessionId?: string;
  registrationId?: string;
  transactionId?: string;
  reference?: string;
  amount?: number | string;
  currency?: string;
  method?: string;
  reason?: string;
  externalReference?: string;
  status?: string;
  notes?: string;
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

function getFiniteAmount(value: unknown): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) ? roundCurrency(amount) : null;
}

function requirePositiveAmount(value: unknown, message: string): number {
  const amount = getFiniteAmount(value);
  if (!amount || amount <= 0) {
    throw new HttpsError("invalid-argument", message);
  }

  return amount;
}

function normalizeCurrency(value: unknown): string {
  return (normalizeOptionalString(value) ?? DEFAULT_CURRENCY).toUpperCase();
}

function normalizeReturnStatus(value: unknown): "pending" | "completed" | "cancelled" {
  const status = String(value ?? "pending").trim().toLowerCase();
  if (status === "completed" || status === "cancelled") return status;
  return "pending";
}

function normalizeReturnMethod(value: unknown): string {
  const method = String(value ?? "other").trim().toLowerCase();
  return ["cash", "bank_transfer", "mobile_money", "card", "other"].includes(method) ?
    method :
    "other";
}

function serializeForCallable(value: unknown): unknown {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeForCallable(entry));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce<
      Record<string, unknown>
    >((serialized, [key, entry]) => {
      serialized[key] = serializeForCallable(entry);
      return serialized;
    }, {});
  }

  return value;
}

function snapshotToCallableObject(
  snapshot: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot
): Record<string, unknown> {
  return {
    id: snapshot.id,
    ...(serializeForCallable(snapshot.data() || {}) as Record<string, unknown>),
  };
}

function extractLencoList(responseData: Record<string, unknown> | null): Record<string, unknown>[] {
  if (!responseData) return [];

  const data = responseData.data;
  if (Array.isArray(data)) {
    return data.filter((entry): entry is Record<string, unknown> =>
      Boolean(entry && typeof entry === "object")
    );
  }

  if (data && typeof data === "object") {
    const nestedData = (data as Record<string, unknown>).data;
    if (Array.isArray(nestedData)) {
      return nestedData.filter((entry): entry is Record<string, unknown> =>
        Boolean(entry && typeof entry === "object")
      );
    }
  }

  return [];
}

function getLencoRecordReference(record: Record<string, unknown>): string | null {
  return normalizeOptionalString(record.reference) ??
    normalizeOptionalString(record.id) ??
    normalizeOptionalString(record.collectionId) ??
    normalizeOptionalString(record.transactionId);
}

function getLencoRecordAmount(record: Record<string, unknown>): number {
  return getFiniteAmount(record.amount) ??
    getFiniteAmount(record.total) ??
    getFiniteAmount(record.value) ??
    0;
}

function getLencoRecordText(record: Record<string, unknown>): string {
  return [
    record.type,
    record.entry,
    record.category,
    record.description,
    record.narration,
    record.status,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");
}

function isProviderWithdrawalRecord(record: Record<string, unknown>): boolean {
  const text = getLencoRecordText(record);
  const amount = getLencoRecordAmount(record);
  return amount < 0 ||
    text.includes("withdraw") ||
    text.includes("payout") ||
    text.includes("debit") ||
    text.includes("transfer");
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
  secret: string,
  timeoutMs = LENCO_REQUEST_TIMEOUT_MS
): Promise<Record<string, unknown>> {
  if (!secret) {
    throw new HttpsError(
      "failed-precondition",
      "Lenco is not configured for this project."
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    response = await fetch(`${LENCO_API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secret}`,
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      logger.warn("Lenco API request timed out", {
        path,
        timeoutMs,
      });
      throw new HttpsError(
        "deadline-exceeded",
        "Lenco request timed out."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

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

async function requireAdminAuth(uid: string | undefined): Promise<string> {
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in as an admin.");
  }

  if (!(await isAdminUser(uid))) {
    throw new HttpsError("permission-denied", "Admin access is required.");
  }

  return uid;
}

async function safeLencoRead(
  path: string,
  secret: string,
  timeoutMs = LENCO_DASHBOARD_REQUEST_TIMEOUT_MS
): Promise<{data: Record<string, unknown> | null; error: string | null}> {
  try {
    return {
      data: await lencoRequest(path, {method: "GET"}, secret, timeoutMs),
      error: null,
    };
  } catch (error) {
    logger.warn("Lenco admin dashboard read failed", {
      path,
      errorMessage: getErrorMessage(error),
    });
    return {
      data: null,
      error: getErrorMessage(error),
    };
  }
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

    const querySnapshot = await db
      .collection(SESSION_PAYMENT_TRANSACTIONS_COLLECTION)
      .where("transactionId", "==", input.transactionId)
      .limit(1)
      .get();

    if (!querySnapshot.empty) {
      return {
        docRef: querySnapshot.docs[0].ref,
        snapshot: querySnapshot.docs[0],
      };
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

export const adminGetPaymentsDashboard = onCall(
  {
    cors: true,
    invoker: "public",
    secrets: [lencoSecretKey],
    timeoutSeconds: 30,
  },
  async (request) => {
    await requireAdminAuth(request.auth?.uid);

    const data = (request.data || {}) as AdminPaymentsDashboardData;
    const sessionId = normalizeOptionalString(data.sessionId);
    const limitCount = Math.min(Math.max(Number(data.limit) || 100, 25), 300);

    let transactionQuery: FirebaseFirestore.Query = db
      .collection(SESSION_PAYMENT_TRANSACTIONS_COLLECTION);
    let registrationQuery: FirebaseFirestore.Query = db
      .collection(SESSION_REGISTRATIONS_COLLECTION);
    let returnQuery: FirebaseFirestore.Query = db
      .collection(SESSION_PAYMENT_RETURNS_COLLECTION);

    if (sessionId) {
      transactionQuery = transactionQuery.where("sessionId", "==", sessionId);
      registrationQuery = registrationQuery.where("sessionId", "==", sessionId);
      returnQuery = returnQuery.where("sessionId", "==", sessionId);
    } else {
      transactionQuery = transactionQuery
        .orderBy("createdAt", "desc")
        .limit(limitCount);
      registrationQuery = registrationQuery.limit(1000);
      returnQuery = returnQuery.orderBy("createdAt", "desc").limit(limitCount);
    }

    const sessionPromise = sessionId ?
      db.collection(SESSIONS_COLLECTION).doc(sessionId).get() :
      db.collection(SESSIONS_COLLECTION).limit(500).get();

    const [
      transactionSnapshot,
      registrationSnapshot,
      returnSnapshot,
      sessionResult,
      accountsResult,
      collectionsResult,
      settlementsResult,
      transactionsResult,
    ] = await Promise.all([
      transactionQuery.get(),
      registrationQuery.get(),
      returnQuery.get(),
      sessionPromise,
      safeLencoRead("/accounts", lencoSecretKey.value()),
      safeLencoRead("/collections", lencoSecretKey.value()),
      safeLencoRead("/settlements", lencoSecretKey.value()),
      safeLencoRead("/transactions", lencoSecretKey.value()),
    ]);

    const sessions = sessionId ?
      ((sessionResult as FirebaseFirestore.DocumentSnapshot).exists ?
        [snapshotToCallableObject(sessionResult as FirebaseFirestore.DocumentSnapshot)] :
        []) :
      (sessionResult as FirebaseFirestore.QuerySnapshot).docs.map(
        (snapshot) => snapshotToCallableObject(snapshot)
      );
    const registrations = registrationSnapshot.docs.map((snapshot) =>
      snapshotToCallableObject(snapshot)
    );
    const localTransactions = transactionSnapshot.docs.map((snapshot) =>
      snapshotToCallableObject(snapshot)
    );
    const returns = returnSnapshot.docs.map((snapshot) =>
      snapshotToCallableObject(snapshot)
    );

    const lencoCollections = extractLencoList(collectionsResult.data).map(
      (record) => serializeForCallable(record) as Record<string, unknown>
    );
    const lencoSettlements = extractLencoList(settlementsResult.data).map(
      (record) => serializeForCallable(record) as Record<string, unknown>
    );
    const lencoTransactions = extractLencoList(transactionsResult.data).map(
      (record) => serializeForCallable(record) as Record<string, unknown>
    );
    const lencoAccounts = extractLencoList(accountsResult.data).map(
      (record) => serializeForCallable(record) as Record<string, unknown>
    );

    const localByReference = new Map<string, Record<string, unknown>>();
    localTransactions.forEach((transaction) => {
      const reference = normalizeOptionalString(transaction.reference);
      if (reference) localByReference.set(reference, transaction);
      const transactionId = normalizeOptionalString(transaction.transactionId);
      if (transactionId) localByReference.set(transactionId, transaction);
    });

    const providerByReference = new Map<string, Record<string, unknown>>();
    lencoCollections.forEach((collection) => {
      const reference = getLencoRecordReference(collection);
      if (reference) providerByReference.set(reference, collection);
    });

    const statusMismatches: Record<string, unknown>[] = [];
    const missingProviderCollections: Record<string, unknown>[] = [];

    localTransactions.forEach((transaction) => {
      const reference = normalizeOptionalString(transaction.reference) ??
        normalizeOptionalString(transaction.transactionId);
      if (!reference) return;

      const providerRecord = providerByReference.get(reference);
      if (!providerRecord) {
        missingProviderCollections.push(transaction);
        return;
      }

      const providerStatus = mapCollectionStatus(providerRecord.status);
      const localStatus = getFallbackPaymentStatus(transaction.status);
      const normalizedLocalStatus = localStatus === "processing" ?
        "pending" :
        localStatus;
      const normalizedProviderStatus = providerStatus === "processing" ?
        "pending" :
        providerStatus;

      if (normalizedLocalStatus !== normalizedProviderStatus) {
        statusMismatches.push({
          reference,
          localStatus,
          providerStatus,
          localTransaction: transaction,
          providerCollection: providerRecord,
        });
      }
    });

    const unmatchedProviderCollections = lencoCollections.filter((collection) => {
      const reference = getLencoRecordReference(collection);
      return reference ? !localByReference.has(reference) : true;
    });

    const sessionsById = new Map<string, Record<string, unknown>>();
    sessions.forEach((session) => {
      const id = normalizeOptionalString(session.id);
      if (id) sessionsById.set(id, session);
    });

    const sessionSummaries = sessions.map((session) => {
      const id = normalizeOptionalString(session.id) ?? "";
      const sessionTransactions = localTransactions.filter((transaction) =>
        normalizeOptionalString(transaction.sessionId) === id
      );
      const sessionRegistrations = registrations.filter((registration) =>
        normalizeOptionalString(registration.sessionId) === id
      );
      const sessionReturns = returns.filter((returnRecord) =>
        normalizeOptionalString(returnRecord.sessionId) === id
      );

      const onlineCollected = sessionTransactions
        .filter((transaction) => getFallbackPaymentStatus(transaction.status) === "completed")
        .reduce((sum, transaction) => sum + (getFiniteAmount(transaction.amount) ?? 0), 0);
      const pending = sessionTransactions
        .filter((transaction) => {
          const status = getFallbackPaymentStatus(transaction.status);
          return status === "pending" || status === "processing";
        })
        .reduce((sum, transaction) => sum + (getFiniteAmount(transaction.amount) ?? 0), 0);
      const failed = sessionTransactions
        .filter((transaction) => getFallbackPaymentStatus(transaction.status) === "failed")
        .reduce((sum, transaction) => sum + (getFiniteAmount(transaction.amount) ?? 0), 0);
      const externalCollected = sessionRegistrations
        .filter((registration) => registration.paymentStatus === "paid_external")
        .reduce((sum, registration) => sum + (getFiniteAmount(registration.paymentAmount) ?? 0), 0);
      const returned = sessionReturns
        .filter((returnRecord) => returnRecord.status === "completed")
        .reduce((sum, returnRecord) => sum + (getFiniteAmount(returnRecord.amount) ?? 0), 0);

      return {
        sessionId: id,
        title: normalizeOptionalString(session.title) ?? "Untitled session",
        currency: normalizeCurrency(session.currency),
        price: getFiniteAmount(session.price) ?? 0,
        onlineCollected: roundCurrency(onlineCollected),
        externalCollected: roundCurrency(externalCollected),
        grossCollected: roundCurrency(onlineCollected + externalCollected),
        pending: roundCurrency(pending),
        failed: roundCurrency(failed),
        returned: roundCurrency(returned),
        netCollected: roundCurrency(onlineCollected + externalCollected - returned),
        transactionCount: sessionTransactions.length,
        registrationCount: sessionRegistrations.length,
      };
    });

    const providerWithdrawals = lencoTransactions.filter(isProviderWithdrawalRecord);
    const settlementTotal = lencoSettlements.reduce(
      (sum, settlement) => sum + Math.abs(getLencoRecordAmount(settlement)),
      0
    );
    const withdrawalTotal = providerWithdrawals.reduce(
      (sum, transaction) => sum + Math.abs(getLencoRecordAmount(transaction)),
      0
    );
    const completedReturnTotal = returns
      .filter((returnRecord) => returnRecord.status === "completed")
      .reduce((sum, returnRecord) => sum + (getFiniteAmount(returnRecord.amount) ?? 0), 0);

    const totals = sessionSummaries.reduce(
      (summary, session) => ({
        onlineCollected: summary.onlineCollected + Number(session.onlineCollected),
        externalCollected: summary.externalCollected + Number(session.externalCollected),
        grossCollected: summary.grossCollected + Number(session.grossCollected),
        pending: summary.pending + Number(session.pending),
        failed: summary.failed + Number(session.failed),
        returned: summary.returned + Number(session.returned),
        netCollected: summary.netCollected + Number(session.netCollected),
      }),
      {
        onlineCollected: 0,
        externalCollected: 0,
        grossCollected: 0,
        pending: 0,
        failed: 0,
        returned: 0,
        netCollected: 0,
      }
    );

    return {
      generatedAt: new Date().toISOString(),
      filters: {sessionId, limit: limitCount},
      provider: {
        accounts: lencoAccounts,
        collections: lencoCollections.slice(0, limitCount),
        settlements: lencoSettlements.slice(0, limitCount),
        transactions: lencoTransactions.slice(0, limitCount),
        withdrawals: providerWithdrawals.slice(0, limitCount),
        errors: {
          accounts: accountsResult.error,
          collections: collectionsResult.error,
          settlements: settlementsResult.error,
          transactions: transactionsResult.error,
        },
      },
      sessions: sessionSummaries.sort((a, b) =>
        Number(b.netCollected) - Number(a.netCollected)
      ),
      localTransactions,
      registrations,
      returns,
      reconciliation: {
        statusMismatches,
        missingProviderCollections,
        unmatchedProviderCollections,
        issueCount: statusMismatches.length +
          missingProviderCollections.length +
          unmatchedProviderCollections.length,
      },
      totals: {
        onlineCollected: roundCurrency(totals.onlineCollected),
        externalCollected: roundCurrency(totals.externalCollected),
        grossCollected: roundCurrency(totals.grossCollected),
        pending: roundCurrency(totals.pending),
        failed: roundCurrency(totals.failed),
        returned: roundCurrency(totals.returned),
        netCollected: roundCurrency(totals.netCollected),
        providerSettlements: roundCurrency(settlementTotal),
        providerWithdrawals: roundCurrency(withdrawalTotal),
        completedReturns: roundCurrency(completedReturnTotal),
      },
      sourceNotes: [
        "Collections and status data come from Lenco.",
        "External payments and manual returns are local admin records.",
        "Withdrawals are reported as provider debit/withdrawal-like transactions; no outgoing withdrawal is initiated here.",
      ],
    };
  }
);

export const adminCollectSessionMobileMoney = onCall(
  {
    cors: true,
    invoker: "public",
    secrets: [lencoSecretKey],
  },
  async (request) => {
    const adminUid = await requireAdminAuth(request.auth?.uid);
    const data = (request.data || {}) as AdminCollectSessionPaymentData;
    const sessionId = requireString(data.sessionId, "Session ID is required.");
    const phone = formatPhoneNumber(
      requireString(data.phone, "Phone number is required.")
    );
    const operator = mapOperator(
      requireString(data.operator, "Mobile money operator is required.")
    );
    const registrationId = normalizeOptionalString(data.registrationId);

    const sessionSnapshot = await db.collection(SESSIONS_COLLECTION)
      .doc(sessionId)
      .get();

    if (!sessionSnapshot.exists) {
      throw new HttpsError("not-found", "Session not found.");
    }

    const sessionData = sessionSnapshot.data() || {};
    const amount = data.amount === undefined || data.amount === "" ?
      requirePositiveAmount(sessionData.price, "Collection amount is required.") :
      requirePositiveAmount(data.amount, "Collection amount is invalid.");
    const currency = normalizeCurrency(data.currency ?? sessionData.currency);

    let registrationData: FirebaseFirestore.DocumentData | null = null;
    if (registrationId) {
      const registrationSnapshot = await db
        .collection(SESSION_REGISTRATIONS_COLLECTION)
        .doc(registrationId)
        .get();

      if (!registrationSnapshot.exists) {
        throw new HttpsError("not-found", "Session registration not found.");
      }

      registrationData = registrationSnapshot.data() || {};
      if (registrationData.sessionId !== sessionId) {
        throw new HttpsError(
          "invalid-argument",
          "Registration does not belong to this session."
        );
      }
    }

    const reference = normalizePaymentReference(data.reference) ??
      generateReference();
    const displayName = normalizeOptionalString(data.displayName) ??
      (registrationData ? getRegistrationName(registrationData) : null);
    const email = normalizeOptionalString(data.email) ??
      normalizeOptionalString(registrationData?.email);
    const metadata: SessionPaymentMetadata = {
      source: "club-bzr-admin",
      sessionId,
      registrationId: registrationId ?? "",
    };
    const transactionRef = db
      .collection(SESSION_PAYMENT_TRANSACTIONS_COLLECTION)
      .doc(reference);
    const existingTransactionSnapshot = await transactionRef.get();

    if (existingTransactionSnapshot.exists) {
      const existingTransaction = existingTransactionSnapshot.data() || {};
      if (
        existingTransaction.sessionId !== sessionId ||
        normalizeOptionalString(existingTransaction.reference) !== reference
      ) {
        throw new HttpsError(
          "permission-denied",
          "Payment reference belongs to another collection."
        );
      }

      const existingStatus = getFallbackPaymentStatus(existingTransaction.status);
      return {
        success: existingStatus === "completed",
        transactionId: normalizeOptionalString(existingTransaction.transactionId) ??
          reference,
        reference,
        status: existingStatus,
        message: normalizeOptionalString(existingTransaction.message) ??
          getMessageForStatus(existingStatus),
        failureReason: normalizeOptionalString(existingTransaction.failureReason),
        recoverable: existingStatus === "pending" ||
          existingStatus === "processing",
      };
    }

    await transactionRef.set(
      {
        transactionId: reference,
        reference,
        sessionId,
        registrationId: registrationId ?? null,
        userId: normalizeOptionalString(registrationData?.userId),
        displayName,
        email,
        phone,
        operator,
        amount,
        currency,
        gatewayStatus: "request_started",
        status: "pending",
        message: getMessageForStatus("pending"),
        failureReason: null,
        metadata,
        initiatedBy: adminUid,
        initiatedByRole: "admin",
        note: normalizeOptionalString(data.note),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true}
    );

    if (registrationId) {
      await db.collection(SESSION_REGISTRATIONS_COLLECTION)
        .doc(registrationId)
        .set(
          {
            paymentStatus: "pending",
            paymentMethod: "mobile_money",
            paymentTransactionId: reference,
            paymentReference: reference,
            paymentAmount: amount,
            paymentCurrency: currency,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          {merge: true}
        );
    }

    let responseData: Record<string, unknown>;
    try {
      responseData = await lencoRequest(
        "/collections/mobile-money",
        {
          method: "POST",
          body: JSON.stringify({
            amount: amount.toFixed(2),
            currency,
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

      await transactionRef.set(
        {
          status: isRecoverable ? "pending" : "failed",
          gatewayStatus: "request_error",
          message: isRecoverable ?
            "Collection request could not be confirmed. Keep checking this payment." :
            getMessageForStatus("failed"),
          failureReason: isRecoverable ? null : errorMessage,
          chargeRequestError: errorMessage,
          lastStatusCheckFailedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true}
      );

      if (registrationId) {
        await db.collection(SESSION_REGISTRATIONS_COLLECTION)
          .doc(registrationId)
          .set(
            {
              paymentStatus: isRecoverable ? "pending" : "failed",
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            {merge: true}
          );
      }

      if (!isRecoverable) {
        throw chargeError;
      }

      return {
        success: false,
        transactionId: reference,
        reference,
        status: "pending",
        message: "We could not confirm that Lenco received the request. If the member gets a prompt, they can approve it and this payment can be reconciled.",
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
        gatewayStatus: normalizeOptionalString(collection.status),
        status,
        message: getMessageForStatus(status),
        failureReason,
        providerCollection: serializeForCallable(collection),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true}
    );

    if (registrationId) {
      if (status === "completed") {
        await markRegistrationPaid({
          transactionId,
          reference,
          metadata,
          amount,
          currency,
        });
      } else {
        await db.collection(SESSION_REGISTRATIONS_COLLECTION)
          .doc(registrationId)
          .set(
            {
              paymentStatus: status === "failed" ? "failed" : "pending",
              paymentMethod: "mobile_money",
              paymentTransactionId: transactionId,
              paymentReference: reference,
              paymentAmount: amount,
              paymentCurrency: currency,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            {merge: true}
          );
      }
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

export const adminSyncPaymentCollection = onCall(
  {
    cors: true,
    invoker: "public",
    secrets: [lencoSecretKey],
  },
  async (request) => {
    await requireAdminAuth(request.auth?.uid);

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
    const reference =
      normalizeOptionalString(existingTransactionData.reference) ??
      referenceInput ??
      transactionId;

    if (!reference) {
      throw new HttpsError("failed-precondition", "Payment reference is missing.");
    }

    const responseData = await lencoRequest(
      `/collections/status/${reference}`,
      {method: "GET"},
      lencoSecretKey.value()
    );
    const collection = (responseData.data || {}) as Record<string, unknown>;
    const resolvedTransactionId = normalizeOptionalString(collection.id) ??
      transactionId ??
      transactionRecord.snapshot.id;
    const status = mapCollectionStatus(collection.status);
    const failureReason = getFailureReason(collection);
    const amount = getFiniteAmount(collection.amount) ??
      getFiniteAmount(existingTransactionData.amount);
    const currency = normalizeCurrency(
      collection.currency ?? existingTransactionData.currency
    );
    const paymentReference = normalizeOptionalString(collection.reference) ??
      reference;

    await transactionRecord.docRef.set(
      {
        transactionId: resolvedTransactionId,
        reference: paymentReference,
        amount,
        currency,
        gatewayStatus: normalizeOptionalString(collection.status),
        status,
        message: getMessageForStatus(status),
        failureReason,
        providerCollection: serializeForCallable(collection),
        completedAt: status === "completed" ?
          admin.firestore.FieldValue.serverTimestamp() :
          null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true}
    );

    const metadata = existingTransactionData.metadata as
      Partial<SessionPaymentMetadata> | undefined;
    const sessionId = normalizeOptionalString(metadata?.sessionId) ??
      normalizeOptionalString(existingTransactionData.sessionId);
    const registrationId = normalizeOptionalString(metadata?.registrationId) ??
      normalizeOptionalString(existingTransactionData.registrationId);

    if (status === "completed" && sessionId && registrationId) {
      await markRegistrationPaid({
        transactionId: resolvedTransactionId,
        reference: paymentReference,
        metadata: {
          source: "club-bzr-admin",
          sessionId,
          registrationId,
        },
        amount,
        currency,
      });
    }

    if (status === "failed" && registrationId) {
      await db.collection(SESSION_REGISTRATIONS_COLLECTION)
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
      providerCollection: serializeForCallable(collection),
    };
  }
);

export const adminRecordPaymentReturn = onCall(
  {
    cors: true,
    invoker: "public",
  },
  async (request) => {
    const adminUid = await requireAdminAuth(request.auth?.uid);
    const data = (request.data || {}) as AdminRecordPaymentReturnData;
    const amount = requirePositiveAmount(data.amount, "Return amount is required.");
    const reference = normalizePaymentReference(data.reference);
    const transactionId = normalizeOptionalString(data.transactionId);
    const status = normalizeReturnStatus(data.status);

    let transactionRecord: {
      docRef: FirebaseFirestore.DocumentReference;
      snapshot: FirebaseFirestore.DocumentSnapshot;
    } | null = null;

    if (transactionId || reference) {
      transactionRecord = await findSessionPaymentTransaction({
        transactionId,
        reference,
      });
    }

    const transactionData = transactionRecord?.snapshot.data() || {};
    const sessionId = normalizeOptionalString(data.sessionId) ??
      normalizeOptionalString(transactionData.sessionId);
    const registrationId = normalizeOptionalString(data.registrationId) ??
      normalizeOptionalString(transactionData.registrationId);

    if (!sessionId) {
      throw new HttpsError("invalid-argument", "Session ID is required.");
    }

    const currency = normalizeCurrency(data.currency ?? transactionData.currency);
    const returnRef = db.collection(SESSION_PAYMENT_RETURNS_COLLECTION).doc();

    const returnRecord = {
      sessionId,
      registrationId,
      transactionId: transactionId ??
        normalizeOptionalString(transactionData.transactionId) ??
        null,
      reference: reference ??
        normalizeOptionalString(transactionData.reference) ??
        null,
      amount,
      currency,
      method: normalizeReturnMethod(data.method),
      reason: normalizeOptionalString(data.reason) ?? "Admin recorded return",
      externalReference: normalizeOptionalString(data.externalReference),
      status,
      notes: normalizeOptionalString(data.notes),
      recordedBy: adminUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await returnRef.set(returnRecord);

    if (transactionRecord) {
      const transactionPatch: FirebaseFirestore.DocumentData = {
        returnStatus: status,
        lastReturnId: returnRef.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (status === "completed") {
        transactionPatch.returnedAmount =
          admin.firestore.FieldValue.increment(amount);
      }

      await transactionRecord.docRef.set(transactionPatch, {merge: true});
    }

    return {
      success: true,
      returnId: returnRef.id,
      record: {
        id: returnRef.id,
        ...serializeForCallable(returnRecord) as Record<string, unknown>,
      },
    };
  }
);

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
