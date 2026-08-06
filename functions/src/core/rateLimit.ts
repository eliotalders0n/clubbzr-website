import {HttpsError} from "firebase-functions/v2/https";

import {admin, db} from "./firebase";

export async function enforceRateLimit(input: {
  actorId: string;
  action: string;
  limit: number;
  windowSeconds: number;
}): Promise<void> {
  const now = Date.now();
  const windowMs = input.windowSeconds * 1000;
  const bucket = Math.floor(now / windowMs);
  const ref = db.collection("rateLimits")
    .doc(`${input.actorId}_${input.action}_${bucket}`);

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const count = Number(snapshot.data()?.count || 0);
    if (count >= input.limit) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many requests. Please try again later."
      );
    }

    transaction.set(ref, {
      actorId: input.actorId,
      action: input.action,
      bucket,
      count: count + 1,
      expiresAt: admin.firestore.Timestamp.fromMillis(now + windowMs * 2),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(snapshot.exists ? {} : {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }),
    }, {merge: true});
  });
}
