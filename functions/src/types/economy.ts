export type BalanceBucket = "available" | "locked" | "pending" | "payout_pending" | "paid" | "reversed";

export type LedgerTransactionType =
  | "admin_credit"
  | "admin_debit"
  | "peer_transfer"
  | "point_purchase"
  | "point_purchase_refund"
  | "quest_reward"
  | "session_payment_reward"
  | "escrow_lock"
  | "escrow_release"
  | "escrow_refund"
  | "marketplace_purchase"
  | "store_provider_fee"
  | "store_collection" | "store_release" | "store_refund_hold" | "store_refund"
  | "store_payout_lock" | "store_payout_paid" | "store_payout_failed";

export interface LedgerEntry {
  accountId: string;
  bucket: BalanceBucket;
  amount: number;
}

export interface LedgerPostInput {
  currency?: "POINT" | "ZMW";
  transactionId: string;
  type: LedgerTransactionType;
  status: "completed" | "failed" | "reversed";
  senderWalletId: string | null;
  receiverWalletId: string | null;
  participants: string[];
  amount: number;
  fee: number;
  referenceType: string;
  referenceId: string;
  createdBy: string;
  idempotencyKey: string;
  entries: LedgerEntry[];
  metadata?: Record<string, unknown>;
  auditData?: Record<string, unknown>;
  reversesTransactionId?: string;
  usageLimit?: {
    documentId: string;
    userId: string;
    field: string;
    increment: number;
    maximum: number;
    period: string;
  };
  documentPreconditions?: Array<{
    collection: string;
    id: string;
    field: string;
    equals: unknown | unknown[];
  }>;
  linkedWrites?: Array<{
    collection: string;
    id: string;
    mode: "create" | "set" | "update";
    data: Record<string, unknown>;
  }>;
}

export interface BalanceRecord {
  payout_pending: number;
  paid: number;
  reversed: number;
  walletId: string;
  available: number;
  locked: number;
  pending: number;
  total: number;
  ledgerSequence: number;
  lifetimeEarned: number;
  lifetimePurchased: number;
  lifetimeSpent: number;
  lifetimeTransferredIn: number;
  lifetimeTransferredOut: number;
}
