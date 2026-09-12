# Club BZR Store — Agent Implementation Prompt

## Purpose

Use this prompt to guide an implementation agent building the first production-ready Club BZR peer-to-peer art marketplace.

The recommended scope is deliberately narrower than a complete DeviantArt-style marketplace. It builds on Club BZR's existing points wallet, immutable ledger, trade escrow, Lenco integration, artist profiles, and Community Wall without prematurely adding recurring billing, auctions, secondary resale, or international commerce.

## Provider assumptions verified during research

- Lenco supports initiating Zambian mobile-money collections and returns pending states that require customer authorization.
- Successful payment must be established through a signed webhook or authenticated status query, not solely from the initial collection response.
- Lenco supports transfers to Zambian mobile-money accounts.
- Lenco documents account-level inflow splitting across subaccounts, but its public API documentation does not establish a marketplace escrow or per-order seller-split product.
- Club BZR must therefore describe its ZMW mechanism as an internal seller-payable hold, not “Lenco escrow.” Real-money marketplace collection and seller payouts must remain feature-flagged until Lenco confirms that the intended marketplace flow is permitted for the Club BZR merchant account.

Official references:

- [Lenco mobile-money collections](https://lenco-api.readme.io/v2.0/reference/initiate-collection-from-mobile-money)
- [Lenco mobile-money transfers](https://lenco-api.readme.io/v2.0/reference/initiate-transfer-to-mobile-money)
- [Lenco collection status](https://lenco-api.readme.io/v2.0/reference/get-collection-by-reference)
- [Lenco webhooks and signature verification](https://lenco-api.readme.io/v2.0/reference/webhooks)
- [Lenco split inflows](https://support.lenco.co/en/articles/6827385-split-payments-and-how-to-split-inflows)

---

## Copy-ready implementation prompt

```text
You are working inside the Club BZR website repository.

Your task is to design and implement the first production-ready version of the
Club BZR Store: a peer-to-peer art marketplace connected to artist profiles,
the Community Wall, Club BZR Points, the existing immutable ledger, and Lenco
ZMW mobile-money payments.

Do not build a generic ecommerce system. The store must feel like a native part
of Club BZR's artist community.

Before editing code, inspect and understand:

- docs/economy/README.md
- docs/economy/ARCHITECTURE.md
- docs/FIREBASE_SCHEMA.md
- lib/schema.ts
- lib/trading.ts
- lib/economy.ts
- functions/src/trading/callables.ts
- functions/src/payments/lenco.ts
- functions/src/wallet/ledger.ts
- functions/src/core/settings.ts
- src/pages/CommunityWall.tsx
- src/pages/MemberProfile.tsx
- the artist profile components and routing
- Firestore rules and indexes

Preserve the existing architecture:

- Firebase Authentication identifies buyers and sellers.
- Firebase callable functions own all value-changing operations.
- Firestore clients must never directly modify balances, trades, payments,
  seller earnings, orders, escrow, or immutable ledger records.
- Integer Points and integer ZMW ngwee must be used. Never use floating-point
  values for money.
- All financial mutations must be idempotent.
- Existing unrelated functionality and user changes must be preserved.
- Extend the existing trading and ledger services instead of creating a second
  financial system.

==================================================
1. PRODUCT SCOPE
==================================================

Implement these marketplace capabilities:

1. Artist storefronts
2. Digital releases
3. Bespoke art requests
4. Physical originals
5. One-time gated collections

Do not implement yet:

- Recurring subscriptions or automatic recurring billing
- Auctions
- Secondary resale
- Resale royalties
- International currencies
- Multiple-item shopping carts
- Split payments between multiple sellers
- Automated shipping-carrier integrations
- Cash conversion or withdrawal of Club BZR Points
- Mixed Points and ZMW payments in one order
- Buyer-to-seller direct Lenco payments that bypass Club BZR
- Automatic real-money payouts before seller verification and admin enablement

Use feature flags for:

- storeEnabled
- zmwCheckoutEnabled
- sellerPayoutsEnabled
- physicalProductsEnabled
- gatedCollectionsEnabled

The system must fail closed when a capability is disabled or its required
configuration is missing.

==================================================
2. ARTIST STOREFRONTS
==================================================

Add a Shop section to eligible artist/member profiles.

The storefront must include:

- Artist identity, profile image, and display name
- Seller verification or availability status
- Product filters:
  - All
  - Digital
  - Bespoke
  - Physical
  - Collections
- Product cards with:
  - Cover image
  - Title
  - Product type
  - Artist
  - ZMW price
  - Optional Points price
  - Availability
  - Sold-out or paused state
- A seller-only “Manage Shop” action
- Empty states for artists without listings

Add a central `/store` route containing:

- Featured releases
- Recent releases
- Digital products
- Bespoke requests
- Physical originals
- Gated collections
- Search by title, artist, and tags
- Filters for product type, availability, and accepted payment method
- Sort by newest and price
- Paginated or cursor-based loading

Do not load the entire collection and filter it in the browser. Use indexed
Firestore queries and stable cursor pagination.

Create a `/store/:listingId` product-detail route containing:

- Large artwork/media preview
- Artist identity and profile link
- Product description
- Included files or physical item details
- Licence
- Price breakdown
- Remaining inventory where relevant
- Payment method choice
- Buy/request action
- Terms acknowledgement
- Related products from the same artist

The styling must use the existing Club BZR dark design, orange accent, spacing,
cards, typography, and responsive patterns. Reuse existing components wherever
possible.

==================================================
3. COMMUNITY WALL INTEGRATION
==================================================

Published listings should be able to appear on the Community Wall as native
platform posts.

Do not duplicate the complete listing inside the post document. Store a stable
reference to the listing and render current listing information through a
dedicated marketplace attachment.

A marketplace Community post should show:

- Product preview
- Product type label
- Artist
- Title
- Price
- Availability
- “View release,” “Request artwork,” or “View original” CTA

The attachment must gracefully handle:

- Listing paused
- Listing sold out
- Listing deleted or moderated
- Artist account suspended
- Store capability disabled

Let sellers choose whether publishing a listing also creates a Community post.
Prevent accidental duplicate promotional posts for the same listing version.

==================================================
4. LISTINGS AND SELLER MANAGEMENT
==================================================

Create seller-facing screens for:

- Listings
- Orders
- Earnings
- Payouts
- Store settings

Listing lifecycle:

draft → pending_review → published → paused → sold_out → archived

Only the seller and authorized administrators may see drafts.

Administrators must be able to approve, reject, pause, and archive listings.
Record moderation actions in audit logs.

Every listing should support:

- sellerId
- productType
- title
- slug if needed
- description
- cover image
- additional images
- tags
- status
- acceptedPaymentMethods
- priceNgwee
- optional pricePoints
- inventory or unlimited availability
- licence information
- fulfilment information
- createdAt
- updatedAt
- publishedAt
- moderation metadata

Do not trust seller-provided price, seller ID, fee, or product details during
checkout. The server must load the authoritative listing.

A seller must not purchase their own listing.

==================================================
5. DIGITAL RELEASES
==================================================

Support:

- Art packs
- Brush and preset packs
- Project/source files
- Tutorials
- Reference packs
- Wallpapers

Digital listings should include:

- Public preview media
- Protected downloadable assets
- File names, types, and sizes
- Version
- Description of included material
- Personal or commercial licence
- Optional download limit
- Optional Points price

Store paid files outside publicly readable paths. Generate short-lived,
buyer-specific download access only after verifying a completed order.

Do not place permanent public Firebase Storage URLs in listing or order
documents.

Record download grants separately from listings. A valid grant must contain:

- orderId
- listingId
- buyerId
- version purchased
- grantedAt
- revokedAt if applicable
- download count
- lastDownloadedAt

The buyer should receive access only after payment succeeds and the order is
completed.

Digital order flow:

ZMW:
payment_pending → paid → completed

Points:
funded → completed

For automatically delivered digital products, create the download grant and
complete the order atomically with the Points settlement or verified Lenco
payment processing wherever possible.

If fulfilment fails after payment, retain a recoverable paid order and expose it
for retry. Never silently lose the purchase.

Licences:

- Require the seller to choose Personal or Commercial.
- Display the licence before checkout.
- Snapshot the licence text and version into the order.
- Personal licences must prohibit resale, redistribution, and commercial use.
- Commercial licences may permit incorporation into finished commercial work
  but must prohibit redistribution of the original downloadable files.
- Clarify that copyright stays with the creator unless a separate written
  agreement explicitly states otherwise.

==================================================
6. BESPOKE ART REQUESTS
==================================================

Replace unstructured commission negotiation with a structured request system.

A bespoke listing should define:

- Base price
- Estimated delivery time
- Number of revision rounds
- Examples
- Artist availability
- Brief questions
- Optional add-ons
- Each add-on's additional price
- Accepted payment methods
- Personal or commercial licence option

Supported brief fields:

- Short text
- Long text
- Single choice
- Multiple choice
- Reference image upload

Calculate the price on the server from the listing and chosen add-ons.

Order lifecycle:

request_draft
→ payment_pending or funded
→ pending_acceptance
→ accepted
→ in_progress
→ submitted
→ approved/completed

Additional transitions:

- pending_acceptance → rejected/refunded
- pending_acceptance → expired/refunded
- accepted or in_progress → disputed
- submitted → revision_requested
- disputed → completed or refunded through admin resolution

Acceptance rules:

- Seller has 72 hours to accept.
- An unanswered request expires automatically.
- Rejection or expiration releases locked Points or starts a ZMW refund.
- The seller may not change the agreed price after funding.
- Scope, add-ons, licence, and original brief must be snapshotted into the order.

Submission must support:

- Final preview
- Seller message
- Protected final files
- Submitted timestamp
- Revision counter

The buyer approves the work to release settlement. Add a configurable automatic
approval period after submission, but initially keep automatic release disabled
unless administrators explicitly enable it.

==================================================
7. PHYSICAL ORIGINALS
==================================================

Support one-off artworks and small quantities of handmade products.

Do not build a full warehouse or courier system.

A physical listing should support:

- Inventory quantity
- One-of-one designation
- Dimensions
- Weight if known
- Medium and materials
- Framed/unframed
- Condition
- Shipping or collection options
- Seller preparation time
- Lusaka pickup availability
- Supported delivery regions
- Region-specific delivery price
- Optional personalization questions

Start with configurable Zambian regions rather than a global shipping engine.

Checkout must snapshot:

- Recipient name
- Phone
- Delivery region
- Delivery address
- Delivery instructions
- Product price
- Delivery charge
- Listing description
- Listing photographs
- Seller preparation estimate

Never expose the buyer's address publicly or to unrelated users.

Physical order lifecycle:

payment_pending or funded
→ pending_acceptance
→ accepted
→ preparing
→ ready_for_collection or dispatched
→ delivered
→ completed

The seller has 72 hours to accept. Inventory must be reserved atomically while
the order is pending. Rejected, expired, or refunded orders must restore it.

Manual fulfilment should support:

- Seller marks ready for collection
- Seller enters carrier or delivery method
- Optional tracking/reference number
- Dispatch photograph or receipt
- Buyer confirms receipt
- Seller and buyer can communicate through order messages
- Either participant can open a dispute

Proof-of-fulfilment records must be private to the buyer, seller, and authorized
administrators.

Do not release real-money seller payout merely because the seller marks an item
dispatched. Require buyer confirmation or an administrator's dispute decision.

==================================================
8. GATED COLLECTIONS
==================================================

Implement one-time paid collections before recurring artist memberships.

A gated collection is a collection of posts, images, videos, or downloadable
resources unlocked by one purchase.

Support:

- Collection title and cover
- Description
- Artist
- One-time ZMW price
- Optional one-time Points price
- Preview items
- Protected items
- Collection updates
- Permanent access for existing buyers while the collection remains available

Create access grants rather than copying protected content into order records.

Do not implement recurring subscriptions now. Lenco's documented collection
flow is one-off and should not be treated as evidence of recurring billing
support.

Design schemas so a future `supporter_pass` product can add time-limited access,
but do not add automatic renewal in this release.

Discounts may be implemented only if the core flows are complete:

- Session-attendee discount
- Existing-customer discount
- Time-limited launch discount

Discount eligibility and final price must be calculated by the server.
Snapshot the applied discount and eligibility reason into the order.

==================================================
9. POINTS AND REAL MONEY
==================================================

Club BZR has two separate payment rails.

A. Club BZR Points

- Points are integer, closed-loop platform units.
- Points can be earned from approved platform activity.
- Points can also be purchased in ZMW through the existing Lenco point-purchase
  flow.
- The configured `pointsPerZmw` rate controls point issuance.
- Points cannot be converted back into ZMW.
- Points cannot be withdrawn through Lenco.
- Receiving Points from a marketplace sale does not create cash earnings.
- A listing may accept Points, ZMW, or both.
- A checkout uses exactly one payment method.
- Do not support mixed Points plus ZMW payments.
- Do not describe Points as money, savings, an investment, or a cash balance.

For a Points purchase:

grossPoints = authoritative listing price
feeBasisPoints = snapshotted economy setting
platformFeePoints = calculateCommercialFee(grossPoints, feeBasisPoints)
sellerReceivesPoints = grossPoints - platformFeePoints

Use the existing double-entry ledger and locked balance.

The platform fee must go to the existing sharded system fee account.

B. ZMW through Lenco

- Store ZMW as integer ngwee.
- Initiate mobile-money collection from a server function.
- Use a unique deterministic Club BZR reference.
- Treat `pay-offline` and `pending` as incomplete.
- Never deliver or credit value from the initial API response.
- Only a verified successful webhook or authenticated status reconciliation may
  mark the payment paid.
- Verify Lenco webhook signatures.
- Retain raw provider events for replay detection and audit.
- Poll unresolved payments as a recovery mechanism.
- Make webhook and polling completion idempotent.

For a ZMW purchase:

grossNgwee = authoritative discounted product subtotal
feeBasisPoints = snapshotted economy setting
platformFeeNgwee = calculateCommercialFee(grossNgwee, feeBasisPoints)
sellerPayableNgwee = grossNgwee - platformFeeNgwee

Lenco collection, refund, and payout fees are provider costs, not Club BZR
revenue. Track them separately from the Club BZR platform fee.

Where supported and approved, configure the Lenco collection fee bearer
explicitly. Show the customer a complete price breakdown before confirmation.

The order must record:

- Product subtotal
- Discount
- Discounted product subtotal
- Club BZR platform fee and basis-point rate
- Delivery charge
- Lenco collection fee if known
- Buyer total
- Seller payable
- Seller payout fee
- Currency
- Conversion-free integer calculations

Do not hard-code ZMW/Point equivalence into marketplace orders. The
`pointsPerZmw` setting is used when purchasing Points, but an artist's Points
price and ZMW price may be independently configured.

==================================================
10. CLUB BZR PLATFORM FEE
==================================================

The marketplace platform fee must be configurable by authorized administrators.

Default configuration:

tradeFeeBasisPoints = 500 // 5%

Do not hard-code `0.05` or any fee percentage into checkout, settlement, UI,
reports, or product logic.

Requirements:

- Store the fee as integer basis points.
- Allow authorized administrators to adjust it through Admin → Economy.
- Validate the configured range on the server.
- Recommended allowed range: 0–2,000 basis points (0–20%).
- Require a reason when an administrator changes the fee.
- Record every change in immutable audit logs.
- Show the previous value, new value, administrator, and timestamp.
- Changes apply only to newly funded orders.
- Snapshot `feeBasisPoints` and the calculated fee onto every order and trade.
- Existing orders retain the rate applied when they were funded.
- Never recalculate historical orders using the current setting.

For Points purchases:

grossPoints = authoritative listing price
platformFeePoints =
  calculateCommercialFee(grossPoints, configuredTradeFeeBasisPoints)
sellerReceivesPoints = grossPoints - platformFeePoints

For ZMW purchases:

grossNgwee = authoritative discounted product subtotal
platformFeeNgwee =
  calculateCommercialFee(grossNgwee, configuredTradeFeeBasisPoints)
sellerPayableNgwee = grossNgwee - platformFeeNgwee

Under the default 5% setting, the seller receives 95% of the discounted product
subtotal before any separately disclosed Lenco payout cost.

Fee rules:

- Apply the platform fee to the product subtotal after discounts.
- Do not charge the platform fee on delivery charges.
- Lenco collection, refund, and payout fees are provider costs—not Club BZR
  platform revenue.
- Record provider fees separately.
- A full refund reverses the Club BZR fee.
- Partial refunds are out of scope for the first release.
- Define a minimum listing price and deterministic integer rounding policy.
- Display the applicable fee to the seller before publishing.
- Display the snapshotted fee in the seller's order and earnings breakdown.

==================================================
11. REAL-MONEY SELLER EARNINGS AND PAYOUTS
==================================================

Do not represent ZMW seller earnings as a member's Points wallet balance.

Create a separate seller-payable projection backed by immutable ZMW ledger
entries.

Suggested compartments:

- pending
- available
- payout_pending
- paid
- reversed

The source of truth must remain immutable ZMW transactions/entries, not a
mutable earnings number.

ZMW purchase sequence:

1. Buyer starts Lenco collection.
2. Verified success marks payment paid.
3. Gross product funds are allocated internally using the snapshotted fee:
   - configured Club BZR platform fee
   - remaining seller payable
4. Seller payable remains pending while the order is being fulfilled.
5. Buyer approval or admin resolution moves it to available.
6. Verified seller requests payout.
7. Server initiates Lenco mobile-money transfer.
8. Signed webhook or reconciliation confirms transfer success or failure.
9. Successful transfer moves the amount to paid.
10. Failed transfer restores it to available safely.

Before real seller payouts, require:

- Seller identity verified
- Legal name
- Zambian mobile number
- Mobile-money operator
- Confirmation that the account belongs to the seller
- Admin approval
- Seller payout feature flag enabled
- Minimum payout threshold
- No unresolved payout already using the same idempotency reference

Never expose the Lenco API secret in the client or Firestore.

Do not invent Lenco sub-merchants, split settlements, or escrow functionality.
If the API/account does not support a required action, show an honest
administrative state and document the dependency.

Include a production-readiness note that Club BZR must obtain confirmation from
Lenco and appropriate legal/compliance advice before enabling custodial
marketplace collection and seller payouts.

==================================================
12. ORDERS, TRADES, AND ESCROW
==================================================

Extend the current `trades` and `escrows` system rather than duplicating it.

Existing trade kinds include:

- commission
- digital_download
- marketplace_purchase

Normalize or extend these safely for:

- digital_release
- bespoke_request
- physical_original
- gated_collection

Provide backward compatibility or a migration for existing records.

Points orders use actual ledger escrow:

- Buyer's available Points move to locked.
- Rejection/cancellation moves locked Points back to available.
- Completion sends the seller proceeds to the seller and the snapshotted
  platform fee to Club BZR.

ZMW orders use an internal seller-payable hold:

- Do not call it provider escrow.
- Lenco collection settles to the Club BZR merchant account.
- The application delays seller payout until completion.
- Preserve the distinction in code, UI, and documentation.

Every order must preserve:

- buyerId
- sellerId
- listingId
- product type
- payment rail
- authoritative price snapshot
- fee snapshot
- licence snapshot
- fulfilment snapshot
- state history
- relevant Lenco references
- relevant ledger transaction IDs
- dispute state
- timestamps

Create an append-only order-event history so administrators can reconstruct
every transition.

==================================================
13. REFUNDS AND DISPUTES
==================================================

Points refunds:

- Unlock or return the buyer's Points atomically.
- Reverse the fee where it was already recognized.
- Never edit or delete the original transaction.

ZMW refunds:

- Use a recorded provider refund workflow consistent with the existing Lenco
  refund implementation.
- Keep the order in `refund_pending` until provider/manual confirmation.
- Add a compensating ledger transaction.
- Preserve original collection and refund references.
- Do not show “refunded” before confirmation.

Disputes must capture:

- Opened by
- Reason category
- Written explanation
- Evidence attachments
- Current fulfilment state
- Admin decision
- Decision reason
- Ledger and payout effects
- Audit timestamps

Only an authorized finance/admin user may force release or refund a disputed
order.

==================================================
14. SECURITY AND FIRESTORE RULES
==================================================

Implement and test rules ensuring:

- Public users can read only published, non-moderated listing metadata.
- Protected files are never publicly readable.
- Buyers can read their orders and grants.
- Sellers can read orders for their own listings.
- Buyer addresses and private briefs are restricted.
- Users cannot modify listing ownership.
- Users cannot modify financial snapshots, fees, or order state directly.
- Users cannot write balances, earnings, payments, payouts, trades, escrows,
  ledger entries, or audit records.
- Admin access uses custom claims, not an editable profile role.
- Suspended users cannot list, buy, accept, deliver, or withdraw.
- App Check is enforced for deployed callable functions.
- Uploaded files are checked for type and size.
- Idempotency prevents duplicate checkout, fulfilment, refund, and payout.
- Inventory reservation is transactional and cannot oversell.

Add necessary composite indexes.

==================================================
15. ADMINISTRATION
==================================================

Add store administration for:

- Listing moderation
- Orders
- Disputes
- ZMW seller liabilities
- Available and pending seller payouts
- Platform fee rate and immutable change history
- Platform fee revenue
- Lenco collection and payout status
- Failed webhooks/reconciliation
- Refunds
- Suspicious activity
- Store feature flags

Provide reconciliation totals for:

gross sales
= seller payable
+ Club BZR platform fees
+ delivery allocation where applicable
+ provider fees where applicable
+ refunds/reversals

Never infer the Lenco account balance from transactions. Continue using the
authoritative balance API where available.

==================================================
16. REQUIRED USER EXPERIENCE
==================================================

Buyer screens:

- Store discovery
- Listing detail
- Checkout
- Mobile-money payment pending state
- Points confirmation
- Purchases/orders
- Download library
- Bespoke request status
- Physical delivery status
- Dispute submission

Seller screens:

- Store setup
- Listing editor
- Product preview
- Orders requiring action
- Digital fulfilment
- Bespoke submission/revisions
- Physical dispatch
- ZMW earnings
- Points earned
- Payout setup and requests

Always distinguish visually between:

- Club BZR Points
- ZMW paid through Lenco
- Pending ZMW seller earnings
- Withdrawable ZMW seller earnings
- Lenco account balance
- Club BZR platform revenue

Never label Points as “cash,” “Kwacha,” “withdrawable,” or “Lenco balance.”

==================================================
17. TESTING AND ACCEPTANCE CRITERIA
==================================================

Add unit, emulator, and integration tests covering at minimum:

- Seller creates and publishes each listing type.
- Unauthorized listing publication is rejected.
- Buyer cannot purchase their own product.
- Checkout uses server-side listing price.
- Duplicate checkout cannot double charge.
- Points lock is atomic.
- Default 5% fee is calculated correctly.
- Seller receives 95% under the default configuration.
- An authorized administrator can change the fee.
- Unauthorized users cannot change the fee.
- Fee changes are audited.
- Existing funded orders retain their original fee.
- New orders use the updated fee.
- Points and ZMW use the same snapshotted basis-point policy.
- Lenco pending response does not deliver value.
- Forged Lenco webhook is rejected.
- Duplicate webhook does not duplicate payment/order completion.
- Polling and webhook racing cannot double-complete.
- Digital download is unavailable before payment.
- Digital grant is buyer-specific.
- Bespoke rejection and expiration refund correctly.
- Physical inventory cannot oversell.
- Refunded physical order restores inventory.
- Seller cannot release their own held payment.
- Buyer can approve delivery.
- Admin can resolve a dispute with an audit record.
- Failed payout restores seller funds safely.
- Points cannot enter the ZMW payout flow.
- ZMW earnings cannot enter the Points wallet projection.
- Suspended accounts cannot transact.
- Private addresses, briefs, and files are not publicly readable.
- Community posts handle unavailable listings without crashing.

Run:

- Type checking
- Linting
- Relevant unit tests
- Firebase emulator tests
- Production build

Do not consider the task complete if only UI mock data exists.

==================================================
18. IMPLEMENTATION SEQUENCE
==================================================

Implement in this order:

Phase 1:
- Schemas and indexes
- Listing CRUD and moderation
- Artist storefront
- Central Store
- Points checkout
- Configurable platform fee with a 5% default
- Digital releases
- Buyer library
- Community Wall attachments

Phase 2:
- Bespoke structured requests
- Existing Points escrow integration
- Revisions, approval, and disputes

Phase 3:
- Lenco ZMW marketplace collection
- Seller payable ledger
- Verified/manual seller payout onboarding
- Payout feature flag and reconciliation

Phase 4:
- Physical originals
- Inventory reservation
- Manual Zambia delivery fulfilment
- Proof of fulfilment

Phase 5:
- One-time gated collections
- Eligible session/customer discounts

Each phase must leave the application deployable.

==================================================
19. DELIVERABLES
==================================================

Deliver:

1. Working frontend and backend implementation.
2. Updated Firestore schemas, security rules, and indexes.
3. Migration or compatibility handling for existing trades.
4. Automated tests.
5. Updated economy and marketplace documentation.
6. A STORE_ARCHITECTURE.md document.
7. A LENCO_MARKETPLACE_READINESS.md document identifying:
   - confirmed API capabilities
   - assumptions
   - configuration
   - required Lenco approval
   - reconciliation
   - rollback procedure
8. Emulator seed data for representative listings and orders.
9. Deployment instructions.
10. A concise completion report listing:
    - files changed
    - tests run and their results
    - feature flags
    - configuration still required
    - known limitations
    - actions Club BZR must complete before enabling ZMW seller payouts

Do not deploy, enable production payouts, alter production data, or insert
secrets unless explicitly authorized.

If a material provider capability is uncertain, document it and build a safe
feature-flagged boundary. Do not fabricate functionality.
```

## Recommended product boundary

Recurring subscriptions and resale royalties are intentionally excluded from this version. One-time collections, digital releases, bespoke requests, and physical originals provide useful marketplace capability without depending on recurring Lenco billing or introducing secondary-market ownership complexity.

The platform fee remains configurable through Admin → Economy, defaults to `500` basis points (5%), and is snapshotted on each funded order so later administrative changes cannot alter historical settlement terms.
