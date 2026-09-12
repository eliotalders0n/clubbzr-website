import {HttpsError, onCall} from "firebase-functions/v2/https";

import {requireAdmin} from "../core/auth";
import {requireString} from "../core/errors";
import {admin, db} from "../core/firebase";
import {
  claimsForRole,
  isManagedAccountStatus,
  isManagedRole,
  removesOwnAdminAccess,
} from "../core/accessPolicy";
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
  const input = request.data as Partial<EconomySettings> & {reason?: unknown};
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
    settings.tradeFeeBasisPoints > 2000
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
    const feeChanged = (current.data()?.tradeFeeBasisPoints ?? 500) !== settings.tradeFeeBasisPoints;
    const reason = feeChanged ? requireString(input.reason, "Fee change reason", {min: 10, max: 1000}) : null;
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
      reason,
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
  if (!isManagedRole(role)) {
    throw new HttpsError("invalid-argument", "Role is invalid.");
  }
  if (userId === actor.uid && role !== "admin") {
    throw new HttpsError("failed-precondition", "Admins cannot remove their own access.");
  }
  const target = await admin.auth().getUser(userId);
  await admin.auth().setCustomUserClaims(userId, {
    ...(target.customClaims || {}),
    role,
    admin: role === "admin",
    curator: role === "curator",
    facilitator: role === "facilitator",
  });
  await admin.auth().revokeRefreshTokens(userId);
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
  await admin.auth().updateUser(userId, {disabled: status !== "active"});
  if (status !== "active") {
    await admin.auth().revokeRefreshTokens(userId);
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

export const adminSaveUser = onCall(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  const data = request.data as Record<string, unknown>;
  const userId = requireString(data.userId, "User", {min: 6, max: 128});
  const displayName = requireString(data.displayName, "Display name", {min: 1, max: 120});
  const email = requireString(data.email, "Email", {min: 3, max: 320}).toLowerCase();
  const username = requireString(data.username, "Username", {min: 2, max: 64});
  const role = requireString(data.role, "Role", {min: 4, max: 16});
  const accountStatus = requireString(data.accountStatus, "Account status", {min: 6, max: 16});

  if (!isManagedRole(role)) {
    throw new HttpsError("invalid-argument", "Role is invalid.");
  }
  if (!isManagedAccountStatus(accountStatus)) {
    throw new HttpsError("invalid-argument", "Account status is invalid.");
  }
  if (removesOwnAdminAccess(actor.uid, userId, role, accountStatus)) {
    throw new HttpsError(
      "failed-precondition",
      "Admins cannot remove or suspend their own administrative access."
    );
  }

  const userRef = db.collection("users").doc(userId);
  const [beforeProfile, beforeAuth] = await Promise.all([
    userRef.get(),
    admin.auth().getUser(userId),
  ]);
  if (!beforeProfile.exists) {
    throw new HttpsError("not-found", "The user profile no longer exists.");
  }

  const beforeRole = String(beforeProfile.data()?.role || "user");
  const nextClaims = claimsForRole(role, beforeAuth.customClaims || {});

  await admin.auth().updateUser(userId, {
    displayName,
    email,
    disabled: accountStatus !== "active",
  });
  await admin.auth().setCustomUserClaims(userId, nextClaims);

  try {
    const batch = db.batch();
    batch.set(userRef, {
      displayName,
      email,
      username,
      role,
      accountStatus,
      isActive: accountStatus === "active",
      invitationStatus: beforeProfile.data()?.invitationStatus || "accepted",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
    batch.set(db.collection("publicProfiles").doc(userId), {
      userId,
      displayName,
      username,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
    batch.set(db.collection("wallets").doc(userId), {
      status: accountStatus === "active" ? "active" : "frozen",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
    batch.create(db.collection("auditLogs").doc(), {
      actorId: actor.uid,
      action: "user_management_updated",
      targetType: "user",
      targetId: userId,
      data: {
        before: {
          displayName: beforeProfile.data()?.displayName || null,
          email: beforeProfile.data()?.email || null,
          username: beforeProfile.data()?.username || null,
          role: beforeRole,
          accountStatus: beforeProfile.data()?.accountStatus ||
            (beforeProfile.data()?.isActive === false ? "suspended" : "active"),
        },
        after: {displayName, email, username, role, accountStatus},
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    await Promise.allSettled([
      admin.auth().updateUser(userId, {
        displayName: beforeAuth.displayName,
        email: beforeAuth.email,
        disabled: beforeAuth.disabled,
      }),
      admin.auth().setCustomUserClaims(userId, beforeAuth.customClaims || null),
    ]);
    throw error;
  }

  if (accountStatus !== "active" || beforeRole !== role) {
    await admin.auth().revokeRefreshTokens(userId);
  }
  return {success: true, requiresTokenRefresh: beforeRole !== role};
});

export const adminGetUserAuthDetails = onCall(callableOptions, async (request) => {
  await requireAdmin(request);
  const data = request.data as Record<string, unknown>;
  const userId = requireString(data.userId, "User", {min: 6, max: 128});
  const user = await admin.auth().getUser(userId);
  return {
    uid: user.uid,
    emailVerified: user.emailVerified,
    disabled: user.disabled,
    createdAt: user.metadata.creationTime || null,
    lastSignInAt: user.metadata.lastSignInTime || null,
  };
});

export const recordUserActivity = onCall({
  ...callableOptions,
  // Authenticated, self-scoped telemetry with a five-minute write throttle.
  // Do not make sign-in health depend on optional client App Check setup.
  enforceAppCheck: false,
}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in to continue.");
  }
  const userRef = db.collection("users").doc(uid);
  const snapshot = await userRef.get();
  const user = snapshot.data() || {};
  if (!snapshot.exists || user.isActive === false || ["suspended", "closed"].includes(user.accountStatus)) {
    throw new HttpsError("permission-denied", "This account is not active.");
  }
  const lastActiveMs = user.lastActiveAt?.toMillis?.() || 0;
  if (Date.now() - lastActiveMs < 5 * 60 * 1000) {
    return {success: true, recorded: false};
  }
  await userRef.set({
    lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(user.invitationStatus === "pending" ? {invitationStatus: "accepted"} : {}),
  }, {merge: true});
  return {success: true, recorded: true};
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
  const normalizedEmail = email.toLowerCase();
  try {
    await admin.auth().getUserByEmail(normalizedEmail);
    throw new HttpsError("already-exists", "A Firebase account already uses this email.");
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    const code = (error as {code?: string}).code;
    if (code !== "auth/user-not-found") throw error;
  }

  const authUser = await admin.auth().createUser({
    email: normalizedEmail,
    displayName,
    emailVerified: false,
    disabled: false,
  });
  await admin.auth().setCustomUserClaims(authUser.uid, {
    role,
    admin: false,
    curator: role === "curator",
    facilitator: role === "facilitator",
  });
  const setupLink = await admin.auth().generatePasswordResetLink(normalizedEmail);
  const inviteRef = db.collection("userInvites").doc();
  const batch = db.batch();
  batch.create(db.collection("users").doc(authUser.uid), {
    uid: authUser.uid,
    displayName,
    email: normalizedEmail,
    username,
    photoURL: null,
    role,
    accountStatus: "active",
    invitationStatus: "pending",
    isActive: true,
    isOnboarded: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  batch.create(db.collection("publicProfiles").doc(authUser.uid), {
    userId: authUser.uid,
    displayName,
    username,
    photoURL: null,
    interests: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  batch.create(inviteRef, {
    displayName, email: normalizedEmail, username, role,
    userId: authUser.uid, status: "pending", createdBy: actor.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  batch.create(db.collection("auditLogs").doc(), {
    actorId: actor.uid, action: "user_invite_created", targetType: "userInvite",
    targetId: inviteRef.id, data: {email: normalizedEmail, role, userId: authUser.uid},
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (error) {
    await admin.auth().deleteUser(authUser.uid).catch(() => undefined);
    throw error;
  }
  return {success: true, inviteId: inviteRef.id, userId: authUser.uid, setupLink};
});
