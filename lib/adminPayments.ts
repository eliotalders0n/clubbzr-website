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
  currency: string;
  price: number;
  onlineCollected: number;
  externalCollected: number;
  grossCollected: number;
  pending: number;
  failed: number;
  returned: number;
  netCollected: number;
  transactionCount: number;
  registrationCount: number;
}

export interface AdminPaymentDashboard {
  generatedAt: string;
  filters: AdminPaymentDashboardFilters;
  provider: {
    accounts: Record<string, unknown>[];
    collections: Record<string, unknown>[];
    settlements: Record<string, unknown>[];
    transactions: Record<string, unknown>[];
    withdrawals: Record<string, unknown>[];
    errors: Record<string, string | null>;
  };
  sessions: AdminPaymentSessionSummary[];
  localTransactions: Record<string, unknown>[];
  registrations: Record<string, unknown>[];
  returns: Record<string, unknown>[];
  reconciliation: {
    statusMismatches: Record<string, unknown>[];
    missingProviderCollections: Record<string, unknown>[];
    unmatchedProviderCollections: Record<string, unknown>[];
    issueCount: number;
  };
  totals: {
    onlineCollected: number;
    externalCollected: number;
    grossCollected: number;
    pending: number;
    failed: number;
    returned: number;
    netCollected: number;
    providerSettlements: number;
    providerWithdrawals: number;
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
}

const getAdminPaymentsDashboardFn = httpsCallable<
  AdminPaymentDashboardFilters,
  AdminPaymentDashboard
>(functions, 'adminGetPaymentsDashboard');

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

export async function getAdminPaymentsDashboard(filters: AdminPaymentDashboardFilters = {}) {
  const result = await getAdminPaymentsDashboardFn(filters);
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
