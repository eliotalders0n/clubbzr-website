import {onCall, HttpsError} from "firebase-functions/v2/https";

import {requireActiveUser, requireAdmin} from "../core/auth";
import {
  requireIdempotencyKey,
  requirePositiveInteger,
  requireString,
} from "../core/errors";
import {admin, db} from "../core/firebase";
import {deterministicId} from "../core/idempotency";
import {enforceRateLimit} from "../core/rateLimit";
import {getEconomySettings, requireEconomyEnabled} from "../core/settings";
import {getSystemAccount, postLedgerTransaction} from "./ledger";

const callableOptions = {
  cors: true,
  invoker: "public" as const,
  enforceAppCheck: process.env.ENFORCE_APP_CHECK !== "false",
};

export const getWalletSummary = onCall(callableOptions, async (request) => {
  const actor = await requireActiveUser(request);
  const [wallet, balance] = await Promise.all([
    db.collection("wallets").doc(actor.uid).get(),
    db.collection("balances").doc(actor.uid).get(),
  ]);

  return {
    wallet: wallet.exists ? {id: wallet.id, ...wallet.data()} : null,
    balance: balance.exists ? {id: balance.id, ...balance.data()} : {
      walletId: actor.uid,
      available: 0,
      locked: 0,
      pending: 0,
      total: 0,
      ledgerSequence: 0,
    },
  };
});

export const transferPoints = onCall(callableOptions, async (request) => {
  const actor = await requireActiveUser(request);
  const data = request.data as Record<string, unknown>;
  const recipientId = requireString(data.recipientId, "Recipient", {
    min: 6,
    max: 128,
  });
  const idempotencyKey = requireIdempotencyKey(data.idempotencyKey);
  if (recipientId === actor.uid) {
    throw new HttpsError("invalid-argument", "You cannot transfer points to yourself.");
  }

  const settings = await getEconomySettings();
  requireEconomyEnabled(settings, "transfers");
  if (!settings.maxTransferPoints || !settings.dailyTransferLimitPoints) {
    throw new HttpsError("failed-precondition", "Transfer limits are not configured.");
  }
  const amount = requirePositiveInteger(
    data.amount,
    "Amount",
    settings.maxTransferPoints
  );

  await enforceRateLimit({
    actorId: actor.uid,
    action: "transfer_points",
    limit: 12,
    windowSeconds: 60,
  });

  const [recipientUser, senderWallet, recipientWallet] = await Promise.all([
    db.collection("users").doc(recipientId).get(),
    db.collection("wallets").doc(actor.uid).get(),
    db.collection("wallets").doc(recipientId).get(),
  ]);
  if (!recipientUser.exists || recipientUser.data()?.isActive === false) {
    throw new HttpsError("not-found", "Recipient is unavailable.");
  }
  if (senderWallet.data()?.status !== "active" || recipientWallet.data()?.status !== "active") {
    throw new HttpsError("failed-precondition", "One of these wallets is unavailable.");
  }

  const transactionId = deterministicId("peer_transfer", actor.uid, idempotencyKey);
  const result = await postLedgerTransaction({
    transactionId,
    type: "peer_transfer",
    status: "completed",
    senderWalletId: actor.uid,
    receiverWalletId: recipientId,
    participants: [actor.uid, recipientId],
    amount,
    fee: 0,
    referenceType: "peer_transfer",
    referenceId: transactionId,
    createdBy: actor.uid,
    idempotencyKey,
    entries: [
      {accountId: actor.uid, bucket: "available", amount: -amount},
      {accountId: recipientId, bucket: "available", amount},
    ],
    usageLimit: {
      documentId: `${actor.uid}_${new Date().toISOString().slice(0, 10)}`,
      userId: actor.uid,
      field: "transferredOut",
      increment: amount,
      maximum: settings.dailyTransferLimitPoints,
      period: new Date().toISOString().slice(0, 10),
    },
  });

  return {...result, status: "completed", amount, fee: 0};
});

export const adminCreditPoints = onCall(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  const data = request.data as Record<string, unknown>;
  const userId = requireString(data.userId, "User", {min: 6, max: 128});
  const amount = requirePositiveInteger(data.amount, "Amount", 100000000);
  const reason = requireString(data.reason, "Reason", {min: 8, max: 500});
  const idempotencyKey = requireIdempotencyKey(data.idempotencyKey);
  const wallet = await db.collection("wallets").doc(userId).get();
  if (!wallet.exists) throw new HttpsError("not-found", "Wallet not found.");

  const transactionId = deterministicId("admin_credit", actor.uid, idempotencyKey);
  const result = await postLedgerTransaction({
    transactionId,
    type: "admin_credit",
    status: "completed",
    senderWalletId: null,
    receiverWalletId: userId,
    participants: [userId],
    amount,
    fee: 0,
    referenceType: "admin_adjustment",
    referenceId: transactionId,
    createdBy: actor.uid,
    idempotencyKey,
    entries: [
      {accountId: getSystemAccount("rewards", transactionId), bucket: "available", amount: -amount},
      {accountId: userId, bucket: "available", amount},
    ],
    auditData: {reason, targetUserId: userId, amount},
  });
  return {...result, status: "completed", amount};
});

export const adminDebitPoints = onCall(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  const data = request.data as Record<string, unknown>;
  const userId = requireString(data.userId, "User", {min: 6, max: 128});
  const amount = requirePositiveInteger(data.amount, "Amount", 100000000);
  const reason = requireString(data.reason, "Reason", {min: 8, max: 500});
  const idempotencyKey = requireIdempotencyKey(data.idempotencyKey);
  const transactionId = deterministicId("admin_debit", actor.uid, idempotencyKey);
  const result = await postLedgerTransaction({
    transactionId,
    type: "admin_debit",
    status: "completed",
    senderWalletId: userId,
    receiverWalletId: null,
    participants: [userId],
    amount,
    fee: 0,
    referenceType: "admin_adjustment",
    referenceId: transactionId,
    createdBy: actor.uid,
    idempotencyKey,
    entries: [
      {accountId: userId, bucket: "available", amount: -amount},
      {accountId: getSystemAccount("rewards", transactionId), bucket: "available", amount},
    ],
    auditData: {reason, targetUserId: userId, amount},
  });
  return {...result, status: "completed", amount};
});

export const getWalletTransactions = onCall(callableOptions, async (request) => {
  const actor = await requireActiveUser(request);
  const data = request.data as Record<string, unknown>;
  const requestedLimit = typeof data.limit === "number" ? data.limit : 30;
  const limit = Math.max(1, Math.min(100, Math.floor(requestedLimit)));
  const snapshot = await db.collection("transactions")
    .where("participants", "array-contains", actor.uid)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return {
    transactions: snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })),
  };
});

export const bootstrapWalletForUser = async (userId: string): Promise<void> => {
  const walletRef = db.collection("wallets").doc(userId);
  const balanceRef = db.collection("balances").doc(userId);
  await db.runTransaction(async (transaction) => {
    const [wallet, balance] = await Promise.all([
      transaction.get(walletRef),
      transaction.get(balanceRef),
    ]);
    if (!wallet.exists) {
      transaction.create(walletRef, {
        userId,
        status: "active",
        currency: "POINT",
        version: 1,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    if (!balance.exists) {
      transaction.create(balanceRef, {
        walletId: userId,
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
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });
};
