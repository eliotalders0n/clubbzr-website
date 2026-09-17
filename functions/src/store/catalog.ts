import {randomUUID} from "node:crypto";
import {HttpsError} from "firebase-functions/v2/https";
import type {AuthenticatedActor} from "../core/auth";
import {admin, db} from "../core/firebase";
import {requireString} from "../core/errors";
import {deterministicId} from "../core/idempotency";
import {STORE_DEFAULTS, LICENCES, PRODUCT_TYPES, active, discoveryKeys, identifier, integer, requireCapability} from "./policy";
import type {StoreAsset, StoreListing, StoreSettings} from "./types";

export const now = () => admin.firestore.FieldValue.serverTimestamp();
export const ref = (collection: string, id: string) => db.collection(collection).doc(id);
export async function settings(transaction?: FirebaseFirestore.Transaction): Promise<StoreSettings> {
  const snapshot = transaction ? await transaction.get(ref("settings", "store")) : await ref("settings", "store").get();
  return {...STORE_DEFAULTS, ...snapshot.data()};
}
export function serialize(value: unknown): unknown {
  if (value instanceof admin.firestore.Timestamp) return value.toMillis();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "discoveryKeys").map(([key, item]) => [key, serialize(item)]));
  return value;
}
export function audit(transaction: FirebaseFirestore.Transaction, actorId: string, action: string, targetId: string, data: Record<string, unknown>) {
  transaction.create(db.collection("auditLogs").doc(), {actorId, action, targetType: "store", targetId, data, createdAt: now()});
}
function url(value: unknown): string {
  const text = requireString(value, "Image URL", {max: 2000});
  if (!/^https:\/\//.test(text)) throw new HttpsError("invalid-argument", "Use an HTTPS image URL.");
  return text;
}
function strings(value: unknown, max = 20): string[] {
  if (!Array.isArray(value) || value.length > max) throw new HttpsError("invalid-argument", "Too many items.");
  return value.map((item) => requireString(item, "Item", {max: 100}));
}
export const ALLOWED_ASSET_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf", "application/zip", "application/x-zip-compressed", "video/mp4", "audio/mpeg", "application/octet-stream"];
export async function verifyAssets(value: unknown, ownerId: string | null): Promise<StoreAsset[]> {
  if (!Array.isArray(value) || value.length > 20) throw new HttpsError("invalid-argument", "Choose up to 20 files.");
  return Promise.all(value.map(async (item) => {
    const path = requireString(item?.path, "Asset path", {max: 500});
    // A null ownerId means any administrator upload is acceptable, so that one
    // administrator can edit a house listing another one created.
    const owned = ownerId === null ? /^store-private\/[A-Za-z0-9_-]+\//.test(path) : path.startsWith(`store-private/${ownerId}/`);
    if (!owned || path.includes("..")) throw new HttpsError("permission-denied", "Asset ownership is invalid.");
    const [metadata] = await admin.storage().bucket().file(path).getMetadata();
    const contentType = String(metadata.contentType || "");
    if (!ALLOWED_ASSET_TYPES.includes(contentType) || metadata.metadata?.firebaseStorageDownloadTokens) throw new HttpsError("invalid-argument", "Unsupported or publicly tokenized file.");
    return {path, generation: String(metadata.generation), name: requireString(item.name, "File name", {max: 200}), contentType, size: integer(Number(metadata.size), "File size", 1, 50 * 1024 * 1024)};
  }));
}
export async function uploadAccess(actorId: string, input: Record<string, unknown>) {
  const config = await settings();
  if (input.orderId) {
    const order = await ref("trades", identifier(input.orderId)).get();
    if (!order.data()?.storeOrder || !order.data()?.participants.includes(actorId)) throw new HttpsError("permission-denied", "Order participant access required for an upload.");
  } else requireCapability(config);
  const contentType = requireString(input.contentType, "File type");
  const size = integer(input.size, "File size", 1, 50 * 1024 * 1024);
  if (!ALLOWED_ASSET_TYPES.includes(contentType)) throw new HttpsError("invalid-argument", "This file type is unsupported. Package source files in a ZIP.");
  const path = `store-private/${actorId}/${randomUUID()}`;
  const expiresAt = Date.now() + 10 * 60 * 1000;
  const headers = {"Content-Type": contentType, "x-goog-if-generation-match": "0"};
  const [uploadUrl] = await admin.storage().bucket().file(path).getSignedUrl({version: "v4", action: "write", expires: expiresAt, contentType, extensionHeaders: {"x-goog-if-generation-match": "0", "content-length": String(size)}});
  return {path, uploadUrl, headers, expiresAt};
}

export const HOUSE_SELLER_ID = "clubbzr_house";
const HOUSE_SHOP_NAME = "Club BZR";
/**
 * Club BZR posts every Store release from one shared house shop, so the
 * catalogue shows a single consistent seller no matter which administrator
 * created the listing. The backing records are provisioned on first save.
 */
function ensureHouseShop(
  t: FirebaseFirestore.Transaction,
  user: FirebaseFirestore.DocumentSnapshot,
  profile: FirebaseFirestore.DocumentSnapshot
) {
  if (!user.exists) {
    t.set(user.ref, {displayName: HOUSE_SHOP_NAME, email: null, photoURL: "", role: "member", isActive: true, accountStatus: "active", systemAccount: true, createdAt: now(), updatedAt: now()});
  }
  if (!profile.exists) {
    t.set(profile.ref, {sellerId: HOUSE_SELLER_ID, displayName: HOUSE_SHOP_NAME, photoURL: "", description: "Official releases from Club BZR.", available: true, verified: true, createdAt: now(), updatedAt: now()});
  }
  return {displayName: String(profile.data()?.displayName || HOUSE_SHOP_NAME), photoURL: String(profile.data()?.photoURL || "")};
}

export async function saveListing(actor: AuthenticatedActor, input: Record<string, unknown>) {
  const config = await settings();
  requireCapability(config, String(input.productType));
  const listingId = input.id ? identifier(input.id) : randomUUID();
  const files = await verifyAssets(input.assets || [], null);
  const postsInput = input.collectionPosts || [];
  if (!Array.isArray(postsInput) || postsInput.length > 30) throw new HttpsError("invalid-argument", "Use up to 30 collection posts.");
  const posts = postsInput.map((post) => ({id: identifier(post.id), title: requireString(post.title, "Collection post title", {max: 200}), body: requireString(post.body, "Collection post", {max: 12000})}));
  const kind = String(input.productType) as StoreListing["productType"];
  if (!PRODUCT_TYPES.includes(kind)) throw new HttpsError("invalid-argument", "Unknown product type.");
  const methods = strings(input.acceptedPaymentMethods, 2) as StoreListing["acceptedPaymentMethods"];
  if (!methods.length || methods.some((item) => !["POINT", "ZMW"].includes(item)) || new Set(methods).size !== methods.length) throw new HttpsError("invalid-argument", "Choose Points, ZMW, or both.");
  const licenceKind = input.licenceKind === "commercial" ? "commercial" : input.licenceKind === "personal" ? "personal" : null;
  if (!licenceKind) throw new HttpsError("invalid-argument", "Choose a Personal or Commercial licence.");
  const f = (input.fulfilment || {}) as StoreListing["fulfilment"];
  const questions = Array.isArray(f.questions) ? f.questions : [];
  const addOns = Array.isArray(f.addOns) ? f.addOns : [];
  const deliveryOptions = Array.isArray(f.deliveryOptions) ? f.deliveryOptions : [];
  if (questions.length > 15 || addOns.length > 20 || deliveryOptions.length > 10) throw new HttpsError("invalid-argument", "Too many fulfilment options.");
  const fulfilment: StoreListing["fulfilment"] = {
    estimatedDays: integer(f.estimatedDays ?? 7, "Preparation days", 1, 365),
    revisionRounds: integer(f.revisionRounds ?? 1, "Revision rounds", 0, 20),
    questions: questions.map((q) => {
      if (!["short_text", "long_text", "single_choice", "multiple_choice", "reference_image"].includes(q.type)) throw new HttpsError("invalid-argument", "Unknown question type.");
      const options = strings(q.options || [], 20);
      if (["single_choice", "multiple_choice"].includes(q.type) && !options.length) throw new HttpsError("invalid-argument", "Add choices to your question.");
      return {id: identifier(q.id), label: requireString(q.label, "Question", {max: 300}), type: q.type, required: q.required === true, options};
    }),
    addOns: addOns.map((a) => ({id: identifier(a.id), title: requireString(a.title, "Add-on title"), priceNgwee: integer(a.priceNgwee, "Add-on ngwee"), pricePoints: integer(a.pricePoints, "Add-on Points")})),
    dimensions: String(f.dimensions || "").slice(0, 200), weightGrams: f.weightGrams == null ? null : integer(f.weightGrams, "Weight", 1),
    materials: String(f.materials || "").slice(0, 500), framed: f.framed === true, condition: String(f.condition || "").slice(0, 500), oneOfOne: f.oneOfOne === true,
    pickup: f.pickup === true,
    deliveryOptions: deliveryOptions.map((d) => {
      if (!config.deliveryRegions.includes(d.region)) throw new HttpsError("invalid-argument", "Choose a configured Zambian region.");
      return {region: d.region, priceNgwee: integer(d.priceNgwee, "Delivery ngwee"), pricePoints: integer(d.pricePoints, "Delivery Points")};
    }),
  };
  for (const items of [fulfilment.questions, fulfilment.addOns]) if (new Set(items.map((item) => item.id)).size !== items.length) throw new HttpsError("invalid-argument", "Option IDs must be unique.");
  if (kind !== "bespoke_request" && fulfilment.addOns.length) throw new HttpsError("invalid-argument", "Add-ons belong to bespoke requests.");
  if (kind === "physical_original" && (!fulfilment.dimensions || !fulfilment.materials || !fulfilment.condition || (!fulfilment.pickup && !deliveryOptions.length))) throw new HttpsError("invalid-argument", "Add physical details and a delivery or pickup option.");
  const listingData = {
    limited: input.inventory != null, productType: kind, title: requireString(input.title, "Title", {min: 3, max: 120}),
    description: requireString(input.description, "Description", {min: 20, max: 12000}), coverImage: url(input.coverImage),
    images: (Array.isArray(input.images) ? input.images.slice(0, 8) : []).map(url), tags: strings(input.tags || [], 12),
    acceptedPaymentMethods: methods, priceNgwee: integer(input.priceNgwee, "Price ngwee", config.minimumPriceNgwee),
    pricePoints: methods.includes("POINT") ? integer(input.pricePoints, "Points price", config.minimumPricePoints) : null,
    inventory: input.inventory == null && kind !== "physical_original" ? null : integer(input.inventory, "Inventory", 0, fulfilment.oneOfOne ? 1 : 100000),
    licence: {kind: licenceKind, version: 1, text: LICENCES[licenceKind]},
    files: files.map(({name, size, contentType}) => ({name, size, contentType})), downloadLimit: input.downloadLimit == null ? null : integer(input.downloadLimit, "Download limit", 1, 10000),
    fulfilment, promoteOnPublish: input.promoteOnPublish === true,
  };
  return db.runTransaction(async (t) => {
    const [old, profile, houseUser, actingUser] = await t.getAll(ref("storeListings", listingId), ref("storeSellerProfiles", HOUSE_SELLER_ID), ref("users", HOUSE_SELLER_ID), ref("users", actor.uid));
    if (!active(actingUser.data())) throw new HttpsError("failed-precondition", "This account is not active.");
    const house = ensureHouseShop(t, houseUser, profile);
    if (old.exists && old.data()?.sellerId !== HOUSE_SELLER_ID) throw new HttpsError("permission-denied", "This listing belongs to another shop.");
    if (old.exists && input.version !== old.data()?.version) throw new HttpsError("aborted", "This listing changed. Reload before saving.");
    if (old.exists && ["published", "pending_review", "archived"].includes(old.data()?.status)) throw new HttpsError("failed-precondition", "Pause the listing before editing. Archived listings cannot be edited.");
    if (old.exists && (old.data()?.reserved > 0 || old.data()?.sold > 0) && (old.data()?.productType !== kind || (old.data()?.inventory === null) !== (listingData.inventory === null))) throw new HttpsError("failed-precondition", "Product type and inventory mode cannot change after orders exist.");
    if (fulfilment.oneOfOne && Number(listingData.inventory || 0) + Number(old.data()?.reserved || 0) + Number(old.data()?.sold || 0) > 1) throw new HttpsError("invalid-argument", "A one-of-one artwork cannot have more than one available, reserved or sold item.");
    const version = Number(old.data()?.version || 0) + 1;
    const listing = {...listingData, sellerId: HOUSE_SELLER_ID, sellerName: house.displayName, sellerPhotoURL: house.photoURL,
      status: "draft", featured: false, publishedVersion: old.data()?.publishedVersion || null, version, reserved: old.data()?.reserved || 0, sold: old.data()?.sold || 0,
      createdAt: old.data()?.createdAt || now(), updatedAt: now(), publishedAt: old.data()?.publishedAt || null};
    t.set(ref("storeListings", listingId), {...listing, discoveryKeys: discoveryKeys({...listing, id: listingId} as unknown as StoreListing)});
    t.create(ref("storeListingAssets", `${listingId}_v${version}`), {sellerId: HOUSE_SELLER_ID, listingId, version, files, posts: kind === "gated_collection" ? posts : [], createdAt: now()});
    return {listingId, version};
  });
}

export async function moderateListing(actor: AuthenticatedActor, input: Record<string, unknown>) {
  const id = identifier(input.listingId);
  const action = requireString(input.action, "Action");
  return db.runTransaction(async (t) => {
    const [snapshot, configSnap] = await t.getAll(ref("storeListings", id), ref("settings", "store"));
    if (!snapshot.exists) throw new HttpsError("not-found", "Listing not found.");
    const listing = snapshot.data() as StoreListing;
    const [seller, assets] = await t.getAll(ref("users", listing.sellerId), ref("storeListingAssets", `${id}_v${listing.version}`));
    if (!actor.admin && actor.uid !== listing.sellerId) throw new HttpsError("permission-denied", "Seller or admin access required.");
    if (!active(seller.data()) && ["submit", "approve", "publish"].includes(action)) throw new HttpsError("permission-denied", "Seller is unavailable.");
    const rules: Record<string, {from: string[]; to: string; admin?: boolean}> = {
      feature: {from: ["published"], to: "published", admin: true},
      unfeature: {from: ["published"], to: "published", admin: true},
      submit: {from: ["draft", "paused", "sold_out"], to: "pending_review"},
      publish: {from: ["draft", "paused", "sold_out", "pending_review"], to: "published", admin: true},
      approve: {from: ["pending_review"], to: "published", admin: true},
      reject: {from: ["pending_review"], to: "draft", admin: true},
      pause: {from: ["published"], to: "paused"},
      archive: {from: ["draft", "paused", "sold_out", "pending_review", "published"], to: "archived"},
    };
    const rule = rules[action];
    if (!rule || !rule.from.includes(listing.status)) throw new HttpsError("failed-precondition", "This listing cannot make that transition.");
    if (rule.admin && !actor.admin) throw new HttpsError("permission-denied", "Admin publication is required.");
    // Admins managing their own shop can perform the same seller actions.
    const needsModerationReason = rule.admin === true || actor.uid !== listing.sellerId;
    const reason = needsModerationReason || (actor.admin && input.reason !== undefined) ?
      requireString(input.reason, "Moderation reason", {min: 10, max: 1000}) :
      action === "submit" ? "Seller submitted listing for review" : "Seller updated availability";
    if (["submit", "approve", "publish"].includes(action)) {
      requireCapability({...STORE_DEFAULTS, ...configSnap.data()}, listing.productType);
      if (["digital_release", "gated_collection"].includes(listing.productType) && !autoDeliveryReady(listing.productType, assets.data())) throw new HttpsError("failed-precondition", "Upload the protected release files first.");
      if (listing.inventory !== null && listing.inventory < 1) throw new HttpsError("failed-precondition", "Add inventory before publication.");
    }
    const promotionId = deterministicId("store_promotion", id, String(listing.version));
    const published = ["approve", "publish"].includes(action);
    const promotion = published && listing.promoteOnPublish ? await t.get(ref("communityPosts", promotionId)) : null;
    t.update(snapshot.ref, {status: rule.to, ...(["feature", "unfeature"].includes(action) ? {featured: action === "feature"} : {}), moderation: {actorId: actor.uid, reason, action, at: now()}, updatedAt: now(), ...(published ? {publishedAt: now(), publishedVersion: listing.version} : {})});
    if (promotion && !promotion.exists) {
      t.create(promotion.ref, {
        userId: listing.sellerId, userName: listing.sellerName, userPhotoURL: listing.sellerPhotoURL,
        postType: "marketplace", marketplace: {listingId: id, version: listing.version}, content: "A new release from my shop.",
        mediaUrls: [], mediaType: null, reactions: {}, reactionsCount: 0, comments: [], commentsCount: 0, shares: 0,
        featured: false, pinned: false, tags: [], isApproved: true, isHidden: false, createdAt: now(), updatedAt: now(),
      });
    }
    audit(t, actor.uid, `store_listing_${action}`, id, {before: listing.status, after: rule.to, version: listing.version, reason});
    return {listingId: id, status: rule.to};
  });
}

export async function browse(input: Record<string, unknown>) {
  const config = await settings();
  if (!config.storeEnabled) return {listings: [], cursor: null, disabled: true};
  const type = String(input.productType || "all");
  const rail = input.sort === "price_points" ? "POINT" : String(input.paymentRail || "all");
  if (!["all", ...PRODUCT_TYPES].includes(type) || !["all", "POINT", "ZMW"].includes(rail)) throw new HttpsError("invalid-argument", "Invalid filters.");
  const token = String(input.search || "").toLowerCase().trim();
  if (token && !/^[\p{L}\p{N}]{2,24}$/u.test(token)) throw new HttpsError("invalid-argument", "Search a word or prefix of 2–24 letters.");
  const sort = input.sort === "price_points" ? "pricePoints" : input.sort === "price" ? "priceNgwee" : "createdAt";
  let query = db.collection("storeListings").where("status", "==", "published").where("discoveryKeys", "array-contains", `${type}|${rail}|${token}`);
  if (input.sellerId) query = query.where("sellerId", "==", identifier(input.sellerId));
  if (input.featured === true) query = query.where("featured", "==", true);
  if (input.availability === "limited") query = query.where("limited", "==", true);
  query = query.orderBy(sort, sort === "createdAt" ? "desc" : "asc").orderBy(admin.firestore.FieldPath.documentId());
  if (input.cursor) {
    const cursor = input.cursor as {id: string; value: number};
    identifier(cursor.id);
    integer(cursor.value, "Cursor", 0, Number.MAX_SAFE_INTEGER);
    query = query.startAfter(sort === "createdAt" ? admin.firestore.Timestamp.fromMillis(cursor.value) : cursor.value, cursor.id);
  }
  const page = await query.limit(24).get();
  const users = page.empty ? [] : await db.getAll(...[...new Set(page.docs.map((d) => String(d.data().sellerId)))].map((id) => ref("users", id)));
  const shops = users.length ? await db.getAll(...users.map((u) => ref("storeSellerProfiles", u.id))) : [];
  const shopMap = new Map(shops.map((shop) => [shop.id, shop.data()]));
  const activeIds = new Set(users.filter((u) => active(u.data())).map((u) => u.id));
  const listings = page.docs.filter((d) => activeIds.has(d.data().sellerId) && (config.physicalProductsEnabled || d.data().productType !== "physical_original") && (config.gatedCollectionsEnabled || d.data().productType !== "gated_collection")).map((d) => serialize({id: d.id, ...d.data(), sellerAvailable: shopMap.get(d.data().sellerId)?.available === true, sellerVerified: shopMap.get(d.data().sellerId)?.verified === true}));
  const last = page.docs.at(-1);
  return {listings, cursor: page.size === 24 && last ? {id: last.id, value: serialize(last.get(sort))} : null, disabled: false};
}
export async function listingDetail(id: string, actor?: AuthenticatedActor) {
  const [snapshot, config] = await Promise.all([ref("storeListings", identifier(id)).get(), settings()]);
  if (!snapshot.exists) return {listing: null, unavailable: "This release is no longer available."};
  const listing = snapshot.data() as StoreListing;
  if (actor?.admin || actor?.uid === listing.sellerId) {
    const assets = await ref("storeListingAssets", `${id}_v${listing.version}`).get();
    return {listing: serialize({...listing, id}), assets: assets.data()?.files || [], collectionPosts: assets.data()?.posts || []};
  }
  const seller = await ref("users", listing.sellerId).get();
  if (!config.storeEnabled || !active(seller.data()) || listing.status !== "published" || (listing.productType === "physical_original" && !config.physicalProductsEnabled) || (listing.productType === "gated_collection" && !config.gatedCollectionsEnabled)) return {listing: null, unavailable: listing.status === "sold_out" ? "This release is sold out." : "This release is currently unavailable."};
  const shop = await ref("storeSellerProfiles", listing.sellerId).get();
  return {listing: serialize({...listing, id, sellerAvailable: shop.data()?.available === true, sellerVerified: shop.data()?.verified === true})};
}

export function autoDeliveryReady(kind: string, assets: FirebaseFirestore.DocumentData | undefined): boolean {
  return Boolean(assets?.files?.length || (kind === "gated_collection" && assets?.posts?.length));
}
