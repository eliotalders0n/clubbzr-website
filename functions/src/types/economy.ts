export type BalanceBucket = "available" | "locked" | "pending";

export type LedgerTransactionType =
  | "admin_credit"
  | "admin_debit"
  | "peer_transfer"
  | "point_purchase"
  | "point_purchase_refund"
  | "quest_reward"
  | "escrow_lock"
  | "escrow_release"
  | "escrow_refund"
  | "marketplace_purchase";

export interface LedgerEntry {
  accountId: string;
  bucket: BalanceBucket;
  amount: number;
}

export interface LedgerPostInput {
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
