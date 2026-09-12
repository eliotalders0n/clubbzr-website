# Store deployment and local verification

No deployment is part of this implementation. Follow [Lenco readiness](LENCO_MARKETPLACE_READINESS.md) before enabling ZMW. The five Store capability flags default to false; absence of `settings/store` is safe.

## Local checks

Use Node 22 (the configured Functions runtime), installed root/Functions dependencies, Firebase CLI and a Java runtime supported by the installed emulators.

```sh
npm run build
npm --prefix functions test
npm run lint
```

The repository had pre-existing lint failures before Store work; see the completion report for the baseline comparison. Type checking and production builds must pass independently.

Start an isolated demo stack in a separate terminal:

```sh
node scripts/store-demo.cjs
```

This generates a temporary Functions source containing only local Store/wallet/activity handlers, and starts Auth, Firestore, Storage and Functions for `demo-clubbzr-store`. It does not read `functions/.env`, load production provider credentials, or start the Store recovery schedule. Ports are 9099, 8080, 9199, 5001 and UI 4000. Build Functions before starting it; restart after backend changes. Never deploy its temporary configuration.

With the emulators running:

```sh
npm --prefix functions run test:store:emulator
npm --prefix functions run seed:store
VITE_USE_FIREBASE_EMULATORS=true VITE_FIREBASE_EMULATOR_PROJECT_ID=demo-clubbzr-store npm run dev -- --host 127.0.0.1 --port 3010
```

Tests clear only the demo project's Firestore between cases, so seed **after** tests. Fixtures refuse non-demo projects. Seed data includes all four products and corresponding Points orders. Sign in with `store_buyer@store.test`, `store_seller@store.test` or `store_admin@store.test`, password `StoreDemo123!`. These are disposable emulator users, never production credentials. Seeding again adds representative releases; it does not delete production or local data.

With Playwright and Chromium available:

```sh
node scripts/check-store-browser.cjs
```

`PLAYWRIGHT_MODULE` may point to an existing Playwright installation. The script asserts the demo project before entering fixture credentials, completes a Points purchase, checks desktop/mobile routes, and writes screenshots and results under `artifacts/store-browser/`. The repo introduces no runtime dependency for these checks.

## Staging rollout order

1. Review the full working-tree change alongside any pre-existing user changes. Export Firestore/Auth and record the currently deployed release/configuration. Store requires no rewrite of legacy trades or journal records.
2. Deploy `firebase/firestore.indexes.json` to a staging project and wait until all new indexes are ready. Run every discovery combination (type, rail, seller, featured, limited quantity, price/newest and next page), workspaces, summaries and recovery queries. The emulator does not prove composite indexes are available in production.
3. Deploy the Functions extensions and both active rules files (`firebase/firestore.rules`, `storage.rules`). Keep all Store flags false. Retain existing payment/quest/trade functions. The existing ledger can post into an outer Store transaction and separates ZMW projections; legacy trade handlers explicitly reject Store orders.
4. Configure Storage signing and CORS as below. Verify private assets are inaccessible anonymously and to unrelated authenticated users.
5. Build and deploy the frontend to staging with its registered App Check site key. Keep `ENFORCE_APP_CHECK=true`; check valid and missing App Check tokens. The demo-project override only works in Vite development with explicit emulator opt-in.
6. Enable Store and Points trading in staging. Publish/moderate representative products, purchase on both desktop/mobile, fulfil bespoke/physical orders, refund, and inspect journal/grant/inventory effects.
7. Obtain provider/account sign-off and complete the cash tests in [Lenco readiness](LENCO_MARKETPLACE_READINESS.md). Only then consider a separately approved production rollout with limited sellers and monitored flags.

Example deployment commands, after explicit deployment authorization and selecting the intended project:

```sh
firebase deploy --only firestore:indexes --project YOUR_STAGING_PROJECT
firebase deploy --only functions,firestore:rules,storage --project YOUR_STAGING_PROJECT
firebase deploy --only hosting --project YOUR_STAGING_PROJECT
```

The repository's existing Hosting target and client Firebase configuration identify `club-bzr`. Configure the intended staging Hosting target/client project before using these commands; `--project` alone does not change the built client configuration. Do not run the economy migration again merely to add Store.

## Protected Storage configuration

Private files use `store-private/{uid}/{randomId}`. Storage rules explicitly deny public/client reads and writes for this prefix, including the previous public fallback. Public covers use `store-previews/`. Do not create public download tokens, public bucket/object IAM grants, or a CDN bypass for paid files; Storage rules do not override public GCS IAM.

The deployed Functions service identity needs bucket object access and permission to sign URLs through IAM Credentials (`iam.serviceAccounts.signBlob`, scoped to the signing identity). Confirm the IAM Credentials API and service identity configuration in staging. Do not introduce a downloaded service-account key into the frontend or repository.

Browser uploads use signed PUT requests. Merge these required CORS capabilities into the bucket's existing CORS policy without removing the existing site's requirements: exact approved frontend origins, PUT/GET/HEAD, `Content-Type`, `x-goog-if-generation-match`, and relevant response metadata. CORS is not authorization. The signed request includes exact content length, MIME type and a generation-zero precondition; the browser supplies the File body's content length automatically. Verify a real upload, overwrite rejection, and a 60-second generation-bound download.

Uploads are limited to 50 MB and supported MIME types; previews are images under 10 MB. Content scanning and orphan-upload lifecycle cleanup are operational extensions, not implemented background jobs. Do not apply a blanket lifecycle deletion to purchased objects. Old digital versions and approved collection versions back existing access grants.

## Settings and compatibility

Deploying Functions does not enable the Store or initialize an open Store setting. If shop setup reports that the Store is unavailable, an authorized administrator can open `/admin/store?tab=controls`, enable **Store open**, enter a reason, and save the controls. This enables shop setup and listing management independently of ZMW checkout and seller payouts. The manager checks availability before showing setup and links administrators directly to these controls; existing orders and earnings remain accessible while the Store is closed.

| Setting | Default / effect |
|---|---|
| `storeEnabled` | false; new browsing/listing/checkout capability |
| `zmwCheckoutEnabled` | false; also requires server account approval |
| `sellerPayoutsEnabled` | false; also requires verified seller and source account |
| `physicalProductsEnabled` | false |
| `gatedCollectionsEnabled` | false |
| `autoApprovalEnabled` | false; applies to bespoke submissions only |
| `autoApprovalHours` | 168; only used after explicit enablement |
| `minimumPriceNgwee` / `minimumPricePoints` | 100 / 1 |
| `minimumPayoutNgwee` | 10000 |
| `settings/economy.tradeFeeBasisPoints` | Existing value, default 500; admin range 0–2000 with reason/audit |

Store orders add `storeOrder: true` to `trades`; existing order kinds remain intact. Points use existing `balances`, `escrows`, system fee shards and ledger posting. ZMW uses explicit-currency journal entries and `sellerPayables`; no Points conversion or withdrawal exists. Historical entries without currency remain valid Points entries during reconciliation. New Points histories and cash reporting stay separated.

Disable new-sales flags for rollback while preserving fulfilment, refunds, payment reconciliation and private access for existing purchases. Follow the obligations-aware rollback in the readiness document; never rewrite immutable ledger history or reopen paid Storage paths.
