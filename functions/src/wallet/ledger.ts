import {HttpsError} from "firebase-functions/v2/https";

import {admin, db} from "../core/firebase";
import type {
  BalanceBucket,
  BalanceRecord,
  LedgerPostInput,
} from "../types/economy";

const emptyBalance = (walletId: string): BalanceRecord => ({
  walletId,
  payout_pending: 0, paid: 0, reversed: 0,
  available: 0,
  locked: 0,
  pending: 0,
  total: 0,
  ledgerSequence: 0,
  lifetimeEarned: 0,
  lifetimePurchased: 0,
  lifetimeSpent: 0,
  lifetimeTransferredIn: 0,
  lifetimeTransferredOut: 0,
});

function isSystemAccount(accountId: string): boolean {
  return accountId.startsWith("__system_");
}

function assertLedgerInput(input: LedgerPostInput): void {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new HttpsError("invalid-argument", "Ledger amount is invalid.");
  }
  if (!Number.isSafeInteger(input.fee) || input.fee < 0) {
    throw new HttpsError("invalid-argument", "Ledger fee is invalid.");
  }
  if (input.entries.length < 2 || input.entries.length > 8) {
    throw new HttpsError("invalid-argument", "Ledger entries are invalid.");
  }

  if ((input.currency || "POINT") === "POINT" && input.entries.some((entry) => !["available", "locked", "pending"].includes(entry.bucket))) {
    throw new HttpsError("invalid-argument", "Invalid Points bucket.");
  }
  if (input.entries.some((entry) => !Number.isSafeInteger(entry.amount))) throw new HttpsError("invalid-argument", "Ledger entries must be safe integers.");
  const sum = input.entries.reduce((total, entry) => total + BigInt(entry.amount), BigInt(0));
  if (sum !== BigInt(0) || input.entries.some((entry) => !Number.isSafeInteger(entry.amount))) {
    throw new HttpsError("internal", "Ledger entries do not balance.");
  }
}

export async function postLedgerTransaction(
  input: LedgerPostInput,
  outerTransaction?: FirebaseFirestore.Transaction
): Promise<{transactionId: string; duplicate: boolean}> {
  assertLedgerInput(input);
  const transactionRef = db.collection("transactions").doc(input.transactionId);

  const currency = input.currency || "POINT";
  const projection = currency === "ZMW" ? "sellerPayables" : "balances";
  const execute = async (transaction: FirebaseFirestore.Transaction) => {
    const existing = await transaction.get(transactionRef);
    if (existing.exists) {
      const current = existing.data() || {};
      const sameParticipants = JSON.stringify(
        [...(current.participants || [])].sort()
      ) === JSON.stringify([...input.participants].sort());
      if (
        (current.currency || "POINT") !== currency ||
        current.type !== input.type ||
        current.amount !== input.amount ||
        current.fee !== input.fee ||
        current.senderWalletId !== input.senderWalletId ||
        current.receiverWalletId !== input.receiverWalletId ||
        current.referenceId !== input.referenceId ||
        !sameParticipants
      ) {
        throw new HttpsError(
          "already-exists",
          "Idempotency key was already used for a different transaction."
        );
      }
      return {transactionId: input.transactionId, duplicate: true};
    }

    const entryGroups = new Map<string, Map<BalanceBucket, number>>();
    for (const entry of input.entries) {
      const buckets = entryGroups.get(entry.accountId) || new Map();
      buckets.set(entry.bucket, (buckets.get(entry.bucket) || 0) + entry.amount);
      entryGroups.set(entry.accountId, buckets);
    }

    const balanceSnapshots = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    for (const accountId of entryGroups.keys()) {
      const ref = db.collection(projection).doc(accountId);
      balanceSnapshots.set(accountId, await transaction.get(ref));
    }

    const usageRef = input.usageLimit ?
      db.collection("walletUsage").doc(input.usageLimit.documentId) : null;
    const usageSnapshot = usageRef ? await transaction.get(usageRef) : null;
    const preconditionSnapshots = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    for (const condition of input.documentPreconditions || []) {
      const key = `${condition.collection}/${condition.id}`;
      if (!preconditionSnapshots.has(key)) {
        preconditionSnapshots.set(
          key,
          await transaction.get(db.collection(condition.collection).doc(condition.id))
        );
      }
    }

    for (const condition of input.documentPreconditions || []) {
      const value = preconditionSnapshots
        .get(`${condition.collection}/${condition.id}`)?.data()?.[condition.field];
      const allowed = Array.isArray(condition.equals) ?
        condition.equals.includes(value) : value === condition.equals;
      if (!allowed) {
        throw new HttpsError("failed-precondition", "Related record changed. Refresh and retry.");
      }
    }

    if (input.usageLimit && usageRef) {
      const current = Number(usageSnapshot?.data()?.[input.usageLimit.field] || 0);
      const next = current + input.usageLimit.increment;
      if (!Number.isSafeInteger(next) || next > input.usageLimit.maximum) {
        throw new HttpsError("resource-exhausted", "Daily transfer limit reached.");
      }
      transaction.set(usageRef, {
        userId: input.usageLimit.userId,
        period: input.usageLimit.period,
        [input.usageLimit.field]: next,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(usageSnapshot?.exists ? {} : {
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }),
      }, {merge: true});
    }

    for (const [accountId, buckets] of entryGroups) {
      const ref = db.collection(projection).doc(accountId);
      const snapshot = balanceSnapshots.get(accountId);
      const current = snapshot?.exists ?
        {...emptyBalance(accountId), ...snapshot.data()} as BalanceRecord :
        emptyBalance(accountId);

      const next = {...current};
      for (const [bucket, delta] of buckets) {
        next[bucket] += delta;
      }
      next.total = next.available + next.locked + next.pending + next.payout_pending;
      next.ledgerSequence += 1;
      if ([next.available, next.locked, next.pending, next.total, next.payout_pending, next.paid, next.reversed].some((value) => !Number.isSafeInteger(value))) {
        throw new HttpsError("out-of-range", "Balance exceeds safe integer bounds.");
      }

      if (
        !isSystemAccount(accountId) &&
        (next.available < 0 || next.locked < 0 || next.pending < 0 || next.payout_pending < 0 || next.paid < 0 || next.reversed < 0)
      ) {
        throw new HttpsError("failed-precondition", currency === "POINT" ? "Insufficient points." : "Insufficient seller payable funds.");
      }

      transaction.set(ref, {
        ...next,
        ...(currency === "ZMW" ? {currency, systemAccount: isSystemAccount(accountId)} : {}),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(snapshot?.exists ? {} : {
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }),
      }, {merge: true});
    }

    transaction.create(transactionRef, {
      transactionId: input.transactionId,
      type: input.type,
      status: input.status,
      senderWalletId: input.senderWalletId,
      receiverWalletId: input.receiverWalletId,
      participants: input.participants,
      amount: input.amount,
      fee: input.fee,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      createdBy: input.createdBy,
      idempotencyKey: input.idempotencyKey,
      entries: input.entries,
      metadata: input.metadata || {},
      ...(input.reversesTransactionId ? {
        reversesTransactionId: input.reversesTransactionId,
      } : {}),
      currency,
      schemaVersion: 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    input.entries.forEach((entry, index) => {
      transaction.create(
        db.collection("ledgerEntries").doc(`${input.transactionId}_${index}`),
        {
          currency,
          transactionId: input.transactionId,
          accountId: entry.accountId,
          bucket: entry.bucket,
          amount: entry.amount,
          type: input.type,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }
      );
    });

    if (input.auditData) {
      const auditRef = db.collection("auditLogs").doc(input.transactionId);
      transaction.create(auditRef, {
        actorId: input.createdBy,
        action: input.type,
        targetType: "transaction",
        targetId: input.transactionId,
        correlationId: input.transactionId,
        data: input.auditData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    for (const write of input.linkedWrites || []) {
      const ref = db.collection(write.collection).doc(write.id);
      if (write.mode === "create") transaction.create(ref, write.data);
      if (write.mode === "set") transaction.set(ref, write.data, {merge: true});
      if (write.mode === "update") transaction.update(ref, write.data);
    }

    return {transactionId: input.transactionId, duplicate: false};
  };
  return outerTransaction ? execute(outerTransaction) : db.runTransaction(execute);
}

export function getSystemAccount(
  purpose: "fees" | "rewards" | "purchases",
  transactionId: string
): string {
  const shard = Number.parseInt(transactionId.slice(0, 2), 16) % 16;
  return `__system_${purpose}_${String(shard).padStart(2, "0")}`;
}
