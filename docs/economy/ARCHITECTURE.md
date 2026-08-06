# Economy architecture

## Components

```mermaid
flowchart LR
  UI[React routes] --> C[Wallet / Trading / Notification contexts]
  C --> API[Typed Firebase callable services]
  API --> AUTH[Auth + App Check + active-account guard]
  AUTH --> FN[Domain Cloud Functions]
  FN --> LEDGER[Ledger transaction service]
  LEDGER --> TX[(transactions)]
  LEDGER --> EN[(ledgerEntries)]
  LEDGER --> BAL[(balances projection)]
  FN --> AUDIT[(auditLogs)]
```

The React providers cache only display state. They never calculate or persist balances. Every value-moving request terminates at the shared ledger service, which checks integer values, balanced entries, non-negative member compartments, idempotency collisions and linked-record preconditions in one Firestore transaction.

## Collections

```mermaid
erDiagram
  USERS ||--|| WALLETS : owns
  WALLETS ||--|| BALANCES : projects
  TRANSACTIONS ||--|{ LEDGER_ENTRIES : contains
  USERS }o--o{ TRANSACTIONS : participates
  USERS ||--o{ PAYMENTS : initiates
  PAYMENTS ||--o{ PAYMENT_EVENTS : receives
  TRADES ||--|| ESCROWS : secures
  USERS ||--o{ QUEST_PROGRESS : advances
  QUESTS ||--o{ QUEST_PROGRESS : defines
  QUEST_PROGRESS ||--o| REWARD_GRANTS : completes
  REWARD_GRANTS ||--o{ TRANSACTIONS : awards
```

Large or append-only data is separated from user documents. `transactions`, `ledgerEntries`, provider events and audit records are immutable to clients and never deleted. System balances use 16 deterministic shards for fees, rewards and purchases to distribute contention.

## Point purchase sequence

```mermaid
sequenceDiagram
  participant U as Member
  participant F as initiatePointPurchase
  participant L as Lenco
  participant W as Signed webhook
  participant D as Firestore
  U->>F: ZMW ngwee + phone + idempotency key
  F->>D: create immutable-intent payment
  F->>L: mobile money collection
  L-->>U: approval prompt
  L->>W: transaction.successful + signature
  W->>W: verify HMAC and amount/currency/reference
  W->>D: post balanced ledger entries + projection
  W->>D: mark payment/event processed
```

The member status callable and scheduled 15-minute reconciler query Lenco as recovery paths. All three paths use the same deterministic ledger transaction ID, so only one can credit points.

## Trading sequence

```mermaid
stateDiagram-v2
  [*] --> Funded: buyer locks points
  Funded --> Accepted: seller accepts
  Accepted --> Delivered: seller delivers
  Accepted --> Disputed: either participant disputes
  Delivered --> Disputed: either participant disputes
  Delivered --> Completed: buyer releases
  Accepted --> Completed: buyer releases
  Funded --> Cancelled: buyer cancels / refund
  Disputed --> Completed: admin releases
  Disputed --> Cancelled: admin refunds
```

The lock, release, fee and refund are double-entry ledger movements. State preconditions and state writes are included in the same Firestore transaction as settlement, preventing cancel/complete races.

## Quest sequence

```mermaid
flowchart LR
  T[Artwork/comment/follow/login/submission/attendance triggers] --> A[(activity)]
  A --> E[evaluateQuestActivity]
  E --> Q[(configured quests)]
  E --> P[(questProgress + receipt)]
  P --> G[(rewardGrant)]
  G --> R[processQuestReward]
  R --> L[Points ledger]
  R --> X[XP, badges, titles, achievements, unlockables]
  R --> N[(notification)]
```

Quest definitions provide `eventTypes`, optional metadata criteria, target, cadence, schedule, approval mode and an extensible rewards array. Activity receipts make each source event count once. Reward grants isolate retries from progress evaluation.

## Security boundaries

- Custom claims—not `users.role`—authorize admin and curator operations.
- Firestore rules prohibit client writes to all economy authority collections.
- Profile owners cannot edit role, account status, XP, quest completion or rewards.
- Admin mutations are callable-only and append an audit record.
- Lenco signatures use constant-time comparison; payload and provider IDs are retained for replay detection.
- All monetary values use integers (ngwee or points); balances never use floats.
- App Check is mandatory unless explicitly disabled for local emulator work.

## Operational monitoring

Scheduled functions reconcile 50 wallets per run, retry pending provider payments, and calculate daily volume, fee, revenue and quest metrics. Large transfers and large manual adjustments create reviewable `fraudAlerts`. Reconciliation discrepancies create `reconciliationIssues`; they are never silently overwritten.
