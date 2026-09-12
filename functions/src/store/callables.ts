import {HttpsError, onCall, onRequest} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import {requireActiveUser, requireAdmin} from "../core/auth";
import {admin, db} from "../core/firebase";
import {requireIdempotencyKey, requireString} from "../core/errors";
import {getEconomySettings} from "../core/settings";
import {lencoSecretKey, normalizePhone, normalizeOperator, validWebhookSignature} from "../payments/lenco";
import {audit, autoDeliveryReady, browse, listingDetail, moderateListing, now, ref, saveListing, serialize, settings, uploadAccess} from "./catalog";
import {active, identifier, integer, quote, requireCapability, STORE_DEFAULTS} from "./policy";
import {actOnOrder, checkout, download, grantWrite, orderEvent, reserveWrite, settleOrder} from "./orders";
import {initiateCollection, reconcileCollection, reconcilePayout, requestPayout} from "./payments";
import {handleVerifiedStoreEvent} from "./webhook";
import type {CheckoutInput, StoreListing, StoreOrder} from "./types";

const options = {cors: true, invoker: "public" as const, enforceAppCheck: process.env.ENFORCE_APP_CHECK !== "false"};
const paymentOptions = {...options, secrets: [lencoSecretKey]};
export const getStoreConfig = onCall(options, async () => {
  const [config, economy] = await Promise.all([settings(), getEconomySettings()]);
  const zmwCheckoutAvailable = process.env.LENCO_MARKETPLACE_APPROVED === "true";
  const sellerPayoutsAvailable = zmwCheckoutAvailable && !!process.env.LENCO_MARKETPLACE_ACCOUNT_ID;
  return {...config, zmwCheckoutAvailable, sellerPayoutsAvailable,
    zmwCheckoutEnabled: config.zmwCheckoutEnabled && zmwCheckoutAvailable,
    sellerPayoutsEnabled: config.sellerPayoutsEnabled && sellerPayoutsAvailable,
    pointsCheckoutEnabled: economy.economyEnabled && economy.tradingEnabled && !economy.maintenanceMode,
    feeBasisPoints: economy.tradeFeeBasisPoints};
});
export const browseStore = onCall(options, (request) => browse(request.data || {}));
export const getStoreListing = onCall(options, async (request) => listingDetail(identifier(request.data?.listingId), request.auth ? await requireActiveUser(request) : undefined));
export const saveStoreListing = onCall(options, async (request) => saveListing(await requireActiveUser(request), request.data || {}));
export const moderateStoreListing = onCall(options, async (request) => moderateListing(await requireActiveUser(request), request.data || {}));
export const createStoreUpload = onCall(options, async (request) => uploadAccess((await requireActiveUser(request)).uid, request.data || {}));
export const quoteStoreOrder = onCall(options, async (request) => {
  await requireActiveUser(request);
  const input = request.data as CheckoutInput;
  const snapshot = await ref("storeListings", identifier(input.listingId)).get();
  if (!snapshot.exists || snapshot.data()?.status !== "published") throw new HttpsError("not-found", "Release unavailable.");
  const listing = snapshot.data() as StoreListing;
  requireCapability(await settings(), listing.productType, input.paymentRail);
  return {price: quote(listing, input, (await getEconomySettings()).tradeFeeBasisPoints), listingVersion: listing.version};
});
export const checkoutStoreOrder = onCall(paymentOptions, async (request) => {
  const actor = await requireActiveUser(request);
  const input = request.data as CheckoutInput;
  if (input.paymentRail === "ZMW") {
    input.phone = normalizePhone(requireString(input.phone, "Mobile money number"));
    input.operator = normalizeOperator(requireString(input.operator, "Operator"));
    if (!lencoSecretKey.value()) throw new HttpsError("failed-precondition", "Lenco is not configured.");
  }
  const result = await checkout(actor, input);
  if (input.paymentRail === "ZMW") await initiateCollection(result.orderId);
  return result;
});
export const actOnStoreOrder = onCall(options, async (request) => actOnOrder(await requireActiveUser(request), request.data || {}));
export const downloadStoreAsset = onCall(options, async (request) => download(await requireActiveUser(request), request.data || {}));

export const getStoreWorkspace = onCall(options, async (request) => {
  const actor = await requireActiveUser(request);
  const input = request.data || {};
  const mode = String(input.mode || "purchases");
  if (!["purchases", "sales", "listings", "library", "payouts", "admin_listings", "admin_orders", "admin_disputes", "admin_payouts", "admin_sellers", "admin_events", "fee_history"].includes(mode)) throw new HttpsError("invalid-argument", "Unknown workspace.");
  if ((mode.startsWith("admin_") || mode === "fee_history") && !actor.admin) throw new HttpsError("permission-denied", "Admin access required.");
  const collection = mode.includes("listings") ? "storeListings" : mode.includes("payouts") ? "storePayouts" : mode === "admin_sellers" ? "storeSellerAccounts" : mode === "library" ? "storeGrants" : mode === "admin_events" ? "paymentEvents" : mode === "fee_history" ? "auditLogs" : "trades";
  let q: FirebaseFirestore.Query = db.collection(collection);
  if (collection === "trades") q = q.where("storeOrder", "==", true);
  if (mode === "purchases") q = q.where("buyerId", "==", actor.uid);
  if (["sales", "listings", "payouts"].includes(mode)) q = q.where("sellerId", "==", actor.uid);
  if (mode === "library") q = q.where("buyerId", "==", actor.uid);
  if (mode === "admin_listings" && input.status) q = q.where("status", "==", String(input.status));
  if (mode === "admin_disputes") q = q.where("status", "==", "disputed");
  if (mode === "admin_events") q = q.where("purpose", "==", "store");
  if (mode === "fee_history") q = q.where("action", "==", "economy_settings_updated");
  const sort = mode === "library" ? "grantedAt" : "createdAt";
  q = q.orderBy(sort, "desc").orderBy(admin.firestore.FieldPath.documentId());
  if (input.cursor) q = q.startAfter(admin.firestore.Timestamp.fromMillis(integer(input.cursor.value, "Cursor", 0, Number.MAX_SAFE_INTEGER)), identifier(input.cursor.id));
  const page = await q.limit(30).get();
  const last = page.docs.at(-1);
  const libraryOrders = mode === "library" && !page.empty ? await db.getAll(...page.docs.map((d) => ref("trades", d.id))) : [];
  const titles = new Map(libraryOrders.map((d) => [d.id, d.data()?.listing?.title || "Purchased release"]));
  return {items: page.docs.map((d) => serialize({id: d.id, ...d.data(), ...(mode === "library" ? {title: titles.get(d.id)} : {})})), cursor: page.size === 30 && last ? {id: last.id, value: serialize(last.get(sort))} : null};
});
export const getStoreOrder = onCall(options, async (request) => {
  const actor = await requireActiveUser(request);
  const id = identifier(request.data?.orderId);
  const snapshot = await ref("trades", id).get();
  if (!snapshot.exists || snapshot.data()?.storeOrder !== true) throw new HttpsError("not-found", "Order not found.");
  if (!actor.admin && !snapshot.data()?.participants.includes(actor.uid)) throw new HttpsError("permission-denied", "Participant access required.");
  const [events, messages] = await Promise.all([
    db.collection("storeOrderEvents").where("orderId", "==", id).orderBy("createdAt", "desc").limit(50).get(),
    db.collection("storeOrderMessages").where("orderId", "==", id).orderBy("createdAt", "desc").limit(50).get(),
  ]);
  let resources: unknown = null;
  if (snapshot.data()?.buyerId === actor.uid && snapshot.data()?.status === "completed") {
    const grant = await ref("storeGrants", id).get();
    if (grant.exists && !grant.data()?.revokedAt) {
      const order = snapshot.data() as StoreOrder;
      const current = order.kind === "gated_collection" ? await ref("storeListings", order.listingId).get() : null;
      if (!current || (current.exists && current.data()?.status !== "archived")) {
        const assetsId = current?.data()?.publishedVersion ? `${order.listingId}_v${current.data()?.publishedVersion}` : String(grant.data()?.assetsId);
        const assets = await ref("storeListingAssets", assetsId).get();
        const files = order.kind === "bespoke_request" ? order.submission?.files || [] : assets.data()?.files || [];
        resources = {files: files.map((file: {name: string; contentType: string; size: number}) => ({name: file.name, contentType: file.contentType, size: file.size})), posts: assets.data()?.posts || []};
      }
    }
  }
  return {order: serialize({id, ...snapshot.data()}), resources, events: events.docs.map((d) => serialize({id: d.id, ...d.data()})), messages: messages.docs.map((d) => serialize({id: d.id, ...d.data()}))};
});
export const messageStoreOrder = onCall(options, async (request) => {
  const actor = await requireActiveUser(request);
  const id = identifier(request.data?.orderId);
  const key = requireIdempotencyKey(request.data?.idempotencyKey);
  const content = requireString(request.data?.content, "Message", {max: 4000});
  return db.runTransaction(async (t) => {
    const [order, existing] = await t.getAll(ref("trades", id), ref("storeOrderMessages", `${id}_${key}`));
    if (!order.data()?.storeOrder || (!actor.admin && !order.data()?.participants.includes(actor.uid))) throw new HttpsError("permission-denied", "Participant access required.");
    if (existing.exists) {
      if (existing.data()?.authorId !== actor.uid || existing.data()?.content !== content) throw new HttpsError("already-exists", "Message key already used.");
      return {duplicate: true};
    }
    t.create(ref("storeOrderMessages", `${id}_${key}`), {orderId: id, participants: order.data()?.participants, authorId: actor.uid, content, createdAt: now()});
    return {success: true};
  });
});

export const getStoreOrderAsset = onCall(options, async (request) => {
  const actor = await requireActiveUser(request);
  const order = (await ref("trades", identifier(request.data?.orderId)).get()).data() as StoreOrder | undefined;
  if (!order?.storeOrder || (!actor.admin && !order.participants.includes(actor.uid))) throw new HttpsError("permission-denied", "Participant access required.");
  const index = integer(request.data?.index, "File index", 0, 20);
  const section = String(request.data?.section);
  let asset;
  if (section === "preview") asset = order.submission?.preview;
  if (section === "dispatch") asset = order.dispatch?.proof;
  if (section === "dispute") asset = order.dispute?.evidence[index];
  if (section === "brief") asset = order.brief[order.listing.fulfilment.questions[index]?.id];
  if (!asset || typeof asset !== "object" || Array.isArray(asset)) throw new HttpsError("not-found", "Private file not found.");
  const [url] = await admin.storage().bucket().file(asset.path, {generation: asset.generation}).getSignedUrl({version: "v4", action: "read", expires: Date.now() + 60000, responseDisposition: "attachment"});
  return {url};
});
export const getStoreSellerSummary = onCall(options, async (request) => {
  const actor = await requireActiveUser(request);
  const result = await db.collection("trades").where("storeOrder", "==", true).where("sellerId", "==", actor.uid).where("paymentRail", "==", "POINT").where("status", "==", "completed").aggregate({pointsEarned: admin.firestore.AggregateField.sum("price.sellerPayable")}).get();
  return result.data();
});
export const adminStoreSummary = onCall(options, async (request) => {
  await requireAdmin(request);
  const sum = (field: string) => admin.firestore.AggregateField.sum(field);
  const q = db.collection("trades").where("storeOrder", "==", true).where("paymentRail", "==", "ZMW");
  const [sales, refunds, pendingRefunds, liabilities, costs, issues] = await Promise.all([
    q.where("status", "in", ["paid", "pending_acceptance", "accepted", "in_progress", "preparing", "submitted", "revision_requested", "dispatched", "completed", "disputed", "ready_for_collection", "delivered", "refund_pending", "refunded"]).aggregate({grossSales: sum("price.buyerTotal"), productSubtotal: sum("price.productSubtotal"), sellerProductPayable: sum("price.sellerPayable"), platformFees: sum("price.platformFee"), delivery: sum("price.deliveryCharge")}).get(),
    q.where("status", "==", "refunded").aggregate({total: sum("price.buyerTotal"), feesReversed: sum("price.platformFee")}).get(),
    q.where("status", "==", "refund_pending").aggregate({total: sum("price.buyerTotal")}).get(),
    db.collection("sellerPayables").where("systemAccount", "==", false).aggregate({pending: sum("pending"), available: sum("available"), payoutPending: sum("payout_pending"), paid: sum("paid")}).get(),
    db.collection("ledgerEntries").where("currency", "==", "ZMW").where("accountId", "==", "__system_store_provider_costs").aggregate({providerFees: sum("amount")}).get(),
    db.collection("reconciliationIssues").where("purpose", "==", "store").where("status", "==", "open").limit(30).get(),
  ]);
  const s = sales.data();
  // Seller payable already includes delivery. Do not add delivery twice.
  return {sales: {...s, sellerProductPayable: s.sellerProductPayable - s.delivery}, refunds: refunds.data(), pendingRefunds: pendingRefunds.data().total,
    liabilities: liabilities.data(), costs: costs.data(), reconciliationDifference: s.grossSales - s.sellerProductPayable - s.platformFees,
    issues: issues.docs.map((d) => serialize({id: d.id, ...d.data()})), balanceSource: "Use the existing Lenco account balance API in Payments. Store journals are not the bank balance."};
});

export const saveStoreSeller = onCall(options, async (request) => {
  const actor = await requireActiveUser(request);
  requireCapability(await settings());
  const data = request.data || {};
  return db.runTransaction(async (t) => {
    const [user, old, account] = await t.getAll(ref("users", actor.uid), ref("storeSellerProfiles", actor.uid), ref("storeSellerAccounts", actor.uid));
    const legalName = String(data.legalName || "").trim().slice(0, 200);
    const phone = data.phone ? normalizePhone(String(data.phone)) : "";
    const operator = data.operator ? normalizeOperator(String(data.operator)) : "";
    const changed = account.data()?.legalName !== legalName || account.data()?.phone !== phone || account.data()?.operator !== operator;
    if (changed && account.data()?.activePayoutId) throw new HttpsError("failed-precondition", "Resolve the pending payout before changing account details.");
    t.set(ref("storeSellerProfiles", actor.uid), {sellerId: actor.uid, displayName: String(user.data()?.displayName || "Member"), photoURL: String(user.data()?.photoURL || ""), description: String(data.description || "").slice(0, 2000), available: data.available === true, verified: changed ? false : old.data()?.verified === true, createdAt: old.data()?.createdAt || now(), updatedAt: now()});
    t.set(ref("storeSellerAccounts", actor.uid), {sellerId: actor.uid, legalName, phone, operator, ownsAccount: data.ownsAccount === true, identityVerified: changed ? false : account.data()?.identityVerified === true, adminApproved: changed || data.ownsAccount !== true ? false : account.data()?.adminApproved === true, activePayoutId: account.data()?.activePayoutId || null, createdAt: account.data()?.createdAt || now(), updatedAt: now()}, {merge: true});
    return {success: true};
  });
});
export const getStoreSeller = onCall(options, async (request) => {
  const actor = request.auth ? await requireActiveUser(request) : null;
  const uid = identifier(request.data?.sellerId || actor?.uid);
  const [profile, account, payable] = await Promise.all([ref("storeSellerProfiles", uid).get(), actor?.uid === uid || actor?.admin ? ref("storeSellerAccounts", uid).get() : null, actor?.uid === uid || actor?.admin ? ref("sellerPayables", uid).get() : null]);
  if (!account) {
    const [config, user] = await Promise.all([settings(), ref("users", uid).get()]);
    if (!config.storeEnabled || !active(user.data())) return {profile: null, account: null, payable: null};
  }
  return {profile: profile.exists ? serialize(profile.data()) : null, account: account?.data() || null, payable: payable?.data() || {available: 0, pending: 0, payout_pending: 0, paid: 0, reversed: 0}};
});
export const adminVerifyStoreSeller = onCall(options, async (request) => {
  const actor = await requireAdmin(request);
  const id = identifier(request.data?.sellerId);
  const reason = requireString(request.data?.reason, "Verification reason", {min: 10, max: 1000});
  await db.runTransaction(async (t) => {
    const [account, user] = await t.getAll(ref("storeSellerAccounts", id), ref("users", id));
    const a = account.data();
    if (!a || !active(user.data()) || !a.legalName || !a.phone || !a.operator || !a.ownsAccount) throw new HttpsError("failed-precondition", "Seller onboarding is incomplete.");
    const approved = request.data?.approved === true;
    t.update(account.ref, {identityVerified: approved, adminApproved: approved, approvedBy: actor.uid, approvedAt: now(), updatedAt: now()});
    t.update(ref("storeSellerProfiles", id), {verified: approved, updatedAt: now()});
    audit(t, actor.uid, "store_seller_verification", id, {approved, reason});
  });
  return {success: true};
});
export const adminUpdateStoreSettings = onCall(options, async (request) => {
  const actor = await requireAdmin(request);
  const data = request.data || {};
  const reason = requireString(data.reason, "Change reason", {min: 10, max: 1000});
  const next = {...STORE_DEFAULTS};
  for (const key of ["storeEnabled", "zmwCheckoutEnabled", "sellerPayoutsEnabled", "physicalProductsEnabled", "gatedCollectionsEnabled", "autoApprovalEnabled"] as const) next[key] = data[key] === true;
  for (const key of ["autoApprovalHours", "minimumPriceNgwee", "minimumPricePoints", "minimumPayoutNgwee"] as const) next[key] = integer(data[key] ?? next[key], key, 1, key === "autoApprovalHours" ? 8760 : 100000000);
  if (data.deliveryRegions) {
    if (!Array.isArray(data.deliveryRegions) || !data.deliveryRegions.length || data.deliveryRegions.length > 10) throw new HttpsError("invalid-argument", "Configure 1–10 Zambian regions.");
    next.deliveryRegions = data.deliveryRegions.map((r: unknown) => requireString(r, "Region", {max: 100}));
  }
  if ((next.zmwCheckoutEnabled || next.sellerPayoutsEnabled) && process.env.LENCO_MARKETPLACE_APPROVED !== "true") throw new HttpsError("failed-precondition", "Lenco marketplace approval must be recorded in deployment configuration first.");
  if (next.sellerPayoutsEnabled && !process.env.LENCO_MARKETPLACE_ACCOUNT_ID) throw new HttpsError("failed-precondition", "Configure the approved Lenco payout account.");
  await db.runTransaction(async (t) => {
    const old = await t.get(ref("settings", "store"));
    next.version = Number(old.data()?.version || 0) + 1;
    t.set(old.ref, {...next, updatedAt: now(), updatedBy: actor.uid});
    audit(t, actor.uid, "store_settings_updated", "store", {before: old.data() || null, after: next, reason});
  });
  return {success: true};
});
export const requestStorePayout = onCall(paymentOptions, async (request) => requestPayout(await requireActiveUser(request), request.data || {}));
export const checkStorePayment = onCall(paymentOptions, async (request) => {
  const actor = await requireActiveUser(request);
  const id = identifier(request.data?.orderId);
  const p = await ref("payments", id).get();
  if (p.data()?.purpose !== "store_order" || (!actor.admin && p.data()?.userId !== actor.uid)) throw new HttpsError("permission-denied", "Buyer access required.");
  return reconcileCollection(id);
});
export const checkStorePayout = onCall(paymentOptions, async (request) => {
  const actor = await requireActiveUser(request);
  const id = identifier(request.data?.payoutId);
  const p = await ref("storePayouts", id).get();
  if (!p.exists || (!actor.admin && p.data()?.sellerId !== actor.uid)) throw new HttpsError("permission-denied", "Seller access required.");
  return reconcilePayout(id);
});

export const lencoStoreWebhook = onRequest({invoker: "public", secrets: [lencoSecretKey]}, async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).send("Method Not Allowed"); return;
  }
  const signature = request.get("x-lenco-signature") || "";
  if (!request.rawBody || !validWebhookSignature(request.rawBody, signature, lencoSecretKey.value())) {
    response.status(403).send("Forbidden"); return;
  }
  try {
    const handled = await handleVerifiedStoreEvent(request.body as Record<string, unknown>, request.rawBody);
    response.status(200).send(handled ? "OK" : "Ignored");
  } catch {
    response.status(500).send("Retry required");
  }
});

export async function retryFulfilment(id: string) {
  return db.runTransaction(async (t) => {
    const orderSnap = await t.get(ref("trades", id));
    if (orderSnap.data()?.status !== "paid" || orderSnap.data()?.storeOrder !== true) return;
    const order = {id, ...orderSnap.data()} as StoreOrder;
    const [assets, buyer, seller, listing] = await t.getAll(ref("storeListingAssets", `${order.listingId}_v${order.listingVersion}`), ref("users", order.buyerId), ref("users", order.sellerId), ref("storeListings", order.listingId));
    if (!active(buyer.data()) || !active(seller.data())) return;
    const auto = ["digital_release", "gated_collection"].includes(order.kind);
    if (auto && !autoDeliveryReady(order.kind, assets.data())) return;
    if (auto) {
      await settleOrder(t, order, "completed", "fulfilment_retry", "fulfilment_retry");
      grantWrite(t, order);
      if (listing.exists) reserveWrite(t, {id: listing.id, ...listing.data()} as StoreListing, "sold");
    }
    const status = auto ? "completed" : "pending_acceptance";
    t.update(orderSnap.ref, {status, expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 72 * 60 * 60 * 1000), updatedAt: now()});
    orderEvent(t, order, "fulfilment_retry", status, "fulfilment_retry");
  });
}
export const retryStoreFulfilment = onCall(options, async (request) => {
  const actor = await requireActiveUser(request);
  const id = identifier(request.data?.orderId);
  const order = await ref("trades", id).get();
  if (!actor.admin && order.data()?.buyerId !== actor.uid) throw new HttpsError("permission-denied", "Buyer access required.");
  await retryFulfilment(id);
  return {success: true};
});
export const recoverStoreOrders = onSchedule({schedule: "every 30 minutes", timeZone: "Africa/Lusaka", secrets: [lencoSecretKey]}, async () => {
  const [payments, payouts, expired, paid, collectionFees, payoutFees] = await Promise.all([
    db.collection("payments").where("purpose", "==", "store_order").where("status", "in", ["initiated", "pending", "pending_verification"]).orderBy("updatedAt").limit(30).get(),
    db.collection("storePayouts").where("status", "in", ["pending", "pending_verification"]).orderBy("updatedAt").limit(30).get(),
    db.collection("trades").where("storeOrder", "==", true).where("status", "==", "pending_acceptance").where("expiresAt", "<=", admin.firestore.Timestamp.now()).limit(30).get(),
    db.collection("trades").where("storeOrder", "==", true).where("status", "==", "paid").orderBy("updatedAt").limit(30).get(),
    db.collection("payments").where("purpose", "==", "store_order").where("status", "in", ["paid", "refunded"]).where("collectionFeeNgwee", "==", null).orderBy("updatedAt").limit(20).get(),
    db.collection("storePayouts").where("status", "in", ["paid", "failed"]).where("payoutFeeNgwee", "==", null).orderBy("updatedAt").limit(20).get(),
  ]);
  const jobs = [...[...payments.docs, ...collectionFees.docs].map((p) => ({record: p, run: () => reconcileCollection(p.id)})), ...[...payouts.docs, ...payoutFees.docs].map((p) => ({record: p, run: () => reconcilePayout(p.id)})), ...expired.docs.map((p) => ({record: p, run: () => actOnOrder({uid: "store_expiry", email: null, admin: true, curator: false}, {orderId: p.id, action: "expire", idempotencyKey: "automatic_expiry"})})), ...paid.docs.map((p) => ({record: p, run: () => retryFulfilment(p.id)}))];
  const config = await settings();
  if (config.autoApprovalEnabled) {
    const due = await db.collection("trades").where("storeOrder", "==", true).where("status", "==", "submitted").where("submission.submittedAt", "<=", admin.firestore.Timestamp.fromMillis(Date.now() - config.autoApprovalHours * 3600000)).limit(30).get();
    for (const record of due.docs) jobs.push({record, run: () => actOnOrder({uid: "store_auto_approval", email: null, admin: true, curator: false}, {orderId: record.id, action: "auto_approve", idempotencyKey: `automatic_approval_${record.data().revisionCount}`})});
  }
  for (const job of jobs) {
    try {
      await job.run();
    } catch (error) {
      logger.error("Store recovery requires attention", {recordId: job.record.id, error});
      await ref("reconciliationIssues", `store_${job.record.id}`).set({purpose: "store", referenceId: job.record.id, status: "open", error: error instanceof Error ? error.message : "Recovery failed", updatedAt: now()}, {merge: true});
    }
    // Rotate unresolved records so one old request cannot starve later payments.
    if (["payments", "storePayouts"].includes(job.record.ref.parent.id) || job.record.data().status === "paid") await job.record.ref.update({updatedAt: now(), lastReconciledAt: now()});
  }
});
