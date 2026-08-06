import {createHash} from "node:crypto";

export function deterministicId(
  namespace: string,
  actorId: string,
  idempotencyKey: string
): string {
  return createHash("sha256")
    .update(`${namespace}:${actorId}:${idempotencyKey}`)
    .digest("hex");
}
