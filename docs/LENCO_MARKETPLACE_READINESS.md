# Lenco marketplace readiness

The Store implementation is ready for staging validation. ZMW checkout and seller payouts remain disabled. No live collection, transfer, deployment, account approval or compliance review was performed during implementation.

## Confirmed public API capabilities

Lenco documents Zambian mobile-money collection initiation, merchant/customer fee bearer selection, customer authorization and incomplete payment states. This implementation requests merchant-covered fees and verifies the outcome independently before delivering value. [Collection API](https://lenco-api.readme.io/v2.0/reference/initiate-collection-from-mobile-money)

Lenco documents mobile-money transfers and authenticated collection/transfer queries by reference. The Store uses a deterministic reference, sends one initiation attempt, and queries uncertain outcomes instead of initiating again. [Transfers](https://lenco-api.readme.io/v2.0/reference/initiate-transfer-to-mobile-money), [collection status](https://lenco-api.readme.io/v2.0/reference/get-collection-by-reference), [transfer status](https://lenco-api.readme.io/v2.0/reference/get-transfer-by-reference)

Signed webhook events cover successful/failed collections and transfers. Verification uses the original request bytes, SHA-256 of the API token as the hash key, and HMAC SHA-512 with constant-time comparison. Lenco documents retries and recommends polling for missed events. [Webhook specification](https://lenco-api.readme.io/v2.0/reference/webhooks)

Lenco's documented splitting feature allocates account inflows. It does not establish that Club BZR has permission or API support for per-order marketplace escrow, sub-merchants or seller settlement. The Store therefore implements an **internal seller-payable hold**. [Split inflows](https://support.lenco.co/en/articles/6827385-split-payments-and-how-to-split-inflows)

## Required confirmation before real-money launch

Club BZR must obtain written confirmation from Lenco that its merchant account may collect for independent sellers, retain seller liabilities until fulfilment/dispute resolution, and send subsequent seller payouts. Confirm settlement timing, supported operators, transaction limits, payout permissions, account identity requirements, fee bearer behavior, actual collection/refund/payout costs, reversals and chargebacks. Obtain appropriate legal/compliance advice on the proposed marketplace arrangement and publish approved buyer/seller terms.

Confirm the exact v2 sandbox base URL, test credentials and source account with Lenco. Public endpoint documentation is evidence of API capability, not approval of this merchant account. This release does not assume a provider refund endpoint or automated identity-verification service.

## Configuration and callback routing

| Configuration | Required behavior |
|---|---|
| `LENCO_SECRET_KEY` | Existing Firebase Functions secret; server only. |
| `LENCO_API_BASE` | Existing shared v2 provider base. Configure the Lenco-confirmed environment; changing it also affects existing Points/session calls. |
| `LENCO_MARKETPLACE_APPROVED` | Must be exactly `true` after written account approval. Defaults to disabled. |
| `LENCO_MARKETPLACE_ACCOUNT_ID` | Approved account UUID for seller transfer debits. Separate from legacy session withdrawal configuration. |
| `settings/store.zmwCheckoutEnabled` | Admin-controlled permission for new Store cash collections. |
| `settings/store.sellerPayoutsEnabled` | Separate permission for new seller payouts. Requires ZMW checkout capability as well. |
| Seller account | Legal name, normalized Zambian phone/operator, ownership confirmation, identity verification and admin approval. |

Keep the existing `lencoPointsWebhook` merchant URL: it now routes signed, known Store references through the same handler used by `lencoStoreWebhook`, while retaining its Points purchase handler. Both paths share idempotency. The Store-only endpoint is available if a separate callback arrangement is approved; do not replace the Points callback with it because it intentionally ignores non-Store payments. Confirm the merchant's configured URL and test both flows in staging. Existing session payment polling remains in place.

## Settlement, fees and reconciliation

The buyer pays the authoritative product price plus delivery. The same configured basis-point policy applies to Points and ZMW, excluding delivery. For Points the fee is fixed in the funding transaction; for ZMW it is fixed when successful collection is verified. Subsequent changes do not recalculate the funded order. Discounts are zero in this release.

The seller receives the product subtotal minus the platform fee, plus delivery. Club BZR covers provider costs separately. A missing provider fee stays unknown (`null`); recovery later records it exactly once. A changed known fee or conflicting terminal outcome requires investigation. Provider payout fees are recorded per payout; orders do not invent an allocation across an aggregate seller payout.

Use Admin → Store → ZMW reconciliation for gross collections, delivery allocation, platform fees, full refunds, pending refunds, seller liability buckets and provider costs. Gross buyer collections reconcile to seller product allocation + delivery + platform allocation. Provider expenses reduce Club BZR's net proceeds separately; refunds/reversals have their own compensating entries. A zero order-allocation difference alone does not prove that the provider has settled all funds.

Use the existing Admin → Payments account API for the authoritative Lenco balance. Never treat Store journal totals, seller liabilities or Points as the merchant bank balance. Store cash records do not enter the legacy Points ledger view or Points purchase metrics.

`recoverStoreOrders` polls every 30 minutes, retries recoverable paid fulfilment, expires unanswered requests and fetches missing provider costs. Failed signed events retain raw payloads and errors in `paymentEvents`; recovery failures create `reconciliationIssues`. An administrator can query a payment/payout from its detail screen. Review open issues against the latest provider result and ledger before resolving the operational record; keep the original provider evidence.

An initiation timeout remains pending verification with reserved inventory/funds. Do not infer failure from elapsed time, release an uncertain payment reservation, or issue another payout. A later success after a previously confirmed failure requires manual investigation. Reconcile the deterministic reference with Lenco and correct through audited compensating operations.

Full refunds enter `refund_pending`. An administrator performs the approved external refund process, verifies the recipient/amount, and records a unique provider reference and reason. A confirmed provider refund fee can be recorded at confirmation; it posts separately to provider expenses and never reduces the buyer's refund. An unknown refund cost stays null for operational follow-up. Only confirmation changes the order to `refunded`, reverses the platform allocation and restores stock; entering refund processing already revokes new download access. Refunds requiring unavailable seller funds fail for manual review; this release does not create hidden negative seller balances. Partial refunds and automated chargeback ingestion are not implemented.

## Staging evidence required

- Run both existing Points purchases and Store collections against the approved sandbox; test pending, successful, failed, duplicate, mismatched and delayed events.
- Verify actual returned amount, currency, reference, provider ID, fee bearer and source/recipient fields, including every supported operator.
- Complete one approved test payout and a failed payout; confirm the available/pending/paid projections match immutable entries and the provider's records.
- Exercise a provider/manual full refund, receipt uniqueness and grant revocation.
- Verify scheduled recovery, alerts, composite indexes, App Check and real signed Storage uploads/downloads under the deployed service identity.

Local tests use real Firebase emulators and mocked Lenco responses. Signed Storage authorization and generation selection are tested, but URL signing uses a test stub; deployed IAM, CORS and actual provider behavior still need staging evidence.

## Rollback

Disable `sellerPayoutsEnabled` and `zmwCheckoutEnabled` first; disable `storeEnabled` if necessary. Keep Store reconciliation, refund handlers, signed callbacks and restrictive Storage rules running for existing obligations. Changes to flags do not erase debts or turn a pending provider request into a failure.

Rollback the UI if needed, but retain backend support for Store-marked trades and ZMW journal entries until all obligations are resolved. Do not deploy a pre-Store backend that interprets cash entries as Points or allows legacy trade handlers to settle Store orders. Preserve every order, event, grant, payout and journal record. Financial correction always uses compensating entries.
