import {createHash} from "node:crypto";
import {HttpsError} from "firebase-functions/v2/https";
import type {AuthenticatedActor} from "../core/auth";
import {requireIdempotencyKey, requireString} from "../core/errors";
import {admin, db} from "../core/firebase";
import {deterministicId} from "../core/idempotency";
import {DISABLED_ECONOMY_SETTINGS, requireEconomyEnabled} from "../core/settings";
import {getSystemAccount, postLedgerTransaction} from "../wallet/ledger";
import {newPointsWalletRecord} from "../wallet/records";
import type {LedgerEntry, LedgerPostInput} from "../types/economy";
import {active, identifier, integer, quote, requireCapability, STORE_DEFAULTS, validateBrief} from "./policy";
import {audit, autoDeliveryReady, now, ref, serialize, verifyAssets} from "./catalog";
import type {CheckoutInput, OrderStatus, StoreAsset, StoreListing, StoreOrder} from "./types";

export const orderIdFor = (uid: string, key: string) => deterministicId("store_order", uid, key);
export function orderEvent(t: FirebaseFirestore.Transaction, order: StoreOrder, actorId: string, status: string, key: string, detail: Record<string, unknown> = {}) {
  t.create(ref("storeOrderEvents", deterministicId("store_event", order.id, key)), {orderId: order.id, participants: order.participants, actorId, from: order.status, to: status, detail, createdAt: now()});
}
export function grantWrite(t: FirebaseFirestore.Transaction, order: StoreOrder) {
  if (!["digital_release", "bespoke_request", "gated_collection"].includes(order.kind)) return;
  t.create(ref("storeGrants", order.id), {orderId: order.id, listingId: order.listingId, buyerId: order.buyerId, sellerId: order.sellerId,
    version: order.listingVersion, assetsId: `${order.listingId}_v${order.listingVersion}`, kind: order.kind,
    grantedAt: now(), revokedAt: null, accessExpiresAt: null, downloadCount: 0, lastDownloadedAt: null, downloadLimit: order.listing.downloadLimit});
}
export function reserveWrite(t: FirebaseFirestore.Transaction, listing: StoreListing, outcome: "reserve" | "sold" | "restore") {
  if (listing.inventory === null) return;
  const inventory = listing.inventory + (outcome === "reserve" ? -1 : outcome === "restore" ? 1 : 0);
  const reserved = listing.reserved + (outcome === "reserve" ? 1 : -1);
  if (inventory < 0 || reserved < 0) throw new HttpsError("failed-precondition", "Inventory reservation is unavailable.");
  const status = inventory === 0 && listing.status === "published" ? "sold_out" : inventory > 0 && listing.status === "sold_out" ? "published" : listing.status;
  t.update(ref("storeListings", listing.id), {inventory, reserved, status, sold: listing.sold + (outcome === "sold" ? 1 : 0), updatedAt: now()});
}
function ledgerInput(order: StoreOrder, key: string, type: LedgerPostInput["type"], entries: LedgerEntry[], actorId: string): LedgerPostInput {
  return {transactionId: deterministicId("store_ledger", order.id, key), type, currency: order.paymentRail,
    status: "completed", senderWalletId: order.buyerId, receiverWalletId: order.sellerId, participants: order.participants,
    amount: order.price.buyerTotal, fee: type === "escrow_lock" || type === "escrow_refund" || type === "store_refund_hold" ? 0 : order.price.platformFee, referenceType: "store_order", referenceId: order.id,
    createdBy: actorId, idempotencyKey: key, entries, metadata: {platformFee: order.price.platformFee, feeReversed: type === "escrow_refund" && order.status === "completed" ? order.price.platformFee : 0, feeBasisPoints: order.price.feeBasisPoints, listingId: order.listingId}};
}
export async function checkout(actor: AuthenticatedActor, input: CheckoutInput) {
  requireIdempotencyKey(input.idempotencyKey);
  const id = orderIdFor(actor.uid, input.idempotencyKey);
  identifier(input.listingId);
  if (!input.termsAccepted || !["POINT", "ZMW"].includes(input.paymentRail)) throw new HttpsError("invalid-argument", "Accept the licence and terms and choose one payment method.");
  const fingerprint = createHash("sha256").update(JSON.stringify({listingId: input.listingId, listingVersion: input.listingVersion, paymentRail: input.paymentRail, addOnIds: input.addOnIds || [], brief: input.brief || {}, delivery: input.delivery || null, phone: input.phone || "", operator: input.operator || ""})).digest("hex");
  // Validate uploaded references before entering a retried Firestore transaction.
  const referenceAssets = Object.values(input.brief || {}).filter((answer): answer is StoreAsset => !!answer && typeof answer === "object" && !Array.isArray(answer));
  const checkedAssets = referenceAssets.length ? await verifyAssets(referenceAssets, actor.uid) : [];
  return db.runTransaction(async (t) => {
    const existing = await t.get(ref("trades", id));
    if (existing.exists) {
      if (existing.data()?.checkoutFingerprint !== fingerprint) throw new HttpsError("already-exists", "Checkout key already belongs to another request.");
      return {orderId: id, status: existing.data()?.status, duplicate: true};
    }
    const [listingSnap, settingsSnap, economySnap, buyer] = await t.getAll(ref("storeListings", input.listingId), ref("settings", "store"), ref("settings", "economy"), ref("users", actor.uid));
    if (!listingSnap.exists) throw new HttpsError("not-found", "Listing not found.");
    const listing = {id: listingSnap.id, ...listingSnap.data()} as StoreListing;
    const config = {...STORE_DEFAULTS, ...settingsSnap.data()};
    requireCapability(config, listing.productType, input.paymentRail);
    const [seller, shop, assets] = await t.getAll(ref("users", listing.sellerId), ref("storeSellerProfiles", listing.sellerId), ref("storeListingAssets", `${listing.id}_v${listing.version}`));
    if (!active(buyer.data()) || !active(seller.data()) || shop.data()?.available !== true) throw new HttpsError("permission-denied", "Buyer or seller is unavailable.");
    if (actor.uid === listing.sellerId) throw new HttpsError("invalid-argument", "You cannot purchase your own release.");
    if (listing.status !== "published" || (listing.inventory !== null && listing.inventory < 1)) throw new HttpsError("failed-precondition", "This release is unavailable or sold out.");
    if (listing.version !== input.listingVersion) throw new HttpsError("aborted", "The listing changed. Review its current terms before buying.");
    const auto = ["digital_release", "gated_collection"].includes(listing.productType);
    if (auto && !autoDeliveryReady(listing.productType, assets.data())) throw new HttpsError("failed-precondition", "The release files are not ready.");
    const economy = {...DISABLED_ECONOMY_SETTINGS, ...economySnap.data()};
    const missingPointsWallets: FirebaseFirestore.DocumentReference[] = [];
    if (input.paymentRail === "POINT") {
      requireEconomyEnabled(economy, "trading");
      const [buyerWallet, sellerWallet] = await t.getAll(ref("wallets", actor.uid), ref("wallets", listing.sellerId));
      for (const wallet of [buyerWallet, sellerWallet]) {
        if (!wallet.exists) {
          // Profiles created before wallet provisioning may have no wallet record.
          missingPointsWallets.push(wallet.ref);
        } else if (wallet.data()?.status !== "active") {
          throw new HttpsError("failed-precondition", wallet.id === actor.uid ? "Your Points wallet is unavailable." : "This seller's Points wallet is unavailable.");
        }
      }
    }
    const price = quote(listing, input, economy.tradeFeeBasisPoints);
    const brief = validateBrief(listing, input.brief);
    for (const [key, answer] of Object.entries(brief)) {
      if (typeof answer === "object" && !Array.isArray(answer)) {
        const verified = checkedAssets.find((asset) => asset.path === answer.path);
        if (!verified?.contentType.startsWith("image/")) throw new HttpsError("invalid-argument", "Reference uploads must be images.");
        brief[key] = verified;
      }
    }
    let delivery: CheckoutInput["delivery"] = null;
    if (listing.productType === "physical_original" && input.delivery) {
      delivery = {
        recipient: requireString(input.delivery.recipient, "Recipient", {max: 200}), phone: requireString(input.delivery.phone, "Recipient phone", {pattern: /^(\+?260|0)\d{9}$/}),
        region: input.delivery.region, address: requireString(input.delivery.address, "Address or pickup details", {max: 1000}), instructions: String(input.delivery.instructions || "").slice(0, 1000),
      };
    }
    const status: OrderStatus = input.paymentRail === "ZMW" ? "payment_pending" : auto ? "completed" : "pending_acceptance";
    const order = {id, storeOrder: true, buyerId: actor.uid, sellerId: listing.sellerId, participants: [actor.uid, listing.sellerId],
      listingId: listing.id, listingVersion: listing.version, kind: listing.productType, paymentRail: input.paymentRail, status,
      price, listing: serialize(listing), brief, delivery, addOnIds: input.addOnIds || [], revisionCount: 0,
      amount: price.buyerTotal, fee: price.platformFee, feeBasisPoints: price.feeBasisPoints,
      checkoutFingerprint: fingerprint, termsAcceptedAt: now(), inventoryReserved: listing.inventory !== null,
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 72 * 60 * 60 * 1000), createdAt: now(), updatedAt: now()} as unknown as StoreOrder;
    if (input.paymentRail === "POINT") {
      const entries: LedgerEntry[] = [
        {accountId: actor.uid, bucket: "available", amount: -price.buyerTotal},
        {accountId: actor.uid, bucket: "locked", amount: price.buyerTotal},
      ];
      if (auto) entries.push({accountId: actor.uid, bucket: "locked", amount: -price.buyerTotal}, {accountId: listing.sellerId, bucket: "available", amount: price.sellerPayable}, ...(price.platformFee ? [{accountId: getSystemAccount("fees", id), bucket: "available" as const, amount: price.platformFee}] : []));
      await postLedgerTransaction(ledgerInput(order, "checkout", auto ? "marketplace_purchase" : "escrow_lock", entries, actor.uid), t);
      // The ledger finishes all reads first and remains responsible for balances.
      for (const walletRef of missingPointsWallets) t.create(walletRef, newPointsWalletRecord(walletRef.id));
      t.create(ref("escrows", id), {tradeId: id, storeOrder: true, buyerId: actor.uid, sellerId: listing.sellerId, participants: order.participants, amount: price.buyerTotal, status: auto ? "released" : "locked", createdAt: now(), updatedAt: now()});
    }
    t.create(ref("trades", id), {...order, fundingTransactionId: input.paymentRail === "POINT" ? deterministicId("store_ledger", id, "checkout") : null});
    if (listing.inventory !== null) {
      reserveWrite(t, listing, "reserve");
      if (status === "completed") t.update(listingSnap.ref, {reserved: listing.reserved, sold: listing.sold + 1});
    }
    if (status === "completed") grantWrite(t, order);
    orderEvent(t, {...order, status: "payment_pending"}, actor.uid, status, "checkout", {transitions: input.paymentRail === "POINT" ? ["funded", status] : [status], price});
    if (input.paymentRail === "ZMW") t.create(ref("payments", id), {purpose: "store_order", provider: "lenco", userId: actor.uid, sellerId: listing.sellerId, orderId: id, currency: "ZMW", amountNgwee: price.buyerTotal, phone: input.phone, operator: input.operator, status: "initiated", createdAt: now(), updatedAt: now()});
    return {orderId: id, status, duplicate: false};
  });
}

export function nextState(order: StoreOrder, actorId: string, action: string, isAdmin: boolean): OrderStatus {
  const buyer = actorId === order.buyerId;
  const seller = actorId === order.sellerId;
  if (!buyer && !seller && !isAdmin) throw new HttpsError("permission-denied", "Order participant access required.");
  const rules: Record<string, {from: string[]; to: OrderStatus; permitted: boolean}> = {
    accept: {from: ["pending_acceptance"], to: "accepted", permitted: seller},
    start: {from: ["accepted"], to: order.kind === "physical_original" ? "preparing" : "in_progress", permitted: seller},
    submit: {from: ["accepted", "in_progress", "revision_requested"], to: "submitted", permitted: seller && order.kind === "bespoke_request"},
    revise: {from: ["submitted"], to: "revision_requested", permitted: buyer && order.revisionCount < order.listing.fulfilment.revisionRounds},
    ready: {from: ["accepted", "preparing"], to: "ready_for_collection", permitted: seller && order.kind === "physical_original" && order.delivery?.region === "pickup"},
    dispatch: {from: ["accepted", "preparing"], to: "dispatched", permitted: seller && order.kind === "physical_original" && order.delivery?.region !== "pickup"},
    auto_approve: {from: ["submitted"], to: "completed", permitted: isAdmin && order.kind === "bespoke_request"},
    approve: {from: ["submitted", "ready_for_collection", "dispatched", "delivered"], to: "completed", permitted: buyer},
    dispute: {from: ["accepted", "in_progress", "preparing", "submitted", "revision_requested", "ready_for_collection", "dispatched", "delivered"], to: "disputed", permitted: buyer || seller},
    reject: {from: ["pending_acceptance"], to: "refunded", permitted: seller},
    cancel: {from: ["pending_acceptance"], to: "refunded", permitted: buyer},
    expire: {from: ["pending_acceptance"], to: "refunded", permitted: isAdmin},
    resolve_release: {from: ["disputed"], to: "completed", permitted: isAdmin},
    resolve_refund: {from: ["disputed", "completed", "paid", "pending_acceptance"], to: "refunded", permitted: isAdmin},
    confirm_refund: {from: ["refund_pending"], to: "refunded", permitted: isAdmin && order.paymentRail === "ZMW"},
  };
  const rule = rules[action];
  if (!rule?.permitted) throw new HttpsError("permission-denied", "This action is not permitted.");
  if (!rule.from.includes(order.status)) throw new HttpsError("failed-precondition", "This order cannot make that transition.");
  return rule.to;
}

export async function settleOrder(t: FirebaseFirestore.Transaction, order: StoreOrder, target: "completed" | "refunded" | "refund_pending", actorId: string, key: string, refundFeeNgwee: number | null = null) {
  const p = order.price;
  const feeAccount = getSystemAccount("fees", order.id);
  const completedRefund = order.status === "completed";
  let entries: LedgerEntry[];
  let type: LedgerPostInput["type"];
  if (order.paymentRail === "POINT") {
    type = target === "completed" ? "escrow_release" : "escrow_refund";
    entries = target === "completed" ? [
      {accountId: order.buyerId, bucket: "locked", amount: -p.buyerTotal}, {accountId: order.sellerId, bucket: "available", amount: p.sellerPayable},
      ...(p.platformFee ? [{accountId: feeAccount, bucket: "available" as const, amount: p.platformFee}] : []),
    ] : completedRefund ? [
      {accountId: order.sellerId, bucket: "available", amount: -p.sellerPayable}, {accountId: order.buyerId, bucket: "available", amount: p.buyerTotal},
      ...(p.platformFee ? [{accountId: feeAccount, bucket: "available" as const, amount: -p.platformFee}] : []),
    ] : [{accountId: order.buyerId, bucket: "locked", amount: -p.buyerTotal}, {accountId: order.buyerId, bucket: "available", amount: p.buyerTotal}];
  } else if (target === "completed") {
    type = "store_release";
    entries = [{accountId: order.sellerId, bucket: "pending", amount: -p.sellerPayable}, {accountId: order.sellerId, bucket: "available", amount: p.sellerPayable},
      ...(p.platformFee ? [{accountId: feeAccount, bucket: "pending" as const, amount: -p.platformFee}, {accountId: feeAccount, bucket: "available" as const, amount: p.platformFee}] : [])];
  } else if (target === "refund_pending") {
    if (!completedRefund) return;
    type = "store_refund_hold";
    entries = [{accountId: order.sellerId, bucket: "available", amount: -p.sellerPayable}, {accountId: order.sellerId, bucket: "pending", amount: p.sellerPayable},
      ...(p.platformFee ? [{accountId: feeAccount, bucket: "available" as const, amount: -p.platformFee}, {accountId: feeAccount, bucket: "pending" as const, amount: p.platformFee}] : [])];
  } else {
    type = "store_refund";
    entries = [{accountId: order.sellerId, bucket: "pending", amount: -p.sellerPayable}, {accountId: "__system_store_collections", bucket: "available", amount: p.buyerTotal},
      ...(p.platformFee ? [{accountId: feeAccount, bucket: "pending" as const, amount: -p.platformFee}] : []),
      {accountId: order.sellerId, bucket: "reversed", amount: p.sellerPayable}, {accountId: "__system_store_reversals", bucket: "available", amount: -p.sellerPayable}];
    if (refundFeeNgwee) entries.push({accountId: "__system_store_provider_costs", bucket: "available", amount: refundFeeNgwee}, {accountId: "__system_store_collections", bucket: "available", amount: -refundFeeNgwee});
  }
  await postLedgerTransaction({...ledgerInput(order, key, type, entries, actorId), ...(target === "refunded" ? {reversesTransactionId: deterministicId("store_ledger", order.id, order.paymentRail === "ZMW" ? "collection" : "checkout")} : {})}, t);
  if (order.paymentRail === "POINT") t.update(ref("escrows", order.id), {status: target === "completed" ? "released" : "refunded", updatedAt: now()});
}

export async function actOnOrder(actor: AuthenticatedActor, input: Record<string, unknown>) {
  const id = identifier(input.orderId);
  const action = requireString(input.action, "Action");
  const key = requireIdempotencyKey(input.idempotencyKey);
  const attachments = input.files ? await verifyAssets(input.files, actor.uid) : [];
  const proof = input.proof ? (await verifyAssets([input.proof], actor.uid))[0] : null;
  const evidence = input.evidence ? await verifyAssets(input.evidence, actor.uid) : [];
  const message = String(input.message || "").trim().slice(0, 4000);
  const refundFeeNgwee = action === "confirm_refund" && input.refundFeeNgwee != null ? integer(input.refundFeeNgwee, "Provider refund fee") : null;
  const fingerprint = createHash("sha256").update(JSON.stringify({action, message, attachments, proof, evidence, method: input.method || "", reference: input.reference || "", category: input.category || "", reason: input.reason || "", providerRefundId: input.providerRefundId || "", refundFeeNgwee})).digest("hex");
  return db.runTransaction(async (t) => {
    const [snapshot, operation] = await t.getAll(ref("trades", id), ref("storeOperations", `${id}_${key}`));
    if (!snapshot.exists || snapshot.data()?.storeOrder !== true) throw new HttpsError("not-found", "Store order not found.");
    const order = {id, ...snapshot.data()} as StoreOrder;
    if (operation.exists) {
      if (operation.data()?.actorId !== actor.uid || operation.data()?.fingerprint !== fingerprint) throw new HttpsError("already-exists", "Request key is already used.");
      return {orderId: id, status: order.status, duplicate: true};
    }
    const [listingSnap, buyer, seller, grant] = await t.getAll(ref("storeListings", order.listingId), ref("users", order.buyerId), ref("users", order.sellerId), ref("storeGrants", id));
    if (!actor.admin && (!active(actor.uid === order.buyerId ? buyer.data() : seller.data()))) throw new HttpsError("permission-denied", "This account is unavailable.");
    if (["accept", "start", "submit", "ready", "dispatch", "approve"].includes(action) && (!active(buyer.data()) || !active(seller.data()))) throw new HttpsError("permission-denied", "A participant is unavailable. Contact an administrator.");
    let status = nextState(order, actor.uid, action, actor.admin);
    if (action === "auto_approve") {
      const config = {...STORE_DEFAULTS, ...(await t.get(ref("settings", "store"))).data()};
      const submittedAt = (snapshot.get("submission.submittedAt") as admin.firestore.Timestamp)?.toMillis();
      if (!config.autoApprovalEnabled || !submittedAt || submittedAt + config.autoApprovalHours * 3600000 > Date.now() || !active(buyer.data()) || !active(seller.data())) throw new HttpsError("failed-precondition", "Automatic approval is disabled or not due.");
    }
    const expiresAt = (snapshot.get("expiresAt") as admin.firestore.Timestamp).toMillis();
    if (action === "accept" && expiresAt <= Date.now()) throw new HttpsError("failed-precondition", "The acceptance window expired.");
    if (action === "expire" && expiresAt > Date.now()) throw new HttpsError("failed-precondition", "The acceptance window is still open.");
    if (status === "refunded" && order.paymentRail === "ZMW" && action !== "confirm_refund") status = "refund_pending";
    const extra: Record<string, unknown> = {};
    if (action === "submit") {
      if (!attachments.length || !message) throw new HttpsError("invalid-argument", "Include final files and a submission message.");
      extra.submission = {message, files: attachments, preview: proof, submittedAt: now()};
    }
    if (action === "revise") {
      requireString(message, "Revision instructions", {min: 10, max: 4000});
      extra.revisionCount = order.revisionCount + 1;
    }
    if (action === "dispatch") extra.dispatch = {method: requireString(input.method, "Delivery method"), reference: String(input.reference || "").slice(0, 200), proof};
    if (action === "dispute") extra.dispute = {openedBy: actor.uid, category: requireString(input.category, "Reason category"), explanation: requireString(input.reason, "Dispute explanation", {min: 20, max: 4000}), evidence, from: order.status, openedAt: now()};
    if (action.startsWith("resolve_") || action === "confirm_refund") {
      const reason = requireString(input.reason, "Admin decision reason", {min: 10, max: 1000});
      extra.resolution = {actorId: actor.uid, reason, action, decidedAt: now()};
    }
    if (action === "confirm_refund") {
      const providerRefundId = requireString(input.providerRefundId, "Confirmed provider refund reference", {max: 200});
      const receiptId = deterministicId("store_refund_receipt", "lenco", providerRefundId);
      const receipt = await t.get(ref("storeRefundReceipts", receiptId));
      if (receipt.exists) throw new HttpsError("already-exists", "This refund reference is already recorded.");
      extra.providerRefundId = providerRefundId;
      extra.refundReceiptId = receiptId;
      extra.providerRefundFeeNgwee = refundFeeNgwee;
    }
    if (status === "completed" && order.kind === "bespoke_request" && !order.submission?.files.length) throw new HttpsError("failed-precondition", "Final files are required before release.");
    if (["completed", "refunded", "refund_pending"].includes(status)) await settleOrder(t, order, status as "completed" | "refunded" | "refund_pending", actor.uid, key, refundFeeNgwee);
    if (status === "completed" && !grant.exists) grantWrite(t, order);
    if (["refunded", "refund_pending"].includes(status) && grant.exists) t.update(grant.ref, {revokedAt: now()});
    if (status === "refunded" && listingSnap.exists && listingSnap.data()?.inventory !== null) {
      const listing = {id: listingSnap.id, ...listingSnap.data()} as StoreListing;
      const wasCompleted = order.status === "completed" || snapshot.data()?.refundFrom === "completed";
      if (listing.inventory === null) throw new HttpsError("failed-precondition", "Inventory changed. Review this refund.");
      if (wasCompleted) t.update(listingSnap.ref, {inventory: listing.inventory + 1, sold: Math.max(0, listing.sold - 1), status: listing.status === "sold_out" ? "published" : listing.status, updatedAt: now()});
      else reserveWrite(t, listing, "restore");
    }
    if (status === "completed" && listingSnap.exists) reserveWrite(t, {id: listingSnap.id, ...listingSnap.data()} as StoreListing, "sold");
    if (status === "refund_pending") extra.refundFrom = order.status;
    if (action === "confirm_refund") {
      t.create(ref("storeRefundReceipts", String(extra.refundReceiptId)), {orderId: id, providerRefundId: extra.providerRefundId, actorId: actor.uid, amountNgwee: order.price.buyerTotal, createdAt: now()});
      t.update(ref("payments", id), {status: "refunded", providerRefundId: extra.providerRefundId, updatedAt: now()});
    }
    t.update(snapshot.ref, {status, ...extra, updatedAt: now()});
    t.create(ref("storeOperations", `${id}_${key}`), {actorId: actor.uid, fingerprint, status, createdAt: now()});
    orderEvent(t, order, actor.uid, status, key, {action, message, ...extra});
    if (actor.admin) audit(t, actor.uid, `store_order_${action}`, id, {from: order.status, to: status, ...extra});
    return {orderId: id, status, duplicate: false};
  });
}

export async function download(actor: AuthenticatedActor, input: Record<string, unknown>) {
  const id = identifier(input.orderId);
  const index = Number(input.fileIndex);
  const key = requireIdempotencyKey(input.idempotencyKey);
  const asset = await db.runTransaction(async (t) => {
    const [grant, orderSnap, attempt, user] = await t.getAll(ref("storeGrants", id), ref("trades", id), ref("storeDownloadAttempts", `${id}_${key}`), ref("users", actor.uid));
    const g = grant.data();
    if (!active(user.data()) || !g || g.buyerId !== actor.uid || g.revokedAt || (g.accessExpiresAt && g.accessExpiresAt.toMillis() <= Date.now()) || orderSnap.data()?.status !== "completed") throw new HttpsError("permission-denied", "A completed purchase is required.");
    const order = orderSnap.data() as StoreOrder;
    const listing = order.kind === "gated_collection" ? await t.get(ref("storeListings", order.listingId)) : null;
    if (listing && (!listing.exists || listing.data()?.status === "archived")) throw new HttpsError("failed-precondition", "This collection is unavailable.");
    const assetsId = listing?.data()?.publishedVersion ? `${order.listingId}_v${listing.data()?.publishedVersion}` : String(g.assetsId);
    const assets = await t.get(ref("storeListingAssets", assetsId));
    const files: StoreAsset[] = order.kind === "bespoke_request" ? order.submission?.files || [] : assets.data()?.files || [];
    if (!Number.isInteger(index) || !files[index]) throw new HttpsError("not-found", "File not found.");
    if (attempt.exists) {
      if (attempt.data()?.fileIndex !== index || attempt.data()?.buyerId !== actor.uid) throw new HttpsError("already-exists", "Download key already used.");
      if (Date.now() - attempt.data()?.createdAt.toMillis() > 60000) throw new HttpsError("failed-precondition", "Download request expired. Request a new download.");
      return attempt.data()?.asset as StoreAsset;
    }
    if (g.downloadLimit !== null && g.downloadCount >= g.downloadLimit) throw new HttpsError("resource-exhausted", "Download limit reached. Contact support.");
    t.update(grant.ref, {downloadCount: g.downloadCount + 1, lastDownloadedAt: now()});
    t.create(ref("storeDownloadAttempts", `${id}_${key}`), {orderId: id, buyerId: actor.uid, fileIndex: index, asset: files[index], createdAt: now()});
    return files[index];
  });
  const expiresAt = Date.now() + 60000;
  const [url] = await admin.storage().bucket().file(asset.path, {generation: asset.generation}).getSignedUrl({version: "v4", action: "read", expires: expiresAt, responseDisposition: `attachment; filename="${asset.name.replace(/[^A-Za-z0-9._-]/g, "_")}"`});
  return {url, expiresAt};
}
