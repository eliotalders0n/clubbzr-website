import {onSchedule} from "firebase-functions/v2/scheduler";
import {onCall} from "firebase-functions/v2/https";

import {requireAdmin} from "../core/auth";
import {requireString} from "../core/errors";
import {admin, db} from "../core/firebase";

async function sumBucket(walletId: string, bucket: "available" | "locked" | "pending") {
  const aggregate = await db.collection("ledgerEntries")
    .where("accountId", "==", walletId)
    .where("bucket", "==", bucket)
    .aggregate({total: admin.firestore.AggregateField.sum("amount")})
    .get();
  return Number(aggregate.data().total || 0);
}

export async function reconcileWallet(walletId: string) {
  const [balance, available, locked, pending] = await Promise.all([
    db.collection("balances").doc(walletId).get(),
    sumBucket(walletId, "available"),
    sumBucket(walletId, "locked"),
    sumBucket(walletId, "pending"),
  ]);
  const projected = balance.data() || {};
  const expected = {available, locked, pending, total: available + locked + pending};
  const matches = expected.available === Number(projected.available || 0) &&
    expected.locked === Number(projected.locked || 0) &&
    expected.pending === Number(projected.pending || 0) &&
    expected.total === Number(projected.total || 0);
  const issueRef = db.collection("reconciliationIssues").doc(walletId);
  await issueRef.set({
    walletId,
    status: matches ? "clear" : "open",
    expected,
    projected: {
      available: Number(projected.available || 0),
      locked: Number(projected.locked || 0),
      pending: Number(projected.pending || 0),
      total: Number(projected.total || 0),
    },
    checkedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(matches ? {resolvedAt: admin.firestore.FieldValue.serverTimestamp()} : {}),
  }, {merge: true});
  return {walletId, matches, expected};
}

export const adminReconcileWallet = onCall({
  cors: true,
  invoker: "public",
  enforceAppCheck: process.env.ENFORCE_APP_CHECK !== "false",
}, async (request) => {
  const actor = await requireAdmin(request);
  const walletId = requireString(
    (request.data as Record<string, unknown>).walletId,
    "Wallet",
    {min: 6, max: 128}
  );
  const result = await reconcileWallet(walletId);
  await db.collection("auditLogs").add({
    actorId: actor.uid,
    action: "wallet_reconciled",
    targetType: "wallet",
    targetId: walletId,
    data: result,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return result;
});

export const scheduledWalletReconciliation = onSchedule(
  {schedule: "every day 02:00", timeZone: "Africa/Lusaka"},
  async () => {
    const stateRef = db.collection("systemState").doc("walletReconciliation");
    const state = await stateRef.get();
    let query = db.collection("wallets").orderBy(admin.firestore.FieldPath.documentId()).limit(50);
    const cursor = state.data()?.cursor;
    if (typeof cursor === "string" && cursor) query = query.startAfter(cursor);
    let wallets = await query.get();
    if (wallets.empty && cursor) {
      wallets = await db.collection("wallets")
        .orderBy(admin.firestore.FieldPath.documentId()).limit(50).get();
    }
    for (const wallet of wallets.docs) await reconcileWallet(wallet.id);
    await stateRef.set({
      cursor: wallets.docs.at(-1)?.id || null,
      checked: wallets.size,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
  }
);
