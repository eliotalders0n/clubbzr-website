# Club BZR Store architecture

The Store extends the existing Points ledger, `trades`, and `escrows`. It adds artist-owned releases, structured requests, physical fulfilment, and one-time collections. New capabilities default to disabled. No production data migration or deployment is performed by this implementation.

## Application map

| Surface | Implementation | Relationship |
| --- | --- | --- |
| Discovery `/store` | `src/pages/Store.tsx`, `StoreCatalog` | Indexed callable queries, filters, search, price sorting, stable cursor pages |
| Product and checkout `/store/:listingId` | `StoreListing.tsx` | Authoritative quotation, brief, add-ons, delivery, terms |
| Profile Shop | `ArtistShop` in artist and member profiles | Uses Auth UID (`artist.userId`), existing identity and public shop status |
| Community attachment | `MarketplaceAttachment` | Stable listing/version reference; resolves live availability; no copied product payload |
| Purchases and library | `StorePurchases.tsx` | Participant orders and buyer-specific grants |
| Order `/store/orders/:orderId` | `StoreOrder.tsx` | Private messages, evidence, submission, revision, receipt, dispute and recovery |
| Seller `/store/manage` | `StoreManage.tsx`, `StoreEditor.tsx` | Listings, orders, separate earnings, payout setup, shop settings |
| Administration `/admin/store` | `src/pages/admin/Store.tsx` | Moderation, disputes, verification, liabilities, provider events, flags, fee history |
| Fee controls | Existing Admin → Economy | Integer basis points, 0–2,000; reason required for fee changes; atomic audit |

`lib/store.ts` is the typed client boundary. Contracts are shared with `functions/src/store/types.ts` through type-only exports in `lib/schema.ts`. The frontend contains no financial write API. `useStoreQuery` cancels stale render results when filters or routes change.

## Trusted backend

`functions/src/store/catalog.ts` owns validation, asset verification, drafts, moderation, public discovery and publication. `orders.ts` owns checkout, transitions, settlement, grants and download authorization. `payments.ts` extends the existing Lenco transport/signature utilities. `webhook.ts` dispatches verified Store events from both the existing merchant callback and the Store-only endpoint. `callables.ts` exposes Auth/App Check guarded operations, administration and recovery.

Value changes execute inside Firestore transactions. The existing `postLedgerTransaction` accepts an optional outer transaction, so stock, trades, grants, immutable entries and balance projections commit together. All reads occur before writes. The existing API remains valid for old callers.

Store orders are `trades/{orderId}` with `storeOrder: true`. Old kinds (`commission`, `digital_download`, `marketplace_purchase`) continue to work. Their lifecycle APIs reject Store orders, whose states require additional fulfilment and inventory checks. The legacy Trading context excludes Store orders from its old controls; Store purchases have their own screens.

## Data model

| Collection | Purpose and access |
| --- | --- |
| `storeListings` | Public metadata only while published, capability enabled and seller active. Seller/admin can read drafts. Server writes only. |
| `storeListingAssets/{listingId}_v{version}` | Immutable file generations and protected collection posts. Server access only. Public listings contain only file names/types/sizes. |
| `storeSellerProfiles` | Public shop identity, availability and verification badge. |
| `storeSellerAccounts` | Private legal name, normalized mobile account, ownership declaration, verification, approval and unresolved payout ID. |
| `trades` | Order snapshot: buyer/seller, rail, product/version, price, fee, licence, brief, add-ons, delivery and fulfilment. Participant/admin reads. |
| `escrows` | Points-only locked/released/refunded state for Store orders. ZMW is never described or stored as provider escrow. |
| `storeOrderEvents` | Append-only transition history, participant IDs, actor, details and timestamps. |
| `storeOrderMessages` | Private append-only participant messages with deterministic request IDs. |
| `storeGrants` | Buyer, purchased version, assets reference, timestamps, revocation, count, limit, and optional future access-expiry field. |
| `storeDownloadAttempts` | Private idempotent download authorization records, including the exact file generation. |
| `storeOperations` | Private action idempotency records. |
| `payments`, `paymentEvents` | Existing collections extended with `purpose: store_order` / `purpose: store`; verified raw provider events are private. |
| `transactions`, `ledgerEntries` | Existing immutable journals; each new entry explicitly states `POINT` or `ZMW`. |
| `balances` | Existing Points projection. No ZMW entries are posted here. |
| `sellerPayables` | ZMW projection with pending, available, payout_pending, paid and reversed compartments; system projections are tagged separately. |
| `storePayouts` | Private deterministic Lenco transfer requests and verified outcomes. |
| `storeRefundReceipts` | Unique provider/manual refund references; prevents reusing one confirmation on multiple orders. |
| `auditLogs`, `reconciliationIssues` | Existing immutable administration audit and recovery diagnostics. |

Listing stock is **available quantity**, plus separate `reserved` and `sold` counters. Checkout reserves one unit inside the funding transaction. Rejection/confirmed refund restores it. Completion converts reserved to sold. One-of-one totals may never exceed one. Product type and finite/unlimited inventory mode cannot change after reservations or sales exist. Archived listings cannot be edited or automatically republished by a refund.

## Indexed discovery

`discoveryKeys` contains bounded combinations of product type, accepted payment method and a title/artist/tag word prefix. Each query uses one `array-contains`, published status, optional seller/featured/limited filters and an ordered cursor `(sortValue, documentId)`. The server reads at most 24 listing documents per page and checks seller state. A page may contain fewer results when sellers are suspended or a capability is disabled; the cursor still advances over every scanned document.

Search supports a single word or prefix of 2–24 letters/numbers. It is not fuzzy/full-text search. Points sorting selects Points-accepting releases. There is no collection-wide browser filtering. Index definitions cover the supported filter combinations; large private snapshots and raw payloads are exempted from unnecessary indexing.

## Money and snapshots

All Points and ZMW ngwee are bounded safe integers. The commercial fee is exact integer floor `(amount × basisPoints) / 10000`, implemented with `BigInt` arithmetic. Delivery is excluded from the fee. Seller payable includes delivery. ZMW and Points prices are independently configured; the point-purchase conversion rate is never used for Store pricing.

Points fees are locked when checkout funds the order. A ZMW intent locks the buyer's product/delivery amount and licence; its fee becomes final when a verified successful collection funds the order. Later fee changes cannot alter funded orders. Fee changes require custom-claim admin authorization and a reason, and preserve before/after values in the same transaction as the setting change.

Points: buyer available → locked; completion transfers locked units to seller and the existing sharded fee account; rejection/expiry returns locked units. Automatic digital delivery includes lock and release entries, order completion and grant creation in one transaction. Full completed-order refunds post compensating entries; they fail for manual review if the seller no longer has enough Points.

ZMW: verified collection creates merchant collection contra entries, seller payable and platform allocation. Bespoke/physical proceeds remain pending until buyer approval or admin resolution. Provider charges are recorded as Club BZR expenses, separately from revenue. Automatic digital delivery makes proceeds available in the same atomic verified-payment transaction. No cash earnings enter the Points wallet.

Payout requests move available → payout_pending after verification, approval and feature checks. Confirmed success moves payout_pending → paid; confirmed failure restores available. An uncertain request stays pending verification and is queried by its deterministic reference. The server never retries an uncertain transfer as a new transfer.

ZMW refunds remain `refund_pending` while an administrator arranges the actual refund through Lenco/the approved manual process. Completed-order refunds first remove the payable from available funds. Confirmation requires a unique external reference and reason, then posts compensating journal entries, reverses the platform allocation, restores inventory and revokes grants. There are no partial refunds or assumed provider refund APIs.

Points history/analytics explicitly select Points transactions. Wallet reconciliation preserves older ledger entries that lack a currency field by subtracting the explicit ZMW subset. Historical journals are never rewritten.

## Fulfilment and access

Bespoke orders have a 72-hour acceptance window. Sellers can accept, start, submit protected files and a preview; buyers can request the snapshotted number of revisions, approve or dispute. Automatic submission approval is disabled by default and checks both the configured delay and current account status inside the transaction. Physical orders support preparation, Lusaka pickup or regional dispatch, private proof, and buyer receipt. Seller dispatch alone never releases funds.

Protected objects live in `store-private/{uploaderId}/{randomId}`. Client Storage reads/writes are denied, including by the old catch-all public read rule. Upload callables create short-lived signed PUT access with MIME type, exact length and generation-zero preconditions. The server verifies persisted metadata, size, ownership and absence of public Firebase download tokens. Listings snapshot immutable object generations. Allowed uploads are JPG/PNG/WebP, PDF, ZIP, MP4, MP3 and packaged binary resources, up to 50 MB each. This is type/size validation, not antivirus scanning.

Downloads require a completed order, matching active buyer and non-revoked grant. Counts are transactional and idempotent. URLs expire after 60 seconds and are bound to the selected object generation. They are bearer links issued after buyer authorization, not DRM; a buyer can share a valid link during its short lifetime. A refund blocks new grants immediately but cannot retract an already downloaded file or instantly revoke an issued signed URL.

Collection posts stay in private version documents. Existing buyers see the latest **approved** collection version, including added resources and posts; unpublished edits cannot leak. Archiving makes the collection unavailable while retaining the purchase record. Private order uploads, downloads, refunds and recovery remain available when new Store sales are disabled.

## Operational boundaries

Every callable enforces App Check by default; mutation/read authorization uses Firebase Auth and custom claims, never editable profile roles. Suspended users cannot transact. Recovery is server-only and may resolve existing obligations after sales flags are disabled.

`recoverStoreOrders` runs every 30 minutes for unresolved payments/transfers, missing provider fees, paid fulfilment retries and expired acceptance windows. Payment/payout records rotate by recovery time to prevent old requests from starving newer ones. Failures appear in reconciliation issues and raw event history. Provider success after a previously confirmed failure requires manual investigation because inventory may already have been restored.

There are no recurring subscriptions, auctions, resale, royalties, carts, split-seller orders, Points cash-out, mixed-rail orders, international shipping, automatic carrier integration or launch discounts in this release. Discounts remain the optional extension from the brief; current orders snapshot zero discount.

See [Store deployment](STORE_DEPLOYMENT.md) and [Lenco marketplace readiness](LENCO_MARKETPLACE_READINESS.md) before enabling any capability.
