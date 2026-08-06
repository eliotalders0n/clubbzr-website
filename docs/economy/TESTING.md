# Economy testing and release gates

## Automated checks

- `npm run build` — React/TypeScript production build.
- `npm --prefix functions test` — Functions compile plus integer conversion/fee tests.
- `npm --prefix functions run lint` — backend lint.
- `npx firebase emulators:exec --only firestore "node -e \"process.exit(0)\""` — rules compilation.

Before production, add authenticated Rules Unit Testing cases for every matrix row below. The current repository did not include `@firebase/rules-unit-testing`, so this release does not silently introduce an unpinned test dependency.

| Actor | Resource | Expected |
|---|---|---|
| Member | own balance read | allow |
| Member | any balance write | deny |
| Member | own role/account status write | deny |
| Member | transaction create/update/delete | deny |
| Member | other member transaction read | deny |
| Member | own notification mark `read=true` | allow |
| Member | notification creation or payload edit | deny |
| Claimed admin | audit/settings/ledger read | allow |
| Profile role only, no claim | admin resource | deny |

## Emulator integration scenarios

1. Two concurrent transfers that together exceed available points: exactly one succeeds.
2. Same idempotency key and same payload: one posting, duplicate response.
3. Same idempotency key and different payload: rejected.
4. Transfers crossing the daily limit concurrently: total never exceeds the limit.
5. Duplicate successful Lenco webhook: one credit only.
6. Validly signed webhook with wrong amount/currency/reference: no credit and review status.
7. Completion and cancellation racing: one terminal trade state and one settlement.
8. Duplicate activity event: one quest increment and one reward grant.
9. Reward processor retry after point posting: no double point or XP award.
10. Frozen user: all economy callables rejected.

## Production smoke test

Keep maintenance mode on. Migrate one test member, credit a small amount, reconcile it, transfer between two test members, run an auto-approved quest, complete and refund separate escrow trades, and complete one Lenco sandbox purchase. Confirm transaction entries sum to zero and balance projections match before enabling member capabilities.
