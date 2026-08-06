import {HttpsError} from "firebase-functions/v2/https";

export function requireString(
  value: unknown,
  field: string,
  options: {min?: number; max?: number; pattern?: RegExp} = {}
): string {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `${field} is required.`);
  }

  const normalized = value.trim();
  const min = options.min ?? 1;
  const max = options.max ?? 256;
  if (
    normalized.length < min ||
    normalized.length > max ||
    (options.pattern && !options.pattern.test(normalized))
  ) {
    throw new HttpsError("invalid-argument", `${field} is invalid.`);
  }

  return normalized;
}

export function requirePositiveInteger(
  value: unknown,
  field: string,
  maximum = Number.MAX_SAFE_INTEGER
): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0 || Number(value) > maximum) {
    throw new HttpsError(
      "invalid-argument",
      `${field} must be a positive whole number.`
    );
  }

  return Number(value);
}

export function requireIdempotencyKey(value: unknown): string {
  return requireString(value, "Idempotency key", {
    min: 8,
    max: 128,
    pattern: /^[A-Za-z0-9:_-]+$/,
  });
}
