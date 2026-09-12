import {admin} from "../core/firebase";

export function newPointsWalletRecord(userId: string) {
  return {
    userId,
    status: "active",
    currency: "POINT",
    version: 1,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}
