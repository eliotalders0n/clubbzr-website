import {HttpsError, onCall} from "firebase-functions/v2/https";
import {onDocumentCreated, onDocumentUpdated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";

import {requireActiveUser, requireAdmin} from "../core/auth";
import {admin, db} from "../core/firebase";
import {deterministicId} from "../core/idempotency";
import {getSystemAccount, postLedgerTransaction} from "../wallet/ledger";
import {getEconomySettings} from "../core/settings";

interface ActivityInput {
  type: string;
  userId: string;
  sourceType: string;
  sourceId: string;
  metadata?: Record<string, unknown>;
}

interface QuestReward {
  type: "points" | "xp" | "badge" | "achievement" | "title" | "unlockable" | string;
  amount?: number;
  id?: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

function activityId(input: ActivityInput): string {
  return deterministicId(input.type, input.userId, `${input.sourceType}:${input.sourceId}`);
}

async function writeActivity(input: ActivityInput): Promise<void> {
  await db.collection("activity").doc(activityId(input)).create({
    ...input,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }).catch((error: {code?: number}) => {
    if (error.code !== 6) throw error;
  });
}

function periodKey(cadence: string, date = new Date()): string {
  if (cadence === "daily") return date.toISOString().slice(0, 10);
  if (cadence === "monthly") return date.toISOString().slice(0, 7);
  if (cadence === "weekly") {
    const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const day = Math.floor((date.getTime() - start.getTime()) / 86400000);
    return `${date.getUTCFullYear()}-W${String(Math.ceil((day + start.getUTCDay() + 1) / 7)).padStart(2, "0")}`;
  }
  return "lifetime";
}

function metadataMatches(
  expected: Record<string, unknown> | undefined,
  actual: Record<string, unknown>
): boolean {
  if (!expected) return true;
  return Object.entries(expected).every(([key, value]) => actual[key] === value);
}

export const evaluateQuestActivity = onDocumentCreated(
  "activity/{activityId}",
  async (event) => {
    const activity = event.data?.data();
    if (!activity?.userId || !activity?.type) return;
    const quests = await db.collection("quests")
      .where("eventTypes", "array-contains", activity.type)
      .get();

    await Promise.all(quests.docs.map(async (questDocument) => {
      const quest = questDocument.data();
      if (quest.status !== "active" && quest.isActive !== true) return;
      if (
        activity.type === "quest.submitted" &&
        activity.metadata?.questId !== questDocument.id
      ) return;
      const now = admin.firestore.Timestamp.now();
      if (quest.startsAt?.toMillis?.() > now.toMillis()) return;
      if (quest.endsAt?.toMillis?.() < now.toMillis()) return;
      if (!metadataMatches(quest.criteria, activity.metadata || {})) return;

      const cadence = String(quest.cadence || "lifetime");
      const period = cadence === "seasonal" ?
        `${questDocument.id}_${quest.startsAt?.seconds || "season"}` :
        periodKey(cadence);
      const progressId = `${activity.userId}_${questDocument.id}_${period}`;
      const progressRef = db.collection("questProgress").doc(progressId);
      const receiptRef = progressRef.collection("receipts").doc(event.params.activityId);
      const target = Math.max(1, Number(quest.targetCount || 1));
      const grantRef = db.collection("rewardGrants").doc(progressId);

      await db.runTransaction(async (transaction) => {
        const [progress, receipt] = await Promise.all([
          transaction.get(progressRef),
          transaction.get(receiptRef),
        ]);
        if (receipt.exists) return;
        const current = Number(progress.data()?.count || 0);
        const next = Math.min(target, current + 1);
        const completed = next >= target;
        transaction.create(receiptRef, {
          activityId: event.params.activityId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        transaction.set(progressRef, {
          userId: activity.userId,
          questId: questDocument.id,
          period,
          count: next,
          target,
          status: completed ? "completed" : "in_progress",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...(progress.exists ? {} : {createdAt: admin.firestore.FieldValue.serverTimestamp()}),
          ...(!progress.data()?.completedAt && completed ? {
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
          } : {}),
        }, {merge: true});
        if (completed && progress.data()?.status !== "completed") {
          transaction.create(grantRef, {
            userId: activity.userId,
            questId: questDocument.id,
            progressId,
            rewards: Array.isArray(quest.rewards) ? quest.rewards : [],
            status: "pending",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      });
    }));
  }
);

export const processQuestReward = onDocumentCreated(
  "rewardGrants/{grantId}",
  async (event) => {
    if (!event.data) return;
    const grant = event.data?.data();
    if (!grant || grant.status === "processed") return;
    const rewards = (Array.isArray(grant.rewards) ? grant.rewards : []) as QuestReward[];
    const settings = await getEconomySettings();
    const multiplier = settings.rewardMultiplierBasisPoints / 10000;
    const points = Math.floor(rewards
      .filter((reward) => reward.type === "points")
      .reduce((sum, reward) => sum + Number(reward.amount || 0), 0) * multiplier);
    if (points > 0) {
      await postLedgerTransaction({
        transactionId: deterministicId("quest_reward", grant.userId, event.params.grantId),
        type: "quest_reward",
        status: "completed",
        senderWalletId: null,
        receiverWalletId: grant.userId,
        participants: [grant.userId],
        amount: points,
        fee: 0,
        referenceType: "quest",
        referenceId: grant.questId,
        createdBy: "quest_engine",
        idempotencyKey: event.params.grantId,
        entries: [
          {accountId: getSystemAccount("rewards", event.params.grantId), bucket: "available", amount: -points},
          {accountId: grant.userId, bucket: "available", amount: points},
        ],
      });
    }

    const xp = Math.floor(rewards
      .filter((reward) => reward.type === "xp")
      .reduce((sum, reward) => sum + Number(reward.amount || 0), 0) * multiplier);
    const passportRef = db.collection("creativePassports").doc(grant.userId);
    const grantRef = event.data.ref;
    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(grantRef);
      if (current.data()?.status === "processed") return;
      const arrayReward = (type: string) => rewards
        .filter((reward) => reward.type === type)
        .map((reward) => ({
          id: reward.id || `${grant.questId}_${type}`,
          name: reward.name || reward.id || type,
          questId: grant.questId,
          metadata: reward.metadata || {},
          earnedAt: admin.firestore.Timestamp.now(),
        }));
      const badgeRewards = arrayReward("badge");
      const achievementRewards = arrayReward("achievement");
      const titleRewards = arrayReward("title");
      const unlockableRewards = arrayReward("unlockable");
      const passportUpdate: Record<string, unknown> = {
        userId: grant.userId,
        ...(xp > 0 ? {xp: admin.firestore.FieldValue.increment(xp)} : {}),
        questsCompleted: admin.firestore.FieldValue.arrayUnion(grant.questId),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (badgeRewards.length) {
        passportUpdate.badges = admin.firestore.FieldValue.arrayUnion(
          ...badgeRewards
        );
      }
      if (achievementRewards.length) {
        passportUpdate.achievements = admin.firestore.FieldValue.arrayUnion(
          ...achievementRewards
        );
      }
      if (titleRewards.length) {
        passportUpdate.titles = admin.firestore.FieldValue.arrayUnion(
          ...titleRewards
        );
      }
      if (unlockableRewards.length) {
        passportUpdate.unlockables = admin.firestore.FieldValue.arrayUnion(
          ...unlockableRewards
        );
      }
      transaction.set(passportRef, passportUpdate, {merge: true});
      transaction.update(grantRef, {
        status: "processed",
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.create(db.collection("notifications").doc(), {
        userId: grant.userId,
        type: "quest_reward",
        title: "Quest completed",
        body: points > 0 ? `You earned ${points} points.` : "Your rewards are ready.",
        referenceType: "quest",
        referenceId: grant.questId,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  }
);

export const activityFromArtwork = onDocumentCreated("artworks/{id}", async (event) => {
  const data = event.data?.data();
  const userId = String(data?.userId || data?.artistId || "");
  if (userId) await writeActivity({type: "artwork.created", userId, sourceType: "artwork", sourceId: event.params.id, metadata: {artType: data?.artType}});
});

export const activityFromComment = onDocumentCreated("comments/{id}", async (event) => {
  const data = event.data?.data();
  const userId = String(data?.userId || "");
  if (userId) await writeActivity({type: "comment.created", userId, sourceType: "comment", sourceId: event.params.id});
});

export const activityFromFollow = onDocumentCreated("artistFollows/{id}", async (event) => {
  const data = event.data?.data();
  const userId = String(data?.userId || "");
  if (userId) await writeActivity({type: "artist.followed", userId, sourceType: "artistFollow", sourceId: event.params.id});
});

export const activityFromQuestSubmission = onDocumentCreated(
  "questSubmissions/{id}",
  async (event) => {
    if (!event.data) return;
    const data = event.data?.data();
    const userId = String(data?.userId || "");
    const questId = String(data?.questId || "");
    if (!userId || !questId) return;
    const quest = await db.collection("quests").doc(questId).get();
    if (!quest.exists) return;
    const autoApproved = quest.data()?.approvalMode !== "manual";
    const batch = db.batch();
    batch.set(event.data.ref, {
      approved: autoApproved,
      pointsAwarded: 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
    batch.set(quest.ref, {
      submissionCount: admin.firestore.FieldValue.increment(1),
      submissions: admin.firestore.FieldValue.arrayUnion(event.params.id),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
    await batch.commit();
    if (autoApproved) {
      await writeActivity({
        type: "quest.submitted",
        userId,
        sourceType: "questSubmission",
        sourceId: event.params.id,
        metadata: {questId, approved: true},
      });
    }
  }
);

export const activityFromApprovedQuestSubmission = onDocumentUpdated(
  "questSubmissions/{id}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (before?.approved !== true && after?.approved === true && after.userId) {
      await writeActivity({
        type: "quest.submitted",
        userId: after.userId,
        sourceType: "questSubmission",
        sourceId: event.params.id,
        metadata: {questId: after.questId, approved: true},
      });
    }
  }
);

export const activityFromSessionAttendance = onDocumentUpdated(
  "sessionRegistrations/{id}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (before?.status !== "confirmed" && after?.status === "confirmed" && after.userId) {
      await writeActivity({type: "event.attended", userId: after.userId, sourceType: "sessionRegistration", sourceId: event.params.id, metadata: {sessionId: after.sessionId}});
    }
  }
);

const PAID_SESSION_STATUSES = new Set(["paid_online", "paid_external"]);

async function rewardPaidSessionRegistration(
  registrationId: string,
  registration: FirebaseFirestore.DocumentData,
  configuredPoints?: number
): Promise<{transactionId: string; duplicate: boolean} | null> {
  const userId = String(registration.userId || "").trim();
  const sessionId = String(registration.sessionId || "").trim();
  if (!userId || !sessionId || !PAID_SESSION_STATUSES.has(registration.paymentStatus)) {
    return null;
  }

  const settings = configuredPoints === undefined ? await getEconomySettings() : null;
  const points = configuredPoints ?? Number(settings?.pointsPerPaidSession || 0);
  if (
    (settings && !settings.economyEnabled) ||
    !Number.isSafeInteger(points) ||
    points <= 0
  ) {
    return null;
  }

  const transactionId = deterministicId(
    "session_payment_reward",
    userId,
    registrationId
  );
  return postLedgerTransaction({
    transactionId,
    type: "session_payment_reward",
    status: "completed",
    senderWalletId: null,
    receiverWalletId: userId,
    participants: [userId],
    amount: points,
    fee: 0,
    referenceType: "sessionRegistration",
    referenceId: registrationId,
    createdBy: "session_payment_reward",
    idempotencyKey: registrationId,
    entries: [
      {
        accountId: getSystemAccount("rewards", transactionId),
        bucket: "available",
        amount: -points,
      },
      {accountId: userId, bucket: "available", amount: points},
    ],
    metadata: {
      sessionId,
      registrationId,
      paymentStatus: registration.paymentStatus,
    },
    linkedWrites: [
      {
        collection: "creativePassports",
        id: userId,
        mode: "set",
        data: {
          userId,
          xp: admin.firestore.FieldValue.increment(points),
          points: admin.firestore.FieldValue.increment(points),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      {
        collection: "sessionRegistrations",
        id: registrationId,
        mode: "set",
        data: {
          paymentRewardPoints: points,
          paymentRewardTransactionId: transactionId,
          paymentRewardedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      {
        collection: "notifications",
        id: transactionId,
        mode: "create",
        data: {
          userId,
          type: "session_payment_reward",
          title: "Session payment reward",
          body: `You earned ${points} points and ${points} XP.`,
          referenceType: "session",
          referenceId: sessionId,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
    ],
  });
}

interface PaidSessionRewardBackfillInput {
  dryRun?: boolean;
  cursor?: string;
  limit?: number;
}

export const adminBackfillPaidSessionRewards = onCall({
  cors: true,
  invoker: "public",
  enforceAppCheck: process.env.ENFORCE_APP_CHECK !== "false",
  timeoutSeconds: 120,
}, async (request) => {
  const actor = await requireAdmin(request);
  const input = (request.data || {}) as PaidSessionRewardBackfillInput;
  const dryRun = input.dryRun !== false;
  const pageSize = Math.min(Math.max(Math.floor(Number(input.limit) || 25), 1), 50);
  const cursor = typeof input.cursor === "string" ? input.cursor.trim() : "";
  const settings = await getEconomySettings();
  const points = Number(settings.pointsPerPaidSession || 0);
  if (!settings.economyEnabled || !Number.isSafeInteger(points) || points <= 0) {
    throw new HttpsError(
      "failed-precondition",
      "Enable the economy and configure Points / XP per paid session before running the backfill."
    );
  }

  let query = db.collection("sessionRegistrations")
    .where("paymentStatus", "in", [...PAID_SESSION_STATUSES])
    .orderBy(admin.firestore.FieldPath.documentId())
    .limit(pageSize);
  if (cursor) query = query.startAfter(cursor);
  const snapshot = await query.get();

  let eligible = 0;
  let awarded = 0;
  let alreadyRewarded = 0;
  let skipped = 0;
  const failures: Array<{registrationId: string; message: string}> = [];

  for (const document of snapshot.docs) {
    const registration = document.data();
    const userId = String(registration.userId || "").trim();
    const sessionId = String(registration.sessionId || "").trim();
    if (!userId || !sessionId) {
      skipped += 1;
      failures.push({
        registrationId: document.id,
        message: "Registration is not linked to both a user and a session.",
      });
      continue;
    }

    const transactionId = deterministicId(
      "session_payment_reward",
      userId,
      document.id
    );
    const existingTransaction = await db.collection("transactions")
      .doc(transactionId)
      .get();
    if (registration.paymentRewardTransactionId || existingTransaction.exists) {
      alreadyRewarded += 1;
      continue;
    }

    eligible += 1;
    if (dryRun) continue;
    try {
      const result = await rewardPaidSessionRegistration(
        document.id,
        registration,
        points
      );
      if (!result || result.duplicate) {
        alreadyRewarded += 1;
      } else {
        awarded += 1;
      }
    } catch (error) {
      skipped += 1;
      failures.push({
        registrationId: document.id,
        message: error instanceof Error ? error.message : "Reward could not be posted.",
      });
    }
  }

  const nextCursor = snapshot.size === pageSize ? snapshot.docs.at(-1)?.id || null : null;
  if (!dryRun) {
    await db.collection("auditLogs").add({
      actorId: actor.uid,
      action: "paid_session_rewards_backfilled",
      targetType: "sessionRegistrations",
      targetId: cursor || "start",
      data: {
        scanned: snapshot.size,
        eligible,
        awarded,
        alreadyRewarded,
        skipped,
        pointsPerReward: points,
        nextCursor,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return {
    dryRun,
    scanned: snapshot.size,
    eligible,
    awarded,
    alreadyRewarded,
    skipped,
    pointsPerReward: points,
    pointsAwarded: awarded * points,
    potentialPoints: eligible * points,
    nextCursor,
    failures: failures.slice(0, 10),
  };
});

export const rewardPaidSessionRegistrationOnCreate = onDocumentCreated(
  "sessionRegistrations/{id}",
  async (event) => {
    const registration = event.data?.data();
    if (registration) {
      await rewardPaidSessionRegistration(event.params.id, registration);
    }
  }
);

export const rewardPaidSessionRegistrationOnUpdate = onDocumentUpdated(
  "sessionRegistrations/{id}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const becamePaid = !PAID_SESSION_STATUSES.has(before?.paymentStatus) &&
      PAID_SESSION_STATUSES.has(after?.paymentStatus);
    if (becamePaid && after) {
      await rewardPaidSessionRegistration(event.params.id, after);
    }
  }
);

export const activityFromProfileCompletion = onDocumentUpdated(
  "users/{id}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (before?.isOnboarded !== true && after?.isOnboarded === true) {
      await writeActivity({
        type: "profile.completed",
        userId: event.params.id,
        sourceType: "user",
        sourceId: event.params.id,
      });
    }
  }
);

export const recordDailyLogin = onCall({
  cors: true,
  invoker: "public",
  enforceAppCheck: process.env.ENFORCE_APP_CHECK !== "false",
}, async (request) => {
  const actor = await requireActiveUser(request);
  const day = new Date().toISOString().slice(0, 10);
  await writeActivity({type: "login.daily", userId: actor.uid, sourceType: "login", sourceId: day});
  return {success: true, day};
});

export async function recordSystemActivity(input: ActivityInput): Promise<void> {
  try {
    await writeActivity(input);
  } catch (error) {
    logger.error("Could not record activity", {input, error});
    throw error;
  }
}
