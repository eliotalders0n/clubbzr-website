# Store implementation plan

## Existing architecture and compatibility

React/Vite routes use Chakra's dark surfaces and orange actions. Member profiles are keyed by Auth UID; artist records link through `userId`. Community posts already have server-authored editorial attachments. Store promotions will add a listing reference without replacing those posts.

Firebase callables enforce Auth, App Check and active accounts. `transactions` and `ledgerEntries` are the immutable financial source of truth; `balances` is the Points projection. Store orders extend `trades` and `escrows`, preserving legacy kinds and APIs. ZMW entries will use the same posting service with an explicit currency and a separate `sellerPayables` projection. Legacy trade actions must reject store orders so they cannot bypass fulfilment or inventory checks.

The deployed rules are `firebase/firestore.rules` and `storage.rules`; indexes are `firebase/firestore.indexes.json`. The Storage public fallback needs an explicit private-store exclusion. Protected assets use immutable object generations and server-authorized short-lived access.

There are pre-existing uncommitted changes across community, access control, payments and admin. Preserve these. Baseline frontend build and nine backend unit tests pass; baseline repository lint fails on existing issues. The initial patch and lint results are saved outside the repository in `/private/tmp/clubbzr-pre-store*` for comparison.

## Implementation sequence

1. Add typed listing/order/grant/settings contracts, validation, indexed cursor discovery, listing lifecycle, seller setup and admin moderation. Save all flags disabled by default.
2. Extend the existing ledger to participate in an outer transaction. Implement authoritative, idempotent Points checkout, inventory reservation, immutable events, digital completion and buyer grants atomically. Add Store, detail, Shop, seller management, purchases/library and Community attachments.
3. Add structured bespoke briefs/add-ons, acceptance deadlines, submission/revision/approval, private messages/evidence and audited dispute/refund resolution.
4. Add guarded Lenco collection/status/webhook processing, explicit integer ZMW ledger entries, seller verification, payout initiation/reconciliation and manual confirmed refunds. Account approval/configuration remain prerequisites.
5. Complete physical fulfilment and one-time gated collections using the same order and grant systems. Discounts remain optional and follow core correctness.
6. Add unit and emulator integration/rules tests, representative emulator seed data, architecture/readiness/deployment documents. Verify frontend/backend builds, targeted lint, existing tests and new tests; report pre-existing failures separately.

## Invariants to verify

- No direct client financial or order writes; immutable ownership and price/fee/licence snapshots.
- Checkout races cannot oversell or double-debit; transition races cannot release/refund twice.
- Points never enter ZMW projections/payouts. Fee rounding is exact integer floor; delivery is excluded.
- Initial/pending Lenco responses deliver no value; signed webhooks and authenticated polling converge idempotently.
- Only completed purchases grant private assets; refunds revoke grants. Briefs/addresses/evidence remain participant-only.
- Sellers cannot approve their own held funds. Suspended accounts cannot transact.
- Store flags fail closed; recovery/refunds for existing obligations remain possible while new sales are disabled.
- No deployment, production-data changes, production payouts or secrets are authorized.

## Completion

All six implementation stages are complete. The production frontend build, backend build, backend lint, 19 unit tests and 22 emulator scenarios pass. Seven browser checks cover desktop/mobile Store, real emulator Points checkout, seller management/editor and administration; a final focused regression also verifies separately recorded provider refund cost. Root lint matches the initial 118 errors / 9 warnings with no added diagnostics.

The shared merchant webhook routes both Store and existing Points purchases. Protected collection updates follow the latest approved version; existing obligations remain serviceable while new sales are disabled. Optional discounts remain deferred as allowed by the brief.

See [completion report](STORE_COMPLETION_REPORT.md), [architecture](STORE_ARCHITECTURE.md), [deployment](STORE_DEPLOYMENT.md) and [provider readiness](LENCO_MARKETPLACE_READINESS.md). No production flags, data or deployment were changed. Real provider sandbox and deployed IAM/CORS/index checks remain rollout gates, not claimed local test results.
