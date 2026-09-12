import {HttpsError} from "firebase-functions/v2/https";
import {calculateCommercialFee} from "../core/economyMath";
import {requireString} from "../core/errors";
import type {CheckoutInput, PaymentRail, PriceSnapshot, StoreListing, StoreSettings} from "./types";

export const STORE_DEFAULTS: StoreSettings = {
  storeEnabled: false, zmwCheckoutEnabled: false, sellerPayoutsEnabled: false,
  physicalProductsEnabled: false, gatedCollectionsEnabled: false,
  autoApprovalEnabled: false, autoApprovalHours: 168,
  minimumPriceNgwee: 100, minimumPricePoints: 1, minimumPayoutNgwee: 10000,
  deliveryRegions: ["Lusaka", "Copperbelt", "Central", "Eastern", "Luapula", "Muchinga", "Northern", "North-Western", "Southern", "Western"],
  version: 1,
};
export const LICENCES = {
  personal: "Personal use only. Resale, redistribution and commercial use are prohibited. Copyright remains with the creator unless a separate written agreement explicitly transfers it.",
  commercial: "May be incorporated into finished commercial work. Resale or redistribution of original downloadable files is prohibited. Copyright remains with the creator unless a separate written agreement explicitly transfers it.",
};
export const PRODUCT_TYPES = ["digital_release", "bespoke_request", "physical_original", "gated_collection"] as const;
export const timestamp = () => Date.now();
export function integer(value: unknown, label: string, min = 0, max = 100000000): number {
  if (!Number.isSafeInteger(value) || Number(value) < min || Number(value) > max) throw new HttpsError("invalid-argument", `${label} must be a whole number between ${min} and ${max}.`);
  return Number(value);
}
export function identifier(value: unknown, label = "ID"): string {
  return requireString(value, label, {max: 128, pattern: /^[A-Za-z0-9_-]+$/});
}
export function active(data: FirebaseFirestore.DocumentData | undefined): boolean {
  return !!data && data.isActive !== false && !["suspended", "closed"].includes(data.accountStatus);
}
export function requireCapability(settings: StoreSettings, type?: string, rail?: PaymentRail) {
  if (!settings.storeEnabled || (type === "physical_original" && !settings.physicalProductsEnabled) || (type === "gated_collection" && !settings.gatedCollectionsEnabled)) throw new HttpsError("failed-precondition", "This Store capability is currently unavailable.");
  if (rail === "ZMW" && (!settings.zmwCheckoutEnabled || process.env.LENCO_MARKETPLACE_APPROVED !== "true")) throw new HttpsError("failed-precondition", "ZMW checkout is awaiting marketplace approval and configuration.");
}
export function decimalToNgwee(value: unknown): number {
  const text = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new HttpsError("invalid-argument", "Invalid provider amount.");
  const [whole, fraction = ""] = text.split(".");
  return integer(Number(whole) * 100 + Number(fraction.padEnd(2, "0")), "Provider amount");
}
export function ngweeToDecimal(value: number): string {
  integer(value, "Ngwee");
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}
export function quote(listing: StoreListing, input: CheckoutInput, feeBasisPoints: number): PriceSnapshot {
  const rail = input.paymentRail;
  if (!listing.acceptedPaymentMethods.includes(rail)) throw new HttpsError("invalid-argument", "Payment method is unavailable.");
  integer(feeBasisPoints, "Fee basis points", 0, 2000);
  const selected = input.addOnIds || [];
  if (!Array.isArray(selected) || new Set(selected).size !== selected.length || selected.length > 20) throw new HttpsError("invalid-argument", "Invalid add-ons.");
  let subtotal = integer(rail === "POINT" ? listing.pricePoints : listing.priceNgwee, "Price", 1);
  for (const id of selected) {
    const addOn = listing.fulfilment.addOns.find((item) => item.id === id);
    if (!addOn) throw new HttpsError("invalid-argument", "Unknown add-on.");
    subtotal += integer(rail === "POINT" ? addOn.pricePoints : addOn.priceNgwee, "Add-on");
  }
  let delivery = 0;
  if (listing.productType === "physical_original") {
    if (!input.delivery) throw new HttpsError("invalid-argument", "Delivery details are required.");
    const option = listing.fulfilment.deliveryOptions.find((item) => item.region === input.delivery?.region);
    if (input.delivery.region === "pickup" && listing.fulfilment.pickup) delivery = 0;
    else if (option) delivery = rail === "POINT" ? option.pricePoints : option.priceNgwee;
    else throw new HttpsError("invalid-argument", "Delivery region is not supported.");
  }
  const fee = calculateCommercialFee(integer(subtotal, "Subtotal", 1), feeBasisPoints);
  return {currency: rail, productSubtotal: subtotal, discount: 0, discountedSubtotal: subtotal,
    deliveryCharge: delivery, feeBasisPoints, platformFee: fee, buyerTotal: integer(subtotal + delivery, "Total", 1),
    sellerPayable: subtotal - fee + delivery, collectionFee: null, payoutFee: null};
}
export function validateBrief(listing: StoreListing, value: CheckoutInput["brief"]): CheckoutInput["brief"] {
  const brief: CheckoutInput["brief"] = {};
  for (const question of listing.fulfilment.questions) {
    const answer = value?.[question.id];
    if (answer === undefined || answer === "" || (Array.isArray(answer) && !answer.length)) {
      if (question.required) throw new HttpsError("invalid-argument", `Answer ${question.label}.`);
      continue;
    }
    if (question.type === "multiple_choice") {
      if (!Array.isArray(answer) || answer.some((item) => !question.options.includes(item))) throw new HttpsError("invalid-argument", "Invalid choices.");
      brief[question.id] = [...new Set(answer)];
    } else if (question.type === "reference_image") {
      if (typeof answer !== "object" || Array.isArray(answer) || !answer.contentType?.startsWith("image/")) throw new HttpsError("invalid-argument", "Upload a reference image.");
      brief[question.id] = answer;
    } else {
      const text = requireString(answer, question.label, {max: question.type === "long_text" ? 4000 : 500});
      if (question.type === "single_choice" && !question.options.includes(text)) throw new HttpsError("invalid-argument", "Invalid choice.");
      brief[question.id] = text;
    }
  }
  return brief;
}

// One indexed array predicate supports combined filters and a word-prefix search.
// This avoids downloading a collection or intersecting multiple array queries.
export function discoveryKeys(listing: StoreListing): string[] {
  const words = `${listing.title} ${listing.sellerName} ${listing.tags.join(" ")}`.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const prefixes = new Set([""]);
  for (const word of words.slice(0, 24)) for (let n = 2; n <= Math.min(word.length, 24); n++) prefixes.add(word.slice(0, n));
  const keys: string[] = [];
  for (const type of ["all", listing.productType]) for (const rail of ["all", ...listing.acceptedPaymentMethods]) for (const token of [...prefixes].slice(0, 150)) keys.push(`${type}|${rail}|${token}`);
  return keys;
}
