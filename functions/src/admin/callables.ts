import {HttpsError, onCall} from "firebase-functions/v2/https";

import {requireAdmin} from "../core/auth";
import {requireString} from "../core/errors";
import {admin, db} from "../core/firebase";
import {DISABLED_ECONOMY_SETTINGS, type EconomySettings} from "../core/settings";

const callableOptions = {
  cors: true,
  invoker: "public" as const,
  enforceAppCheck: process.env.ENFORCE_APP_CHECK !== "false",
};

function booleanValue(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new HttpsError("invalid-argument", `${field} must be true or false.`);
  }
  return value;
}

function nullablePositiveInteger(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new HttpsError("invalid-argument", `${field} must be a positive integer.`);
  }
  return Number(value);
}

function nullableNonNegativeInteger(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new HttpsError(
      "invalid-argument",
      `${field} must be a non-negative integer.`
    );
  }
  return Number(value);
}

export const updateEconomySettings = onCall(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  const input = request.data as Partial<EconomySettings>;
  const settings: EconomySettings = {
    ...DISABLED_ECONOMY_SETTINGS,
    economyEnabled: booleanValue(input.economyEnabled, "economyEnabled"),
    maintenanceMode: booleanValue(input.maintenanceMode, "maintenanceMode"),
    transfersEnabled: booleanValue(input.transfersEnabled, "transfersEnabled"),
    pointPurchasesEnabled: booleanValue(
      input.pointPurchasesEnabled,
      "pointPurchasesEnabled"
    ),
    tradingEnabled: booleanValue(input.tradingEnabled, "tradingEnabled"),
    pointsPerZmw: nullablePositiveInteger(input.pointsPerZmw, "pointsPerZmw"),
    pointsPerPaidSession: nullableNonNegativeInteger(
      input.pointsPerPaidSession,
      "pointsPerPaidSession"
    ),
    minPurchaseNgwee: nullablePositiveInteger(
      input.minPurchaseNgwee,
      "minPurchaseNgwee"
    ),
    maxPurchaseNgwee: nullablePositiveInteger(
      input.maxPurchaseNgwee,
      "maxPurchaseNgwee"
    ),
    maxTransferPoints: nullablePositiveInteger(
      input.maxTransferPoints,
      "maxTransferPoints"
    ),
    dailyTransferLimitPoints: nullablePositiveInteger(
      input.dailyTransferLimitPoints,
      "dailyTransferLimitPoints"
    ),
    tradeFeeBasisPoints: Number(input.tradeFeeBasisPoints ?? 500),
    rewardMultiplierBasisPoints: Number(
      input.rewardMultiplierBasisPoints ?? 10000
    ),
    escrowTimeoutHours: Number(input.escrowTimeoutHours ?? 168),
    version: Number(input.version ?? 1),
  };
  if (
    !Number.isSafeInteger(settings.tradeFeeBasisPoints) ||
    settings.tradeFeeBasisPoints < 0 ||
    settings.tradeFeeBasisPoints > 10000
  ) {
    throw new HttpsError("invalid-argument", "Trade fee must be 0-10000 basis points.");
  }
  if (
    !Number.isSafeInteger(settings.rewardMultiplierBasisPoints) ||
    settings.rewardMultiplierBasisPoints < 0 ||
    settings.rewardMultiplierBasisPoints > 100000
  ) {
    throw new HttpsError("invalid-argument", "Reward multiplier is invalid.");
  }
  if (
    !Number.isSafeInteger(settings.escrowTimeoutHours) ||
    settings.escrowTimeoutHours < 1 ||
    settings.escrowTimeoutHours > 8760
  ) {
    throw new HttpsError("invalid-argument", "Escrow timeout is invalid.");
  }
  if (settings.pointPurchasesEnabled && (
    !settings.pointsPerZmw ||
    !settings.minPurchaseNgwee ||
    !settings.maxPurchaseNgwee ||
    settings.minPurchaseNgwee > settings.maxPurchaseNgwee
  )) {
    throw new HttpsError(
      "failed-precondition",
      "Configure a conversion rate and valid purchase limits before enabling purchases."
    );
  }
  if (settings.transfersEnabled && (
    !settings.maxTransferPoints || !settings.dailyTransferLimitPoints
  )) {
    throw new HttpsError(
      "failed-precondition",
      "Configure per-transfer and daily limits before enabling transfers."
    );
  }

  const ref = db.collection("settings").doc("economy");
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(ref);
    const nextVersion = Number(current.data()?.version || 0) + 1;
    transaction.set(ref, {
      ...settings,
      version: nextVersion,
      updatedBy: actor.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(current.exists ? {} : {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }),
    });
    transaction.create(db.collection("auditLogs").doc(), {
      actorId: actor.uid,
      action: "economy_settings_updated",
      targetType: "settings",
      targetId: "economy",
      before: current.exists ? current.data() : null,
      after: {...settings, version: nextVersion},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  return {success: true};
});

export const setUserAccess = onCall(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  const data = request.data as Record<string, unknown>;
  const userId = requireString(data.userId, "User", {min: 6, max: 128});
  const role = requireString(data.role, "Role", {min: 4, max: 16});
  if (!["user", "artist", "facilitator", "curator", "admin"].includes(role)) {
    throw new HttpsError("invalid-argument", "Role is invalid.");
  }
  if (userId === actor.uid && role !== "admin") {
    throw new HttpsError("failed-precondition", "Admins cannot remove their own access.");
  }
  const target = await admin.auth().getUser(userId);
  await admin.auth().setCustomUserClaims(userId, {
    ...(target.customClaims || {}),
    admin: role === "admin",
    curator: role === "curator",
  });
  await db.collection("users").doc(userId).set({
    role,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
  await db.collection("auditLogs").add({
    actorId: actor.uid,
    action: "user_access_updated",
    targetType: "user",
    targetId: userId,
    data: {role},
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return {success: true, requiresTokenRefresh: true};
});

export const setUserAccountStatus = onCall(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  const data = request.data as Record<string, unknown>;
  const userId = requireString(data.userId, "User", {min: 6, max: 128});
  const status = requireString(data.status, "Status", {min: 5, max: 16});
  if (!["active", "frozen", "suspended", "closed"].includes(status)) {
    throw new HttpsError("invalid-argument", "Account status is invalid.");
  }
  if (userId === actor.uid && status !== "active") {
    throw new HttpsError("failed-precondition", "Admins cannot freeze their own account.");
  }
  const batch = db.batch();
  batch.set(db.collection("users").doc(userId), {
    accountStatus: status,
    isActive: status === "active",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
  batch.set(db.collection("wallets").doc(userId), {
    status: status === "active" ? "active" : "frozen",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
  batch.create(db.collection("auditLogs").doc(), {
    actorId: actor.uid,
    action: "user_account_status_updated",
    targetType: "user",
    targetId: userId,
    data: {status},
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return {success: true};
});

export const adminUpdateUserProfile = onCall(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  const data = request.data as Record<string, unknown>;
  const userId = requireString(data.userId, "User", {min: 6, max: 128});
  const displayName = requireString(data.displayName, "Display name", {min: 1, max: 120});
  const email = requireString(data.email, "Email", {min: 3, max: 320});
  const username = requireString(data.username, "Username", {min: 2, max: 64});
  await db.collection("users").doc(userId).set({
    displayName, email, username,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
  await db.collection("auditLogs").add({
    actorId: actor.uid, action: "user_profile_updated", targetType: "user",
    targetId: userId, data: {displayName, email, username},
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return {success: true};
});

export const adminCreateInviteProfile = onCall(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  const data = request.data as Record<string, unknown>;
  const displayName = requireString(data.displayName, "Display name", {min: 1, max: 120});
  const email = requireString(data.email, "Email", {min: 3, max: 320});
  const username = requireString(data.username, "Username", {min: 2, max: 64});
  const role = requireString(data.role, "Role", {min: 4, max: 16});
  if (!["user", "artist", "facilitator", "curator"].includes(role)) {
    throw new HttpsError("invalid-argument", "Invite role is invalid.");
  }
  const inviteId = db.collection("userInvites").doc().id;
  await db.collection("userInvites").doc(inviteId).create({
    displayName, email: email.toLowerCase(), username, role,
    status: "pending", createdBy: actor.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.collection("auditLogs").add({
    actorId: actor.uid, action: "user_invite_created", targetType: "userInvite",
    targetId: inviteId, data: {email: email.toLowerCase(), role},
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return {success: true, inviteId};
});
