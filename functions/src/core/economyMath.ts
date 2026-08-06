import {HttpsError} from "firebase-functions/v2/https";

export function calculateCommercialFee(amount: number, basisPoints: number): number {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new HttpsError("invalid-argument", "Amount must be a positive integer.");
  }
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0 || basisPoints > 10000) {
    throw new HttpsError("invalid-argument", "Fee basis points are invalid.");
  }
  return Math.floor((amount * basisPoints) / 10000);
}

export function calculatePurchasePoints(amountNgwee: number, pointsPerZmw: number): number {
  if (!Number.isSafeInteger(amountNgwee) || amountNgwee <= 0) {
    throw new HttpsError("invalid-argument", "Purchase amount must be a positive integer.");
  }
  if (!Number.isSafeInteger(pointsPerZmw) || pointsPerZmw <= 0) {
    throw new HttpsError("failed-precondition", "Point conversion rate is invalid.");
  }
  return Math.floor((amountNgwee * pointsPerZmw) / 100);
}
