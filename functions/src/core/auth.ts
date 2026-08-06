import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";

import {db} from "./firebase";

export interface AuthenticatedActor {
  uid: string;
  email: string | null;
  admin: boolean;
  curator: boolean;
}

export async function requireActiveUser(
  request: CallableRequest<unknown>
): Promise<AuthenticatedActor> {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in to continue.");
  }

  const userSnapshot = await db.collection("users").doc(uid).get();
  if (!userSnapshot.exists) {
    throw new HttpsError("failed-precondition", "User profile is missing.");
  }

  const user = userSnapshot.data() || {};
  if (
    user.isActive === false ||
    user.accountStatus === "suspended" ||
    user.accountStatus === "closed"
  ) {
    throw new HttpsError("permission-denied", "This account is not active.");
  }

  return {
    uid,
    email: typeof request.auth?.token.email === "string" ?
      request.auth.token.email : null,
    admin: request.auth?.token.admin === true,
    curator: request.auth?.token.curator === true,
  };
}

export async function requireAdmin(
  request: CallableRequest<unknown>
): Promise<AuthenticatedActor> {
  const actor = await requireActiveUser(request);
  if (!actor.admin) {
    throw new HttpsError("permission-denied", "Admin access is required.");
  }
  return actor;
}
