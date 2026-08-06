import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";

import {admin, db} from "../core/firebase";
import {getEconomySettings} from "../core/settings";

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
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const start = admin.firestore.Timestamp.fromDate(
      new Date(`${day}T00:00:00.000Z`)
    );
    const transactions = db.collection("transactions")
      .where("createdAt", ">=", start);
    const payments = db.collection("payments")
      .where("createdAt", ">=", start)
      .where("status", "==", "successful");
    const [transactionTotals, paymentTotals, completions] = await Promise.all([
      transactions.aggregate({
        count: admin.firestore.AggregateField.count(),
        volume: admin.firestore.AggregateField.sum("amount"),
        fees: admin.firestore.AggregateField.sum("fee"),
      }).get(),
      payments.aggregate({
        count: admin.firestore.AggregateField.count(),
        revenueNgwee: admin.firestore.AggregateField.sum("amountNgwee"),
      }).get(),
      db.collection("questProgress")
        .where("completedAt", ">=", start)
        .count().get(),
    ]);
    await db.collection("analytics").doc(`economy_${day}`).set({
      date: day,
      transactions: transactionTotals.data(),
      payments: paymentTotals.data(),
      questCompletions: completions.data().count,
      calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
);
