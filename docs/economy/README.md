# Club BZR points economy

This subsystem treats the immutable `transactions` and `ledgerEntries` collections as the financial source of truth. `balances` is a transactionally updated projection. Clients can read their own wallet but cannot write wallets, balances, payments, trades, escrow, ledger entries, reward grants, or audit logs.

## Launch invariants

- Points are integer units; ZMW is accepted as integer ngwee.
- The economy fails closed. A missing `settings/economy` document disables every capability.
- Purchases remain disabled until an administrator saves `pointsPerZmw`, minimum and maximum purchase values.
- Peer transfers have no fee and enforce per-transfer, rate, and atomic daily limits.
- Commercial settlement charges the configured basis-point fee (initial policy: 500 / 5%).
- Existing Creative Passport `points` migrate to `xp`; they never become spendable currency.
- There is no cash-out or point withdrawal in this release.
- Every mutating API requires Auth, active-account checks, App Check in deployed environments, validation, and an idempotency key where value moves.

## Collections

`wallets/{uid}` owns status and currency. `balances/{uid}` stores available, locked, pending, total and projection sequence. `transactions/{id}` is an immutable business transaction and contains balanced entries for audit portability. `ledgerEntries/{transactionId_index}` provides scalable per-account aggregation. `payments` and `paymentEvents` retain operational and raw-event state. `trades` and `escrows` preserve lifecycle state; completion/cancellation always posts a ledger transaction. `questProgress` and `rewardGrants` separate progress from retryable reward delivery. `auditLogs` records privileged changes.

System accounts are sharded into 16 documents per purpose to avoid a single hot balance document.

## Deployment order

1. Export Firestore and Auth. Deploy indexes, then Functions.
2. Run `npm --prefix functions run migrate:economy:dry-run` with production credentials and archive the output.
3. Run `npm --prefix functions run migrate:economy` in a maintenance window.
4. Force administrators to refresh their ID tokens, then deploy rules and Hosting.
5. Configure `VITE_FIREBASE_APPCHECK_SITE_KEY` for Hosting and register the
   production domains before deploying the client. New callable functions reject
   missing App Check tokens by default.
6. In Admin → Economy, save limits and conversion while maintenance remains on.
7. Configure Lenco’s webhook URL to `lencoPointsWebhook` and make a sandbox purchase.
8. Verify the payment, event, transaction, entries, and balance reconcile.
9. Disable maintenance and enable capabilities individually.

## Lenco webhook

The endpoint verifies `X-Lenco-Signature` using HMAC SHA-512 with a webhook hash key that is the SHA-256 hash of `LENCO_SECRET_KEY`, following Lenco’s published webhook specification. Duplicate events are keyed and retained in `paymentEvents`. A successful event credits points only when payment ID, amount, currency, user and purpose match the initiated payment.

Lenco recommends polling as a recovery mechanism when webhooks cannot be delivered. Keep purchases disabled until a scheduled recovery poll has been deployed and verified for the production account.

Purchase refunds are full reversals. An administrator first completes the cash
refund in Lenco, then records its provider refund ID and reason through
`adminRecordPointPurchaseRefund`. The callable atomically removes the purchased
points, links the compensating transaction to the original and marks the payment
refunded. If the member has already spent those points, the operation fails for
manual review rather than creating a hidden negative balance.

## Rollback

First enable maintenance mode; do not delete or rewrite ledger data. Disable purchases, transfers and trading. Roll Hosting/Functions back to the previous release while leaving the restrictive rules in place. Restore user/profile data only from the pre-migration export if needed; retain `transactions`, `ledgerEntries`, `payments`, `paymentEvents`, `trades`, `escrows`, and `auditLogs` for investigation. Corrections are compensating ledger transactions, never edits or deletes.
