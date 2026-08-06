import {onDocumentCreated} from "firebase-functions/v2/firestore";

import {bootstrapWalletForUser} from "./callables";

export const createWalletOnUserCreated = onDocumentCreated(
  "users/{userId}",
  async (event) => {
    const userId = event.params.userId;
    if (!userId.startsWith("invited-")) {
      await bootstrapWalletForUser(userId);
    }
  }
);
