# Store completion report

Implemented the Store's four product types with native discovery, profile shops, Community attachments, checkout, private fulfilment, seller management and administration. Points use existing ledger escrow; feature-flagged ZMW collections and payouts use the same immutable journal with a separate seller-payable projection. No production deployment, data changes, secret insertion or live provider transactions were performed.

## Files and integration

| Area | Store changes |
|---|---|
| Backend domain | New `functions/src/store/{types,policy,catalog,orders,payments,webhook,callables}.ts` |
| Shared finance | Extensions in `wallet/ledger.ts`, `wallet/callables.ts`, `wallet/reconciliation.ts`, `types/economy.ts`, `core/economyMath.ts`, `analytics/triggers.ts` |
| Existing flows | `trading/callables.ts` rejects Store orders in legacy transitions; `payments/lenco.ts` shares verified callback routing; `admin/callables.ts` requires reasoned fee changes; `index.ts` exports Store and keeps the Points-payment query scoped |
| Client contracts | New `lib/store.ts`, type exports in `lib/schema.ts`, local demo project selection in `lib/config.ts` |
| Buyer/seller UI | New `src/pages/Store*.tsx`, `src/components/features/store/*`, `src/hooks/useStoreQuery.ts` |
| Native navigation | `src/App.tsx`, Header, AdminLayout, ArtistProfile, MemberProfile, CommunityPost, TradingContext and Admin Economy |
| Administration | New `src/pages/admin/Store.tsx` |
| Security/data | `firebase/firestore.rules`, `firebase/firestore.indexes.json`, `storage.rules`, `docs/FIREBASE_SCHEMA.md` |
| Tests/demo | `functions/test/storePolicy.test.cjs`, `store.emulator.cjs`, `storeFixtures.cjs`, `functions/scripts/seed-store.cjs`, `scripts/store-demo.cjs`, `scripts/check-store-browser.cjs`, Functions test/seed scripts |
| Documentation | Store plan, architecture, deployment, Lenco readiness, this report, updated economy docs and `functions/.env.example` |

Pre-existing uncommitted work in community, authentication, user management, session payments, quests and admin screens was preserved. The existing ledger API remains compatible; historical trades/journals require no Store migration. No runtime package was added.

## Verification results

| Check | Result |
|---|---|
| `npm run build` | Passed TypeScript and Vite production build |
| `npm --prefix functions test` | Passed build + 19 unit tests, including the 9 original tests |
| `npm --prefix functions run lint` | Passed, no errors or warnings |
| `npm --prefix functions run test:store:emulator` | 22 passed with real Firebase Auth/Firestore/Storage emulators |
| Focused final refund-cost regression | Passed; confirmed expense is separate from full refund/platform reversal |
| `scripts/check-store-browser.cjs` | 7 passed; real Points purchase, desktop/mobile screenshots, no horizontal overflow or uncaught page errors |
| Targeted Store lint | Passed |
| Full root ESLint | Existing 118 errors / 9 warnings; zero added diagnostics against saved baseline |
| `git diff --check` | Passed |
| Demo launcher and seed | Started isolated stack successfully and populated representative releases/orders |

Emulator scenarios cover publication for all types, claims/moderation, self-purchase, authoritative prices, concurrent duplicate checkout, insufficient/frozen wallet rollback, stock races, fee changes/audits, bespoke revisions/expiry, physical receipt/refund, disputes, protected buyer grants, updated collection posts, one-of-one inventory, automatic approval opt-in, disabled-Store obligations and paid fulfilment recovery. Payment cases cover forged/duplicate webhooks, webhook/poll races, original Points callback compatibility, mismatched provider data, late provider fees, cash/Points separation, verified payout onboarding and failed-payout restoration.

Screenshots and machine-readable browser results are in [artifacts/store-browser](../artifacts/store-browser/). Tests used the host's Node 26; deployment targets Node 22. Repeat staging validation on that runtime.

## Flags and remaining configuration

`storeEnabled`, `zmwCheckoutEnabled`, `sellerPayoutsEnabled`, `physicalProductsEnabled` and `gatedCollectionsEnabled` all default to false. Automatic bespoke approval also defaults to false. The fee remains the existing economy setting (default 500 basis points) and changes only for newly funded orders. Points and ZMW prices remain independent.

Before enabling real ZMW seller payouts, Club BZR must obtain written Lenco marketplace approval and appropriate legal/compliance advice; confirm the v2 environment, credentials, merchant/source account, operators and fee/refund terms; configure server approval/account values; verify seller identity and account ownership; and explicitly enable the relevant flags. Complete real sandbox tests for the shared webhook, recovery, payout and manual refund workflow.

Deploy and validate indexes, App Check, protected bucket IAM, signed URL permissions and browser CORS in staging. The emulator suite mocks Lenco responses and stubs signed URL generation; it does not prove live provider approval, actual file signing or merchant settlement. See [Lenco readiness](LENCO_MARKETPLACE_READINESS.md) and [deployment guide](STORE_DEPLOYMENT.md).

## Known limits

- Search is an indexed, single-word prefix across title, artist and tags; no external full-text engine or browser-wide collection loading.
- No optional launch/customer/session discounts yet; the order records a zero discount. No recurring billing, resale, auctions, cart, mixed-rail payments, shipping integrations or Points withdrawal.
- Full ZMW refunds need confirmed provider/manual action. Partial refunds and automated chargeback ingestion are outside this release. Unknown refund costs need operational follow-up; no undocumented provider refund API is assumed.
- Aggregate seller payouts record their actual cost per payout, rather than inventing per-order allocations. Insufficient seller funds require manual refund investigation.
- Protected links are short-lived bearer URLs, not DRM. Type/size checks do not scan for malware. Orphan upload cleanup and content scanning are operational extensions.
- Admin/order detail shows the latest 50 events/messages; all original records remain stored. Discovery and workspaces use bounded cursor queries.
- Root lint debt predates Store; the entire repository's lint command is still not green.

Use [the local demo instructions](STORE_DEPLOYMENT.md#local-checks) to review the implementation. Rollback must disable new sales/payouts while preserving support for outstanding Store orders and liabilities.
