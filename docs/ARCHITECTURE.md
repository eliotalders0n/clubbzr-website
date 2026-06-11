# Club BZR Architecture

This document describes the current Club BZR web app architecture as implemented in this repository. It is the working reference for feature changes, Firebase integration, routing, and deployment.

## Runtime Stack

- React 19 with TypeScript and Vite.
- React Router 7 for client-side routing.
- Chakra UI 3 for component primitives and theme tokens.
- Firebase Auth, Firestore, Storage, and optional Analytics.
- Framer Motion, GSAP/Lenis, and Three.js are available for motion and immersive visual surfaces.
- Tailwind CSS v4 utilities are imported globally, but most feature UI uses Chakra props.

Key commands:

```bash
npm run dev      # Start Vite on port 3000
npm run build    # Type-check and build into dist/
npm run lint     # Run ESLint
npm run preview  # Preview the production build locally
```

## Application Shell

`src/main.tsx` mounts the app with:

- `ChakraProvider value={system}` from `src/theme.ts`.
- `BrowserRouter`.
- Global CSS from `src/styles/globals.css`.

`src/App.tsx` wraps routes in `AuthProvider` and `Suspense`. Every main page is lazy-loaded, and `PageLoader` provides a full-screen Chakra spinner while chunks or auth state load.

The root route is auth-aware: authenticated users redirect from `/` to `/community/wall`; anonymous users see the landing page.

## Routes

Public and member routes:

- `/` - landing or auth redirect.
- `/auth`, `/auth/login`, `/auth/signup` - authentication.
- `/community/wall`, `/community/matchmaking`, `/community/map`.
- `/quests`, `/quests/:id`.
- `/sessions`, `/sessions/:id`.
- `/artists`, `/artists/create`, `/artists/:id`.
- `/exhibitions`, `/exhibitions/:id`.
- `/radio`.
- `/passport`.
- `/terms`, `/privacy`.

Admin routes:

- `/admin`.
- `/admin/users`.
- `/admin/sessions`.
- `/admin/quests`.
- `/admin/exhibitions`.
- `/admin/radio`.
- `/admin/community`.
- `/admin/map`.

Route access is primarily enforced by Firestore rules and page-level auth checks. Admin navigation is under `src/pages/admin` and uses Firestore-backed management screens.

## Source Organization

```text
src/
  App.tsx                 Route map and lazy loading
  main.tsx                React entry point
  theme.ts                Chakra v3 system tokens
  styles/globals.css      Global CSS, fonts, Tailwind tokens
  contexts/AuthContext.tsx
  hooks/useFirestore.ts   Firestore React hooks
  components/
    layout/               Header, footer, containers, nav
    ui/                   Local reusable UI wrappers
    features/             Domain feature cards/forms
    admin/                Admin data table, uploader, stats card
    animations/           Motion helpers
    three/                Three/R3F visual scenes
  pages/                  Route-level screens
lib/
  config.ts               Firebase app, collections, storage paths
  schema.ts               Collection TypeScript interfaces
  firestore.ts            Typed CRUD, queries, transactions, counts
  storage.ts              Upload, validation, compression helpers
  badges.ts               Quest badge definitions and award helpers
  submissionVotes.ts      Submission upvote/downvote transactions
firebase/
  firestore.rules
  firestore.indexes.json
storage.rules
```

## Data Layer

Firebase is initialized in `lib/config.ts`. The app uses singleton instances for Auth, Firestore, Storage, and optional Analytics. Emulator connections are enabled only when `VITE_USE_FIREBASE_EMULATORS=true`.

`lib/schema.ts` is the type source for Firestore collections. `lib/firestore.ts` wraps document CRUD, collection queries, paginated reads, count aggregations, listeners, batch writes, and transactions. `src/hooks/useFirestore.ts` exposes these helpers to React through `useDocument`, `useCollection`, `useRealtimeCollection`, `usePagination`, `useInfinitePagination`, `useMutation`, and `useQuery`.

## Current Feature Model

The community wall is a mixed activity feed, not just post rendering. `src/pages/CommunityWall.tsx` combines:

- `communityPosts` for user posts.
- `questSubmissions` for quest completions and badge activity.
- `exhibitions` for upcoming or active exhibition cards.

Posts are loaded with infinite pagination. Comments are loaded per post in small pages, so the wall does not render all comments up front. The wall sidebar stats are Firestore count aggregations rather than mock numbers.

Quest submissions write to `questSubmissions`, show on the wall when configured, support upvotes/downvotes, and award Creative Passport badges through a transaction. The passport page derives live post, quest, badge, and artist profile state from Firestore.

Admin pages now read from Firestore collections for dashboard, users, sessions, quests, exhibitions, radio, community, and map content. Exhibitions and radio are both public-facing routes and admin-managed content areas.

## Deployment

Firebase Hosting is configured in `firebase.json`:

- Project: `club-bzr` from `.firebaserc`.
- Hosting site: `club-bzr`.
- Public directory: `dist`.
- SPA rewrites send all routes to `index.html`.
- Firestore rules: `firebase/firestore.rules`.
- Firestore indexes: `firebase/firestore.indexes.json`.
- Storage rules: `storage.rules`.

Cloud Functions are intentionally not configured in `firebase.json` yet. Deploy hosting with:

```bash
npm run build
firebase deploy --only hosting
```

Deploy rules/indexes separately when they change:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```
