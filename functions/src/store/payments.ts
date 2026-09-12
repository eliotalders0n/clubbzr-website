import {HttpsError} from "firebase-functions/v2/https";
import type {AuthenticatedActor} from "../core/auth";
import {requireIdempotencyKey} from "../core/errors";
import {admin, db} from "../core/firebase";
import {calculateCommercialFee} from "../core/economyMath";
import {DISABLED_ECONOMY_SETTINGS} from "../core/settings";
import {deterministicId} from "../core/idempotency";
import {lencoRequest} from "../payments/lenco";
import {postLedgerTransaction, getSystemAccount} from "../wallet/ledger";
import {active, decimalToNgwee, integer, ngweeToDecimal, requireCapability} from "./policy";
import {audit, autoDeliveryReady, now, ref, settings} from "./catalog";
import {grantWrite, orderEvent, reserveWrite} from "./orders";
import type {StoreListing, StoreOrder} from "./types";

async function recordLateProviderFee(t: FirebaseFirestore.Transaction, id: string, purpose: "collection" | "payout", fee: number, participants: string[]) {
  if (!fee) return;
  await postLedgerTransaction({transactionId: deterministicId("store_provider_fee", id, purpose), type: "store_provider_fee", currency: "ZMW", status: "completed", senderWalletId: null, receiverWalletId: null, participants,
    amount: fee, fee: 0, referenceType: purpose === "collection" ? "store_order" : "store_payout", referenceId: id, createdBy: "lenco_verified", idempotencyKey: id,
    metadata: {providerFeeNgwee: fee, purpose}, entries: [{accountId: "__system_store_provider_costs", bucket: "available", amount: fee}, {accountId: "__system_store_collections", bucket: "available", amount: -fee}]}, t);
}

// A lease marks an attempted provider request. Timeouts remain pending verification;
// they must be reconciled by the deterministic reference, never blindly retried.
export async function initiateCollection(orderId: string) {
  const claimed = await db.runTransaction(async (t) => {
    const payment = await t.get(ref("payments", orderId));
    if (!payment.exists || payment.data()?.purpose !== "store_order") throw new HttpsError("not-found", "Store payment not found.");
    if (payment.data()?.requestAttemptedAt || payment.data()?.status !== "initiated") return null;
    t.update(payment.ref, {requestAttemptedAt: now(), status: "pending_verification", updatedAt: now()});
    return payment.data();
  });
  if (!claimed) return;
  try {
    const response = await lencoRequest("/collections/mobile-money", {amount: ngweeToDecimal(claimed.amountNgwee), currency: "ZMW", country: "zm", bearer: "merchant", phone: claimed.phone, operator: claimed.operator, reference: orderId});
    const data = (response.data || {}) as Record<string, unknown>;
    // Even an initial successful/failed response is reconciled before value moves.
    await db.runTransaction(async (t) => {
      const payment = await t.get(ref("payments", orderId));
      if (!["paid", "failed", "refunded"].includes(payment.data()?.status)) t.update(payment.ref, {status: "pending", providerStatus: String(data.status || "pending"), providerTransactionId: String(data.id || ""), updatedAt: now()});
    });
  } catch (error) {
    await ref("payments", orderId).set({requestError: error instanceof Error ? error.message : "Provider unavailable", updatedAt: now()}, {merge: true});
  }
}

export function validateCollection(payment: FirebaseFirestore.DocumentData, orderId: string, data: Record<string, unknown>) {
  if (data.reference !== orderId || data.currency !== "ZMW" || !data.id || decimalToNgwee(data.amount) !== payment.amountNgwee || (payment.providerTransactionId && payment.providerTransactionId !== data.id) || (data.bearer && data.bearer !== "merchant")) throw new HttpsError("failed-precondition", "Lenco collection does not match the order.");
}
export async function applyCollection(orderId: string, data: Record<string, unknown>) {
  return db.runTransaction(async (t) => {
    const [payment, snapshot] = await t.getAll(ref("payments", orderId), ref("trades", orderId));
    if (!payment.exists || payment.data()?.purpose !== "store_order" || !snapshot.exists) throw new HttpsError("not-found", "Store payment not found.");
    const p = payment.data();
    if (!p) throw new HttpsError("not-found", "Store payment not found.");
    validateCollection(p, orderId, data);
    const order = {id: snapshot.id, ...snapshot.data()} as StoreOrder;
    if (["paid", "refunded"].includes(p.status)) {
      if (data.status === "successful" && data.fee != null) {
        const fee = decimalToNgwee(data.fee);
        if (p.collectionFeeNgwee == null) {
          await recordLateProviderFee(t, orderId, "collection", fee, order.participants);
          t.update(payment.ref, {collectionFeeNgwee: fee, updatedAt: now()});
          t.update(snapshot.ref, {"price.collectionFee": fee, "updatedAt": now()});
        } else if (p.collectionFeeNgwee !== fee) throw new HttpsError("failed-precondition", "Provider fee changed. Reconciliation is required.");
      }
      return {status: order.status, duplicate: true};
    }
    if (p.status === "failed") {
      if (data.status === "successful") throw new HttpsError("failed-precondition", "A previously failed collection succeeded. Manual reconciliation is required.");
      return {status: order.status, duplicate: true};
    }
    if (!["successful", "failed"].includes(String(data.status))) return {status: order.status, duplicate: false};
    const [listingSnap, assets, buyer, seller, economySnap] = await t.getAll(ref("storeListings", order.listingId), ref("storeListingAssets", `${order.listingId}_v${order.listingVersion}`), ref("users", order.buyerId), ref("users", order.sellerId), ref("settings", "economy"));
    if (data.status === "failed") {
      if (listingSnap.exists) reserveWrite(t, {id: listingSnap.id, ...listingSnap.data()} as StoreListing, "restore");
      t.update(payment.ref, {status: "failed", providerTransactionId: data.id, updatedAt: now()});
      t.update(snapshot.ref, {status: "payment_failed", updatedAt: now()});
      orderEvent(t, order, "lenco_verified", "payment_failed", "collection_failed");
      return {status: "payment_failed", duplicate: false};
    }
    // A collection intent is not funded yet. Lock the current fee only when
    // verified funds enter the ledger, preserving the agreed buyer total.
    const basisPoints = integer(economySnap.data()?.tradeFeeBasisPoints ?? DISABLED_ECONOMY_SETTINGS.tradeFeeBasisPoints, "Fee basis points", 0, 2000);
    const platformFee = calculateCommercialFee(order.price.discountedSubtotal, basisPoints);
    order.price = {...order.price, feeBasisPoints: basisPoints, platformFee, sellerPayable: order.price.discountedSubtotal - platformFee + order.price.deliveryCharge};
    const auto = ["digital_release", "gated_collection"].includes(order.kind);
    const fulfil = auto && autoDeliveryReady(order.kind, assets.data()) && active(buyer.data()) && active(seller.data());
    const fee = data.fee == null ? null : decimalToNgwee(data.fee);
    const sellerBucket: "available" | "pending" = fulfil ? "available" : "pending";
    const fees = getSystemAccount("fees", orderId);
    await postLedgerTransaction({transactionId: deterministicId("store_ledger", orderId, "collection"), type: "store_collection", currency: "ZMW", status: "completed",
      senderWalletId: null, receiverWalletId: order.sellerId, participants: order.participants, amount: order.price.buyerTotal, fee: order.price.platformFee,
      referenceType: "store_order", referenceId: orderId, createdBy: "lenco_verified", idempotencyKey: String(data.id), metadata: {providerTransactionId: data.id, providerFeeNgwee: fee, feeBasisPoints: order.price.feeBasisPoints},
      entries: [{accountId: "__system_store_collections", bucket: "available", amount: -order.price.buyerTotal},
        {accountId: order.sellerId, bucket: sellerBucket, amount: order.price.sellerPayable},
        ...(order.price.platformFee ? [{accountId: fees, bucket: sellerBucket, amount: order.price.platformFee}] : []),
        ...(fee ? [{accountId: "__system_store_provider_costs", bucket: "available" as const, amount: fee}, {accountId: "__system_store_collections", bucket: "available" as const, amount: -fee}] : [])]}, t);
    const status = fulfil ? "completed" : auto || !active(buyer.data()) || !active(seller.data()) ? "paid" : "pending_acceptance";
    t.update(payment.ref, {status: "paid", providerTransactionId: data.id, collectionFeeNgwee: fee, paidAt: now(), updatedAt: now()});
    t.update(snapshot.ref, {status, price: {...order.price, collectionFee: fee}, fee: platformFee, feeBasisPoints: basisPoints, fundingTransactionId: deterministicId("store_ledger", orderId, "collection"), paidAt: now(), expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 72 * 60 * 60 * 1000), updatedAt: now()});
    if (fulfil) {
      grantWrite(t, order);
      if (listingSnap.exists) reserveWrite(t, {id: listingSnap.id, ...listingSnap.data()} as StoreListing, "sold");
    }
    orderEvent(t, order, "lenco_verified", status, "collection", {transitions: ["paid", status], providerTransactionId: data.id, providerFeeNgwee: fee});
    return {status, duplicate: false};
  });
}
export async function reconcileCollection(orderId: string) {
  const response = await lencoRequest(`/collections/status/${encodeURIComponent(orderId)}`, undefined, "GET");
  return applyCollection(orderId, (response.data || {}) as Record<string, unknown>);
}

export async function requestPayout(actor: AuthenticatedActor, input: Record<string, unknown>) {
  const config = await settings();
  requireCapability(config, undefined, "ZMW");
  if (!config.sellerPayoutsEnabled || !process.env.LENCO_MARKETPLACE_ACCOUNT_ID) throw new HttpsError("failed-precondition", "Seller payouts are awaiting approval and configuration.");
  if (input.currency !== "ZMW") throw new HttpsError("invalid-argument", "Only ZMW earnings can be paid out. Points cannot be withdrawn.");
  const key = requireIdempotencyKey(input.idempotencyKey);
  const amount = integer(input.amountNgwee, "Payout ngwee", config.minimumPayoutNgwee);
  const id = deterministicId("store_payout", actor.uid, key);
  const result = await db.runTransaction(async (t) => {
    const currentSettings = await settings(t);
    requireCapability(currentSettings, undefined, "ZMW");
    if (!currentSettings.sellerPayoutsEnabled || amount < currentSettings.minimumPayoutNgwee) throw new HttpsError("failed-precondition", "Payout configuration changed. Review and retry.");
    const [existing, account, user] = await t.getAll(ref("storePayouts", id), ref("storeSellerAccounts", actor.uid), ref("users", actor.uid));
    if (existing.exists) {
      if (existing.data()?.amountNgwee !== amount) throw new HttpsError("already-exists", "Payout key already used.");
      return {payoutId: id, duplicate: true};
    }
    const a = account.data();
    if (!active(user.data()) || !a || !a.identityVerified || !a.adminApproved || !a.legalName || !a.phone || !a.operator || !a.ownsAccount || a.activePayoutId) throw new HttpsError("failed-precondition", "Verified identity, account ownership and admin approval are required; resolve any pending payout first.");
    await postLedgerTransaction({transactionId: deterministicId("store_payout_lock", actor.uid, id), type: "store_payout_lock", currency: "ZMW", status: "completed", senderWalletId: actor.uid, receiverWalletId: actor.uid, participants: [actor.uid], amount, fee: 0, referenceType: "store_payout", referenceId: id, createdBy: actor.uid, idempotencyKey: key,
      entries: [{accountId: actor.uid, bucket: "available", amount: -amount}, {accountId: actor.uid, bucket: "payout_pending", amount}]}, t);
    t.create(ref("storePayouts", id), {sellerId: actor.uid, amountNgwee: amount, currency: "ZMW", status: "pending_verification", phone: a.phone, operator: a.operator, accountId: process.env.LENCO_MARKETPLACE_ACCOUNT_ID, createdAt: now(), updatedAt: now(), requestAttemptedAt: now()});
    t.update(account.ref, {activePayoutId: id});
    return {payoutId: id, duplicate: false};
  });
  if (!result.duplicate) {
    const payout = (await ref("storePayouts", id).get()).data();
    if (!payout) throw new HttpsError("not-found", "Payout not found.");
    try {
      const response = await lencoRequest("/transfers/mobile-money", {accountId: payout.accountId, amount: ngweeToDecimal(amount), reference: id, phone: payout.phone, operator: payout.operator, country: "zm", narration: "Club BZR seller earnings"});
      const data = (response.data || {}) as Record<string, unknown>;
      await db.runTransaction(async (t) => {
        const current = await t.get(ref("storePayouts", id));
        if (!["paid", "failed"].includes(current.data()?.status)) t.update(current.ref, {providerTransactionId: String(data.id || ""), status: "pending", updatedAt: now()});
      });
    } catch (error) {
      await ref("storePayouts", id).set({requestError: error instanceof Error ? error.message : "Provider request uncertain", updatedAt: now()}, {merge: true});
    }
  }
  return result;
}
export async function applyPayout(id: string, data: Record<string, unknown>) {
  return db.runTransaction(async (t) => {
    const payout = await t.get(ref("storePayouts", id));
    if (!payout.exists) throw new HttpsError("not-found", "Payout not found.");
    const p = payout.data();
    if (!p) throw new HttpsError("not-found", "Payout not found.");
    const recipient = (data.creditAccount || {}) as Record<string, unknown>;
    if (data.reference !== id || data.currency !== "ZMW" || !data.id || decimalToNgwee(data.amount) !== p.amountNgwee || data.accountId !== p.accountId || recipient.phone !== p.phone || recipient.operator !== p.operator || (p.providerTransactionId && p.providerTransactionId !== data.id)) throw new HttpsError("failed-precondition", "Transfer does not match the payout.");
    if (["paid", "failed"].includes(p.status)) {
      if (!["successful", "failed"].includes(String(data.status))) return {pending: true};
      if ((p.status === "paid") !== (data.status === "successful")) throw new HttpsError("failed-precondition", "Conflicting payout outcome requires reconciliation.");
      if (data.fee != null) {
        const fee = decimalToNgwee(data.fee);
        if (p.payoutFeeNgwee == null) {
          await recordLateProviderFee(t, id, "payout", fee, [p.sellerId]);
          t.update(payout.ref, {payoutFeeNgwee: fee, updatedAt: now()});
        } else if (p.payoutFeeNgwee !== fee) throw new HttpsError("failed-precondition", "Provider fee changed. Reconciliation is required.");
      }
      return {duplicate: true};
    }
    if (!["successful", "failed"].includes(String(data.status))) return {pending: true};
    const success = data.status === "successful";
    const fee = data.fee == null ? null : decimalToNgwee(data.fee);
    await postLedgerTransaction({transactionId: deterministicId("store_payout_outcome", p.sellerId, id), type: success ? "store_payout_paid" : "store_payout_failed", currency: "ZMW", status: "completed", senderWalletId: p.sellerId, receiverWalletId: p.sellerId, participants: [p.sellerId], amount: p.amountNgwee, fee: 0, referenceType: "store_payout", referenceId: id, createdBy: "lenco_verified", idempotencyKey: id, metadata: {providerTransactionId: data.id, providerFeeNgwee: fee},
      entries: [{accountId: p.sellerId, bucket: "payout_pending", amount: -p.amountNgwee}, {accountId: p.sellerId, bucket: success ? "paid" : "available", amount: p.amountNgwee},
        ...(fee ? [{accountId: "__system_store_provider_costs", bucket: "available" as const, amount: fee}, {accountId: "__system_store_collections", bucket: "available" as const, amount: -fee}] : [])]}, t);
    t.update(payout.ref, {status: success ? "paid" : "failed", providerTransactionId: data.id, payoutFeeNgwee: fee, completedAt: now(), updatedAt: now()});
    t.update(ref("storeSellerAccounts", p.sellerId), {activePayoutId: null});
    audit(t, "lenco_verified", "store_payout_reconciled", id, {status: success ? "paid" : "failed", amountNgwee: p.amountNgwee, providerFeeNgwee: fee});
    return {success};
  });
}
export async function reconcilePayout(id: string) {
  const response = await lencoRequest(`/transfers/status/${encodeURIComponent(id)}`, undefined, "GET");
  return applyPayout(id, (response.data || {}) as Record<string, unknown>);
}
