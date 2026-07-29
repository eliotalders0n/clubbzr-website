import * as admin from "firebase-admin";
import {createHmac, randomBytes, timingSafeEqual} from "node:crypto";
import {defineSecret} from "firebase-functions/params";
import {setGlobalOptions} from "firebase-functions/v2";
import {onDocumentCreated, onDocumentUpdated} from "firebase-functions/v2/firestore";
import {HttpsError, onCall, onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

admin.initializeApp();
setGlobalOptions({maxInstances: 10});

const db = admin.firestore();
const lencoSecretKey = defineSecret("LENCO_SECRET_KEY");
const metaAppSecret = defineSecret("META_APP_SECRET");
const whatsappAccessToken = defineSecret("WHATSAPP_ACCESS_TOKEN");
const whatsappPhoneNumberId = defineSecret("WHATSAPP_PHONE_NUMBER_ID");
const whatsappWebhookVerifyToken = defineSecret("WHATSAPP_WEBHOOK_VERIFY_TOKEN");

const LENCO_API_BASE =
  process.env.LENCO_API_BASE || "https://api.lenco.co/access/v2";
const LENCO_REQUEST_TIMEOUT_MS = 15000;
const WHATSAPP_API_BASE = "https://graph.facebook.com/v25.0";
const WHATSAPP_REQUEST_TIMEOUT_MS = 15000;
const CLUB_BZR_WHATSAPP_BUSINESS_NUMBER = "260960912464";
const WHATSAPP_CONFIRMATION_TEMPLATE_NAME =
  process.env.WHATSAPP_CONFIRMATION_TEMPLATE_NAME || "session_confirmation_v1";
const WHATSAPP_TEMPLATE_LANGUAGE = "en_US";
const DEFAULT_CURRENCY = "ZMW";
const DEFAULT_ADMIN_NOTIFICATION_EMAIL = "clubbzrzm@gmail.com";
const RECOVERABLE_WITHDRAWAL_REQUEST_MESSAGE =
  "Withdrawal request could not be confirmed. " +
  "Sync this withdrawal before retrying.";
const APP_BASE_URL = process.env.APP_BASE_URL || "https://clubbzr.com";
const WHATSAPP_CONFIRMATION_HEADER_IMAGE_URL =
  process.env.WHATSAPP_CONFIRMATION_HEADER_IMAGE_URL ||
  "https://club-bzr.web.app/whatsapp/session-confirmation-header.png";
const SESSIONS_COLLECTION = "sessions";
const SESSION_REGISTRATIONS_COLLECTION = "sessionRegistrations";
const SESSION_PAYMENT_TRANSACTIONS_COLLECTION = "sessionPaymentTransactions";
const SESSION_PAYMENT_RETURNS_COLLECTION = "sessionPaymentReturns";
const SESSION_PAYMENT_WITHDRAWALS_COLLECTION = "sessionPaymentWithdrawals";
const MESSAGE_JOBS_COLLECTION = "messageJobs";
const WHATSAPP_WEBHOOK_EVENTS_COLLECTION = "whatsappWebhookEvents";
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

interface RevenuePeriodSummary {
  periodKey: string;
  label: string;
  currency: string;
  onlineCollected: number;
  externalCollected: number;
  grossCollected: number;
  pending: number;
  failed: number;
  returned: number;
  withdrawn: number;
  netCollected: number;
  transactionCount: number;
  registrationCount: number;
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

interface AdminCreatePaymentWithdrawalData {
  recipientUserId?: string;
  phone?: string;
  operator?: string;
  amount?: number | string;
  currency?: string;
  narration?: string;
  reason?: string;
  note?: string;
  reference?: string;
}

interface AdminSyncPaymentWithdrawalData {
  withdrawalId?: string;
  transferId?: string;
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

interface AdminSendSessionConfirmationWhatsAppData {
  registrationId?: string;
  force?: boolean;
}

interface SessionEmailSummary {
  title: string;
  dateText: string;
  dateOnlyText: string;
  timeText: string;
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

interface QueuedWhatsAppTemplate {
  to: string;
  templateName: string;
  languageCode: string;
  headerImageUrl?: string;
  bodyParameters: string[];
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

/**
 * Formats a Zambian phone number for Lenco transfer requests.
 */
function formatLencoTransferPhoneNumber(value: string): string {
  return `+${formatPhoneNumber(value)}`;
}

function normalizeWhatsAppPhoneNumber(value: unknown): string | null {
  const phone = normalizeOptionalString(value);
  if (!phone) return null;

  try {
    return formatPhoneNumber(phone);
  } catch {
    return null;
  }
}

function mapOperator(value: string): MobileMoneyOperator {
  const operator = value.trim().toLowerCase();
  const operatorMap: Record<string, MobileMoneyOperator> = {
    "mtn": "mtn",
    "mtn zm": "mtn",
    "momo": "mtn",
    "mtn momo": "mtn",
    "mtn mobile money": "mtn",
    "airtel": "airtel",
    "airtel zm": "airtel",
    "airtel money": "airtel",
    "zamtel": "zamtel",
    "zamtel kwacha": "zamtel",
  };
  const mappedOperator = operatorMap[operator];

  if (mappedOperator) return mappedOperator;

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
  return normalizeOptionalString(data.reasonForFailure) ??
    normalizeOptionalString(data.failureReason) ??
    normalizeOptionalString(data.reason) ??
    normalizeOptionalString(data.statusMessage) ??
    normalizeOptionalString(data.responseMessage) ??
    normalizeOptionalString(data.error) ??
    normalizeOptionalString(data.message);
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

function getTransferMessageForStatus(status: PaymentStatus): string {
  if (status === "completed") {
    return "Withdrawal sent successfully.";
  }

  if (status === "failed") {
    return "Withdrawal failed.";
  }

  if (status === "processing") {
    return "Withdrawal is processing in Lenco.";
  }

  return "Withdrawal initiated. Check Lenco status before marking it settled.";
}

function getTransferMessage(status: PaymentStatus, failureReason: string | null): string {
  if (status === "failed" && failureReason) {
    return `Withdrawal failed: ${failureReason}`;
  }

  return getTransferMessageForStatus(status);
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

function getLencoUnauthorizedMessage(path: string): string {
  if (path === "/accounts") {
    return [
      "Lenco rejected the source account lookup.",
      "Set LENCO_DEBIT_ACCOUNT_ID for the Firebase function, or use a Lenco API key that can read accounts.",
    ].join(" ");
  }

  if (path.startsWith("/transfers")) {
    return [
      "Lenco rejected the withdrawal request.",
      "Check that the Lenco API key has transfer permissions and can debit the configured account.",
    ].join(" ");
  }

  return "Lenco rejected the request. Check the Lenco API key and account permissions.";
}

function isGenericLencoUnauthorizedMessage(message: string): boolean {
  return message.trim().toLowerCase() === "unauthorized";
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

function getConfiguredLencoAccountId(): string | null {
  return normalizeOptionalString(process.env.LENCO_DEBIT_ACCOUNT_ID) ??
    normalizeOptionalString(process.env.LENCO_ACCOUNT_ID);
}

function getConfiguredLencoAccountNumber(): string | null {
  return normalizeOptionalString(process.env.LENCO_DEBIT_ACCOUNT_NUMBER) ??
    normalizeOptionalString(process.env.LENCO_ACCOUNT_NUMBER) ??
    normalizeOptionalString(process.env.LENCO_DEBIT_TILL_NUMBER) ??
    normalizeOptionalString(process.env.LENCO_TILL_NUMBER);
}

function getConfiguredLencoAccountName(): string | null {
  return normalizeOptionalString(process.env.LENCO_DEBIT_ACCOUNT_NAME) ??
    normalizeOptionalString(process.env.LENCO_ACCOUNT_NAME);
}

function getRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function getLencoAccountDetails(
  account: Record<string, unknown>
): Record<string, unknown> {
  return getRecord(account.details);
}

function getLencoAccountId(account: Record<string, unknown>): string | null {
  return normalizeOptionalString(account.id) ??
    normalizeOptionalString(account._id);
}

function getLencoAccountDisplayName(
  account: Record<string, unknown>
): string | null {
  const details = getLencoAccountDetails(account);
  return normalizeOptionalString(details.accountName) ??
    normalizeOptionalString(account.accountName) ??
    normalizeOptionalString(account.name);
}

function getLencoAccountNumber(
  account: Record<string, unknown>
): string | null {
  const details = getLencoAccountDetails(account);
  return normalizeOptionalString(details.tillNumber) ??
    normalizeOptionalString(details.accountNumber) ??
    normalizeOptionalString(account.tillNumber) ??
    normalizeOptionalString(account.accountNumber) ??
    normalizeOptionalString(account.number) ??
    normalizeOptionalString(account.accountNo);
}

function getLencoAccountCurrency(
  account: Record<string, unknown>
): string | null {
  const details = getLencoAccountDetails(account);
  return normalizeOptionalString(account.currency) ??
    normalizeOptionalString(details.currency);
}

function isLencoAccountActive(account: Record<string, unknown>): boolean {
  const status = normalizeOptionalString(account.status)?.toLowerCase();
  return status !== "closed" && status !== "deleted" &&
    status !== "disabled";
}

function summarizeLencoAccounts(accounts: Record<string, unknown>[]): string {
  return accounts.map((account) => {
    const id = getLencoAccountId(account) ?? "no-id";
    const name = getLencoAccountDisplayName(account) ?? "Unnamed account";
    const number = getLencoAccountNumber(account) ?? "no-number";
    const currency = getLencoAccountCurrency(account) ?? "no-currency";
    return `${name} / ${number} / ${currency} / ${id}`;
  }).join("; ");
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

function canAutoConfirmPaidRegistration(
  sessionData: FirebaseFirestore.DocumentData
): boolean {
  const approvalMode = normalizeOptionalString(sessionData.approvalMode) ??
    "manual";
  const accessMode = normalizeOptionalString(sessionData.accessMode) ?? "open";
  return approvalMode === "auto" && accessMode === "open";
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

function getLocalPaymentKey(record: Record<string, unknown>): string | null {
  return normalizeOptionalString(record.reference) ??
    normalizeOptionalString(record.paymentReference) ??
    normalizeOptionalString(record.transactionId) ??
    normalizeOptionalString(record.paymentTransactionId) ??
    normalizeOptionalString(record.id);
}

function getRecordDate(
  record: Record<string, unknown>,
  fields: string[]
): Date | null {
  for (const field of fields) {
    const value = record[field];

    if (value instanceof admin.firestore.Timestamp) {
      return value.toDate();
    }

    if (value instanceof Date && Number.isFinite(value.getTime())) {
      return value;
    }

    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      if (Number.isFinite(date.getTime())) return date;
    }
  }

  return null;
}

function getRevenuePeriodKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lusaka",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ??
    String(date.getUTCFullYear());
  const month = parts.find((part) => part.type === "month")?.value ??
    String(date.getUTCMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function getRevenuePeriodLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-ZM", {
    timeZone: "Africa/Lusaka",
    month: "short",
    year: "numeric",
  }).format(date);
}

function buildRevenueTimeline(input: {
  localTransactions: Record<string, unknown>[];
  registrations: Record<string, unknown>[];
  returns: Record<string, unknown>[];
  withdrawals: Record<string, unknown>[];
}): RevenuePeriodSummary[] {
  const periods = new Map<string, RevenuePeriodSummary>();

  const getPeriod = (date: Date, currency: string) => {
    const periodKey = getRevenuePeriodKey(date);
    const existingPeriod = periods.get(periodKey);
    if (existingPeriod) return existingPeriod;

    const period: RevenuePeriodSummary = {
      periodKey,
      label: getRevenuePeriodLabel(date),
      currency,
      onlineCollected: 0,
      externalCollected: 0,
      grossCollected: 0,
      pending: 0,
      failed: 0,
      returned: 0,
      withdrawn: 0,
      netCollected: 0,
      transactionCount: 0,
      registrationCount: 0,
    };

    periods.set(periodKey, period);
    return period;
  };

  input.localTransactions.forEach((transaction) => {
    const date = getRecordDate(transaction, [
      "completedAt",
      "createdAt",
      "updatedAt",
    ]);
    if (!date) return;

    const amount = getFiniteAmount(transaction.amount) ?? 0;
    const currency = normalizeCurrency(transaction.currency);
    const period = getPeriod(date, currency);
    const status = getFallbackPaymentStatus(transaction.status);

    if (status === "completed") {
      period.onlineCollected += amount;
      period.transactionCount += 1;
    } else if (status === "pending" || status === "processing") {
      period.pending += amount;
    } else if (status === "failed") {
      period.failed += amount;
    }
  });

  input.registrations.forEach((registration) => {
    if (registration.paymentStatus !== "paid_external") return;

    const date = getRecordDate(registration, [
      "paidAt",
      "confirmedAt",
      "updatedAt",
      "createdAt",
    ]);
    if (!date) return;

    const amount = getFiniteAmount(registration.paymentAmount) ?? 0;
    const currency = normalizeCurrency(registration.paymentCurrency);
    const period = getPeriod(date, currency);
    period.externalCollected += amount;
    period.registrationCount += 1;
  });

  input.returns.forEach((returnRecord) => {
    if (returnRecord.status !== "completed") return;

    const date = getRecordDate(returnRecord, ["createdAt", "updatedAt"]);
    if (!date) return;

    const amount = getFiniteAmount(returnRecord.amount) ?? 0;
    const currency = normalizeCurrency(returnRecord.currency);
    const period = getPeriod(date, currency);
    period.returned += amount;
  });

  input.withdrawals.forEach((withdrawal) => {
    if (withdrawal.status !== "completed") return;

    const date = getRecordDate(withdrawal, [
      "completedAt",
      "createdAt",
      "updatedAt",
    ]);
    if (!date) return;

    const amount = getFiniteAmount(withdrawal.amount) ?? 0;
    const currency = normalizeCurrency(withdrawal.currency);
    const period = getPeriod(date, currency);
    period.withdrawn += amount;
  });

  return Array.from(periods.values())
    .map((period) => {
      const grossCollected = roundCurrency(
        period.onlineCollected + period.externalCollected
      );

      return {
        ...period,
        onlineCollected: roundCurrency(period.onlineCollected),
        externalCollected: roundCurrency(period.externalCollected),
        grossCollected,
        pending: roundCurrency(period.pending),
        failed: roundCurrency(period.failed),
        returned: roundCurrency(period.returned),
        withdrawn: roundCurrency(period.withdrawn),
        netCollected: roundCurrency(
          grossCollected - period.returned - period.withdrawn
        ),
      };
    })
    .sort((a, b) => b.periodKey.localeCompare(a.periodKey));
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

function formatSessionDateOnly(value: unknown): string {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toLocaleDateString("en-ZM", {
      dateStyle: "medium",
      timeZone: "Africa/Lusaka",
    });
  }

  return "Date to be confirmed";
}

function formatSessionTimeOnly(value: unknown): string {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toLocaleTimeString("en-ZM", {
      timeStyle: "short",
      timeZone: "Africa/Lusaka",
    });
  }

  return "Time to be confirmed";
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
      dateOnlyText: "Date to be confirmed",
      timeText: "Time to be confirmed",
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
    dateOnlyText: formatSessionDateOnly(sessionData.date),
    timeText: formatSessionTimeOnly(sessionData.date),
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

async function whatsappRequest(
  path: string,
  init: RequestInit,
  accessToken: string,
  timeoutMs = WHATSAPP_REQUEST_TIMEOUT_MS
): Promise<Record<string, unknown>> {
  if (!accessToken) {
    throw new HttpsError(
      "failed-precondition",
      "WhatsApp access token is not configured."
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    response = await fetch(`${WHATSAPP_API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      logger.warn("WhatsApp API request timed out", {
        path,
        timeoutMs,
      });
      throw new HttpsError(
        "deadline-exceeded",
        "WhatsApp request timed out."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const parsedResponse = await response.json().catch(() => ({}));
  const responseData = parsedResponse as Record<string, unknown>;

  if (!response.ok) {
    logger.error("WhatsApp API request failed", {
      path,
      status: response.status,
      responseData,
    });

    const errorData = responseData.error as Record<string, unknown> | undefined;
    const providerErrorData = errorData?.error_data as
      Record<string, unknown> | undefined;
    const baseMessage = normalizeOptionalString(errorData?.message) ??
      normalizeOptionalString(responseData.message) ??
      "WhatsApp request failed.";
    const details = normalizeOptionalString(providerErrorData?.details);
    const message = details && details !== baseMessage ?
      `${baseMessage}: ${details}` :
      baseMessage;
    const errorCode: "failed-precondition" | "unavailable" =
      response.status === 408 || response.status === 429 || response.status >= 500 ?
        "unavailable" :
        "failed-precondition";

    throw new HttpsError(errorCode, message);
  }

  return responseData;
}

function getWhatsAppMessageId(responseData: Record<string, unknown>): string | null {
  const messages = responseData.messages;
  if (!Array.isArray(messages)) return null;

  const firstMessage = messages[0] as Record<string, unknown> | undefined;
  return normalizeOptionalString(firstMessage?.id);
}

async function sendWhatsAppTemplate(
  input: QueuedWhatsAppTemplate
): Promise<Record<string, unknown>> {
  const phoneNumberId = whatsappPhoneNumberId.value();
  if (!phoneNumberId) {
    throw new HttpsError(
      "failed-precondition",
      "WhatsApp phone number ID is not configured."
    );
  }

  const components: Record<string, unknown>[] = [];
  if (input.headerImageUrl) {
    components.push({
      type: "header",
      parameters: [
        {
          type: "image",
          image: {
            link: input.headerImageUrl,
          },
        },
      ],
    });
  }

  components.push({
    type: "body",
    parameters: input.bodyParameters.map((text) => ({
      type: "text",
      text,
    })),
  });

  return whatsappRequest(
    `/${phoneNumberId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.to,
        type: "template",
        template: {
          name: input.templateName,
          language: {code: input.languageCode},
          components,
        },
      }),
    },
    whatsappAccessToken.value()
  );
}

function getSessionConfirmationWhatsAppBodyParameters(input: {
  templateName: string;
  memberName: string;
  session: SessionEmailSummary;
  registrationData: FirebaseFirestore.DocumentData;
}): string[] {
  if (input.templateName.endsWith("_v2")) {
    return [
      input.memberName,
      input.session.title,
      input.session.dateOnlyText,
      input.session.timeText,
      input.session.locationText,
      formatMoney(
        input.registrationData.paymentAmount,
        input.registrationData.paymentCurrency
      ),
    ];
  }

  return [
    input.memberName,
    input.session.title,
    input.session.dateText,
  ];
}

async function getRegistrationWhatsAppRecipient(input: {
  registrationId: string;
  registrationData: FirebaseFirestore.DocumentData;
}): Promise<string | null> {
  const userId = normalizeOptionalString(input.registrationData.userId);
  if (userId) {
    const userSnapshot = await db.collection("users").doc(userId).get();
    const userData = userSnapshot.data() || {};
    const userPhone = [
      userData.whatsappPhone,
      userData.phone,
      userData.mobilePhone,
      userData.contactPhone,
    ]
      .map((value) => normalizeWhatsAppPhoneNumber(value))
      .find(Boolean);
    if (userPhone) return userPhone;
  }

  const registrationPhone = [
    input.registrationData.whatsappPhone,
    input.registrationData.phone,
    input.registrationData.mobilePhone,
    input.registrationData.contactPhone,
  ]
    .map((value) => normalizeWhatsAppPhoneNumber(value))
    .find(Boolean);
  if (registrationPhone) return registrationPhone;

  const paymentSnapshot = await db
    .collection(SESSION_PAYMENT_TRANSACTIONS_COLLECTION)
    .where("registrationId", "==", input.registrationId)
    .limit(1)
    .get();

  if (!paymentSnapshot.empty) {
    return normalizeWhatsAppPhoneNumber(paymentSnapshot.docs[0].data().phone);
  }

  return null;
}

async function queueUserConfirmationWhatsApp(input: {
  registrationId: string;
  registrationData: FirebaseFirestore.DocumentData;
  force?: boolean;
}): Promise<{
  status: "sent" | "skipped" | "failed";
  messageId?: string | null;
  reason?: string;
}> {
  const jobRef = db
    .collection(MESSAGE_JOBS_COLLECTION)
    .doc(`whatsapp_session_confirmation_${input.registrationId}`);
  const existingJobSnapshot = await jobRef.get();
  const existingJob = existingJobSnapshot.data() || {};

  if (!input.force && existingJob.status === "sent") {
    return {
      status: "sent",
      messageId: normalizeOptionalString(existingJob.providerMessageId),
    };
  }

  const recipient = await getRegistrationWhatsAppRecipient(input);
  const sessionId = normalizeOptionalString(input.registrationData.sessionId);
  const session = await getSessionEmailSummary(sessionId);
  const memberName = getRegistrationName(input.registrationData);
  const userId = normalizeOptionalString(input.registrationData.userId);
  const metadata = {
    sessionId,
    registrationId: input.registrationId,
    userId,
  };

  if (!recipient) {
    const reason = "No WhatsApp-capable phone number is recorded.";
    await jobRef.set(
      {
        channel: "whatsapp",
        type: "session_confirmation",
        tag: "session_confirmation_user",
        status: "skipped",
        reason,
        from: CLUB_BZR_WHATSAPP_BUSINESS_NUMBER,
        metadata,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: existingJobSnapshot.exists && existingJob.createdAt ?
          existingJob.createdAt :
          admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true}
    );
    await db
      .collection(SESSION_REGISTRATIONS_COLLECTION)
      .doc(input.registrationId)
      .set(
        {
          confirmationWhatsAppSkippedAt:
            admin.firestore.FieldValue.serverTimestamp(),
          confirmationWhatsAppSkipReason: reason,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true}
      );

    return {status: "skipped", reason};
  }

  const message: QueuedWhatsAppTemplate = {
    to: recipient,
    templateName: WHATSAPP_CONFIRMATION_TEMPLATE_NAME,
    languageCode: WHATSAPP_TEMPLATE_LANGUAGE,
    headerImageUrl: WHATSAPP_CONFIRMATION_HEADER_IMAGE_URL,
    bodyParameters: getSessionConfirmationWhatsAppBodyParameters({
      templateName: WHATSAPP_CONFIRMATION_TEMPLATE_NAME,
      memberName,
      session,
      registrationData: input.registrationData,
    }),
    tag: "session_confirmation_user",
    metadata,
  };

  await jobRef.set(
    {
      channel: "whatsapp",
      type: "session_confirmation",
      tag: message.tag,
      status: "sending",
      from: CLUB_BZR_WHATSAPP_BUSINESS_NUMBER,
      to: recipient,
      templateName: message.templateName,
      languageCode: message.languageCode,
      headerImageUrl: message.headerImageUrl,
      bodyParameters: message.bodyParameters,
      metadata,
      attempts: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: existingJobSnapshot.exists && existingJob.createdAt ?
        existingJob.createdAt :
        admin.firestore.FieldValue.serverTimestamp(),
    },
    {merge: true}
  );

  try {
    const responseData = await sendWhatsAppTemplate(message);
    const messageId = getWhatsAppMessageId(responseData);
    const providerMessageIdsPatch = messageId ? {
      providerMessageIds: admin.firestore.FieldValue.arrayUnion(messageId),
    } : {};

    await jobRef.set(
      {
        status: "sent",
        provider: "meta_whatsapp_cloud_api",
        providerMessageId: messageId,
        ...providerMessageIdsPatch,
        providerResponse: serializeForCallable(responseData),
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true}
    );
    await db
      .collection(SESSION_REGISTRATIONS_COLLECTION)
      .doc(input.registrationId)
      .set(
        {
          whatsappPhone: recipient,
          confirmationWhatsAppSentAt:
            admin.firestore.FieldValue.serverTimestamp(),
          confirmationWhatsAppMessageId: messageId,
          confirmationWhatsAppSkippedAt: admin.firestore.FieldValue.delete(),
          confirmationWhatsAppSkipReason: admin.firestore.FieldValue.delete(),
          confirmationWhatsAppFailedAt: admin.firestore.FieldValue.delete(),
          confirmationWhatsAppError: admin.firestore.FieldValue.delete(),
          confirmationWhatsAppDeliveryStatus:
            admin.firestore.FieldValue.delete(),
          confirmationWhatsAppProviderSentAt:
            admin.firestore.FieldValue.delete(),
          confirmationWhatsAppDeliveredAt:
            admin.firestore.FieldValue.delete(),
          confirmationWhatsAppReadAt:
            admin.firestore.FieldValue.delete(),
          confirmationWhatsAppDeliveryFailedAt:
            admin.firestore.FieldValue.delete(),
          confirmationWhatsAppDeliveryError:
            admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true}
      );

    logger.info("Session confirmation WhatsApp accepted by Meta", {
      registrationId: input.registrationId,
      sessionId,
      messageId,
      recipientLast4: recipient.slice(-4),
    });

    return {status: "sent", messageId};
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    await jobRef.set(
      {
        status: "failed",
        lastError: errorMessage,
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true}
    );
    await db
      .collection(SESSION_REGISTRATIONS_COLLECTION)
      .doc(input.registrationId)
      .set(
        {
          confirmationWhatsAppFailedAt:
            admin.firestore.FieldValue.serverTimestamp(),
          confirmationWhatsAppError: errorMessage,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true}
      );
    logger.error("Session confirmation WhatsApp failed", {
      registrationId: input.registrationId,
      sessionId,
      errorMessage,
    });

    return {status: "failed", reason: errorMessage};
  }
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
  timeoutMs = LENCO_REQUEST_TIMEOUT_MS,
  baseUrl = LENCO_API_BASE
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
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${secret}`,
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      logger.warn("Lenco API request timed out", {
        baseUrl,
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

  let responseData: Record<string, unknown>;

  try {
    responseData = await response.json() as Record<string, unknown>;
  } catch {
    logger.error("Lenco API returned invalid JSON", {
      baseUrl,
      path,
      status: response.status,
    });

    throw new HttpsError(
      "unavailable",
      `Lenco returned an invalid response with HTTP status ${response.status}.`
    );
  }

  if (!response.ok || responseData.status === false) {
    logger.error("Lenco API request failed", {
      baseUrl,
      path,
      status: response.status,
      responseData,
    });

    const providerMessage = normalizeOptionalString(responseData.message) ??
      "Lenco request failed.";
    const message = response.status === 401 &&
      isGenericLencoUnauthorizedMessage(providerMessage) ?
      getLencoUnauthorizedMessage(path) :
      providerMessage;

    const errorCode: "failed-precondition" | "unavailable" =
      response.status === 408 || response.status === 429 || response.status >= 500 ?
        "unavailable" :
        "failed-precondition";

    throw new HttpsError(errorCode, message);
  }

  return responseData;
}

async function resolveLencoDebitAccountId(
  secret: string,
  currency: string
): Promise<string> {
  const configuredAccountNumber = getConfiguredLencoAccountNumber();
  const configuredAccountName = getConfiguredLencoAccountName();
  const shouldResolveFromAccounts =
    Boolean(configuredAccountNumber || configuredAccountName);

  if (!shouldResolveFromAccounts) {
    const configuredAccountId = getConfiguredLencoAccountId();
    if (configuredAccountId) return configuredAccountId;
  }

  const responseData = await lencoRequest(
    "/accounts",
    {method: "GET"},
    secret
  );
  const accounts = Array.isArray(responseData.data) ?
    responseData.data as Record<string, unknown>[] :
    [];

  const normalizedCurrency = normalizeCurrency(currency);
  const activeAccounts = accounts.filter(isLencoAccountActive);
  const matchesCurrency = (account: Record<string, unknown>) => {
    const accountCurrency = getLencoAccountCurrency(account);
    return !accountCurrency || accountCurrency.toUpperCase() ===
      normalizedCurrency;
  };
  const accountNumber = configuredAccountNumber?.replace(/\s/g, "");
  const accountName = configuredAccountName?.toLowerCase();
  const matchingConfiguredAccount = accountNumber ?
    activeAccounts.find((account) =>
      getLencoAccountNumber(account)?.replace(/\s/g, "") === accountNumber &&
      matchesCurrency(account)
    ) ??
    activeAccounts.find((account) =>
      getLencoAccountNumber(account)?.replace(/\s/g, "") === accountNumber
    ) :
    accountName ?
      activeAccounts.find((account) =>
        getLencoAccountDisplayName(account)?.toLowerCase() === accountName &&
        matchesCurrency(account)
      ) ??
      activeAccounts.find((account) =>
        getLencoAccountDisplayName(account)?.toLowerCase().includes(accountName)
      ) :
      null;
  const matchingAccount = matchingConfiguredAccount ??
    activeAccounts.find(matchesCurrency) ??
    activeAccounts[0];
  const accountId = getLencoAccountId(matchingAccount ?? {});

  if (shouldResolveFromAccounts && !matchingConfiguredAccount) {
    throw new HttpsError(
      "failed-precondition",
      [
        "Configured Lenco debit account was not returned by /accounts.",
        configuredAccountNumber ?
          `Expected account number ${configuredAccountNumber}.` :
          `Expected account name ${configuredAccountName}.`,
        `Returned accounts: ${summarizeLencoAccounts(activeAccounts)}`,
      ].join(" ")
    );
  }

  if (!accountId) {
    throw new HttpsError(
      "failed-precondition",
      "Lenco source account was not found. Set LENCO_DEBIT_ACCOUNT_ID for this Firebase function."
    );
  }

  return accountId;
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

function extractWhatsAppStatuses(body: unknown): Record<string, unknown>[] {
  const statuses: Record<string, unknown>[] = [];
  const bodyRecord = body as Record<string, unknown>;
  const entries = Array.isArray(bodyRecord.entry) ? bodyRecord.entry : [];

  entries.forEach((entry) => {
    const entryRecord = entry as Record<string, unknown>;
    const changes = Array.isArray(entryRecord.changes) ?
      entryRecord.changes :
      [];

    changes.forEach((change) => {
      const changeRecord = change as Record<string, unknown>;
      const value = changeRecord.value as Record<string, unknown> | undefined;
      const changeStatuses = Array.isArray(value?.statuses) ?
        value?.statuses :
        [];

      changeStatuses.forEach((status) => {
        if (status && typeof status === "object") {
          statuses.push(status as Record<string, unknown>);
        }
      });
    });
  });

  return statuses;
}

function getWhatsAppStatusTimestamp(statusRecord: Record<string, unknown>) {
  const rawTimestamp = statusRecord.timestamp;
  const timestamp = typeof rawTimestamp === "number" ?
    rawTimestamp :
    Number(normalizeOptionalString(rawTimestamp));

  if (Number.isFinite(timestamp) && timestamp > 0) {
    return admin.firestore.Timestamp.fromMillis(timestamp * 1000);
  }

  return admin.firestore.FieldValue.serverTimestamp();
}

function getWhatsAppStatusError(statusRecord: Record<string, unknown>): string {
  const errors = Array.isArray(statusRecord.errors) ?
    statusRecord.errors :
    [];
  const firstError = errors.find((entry) =>
    entry && typeof entry === "object"
  ) as Record<string, unknown> | undefined;

  if (!firstError) {
    return "WhatsApp delivery failed.";
  }

  const rawCode = firstError.code;
  const code = typeof rawCode === "number" ?
    String(rawCode) :
    normalizeOptionalString(rawCode);
  const title = normalizeOptionalString(firstError.title);
  const message = normalizeOptionalString(firstError.message);
  const errorData = firstError.error_data as
    Record<string, unknown> | undefined;
  const details = normalizeOptionalString(errorData?.details);
  const parts = [
    code ? `(#${code})` : null,
    title,
    message && message !== title ? message : null,
    details && details !== message && details !== title ? details : null,
  ].filter(Boolean);

  return parts.join(": ") || "WhatsApp delivery failed.";
}

function getRegistrationIdFromMessageJob(
  jobSnapshot: FirebaseFirestore.QueryDocumentSnapshot
): string | null {
  const jobData = jobSnapshot.data() || {};
  const metadata = jobData.metadata as Record<string, unknown> | undefined;
  const metadataRegistrationId =
    normalizeOptionalString(metadata?.registrationId);
  if (metadataRegistrationId) return metadataRegistrationId;

  const jobPrefix = "whatsapp_session_confirmation_";
  return jobSnapshot.id.startsWith(jobPrefix) ?
    jobSnapshot.id.slice(jobPrefix.length) :
    null;
}

function isValidMetaSignature(input: {
  signatureHeader: string | null;
  rawBody: Buffer | undefined;
  appSecret: string;
}): boolean {
  const signature = input.signatureHeader?.startsWith("sha256=") ?
    input.signatureHeader.slice("sha256=".length) :
    null;

  if (!signature || !input.rawBody || !input.appSecret) {
    return false;
  }

  const expectedSignature = createHmac("sha256", input.appSecret)
    .update(input.rawBody)
    .digest("hex");

  const received = Buffer.from(signature, "hex");
  const expected = Buffer.from(expectedSignature, "hex");

  return received.length === expected.length && timingSafeEqual(received, expected);
}

async function applyWhatsAppStatusUpdates(
  statuses: Record<string, unknown>[]
): Promise<void> {
  await Promise.all(statuses.map(async (statusRecord) => {
    const messageId = normalizeOptionalString(statusRecord.id);
    if (!messageId) return;

    const status = normalizeOptionalString(statusRecord.status) ?? "unknown";
    let matchingJobs = await db
      .collection(MESSAGE_JOBS_COLLECTION)
      .where("providerMessageId", "==", messageId)
      .limit(5)
      .get();

    if (matchingJobs.empty) {
      matchingJobs = await db
        .collection(MESSAGE_JOBS_COLLECTION)
        .where("providerMessageIds", "array-contains", messageId)
        .limit(5)
        .get();
    }

    logger.info("WhatsApp status event received", {
      messageId,
      status,
      matchingJobs: matchingJobs.size,
    });

    await Promise.all(matchingJobs.docs.map((jobSnapshot) => {
      const eventTimestamp = getWhatsAppStatusTimestamp(statusRecord);
      const timestampPatch: Record<string, unknown> = {};
      if (status === "sent") {
        timestampPatch.providerSentAt = eventTimestamp;
      }
      if (status === "delivered") {
        timestampPatch.deliveredAt = eventTimestamp;
      }
      if (status === "read") {
        timestampPatch.readAt = eventTimestamp;
      }
      if (status === "failed") {
        timestampPatch.providerFailedAt = eventTimestamp;
      }

      const statusEvent = serializeForCallable(statusRecord);
      const jobUpdate = jobSnapshot.ref.set(
        {
          deliveryStatus: status,
          recipientId: normalizeOptionalString(statusRecord.recipient_id),
          lastStatusEvent: statusEvent,
          statusEvents: admin.firestore.FieldValue.arrayUnion(
            statusEvent
          ),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...timestampPatch,
        },
        {merge: true}
      );

      const registrationId = getRegistrationIdFromMessageJob(jobSnapshot);
      if (!registrationId) return jobUpdate;

      const registrationPatch: Record<string, unknown> = {
        confirmationWhatsAppDeliveryStatus: status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (status === "sent") {
        registrationPatch.confirmationWhatsAppProviderSentAt = eventTimestamp;
        registrationPatch.confirmationWhatsAppDeliveryFailedAt =
          admin.firestore.FieldValue.delete();
        registrationPatch.confirmationWhatsAppDeliveryError =
          admin.firestore.FieldValue.delete();
      }
      if (status === "delivered") {
        registrationPatch.confirmationWhatsAppDeliveredAt = eventTimestamp;
        registrationPatch.confirmationWhatsAppDeliveryFailedAt =
          admin.firestore.FieldValue.delete();
        registrationPatch.confirmationWhatsAppDeliveryError =
          admin.firestore.FieldValue.delete();
      }
      if (status === "read") {
        registrationPatch.confirmationWhatsAppReadAt = eventTimestamp;
        registrationPatch.confirmationWhatsAppDeliveryFailedAt =
          admin.firestore.FieldValue.delete();
        registrationPatch.confirmationWhatsAppDeliveryError =
          admin.firestore.FieldValue.delete();
      }
      if (status === "failed") {
        registrationPatch.confirmationWhatsAppDeliveryFailedAt =
          eventTimestamp;
        registrationPatch.confirmationWhatsAppDeliveryError =
          getWhatsAppStatusError(statusRecord);
      }

      const registrationUpdate = db
        .collection(SESSION_REGISTRATIONS_COLLECTION)
        .doc(registrationId)
        .set(registrationPatch, {merge: true});

      return Promise.all([jobUpdate, registrationUpdate]);
    }));
  }));
}

export const whatsappWebhook = onRequest(
  {
    invoker: "public",
    secrets: [metaAppSecret, whatsappWebhookVerifyToken],
  },
  async (request, response) => {
    if (request.method === "GET") {
      const mode = normalizeOptionalString(request.query["hub.mode"]);
      const token = normalizeOptionalString(request.query["hub.verify_token"]);
      const challenge = normalizeOptionalString(request.query["hub.challenge"]);

      if (
        mode === "subscribe" &&
        token === whatsappWebhookVerifyToken.value() &&
        challenge
      ) {
        logger.info("WhatsApp webhook verified");
        response.status(200).send(challenge);
        return;
      }

      logger.warn("WhatsApp webhook verification failed", {
        mode,
        hasToken: Boolean(token),
        hasChallenge: Boolean(challenge),
      });
      response.status(403).send("Forbidden");
      return;
    }

    if (request.method === "POST") {
      const signatureHeader = normalizeOptionalString(
        request.get("x-hub-signature-256")
      );
      const rawBody = (request as {rawBody?: Buffer}).rawBody;
      if (!isValidMetaSignature({
        signatureHeader,
        rawBody,
        appSecret: metaAppSecret.value(),
      })) {
        logger.warn("WhatsApp webhook signature verification failed", {
          hasSignature: Boolean(signatureHeader),
          hasRawBody: Boolean(rawBody),
        });
        response.status(403).send("Forbidden");
        return;
      }

      const statuses = extractWhatsAppStatuses(request.body || {});
      await db.collection(WHATSAPP_WEBHOOK_EVENTS_COLLECTION).add({
        body: serializeForCallable(request.body || {}),
        headers: {
          "x-hub-signature-256": signatureHeader,
          "user-agent": normalizeOptionalString(request.get("user-agent")),
        },
        statusCount: statuses.length,
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await applyWhatsAppStatusUpdates(statuses);

      response.status(200).send("EVENT_RECEIVED");
      return;
    }

    response.set("Allow", "GET, POST");
    response.status(405).send("Method Not Allowed");
  }
);

export const adminSendSessionConfirmationWhatsApp = onCall(
  {
    cors: true,
    invoker: "public",
    secrets: [whatsappAccessToken, whatsappPhoneNumberId],
  },
  async (request) => {
    await requireAdminAuth(request.auth?.uid);

    const data = (request.data || {}) as AdminSendSessionConfirmationWhatsAppData;
    const registrationId = requireString(
      data.registrationId,
      "Registration ID is required."
    );
    const registrationSnapshot = await db
      .collection(SESSION_REGISTRATIONS_COLLECTION)
      .doc(registrationId)
      .get();

    if (!registrationSnapshot.exists) {
      throw new HttpsError("not-found", "Session registration not found.");
    }

    const registrationData = registrationSnapshot.data() || {};
    if (registrationData.status !== "confirmed") {
      throw new HttpsError(
        "failed-precondition",
        "WhatsApp confirmation can only be sent to confirmed registrations."
      );
    }

    return queueUserConfirmationWhatsApp({
      registrationId,
      registrationData,
      force: data.force === true,
    });
  }
);

export const notifyAdminsOnSessionRegistration = onDocumentCreated(
  {
    document: `${SESSION_REGISTRATIONS_COLLECTION}/{registrationId}`,
    secrets: [whatsappAccessToken, whatsappPhoneNumberId],
  },
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
      await queueUserConfirmationWhatsApp({registrationId, registrationData});
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
  {
    document: `${SESSION_REGISTRATIONS_COLLECTION}/{registrationId}`,
    secrets: [whatsappAccessToken, whatsappPhoneNumberId],
  },
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
      await queueUserConfirmationWhatsApp({
        registrationId,
        registrationData: afterData,
      });
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

async function findSessionPaymentWithdrawal(input: {
  withdrawalId: string | null;
  transferId: string | null;
  reference: string | null;
}): Promise<{
  docRef: FirebaseFirestore.DocumentReference;
  snapshot: FirebaseFirestore.DocumentSnapshot;
}> {
  const directId = input.withdrawalId ?? input.transferId ?? input.reference;

  if (directId) {
    const docRef = db
      .collection(SESSION_PAYMENT_WITHDRAWALS_COLLECTION)
      .doc(directId);
    const snapshot = await docRef.get();

    if (snapshot.exists) {
      return {docRef, snapshot};
    }
  }

  const candidates = [
    ["withdrawalId", input.withdrawalId],
    ["transferId", input.transferId],
    ["reference", input.reference],
  ] as const;

  for (const [field, value] of candidates) {
    if (!value) continue;

    const querySnapshot = await db
      .collection(SESSION_PAYMENT_WITHDRAWALS_COLLECTION)
      .where(field, "==", value)
      .limit(1)
      .get();

    if (!querySnapshot.empty) {
      return {
        docRef: querySnapshot.docs[0].ref,
        snapshot: querySnapshot.docs[0],
      };
    }
  }

  throw new HttpsError("not-found", "Payment withdrawal not found.");
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
  const sessionRef = db
    .collection(SESSIONS_COLLECTION)
    .doc(input.metadata.sessionId);

  await db.runTransaction(async (transaction) => {
    const registrationSnapshot = await transaction.get(registrationRef);
    const sessionSnapshot = await transaction.get(sessionRef);

    if (!registrationSnapshot.exists) {
      throw new HttpsError("not-found", "Session registration not found.");
    }

    if (!sessionSnapshot.exists) {
      throw new HttpsError("not-found", "Session not found.");
    }

    const registrationData = registrationSnapshot.data() || {};
    const sessionData = sessionSnapshot.data() || {};

    if (registrationData.sessionId !== input.metadata.sessionId) {
      throw new HttpsError(
        "invalid-argument",
        "Registration does not belong to this session."
      );
    }

    const userId = normalizeOptionalString(registrationData.userId);
    const attendees = Array.isArray(sessionData.attendees) ?
      sessionData.attendees :
      [];
    const alreadyConfirmed = registrationData.status === "confirmed";
    const alreadyAttending = userId ? attendees.includes(userId) : false;
    const capacity = Number(sessionData.capacity);
    const hasCapacity = alreadyAttending ||
      (Number.isFinite(capacity) && capacity > attendees.length);
    const shouldConfirm = alreadyConfirmed ||
      (canAutoConfirmPaidRegistration(sessionData) && hasCapacity);

    const registrationPatch: FirebaseFirestore.DocumentData = {
      status: shouldConfirm ? "confirmed" : "paid_pending_confirmation",
      paymentStatus: "paid_online",
      paymentMethod: "mobile_money",
      paymentTransactionId: input.transactionId,
      paymentReference: input.reference,
      paymentAmount: input.amount,
      paymentCurrency: input.currency,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (shouldConfirm && !registrationData.confirmedAt) {
      registrationPatch.confirmedAt =
        admin.firestore.FieldValue.serverTimestamp();
      registrationPatch.confirmedBy = "lenco";
    }

    transaction.set(registrationRef, registrationPatch, {merge: true});

    if (shouldConfirm && userId) {
      transaction.set(
        sessionRef,
        {
          attendees: admin.firestore.FieldValue.arrayUnion(userId),
          waitlist: admin.firestore.FieldValue.arrayRemove(userId),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true}
      );
    }
  });
}

export const adminGetPaymentsDashboard = onCall(
  {
    cors: true,
    invoker: "public",
    timeoutSeconds: 30,
  },
  async (request) => {
    await requireAdminAuth(request.auth?.uid);

    const data = (request.data || {}) as AdminPaymentsDashboardData;
    const sessionId = normalizeOptionalString(data.sessionId);
    const limitCount = Math.min(Math.max(Number(data.limit) || 500, 25), 1000);

    let transactionQuery: FirebaseFirestore.Query = db
      .collection(SESSION_PAYMENT_TRANSACTIONS_COLLECTION);
    let registrationQuery: FirebaseFirestore.Query = db
      .collection(SESSION_REGISTRATIONS_COLLECTION);
    let returnQuery: FirebaseFirestore.Query = db
      .collection(SESSION_PAYMENT_RETURNS_COLLECTION);
    let withdrawalQuery: FirebaseFirestore.Query = db
      .collection(SESSION_PAYMENT_WITHDRAWALS_COLLECTION);

    if (sessionId) {
      transactionQuery = transactionQuery.where("sessionId", "==", sessionId);
      registrationQuery = registrationQuery.where("sessionId", "==", sessionId);
      returnQuery = returnQuery.where("sessionId", "==", sessionId);
      withdrawalQuery = withdrawalQuery.where("sessionId", "==", sessionId);
    } else {
      transactionQuery = transactionQuery
        .orderBy("createdAt", "desc")
        .limit(limitCount);
      registrationQuery = registrationQuery.limit(1000);
      returnQuery = returnQuery.orderBy("createdAt", "desc").limit(limitCount);
      withdrawalQuery = withdrawalQuery
        .orderBy("createdAt", "desc")
        .limit(limitCount);
    }

    const sessionPromise = sessionId ?
      db.collection(SESSIONS_COLLECTION).doc(sessionId).get() :
      db.collection(SESSIONS_COLLECTION).limit(500).get();

    const [
      transactionSnapshot,
      registrationSnapshot,
      returnSnapshot,
      withdrawalSnapshot,
      sessionResult,
    ] = await Promise.all([
      transactionQuery.get(),
      registrationQuery.get(),
      returnQuery.get(),
      withdrawalQuery.get(),
      sessionPromise,
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
    const withdrawals = withdrawalSnapshot.docs.map((snapshot) =>
      snapshotToCallableObject(snapshot)
    );

    const localTransactionsByKey = new Map<string, Record<string, unknown>>();
    localTransactions.forEach((transaction) => {
      const key = getLocalPaymentKey(transaction);
      if (key) localTransactionsByKey.set(key, transaction);
    });

    const registrationsById = new Map<string, Record<string, unknown>>();
    registrations.forEach((registration) => {
      const id = normalizeOptionalString(registration.id);
      if (id) registrationsById.set(id, registration);
    });

    const transactionStatusIssues: Record<string, unknown>[] = [];
    localTransactions.forEach((transaction) => {
      if (getFallbackPaymentStatus(transaction.status) !== "completed") return;

      const registrationId = normalizeOptionalString(transaction.registrationId);
      if (!registrationId) return;

      const registration = registrationsById.get(registrationId);
      const registrationStatus = normalizeOptionalString(registration?.status);
      const paymentStatus = normalizeOptionalString(registration?.paymentStatus);
      const paymentStateMatches = paymentStatus === "paid_online" ||
        paymentStatus === "paid_external";
      const signupStateMatches = registrationStatus === "paid_pending_confirmation" ||
        registrationStatus === "confirmed";

      if (!registration || !paymentStateMatches || !signupStateMatches) {
        transactionStatusIssues.push({
          reference: getLocalPaymentKey(transaction),
          transaction,
          registration: registration ?? null,
        });
      }
    });

    const registrationPaymentIssues: Record<string, unknown>[] = [];
    registrations.forEach((registration) => {
      if (normalizeOptionalString(registration.paymentStatus) !== "paid_online") {
        return;
      }

      const key = getLocalPaymentKey(registration);
      const transaction = key ? localTransactionsByKey.get(key) : undefined;
      if (!transaction ||
        getFallbackPaymentStatus(transaction.status) !== "completed") {
        registrationPaymentIssues.push({
          reference: key,
          registration,
          transaction: transaction ?? null,
        });
      }
    });

    const returnIssues: Record<string, unknown>[] = [];
    returns.forEach((returnRecord) => {
      if (normalizeOptionalString(returnRecord.status) !== "completed") return;

      const key = getLocalPaymentKey(returnRecord);
      const transaction = key ? localTransactionsByKey.get(key) : undefined;
      const returnedAmount = getFiniteAmount(returnRecord.amount) ?? 0;
      const paidAmount = transaction ?
        getFiniteAmount(transaction.amount) ?? 0 :
        0;

      if (!transaction || returnedAmount > paidAmount) {
        returnIssues.push({
          reference: key,
          returnRecord,
          transaction: transaction ?? null,
        });
      }
    });

    const sessionsById = new Map<string, Record<string, unknown>>();
    sessions.forEach((session) => {
      const id = normalizeOptionalString(session.id);
      if (id) sessionsById.set(id, session);
    });

    const ledgerSessionIds = new Set<string>();
    if (sessionId) ledgerSessionIds.add(sessionId);
    sessionsById.forEach((_session, id) => ledgerSessionIds.add(id));
    [
      ...localTransactions,
      ...registrations,
      ...returns,
      ...withdrawals,
    ].forEach((record) => {
      const id = normalizeOptionalString(record.sessionId);
      if (id) ledgerSessionIds.add(id);
    });

    const sessionSummaries = Array.from(ledgerSessionIds).map((id) => {
      const session = sessionsById.get(id);
      const sessionTransactions = localTransactions.filter((transaction) =>
        normalizeOptionalString(transaction.sessionId) === id
      );
      const sessionRegistrations = registrations.filter((registration) =>
        normalizeOptionalString(registration.sessionId) === id
      );
      const sessionReturns = returns.filter((returnRecord) =>
        normalizeOptionalString(returnRecord.sessionId) === id
      );
      const sessionWithdrawals = withdrawals.filter((withdrawal) =>
        normalizeOptionalString(withdrawal.sessionId) === id
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
      const withdrawn = sessionWithdrawals
        .filter((withdrawal) => withdrawal.status === "completed")
        .reduce((sum, withdrawal) => sum + (getFiniteAmount(withdrawal.amount) ?? 0), 0);
      const fallbackCurrency = sessionTransactions
        .map((transaction) => normalizeOptionalString(transaction.currency))
        .find(Boolean) ??
        sessionRegistrations
          .map((registration) =>
            normalizeOptionalString(registration.paymentCurrency)
          )
          .find(Boolean) ??
        sessionReturns
          .map((returnRecord) => normalizeOptionalString(returnRecord.currency))
          .find(Boolean) ??
        sessionWithdrawals
          .map((withdrawal) => normalizeOptionalString(withdrawal.currency))
          .find(Boolean);
      const fallbackPrice = sessionRegistrations
        .map((registration) => getFiniteAmount(registration.paymentAmount))
        .find((amount) => amount !== null) ??
        sessionTransactions
          .map((transaction) => getFiniteAmount(transaction.amount))
          .find((amount) => amount !== null) ??
        0;

      return {
        sessionId: id,
        title: session ?
          normalizeOptionalString(session.title) ?? "Untitled session" :
          `Deleted session (${id.slice(0, 8)})`,
        isDeleted: !session,
        currency: normalizeCurrency(session?.currency ?? fallbackCurrency),
        price: getFiniteAmount(session?.price) ?? fallbackPrice,
        onlineCollected: roundCurrency(onlineCollected),
        externalCollected: roundCurrency(externalCollected),
        grossCollected: roundCurrency(onlineCollected + externalCollected),
        pending: roundCurrency(pending),
        failed: roundCurrency(failed),
        returned: roundCurrency(returned),
        withdrawn: roundCurrency(withdrawn),
        netCollected: roundCurrency(
          onlineCollected + externalCollected - returned - withdrawn
        ),
        transactionCount: sessionTransactions.length,
        registrationCount: sessionRegistrations.length,
      };
    });

    const recordedWithdrawalTotal = withdrawals
      .filter((withdrawal) => withdrawal.status === "completed")
      .reduce(
        (sum, withdrawal) => sum + (getFiniteAmount(withdrawal.amount) ?? 0),
        0
      );
    const pendingWithdrawalTotal = withdrawals
      .filter((withdrawal) => {
        const status = getFallbackPaymentStatus(withdrawal.status);
        return status === "pending" || status === "processing";
      })
      .reduce(
        (sum, withdrawal) => sum + (getFiniteAmount(withdrawal.amount) ?? 0),
        0
      );
    const cancelledWithdrawalTotal = withdrawals
      .filter((withdrawal) => withdrawal.status === "cancelled")
      .reduce(
        (sum, withdrawal) => sum + (getFiniteAmount(withdrawal.amount) ?? 0),
        0
      );
    const withdrawalTotal = withdrawals.reduce(
      (sum, withdrawal) => sum + (getFiniteAmount(withdrawal.amount) ?? 0),
      0
    );
    const completedReturnTotal = returns
      .filter((returnRecord) => returnRecord.status === "completed")
      .reduce((sum, returnRecord) => sum + (getFiniteAmount(returnRecord.amount) ?? 0), 0);
    const revenueTimeline = buildRevenueTimeline({
      localTransactions,
      registrations,
      returns,
      withdrawals,
    });

    const totals = sessionSummaries.reduce(
      (summary, session) => ({
        onlineCollected: summary.onlineCollected + Number(session.onlineCollected),
        externalCollected: summary.externalCollected + Number(session.externalCollected),
        grossCollected: summary.grossCollected + Number(session.grossCollected),
        pending: summary.pending + Number(session.pending),
        failed: summary.failed + Number(session.failed),
        returned: summary.returned + Number(session.returned),
        withdrawn: summary.withdrawn + Number(session.withdrawn),
        netCollected: summary.netCollected + Number(session.netCollected),
      }),
      {
        onlineCollected: 0,
        externalCollected: 0,
        grossCollected: 0,
        pending: 0,
        failed: 0,
        returned: 0,
        withdrawn: 0,
        netCollected: 0,
      }
    );
    const grossCollectedTotal = roundCurrency(
      totals.onlineCollected + totals.externalCollected
    );
    const netCollectedTotal = roundCurrency(
      grossCollectedTotal - completedReturnTotal - recordedWithdrawalTotal
    );

    return {
      generatedAt: new Date().toISOString(),
      filters: {sessionId, limit: limitCount},
      sessions: sessionSummaries.sort((a, b) =>
        Number(b.netCollected) - Number(a.netCollected)
      ),
      localTransactions,
      registrations,
      returns,
      withdrawals,
      revenueTimeline,
      reconciliation: {
        transactionStatusIssues,
        registrationPaymentIssues,
        returnIssues,
        issueCount: transactionStatusIssues.length +
          registrationPaymentIssues.length +
          returnIssues.length,
      },
      totals: {
        onlineCollected: roundCurrency(totals.onlineCollected),
        externalCollected: roundCurrency(totals.externalCollected),
        grossCollected: grossCollectedTotal,
        pending: roundCurrency(totals.pending),
        failed: roundCurrency(totals.failed),
        returned: roundCurrency(completedReturnTotal),
        withdrawn: roundCurrency(recordedWithdrawalTotal),
        netCollected: netCollectedTotal,
        recordedWithdrawals: roundCurrency(recordedWithdrawalTotal),
        pendingWithdrawals: roundCurrency(pendingWithdrawalTotal),
        cancelledWithdrawals: roundCurrency(cancelledWithdrawalTotal),
        totalWithdrawals: roundCurrency(withdrawalTotal),
        completedReturns: roundCurrency(completedReturnTotal),
      },
      sourceNotes: [
        "Dashboard totals come from Firestore ledger records.",
        "Lenco is only contacted for explicit payment actions and manual payment syncs.",
        "Provider-wide accounts, settlements, and transactions are not loaded here.",
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
            country: "zm",
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

export const adminCreatePaymentWithdrawal = onCall(
  {
    cors: true,
    invoker: "public",
    secrets: [lencoSecretKey],
  },
  async (request) => {
    const adminUid = await requireAdminAuth(request.auth?.uid);
    const data = (request.data || {}) as AdminCreatePaymentWithdrawalData;
    const recipientUserId = normalizeOptionalString(data.recipientUserId);
    const amount = requirePositiveAmount(
      data.amount,
      "Withdrawal amount is required."
    );
    const currency = normalizeCurrency(data.currency);
    const operator = mapOperator(
      requireString(data.operator, "Mobile money operator is required.")
    );

    let recipientUserData: FirebaseFirestore.DocumentData | null = null;
    if (recipientUserId) {
      const recipientSnapshot = await db.collection("users")
        .doc(recipientUserId)
        .get();

      if (!recipientSnapshot.exists) {
        throw new HttpsError("not-found", "Admin recipient not found.");
      }

      recipientUserData = recipientSnapshot.data() || {};
      if (recipientUserData.role !== "admin") {
        throw new HttpsError(
          "permission-denied",
          "Withdrawals can only be sent to admin recipients."
        );
      }
    }

    const recipientPhone = normalizeOptionalString(data.phone) ??
      normalizeOptionalString(recipientUserData?.whatsappPhone) ??
      normalizeOptionalString(recipientUserData?.phone);
    const phone = formatPhoneNumber(
      requireString(recipientPhone, "Withdrawal phone number is required.")
    );
    const transferPhone = formatLencoTransferPhoneNumber(phone);
    const reference = normalizePaymentReference(data.reference) ??
      generateReference();
    const reason = normalizeOptionalString(data.reason) ??
      normalizeOptionalString(data.narration) ??
      "Admin withdrawal";
    const narration = normalizeOptionalString(data.narration) ?? reason;
    const note = normalizeOptionalString(data.note);
    const lencoAccountId = await resolveLencoDebitAccountId(
      lencoSecretKey.value(),
      currency
    );
    const withdrawalRef = db
      .collection(SESSION_PAYMENT_WITHDRAWALS_COLLECTION)
      .doc(reference);
    const existingWithdrawalSnapshot = await withdrawalRef.get();

    if (existingWithdrawalSnapshot.exists) {
      const existingWithdrawal = existingWithdrawalSnapshot.data() || {};
      const existingStatus = getFallbackPaymentStatus(
        existingWithdrawal.status
      );
      const existingFailureReason =
        normalizeOptionalString(existingWithdrawal.failureReason);
      const existingWithdrawalId =
        normalizeOptionalString(existingWithdrawal.withdrawalId) ?? reference;
      return {
        success: existingStatus !== "failed",
        withdrawalId: existingWithdrawalId,
        transferId: normalizeOptionalString(existingWithdrawal.transferId),
        reference,
        status: existingStatus,
        message: normalizeOptionalString(existingWithdrawal.message) ??
          getTransferMessage(existingStatus, existingFailureReason),
        failureReason: existingFailureReason,
      };
    }

    await withdrawalRef.set(
      {
        withdrawalId: reference,
        reference,
        transferId: null,
        lencoAccountId,
        provider: "lenco",
        method: "mobile_money",
        direction: "transfer",
        recipientUserId: recipientUserId ?? null,
        recipientDisplayName: normalizeOptionalString(
          recipientUserData?.displayName
        ),
        recipientEmail: normalizeOptionalString(recipientUserData?.email),
        phone,
        providerPhone: transferPhone,
        operator,
        amount,
        currency,
        reason,
        narration,
        note,
        gatewayStatus: "request_started",
        status: "pending",
        message: getTransferMessageForStatus("pending"),
        failureReason: null,
        initiatedBy: adminUid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true}
    );

    let responseData: Record<string, unknown>;
    try {
      responseData = await lencoRequest(
        "/transfers/mobile-money",
        {
          method: "POST",
          body: JSON.stringify({
            accountId: lencoAccountId,
            amount: amount.toFixed(2),
            narration,
            reference,
            phone: transferPhone,
            operator,
            country: "zm",
          }),
        },
        lencoSecretKey.value()
      );
    } catch (transferError) {
      const errorMessage = getErrorMessage(transferError);
      const isRecoverable = isRecoverablePaymentProviderError(transferError);

      await withdrawalRef.set(
        {
          status: isRecoverable ? "pending" : "failed",
          gatewayStatus: "request_error",
          message: isRecoverable ?
            RECOVERABLE_WITHDRAWAL_REQUEST_MESSAGE :
            getTransferMessage("failed", errorMessage),
          failureReason: isRecoverable ? null : errorMessage,
          transferRequestError: errorMessage,
          lastStatusCheckFailedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true}
      );

      if (!isRecoverable) {
        throw transferError;
      }

      return {
        success: false,
        withdrawalId: reference,
        reference,
        status: "pending",
        message: RECOVERABLE_WITHDRAWAL_REQUEST_MESSAGE,
        failureReason: null,
        recoverable: true,
      };
    }

    const transfer = (responseData.data || {}) as Record<string, unknown>;
    const providerReference = normalizeOptionalString(transfer.reference) ??
      reference;
    const transferId = normalizeOptionalString(transfer.id) ??
      normalizeOptionalString(transfer._id) ??
      normalizeOptionalString(transfer.transferId) ??
      providerReference;
    const lencoReference =
      normalizeOptionalString(transfer.lencoReference) ??
      normalizeOptionalString(transfer.lenco_reference);
    const status = mapCollectionStatus(transfer.status);
    const failureReason = getFailureReason(transfer);

    await withdrawalRef.set(
      {
        withdrawalId: transferId,
        transferId,
        reference: providerReference,
        lencoReference: lencoReference ?? null,
        providerReference,
        gatewayStatus: normalizeOptionalString(transfer.status),
        status,
        message: getTransferMessage(status, failureReason),
        failureReason,
        providerTransfer: serializeForCallable(transfer),
        completedAt: status === "completed" ?
          admin.firestore.FieldValue.serverTimestamp() :
          null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true}
    );

    return {
      success: status !== "failed",
      withdrawalId: transferId,
      transferId,
      reference: providerReference,
      lencoReference: lencoReference ?? null,
      status,
      message: getTransferMessage(status, failureReason),
      failureReason,
    };
  }
);

export const adminSyncPaymentWithdrawal = onCall(
  {
    cors: true,
    invoker: "public",
    secrets: [lencoSecretKey],
  },
  async (request) => {
    await requireAdminAuth(request.auth?.uid);

    const data = (request.data || {}) as AdminSyncPaymentWithdrawalData;
    const withdrawalId = normalizeOptionalString(data.withdrawalId);
    const transferId = normalizeOptionalString(data.transferId);
    const referenceInput = normalizeOptionalString(data.reference);

    if (!withdrawalId && !transferId && !referenceInput) {
      throw new HttpsError(
        "invalid-argument",
        "Withdrawal ID, transfer ID, or reference is required."
      );
    }

    const withdrawalRecord = await findSessionPaymentWithdrawal({
      withdrawalId,
      transferId,
      reference: referenceInput,
    });
    const existingWithdrawalData = withdrawalRecord.snapshot.data() || {};
    const reference =
      normalizeOptionalString(existingWithdrawalData.reference) ??
      referenceInput ??
      transferId ??
      withdrawalId;

    if (!reference) {
      throw new HttpsError(
        "failed-precondition",
        "Withdrawal reference is missing."
      );
    }

    const responseData = await lencoRequest(
      `/transfers/status/${encodeURIComponent(reference)}`,
      {method: "GET"},
      lencoSecretKey.value()
    );
    const transfer = (responseData.data || {}) as Record<string, unknown>;
    const resolvedTransferId = normalizeOptionalString(transfer.id) ??
      normalizeOptionalString(transfer._id) ??
      normalizeOptionalString(transfer.transferId) ??
      transferId ??
      withdrawalRecord.snapshot.id;
    const status = mapCollectionStatus(transfer.status);
    const failureReason = getFailureReason(transfer);
    const amount = getFiniteAmount(transfer.amount) ??
      getFiniteAmount(existingWithdrawalData.amount);
    const currency = normalizeCurrency(
      transfer.currency ?? existingWithdrawalData.currency
    );
    const paymentReference = normalizeOptionalString(transfer.reference) ??
      reference;
    const lencoReference =
      normalizeOptionalString(transfer.lencoReference) ??
      normalizeOptionalString(transfer.lenco_reference);

    await withdrawalRecord.docRef.set(
      {
        withdrawalId: resolvedTransferId,
        transferId: resolvedTransferId,
        reference: paymentReference,
        amount,
        currency,
        lencoReference: lencoReference ?? null,
        providerReference: paymentReference,
        gatewayStatus: normalizeOptionalString(transfer.status),
        status,
        message: getTransferMessage(status, failureReason),
        failureReason,
        providerTransfer: serializeForCallable(transfer),
        completedAt: status === "completed" ?
          admin.firestore.FieldValue.serverTimestamp() :
          null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true}
    );

    return {
      success: status !== "failed",
      withdrawalId: resolvedTransferId,
      transferId: resolvedTransferId,
      reference: paymentReference,
      lencoReference: lencoReference ?? null,
      status,
      message: getTransferMessage(status, failureReason),
      failureReason,
      providerTransfer: serializeForCallable(transfer),
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
