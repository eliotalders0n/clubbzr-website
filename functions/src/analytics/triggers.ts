import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {onCall} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";

import {requireAdmin} from "../core/auth";
import {admin, db} from "../core/firebase";
import {getEconomySettings} from "../core/settings";

const LUSAKA_OFFSET_MS = 2 * 60 * 60 * 1000;

function lusakaDayWindow(date: Date): {
  day: string;
  start: FirebaseFirestore.Timestamp;
  end: FirebaseFirestore.Timestamp;
} {
  const shifted = new Date(date.getTime() + LUSAKA_OFFSET_MS);
  const day = shifted.toISOString().slice(0, 10);
  const localMidnightAsUtc = Date.parse(`${day}T00:00:00.000Z`);
  const startMillis = localMidnightAsUtc - LUSAKA_OFFSET_MS;
  return {
    day,
    start: admin.firestore.Timestamp.fromMillis(startMillis),
    end: admin.firestore.Timestamp.fromMillis(startMillis + 24 * 60 * 60 * 1000),
  };
}

async function getEconomyMetrics(
  window: ReturnType<typeof lusakaDayWindow>
) {
  const transactions = db.collection("transactions")
    .where("createdAt", ">=", window.start)
    .where("createdAt", "<", window.end);
  const payments = db.collection("payments")
    .where("completedAt", ">=", window.start)
    .where("completedAt", "<", window.end);
  const completions = db.collection("questProgress")
    .where("completedAt", ">=", window.start)
    .where("completedAt", "<", window.end);
  const [transactionTotals, paymentTotals, questCompletions] = await Promise.all([
    transactions.aggregate({
      count: admin.firestore.AggregateField.count(),
      volume: admin.firestore.AggregateField.sum("amount"),
      fees: admin.firestore.AggregateField.sum("fee"),
    }).get(),
    payments.aggregate({
      count: admin.firestore.AggregateField.count(),
      revenueNgwee: admin.firestore.AggregateField.sum("amountNgwee"),
    }).get(),
    completions.count().get(),
  ]);
  return {
    date: window.day,
    transactions: transactionTotals.data(),
    payments: paymentTotals.data(),
    questCompletions: questCompletions.data().count,
  };
}

export const detectLedgerRisk = onDocumentCreated(
  "transactions/{transactionId}",
  async (event) => {
    const transaction = event.data?.data();
    if (!transaction) return;
    const settings = await getEconomySettings();
    const transferThreshold = Math.floor(
      Number(settings.maxTransferPoints || 0) * 0.8
    );
    const reasons: string[] = [];
    if (
      transaction.type === "peer_transfer" &&
      transferThreshold > 0 &&
      Number(transaction.amount) >= transferThreshold
    ) reasons.push("near_transfer_limit");
    if (
      ["admin_credit", "admin_debit"].includes(transaction.type) &&
      Number(transaction.amount) >= 100000
    ) reasons.push("large_admin_adjustment");
    if (!reasons.length) return;
    await db.collection("fraudAlerts").doc(event.params.transactionId).set({
      transactionId: event.params.transactionId,
      userIds: transaction.participants || [],
      reasons,
      riskScore: Math.min(100, 40 + reasons.length * 25),
      status: "open",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
  }
);

export const calculateDailyEconomyAnalytics = onSchedule(
  {schedule: "every day 01:30", timeZone: "Africa/Lusaka"},
  async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const metrics = await getEconomyMetrics(lusakaDayWindow(yesterday));
    await db.collection("analytics").doc(`economy_${metrics.date}`).set({
      ...metrics,
      calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
);

export const adminGetEconomyAnalytics = onCall({
  cors: true,
  invoker: "public",
  enforceAppCheck: process.env.ENFORCE_APP_CHECK !== "false",
  timeoutSeconds: 60,
}, async (request) => {
  await requireAdmin(request);
  const metrics = await getEconomyMetrics(lusakaDayWindow(new Date()));
  const alertSnapshot = await db.collection("fraudAlerts")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();
  return {
    ...metrics,
    alerts: alertSnapshot.docs
      .filter((document) => document.data().status === "open")
      .slice(0, 25)
      .map((document) => ({id: document.id, ...document.data()})),
    calculatedAt: new Date().toISOString(),
    source: "live_ledger",
  };
});
