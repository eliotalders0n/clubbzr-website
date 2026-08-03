import { httpsCallable } from 'firebase/functions';

import { functions } from './config';
import type { MobileMoneyOperator, MobileMoneyStatus } from './lenco';

export interface AdminPaymentDashboardFilters {
  sessionId?: string;
  limit?: number;
}

export interface AdminPaymentSessionSummary {
  sessionId: string;
  title: string;
  isDeleted?: boolean;
  currency: string;
  price: number;
  onlineCollected: number;
  externalCollected: number;
  grossCollected: number;
  pending: number;
  failed: number;
  returned: number;
  corrections: number;
  withdrawn: number;
  netCollected: number;
  transactionCount: number;
  registrationCount: number;
}

export interface AdminPaymentRevenuePeriod {
  periodKey: string;
  label: string;
  currency: string;
  onlineCollected: number;
  externalCollected: number;
  grossCollected: number;
  pending: number;
  failed: number;
  returned: number;
  corrections: number;
  withdrawn: number;
  netCollected: number;
  currentBalance: number;
  transactionCount: number;
  registrationCount: number;
}

export interface AdminPaymentDashboard {
  generatedAt: string;
  filters: AdminPaymentDashboardFilters;
  sessions: AdminPaymentSessionSummary[];
  localTransactions: Record<string, unknown>[];
  registrations: Record<string, unknown>[];
  returns: Record<string, unknown>[];
  withdrawals: Record<string, unknown>[];
  revenueTimeline: AdminPaymentRevenuePeriod[];
  reconciliation: {
    transactionStatusIssues: Record<string, unknown>[];
    registrationPaymentIssues: Record<string, unknown>[];
    returnIssues: Record<string, unknown>[];
    issueCount: number;
  };
  totals: {
    onlineCollected: number;
    externalCollected: number;
    grossCollected: number;
    pending: number;
    failed: number;
    returned: number;
    corrections: number;
    withdrawn: number;
    netCollected: number;
    recordedWithdrawals: number;
    pendingWithdrawals: number;
    cancelledWithdrawals: number;
    totalWithdrawals: number;
    completedReturns: number;
  };
  sourceNotes: string[];
}

export interface AdminCollectSessionPaymentInput {
  sessionId: string;
  registrationId?: string;
  phone: string;
  operator: MobileMoneyOperator;
  amount?: number;
  currency?: string;
  displayName?: string;
  email?: string;
  note?: string;
}

export interface AdminPaymentActionResponse {
  success: boolean;
  transactionId?: string;
  reference?: string;
  status?: MobileMoneyStatus;
  message?: string;
  failureReason?: string | null;
  recoverable?: boolean;
  returnId?: string;
  withdrawalId?: string;
  transferId?: string;
  lencoReference?: string | null;
  record?: Record<string, unknown>;
}

export interface AdminRecordPaymentReturnInput {
  sessionId: string;
  registrationId?: string;
  transactionId?: string;
  reference?: string;
  amount: number;
  currency?: string;
  method: 'cash' | 'bank_transfer' | 'mobile_money' | 'card' | 'other';
  reason: string;
  externalReference?: string;
  status: 'pending' | 'completed' | 'cancelled';
  notes?: string;
  origin?: 'manual' | 'cancelled_registration';
  effect?: 'customer_refund' | 'revenue_correction';
}

export interface AdminUpdatePaymentReturnInput {
  returnId: string;
  status: 'completed' | 'cancelled' | 'reversed';
  externalReference?: string;
  notes?: string;
}

export interface AdminCreatePaymentWithdrawalInput {
  recipientUserId?: string;
  phone: string;
  operator: MobileMoneyOperator;
  amount: number;
  currency?: string;
  reason?: string;
  note?: string;
}

export interface AdminResolvePaymentReconciliationIssueInput {
  issueType: 'transaction_signup_status';
  transactionId?: string;
  reference?: string;
  registrationId?: string;
}

const getAdminPaymentsDashboardFn = httpsCallable<
  AdminPaymentDashboardFilters,
  AdminPaymentDashboard
>(functions, 'adminGetPaymentsDashboard');

const resolvePaymentReconciliationIssueFn = httpsCallable<
  AdminResolvePaymentReconciliationIssueInput,
  AdminPaymentActionResponse & { registrationId?: string }
>(functions, 'adminResolvePaymentReconciliationIssue');

const collectSessionPaymentFn = httpsCallable<
  AdminCollectSessionPaymentInput,
  AdminPaymentActionResponse
>(functions, 'adminCollectSessionMobileMoney');

const syncPaymentCollectionFn = httpsCallable<
  { transactionId?: string; reference?: string },
  AdminPaymentActionResponse
>(functions, 'adminSyncPaymentCollection');

const recordPaymentReturnFn = httpsCallable<
  AdminRecordPaymentReturnInput,
  AdminPaymentActionResponse
>(functions, 'adminRecordPaymentReturn');

const updatePaymentReturnFn = httpsCallable<
  AdminUpdatePaymentReturnInput,
  AdminPaymentActionResponse
>(functions, 'adminUpdatePaymentReturn');

const createPaymentWithdrawalFn = httpsCallable<
  AdminCreatePaymentWithdrawalInput,
  AdminPaymentActionResponse
>(functions, 'adminCreatePaymentWithdrawal');

const syncPaymentWithdrawalFn = httpsCallable<
  { withdrawalId?: string; transferId?: string; reference?: string },
  AdminPaymentActionResponse
>(functions, 'adminSyncPaymentWithdrawal');

export async function getAdminPaymentsDashboard(filters: AdminPaymentDashboardFilters = {}) {
  const result = await getAdminPaymentsDashboardFn(filters);
  return result.data;
}

export async function resolvePaymentReconciliationIssue(
  input: AdminResolvePaymentReconciliationIssueInput
) {
  const result = await resolvePaymentReconciliationIssueFn(input);
  return result.data;
}

export async function collectSessionPayment(input: AdminCollectSessionPaymentInput) {
  const result = await collectSessionPaymentFn(input);
  return result.data;
}

export async function syncPaymentCollection(input: { transactionId?: string; reference?: string }) {
  const result = await syncPaymentCollectionFn(input);
  return result.data;
}

export async function recordPaymentReturn(input: AdminRecordPaymentReturnInput) {
  const result = await recordPaymentReturnFn(input);
  return result.data;
}

export async function updatePaymentReturn(input: AdminUpdatePaymentReturnInput) {
  const result = await updatePaymentReturnFn(input);
  return result.data;
}

export async function createPaymentWithdrawal(input: AdminCreatePaymentWithdrawalInput) {
  const result = await createPaymentWithdrawalFn(input);
  return result.data;
}

export async function syncPaymentWithdrawal(input: { withdrawalId?: string; transferId?: string; reference?: string }) {
  const result = await syncPaymentWithdrawalFn(input);
  return result.data;
}
