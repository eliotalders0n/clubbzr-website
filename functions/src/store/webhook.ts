import {createHash} from "node:crypto";
import {HttpsError} from "firebase-functions/v2/https";
import {deterministicId} from "../core/idempotency";
import {now, ref} from "./catalog";
import {applyCollection, applyPayout} from "./payments";

// Internal dispatch only: callers must verify the signature against rawBody first.
// False means this event belongs to another payment flow on the merchant account.
export async function handleVerifiedStoreEvent(payload: Record<string, unknown>, rawBody: Buffer): Promise<boolean> {
  const event = String(payload.event || "");
  if (!["collection.successful", "collection.failed", "transfer.successful", "transfer.failed"].includes(event)) return false;
  const data = (payload.data || {}) as Record<string, unknown>;
  const id = String(data.reference || "");
  if (!/^[a-f0-9]{64}$/.test(id)) return false;
  const transfer = event.startsWith("transfer");
  const record = await ref(transfer ? "storePayouts" : "payments", id).get();
  if (!record.exists || (!transfer && record.data()?.purpose !== "store_order")) return false;
  const hash = createHash("sha256").update(rawBody).digest("hex");
  const eventRef = ref("paymentEvents", deterministicId("store_event", event, hash));
  const previous = await eventRef.get();
  if (previous.data()?.status === "processed") return true;
  await eventRef.set({purpose: "store", provider: "lenco", event, reference: id, payload, payloadHash: hash, rawBody: rawBody.toString("utf8"), status: "received", createdAt: previous.data()?.createdAt || now(), updatedAt: now()}, {merge: true});
  try {
    if (data.status !== (event.endsWith("successful") ? "successful" : "failed")) throw new HttpsError("invalid-argument", "Event status mismatch.");
    if (transfer) await applyPayout(id, data); else await applyCollection(id, data);
    await eventRef.update({status: "processed", processedAt: now()});
    return true;
  } catch (error) {
    await eventRef.update({status: "failed", error: error instanceof Error ? error.message : "Processing failed", updatedAt: now()});
    throw error;
  }
}
