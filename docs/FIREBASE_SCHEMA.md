# Firebase Schema

This document summarizes the current Firebase model for Club BZR. TypeScript source of truth lives in `lib/schema.ts`; access control lives in `firebase/firestore.rules` and `storage.rules`.

## Firebase Configuration

Firebase is initialized in `lib/config.ts`.

- Project ID: `club-bzr`.
- Hosting site: `club-bzr`.
- Storage bucket: `club-bzr.firebasestorage.app`.
- Hosting output: `dist`.
- Active Firestore rules: `firebase/firestore.rules`.
- Active Firestore indexes: `firebase/firestore.indexes.json`.
- Active Storage rules: `storage.rules`.

Emulators are supported when `VITE_USE_FIREBASE_EMULATORS=true`:

- Auth: `localhost:9099`.
- Firestore: `localhost:8080`.
- Storage: `localhost:9199`.
- Emulator UI: `localhost:4000`.

## Collection Map

`CollectionTypes` currently maps these Firestore collections:

- `users`
- `creativePassports`
- `artists`
- `artistFollows`
- `sessions`
- `quests`
- `questSubmissions`
- `communityPosts`
- `comments`
- `exhibitions`
- `artLocations`
- `radioContent`
- `notifications`
- `matches`

`lib/config.ts` also exposes `prompts`, and the rules include `/prompts`, but it is not currently part of `CollectionTypes`.

## Users and Passports

`users/{uid}` stores account profile data:

- `uid`, `email`, `displayName`, `photoURL`.
- `role`: `user`, `artist`, `facilitator`, `curator`, or `admin`.
- Optional profile fields: `bio`, `location`, `website`, `socialLinks`.
- `isOnboarded`, `isActive`, `lastActiveAt`.

`creativePassports/{userId}` stores gamification and activity state:

- `eventsAttended`, `questsCompleted`, `questsInProgress`.
- `mediums`, `interests`, `collaborations`.
- `streaks`, `badges`, `points`, `level`.
- `timeline` events such as `quest_completed`, `badge_earned`, and `post_created`.
- `stats` totals for events, quests, collaborations, posts, and reactions.

Passport stats shown in the UI may also be derived live from `communityPosts` and `questSubmissions` so the dashboard reflects current activity.

## Artists and Follows

`artists/{artistId}` stores public artist profiles:

- Owner: `userId`.
- Identity: `name`, optional `artistName`, `bio`, `statement`.
- Creative profile: `mediums`, `styles`, `influences`.
- Portfolio: `portfolio`, optional `featuredWork`, `portfolioUrl`.
- Collaboration: `interests`, `collaborationGoals`, `openToCollaboration`, `availability`.
- Status: `featured`, `verified`, `featuredUntil`.
- Counters: `followersCount`, `worksCount`.

`artistFollows/{userId}_{artistId}` persists follow relationships. Artist profile pages should show Edit Profile instead of Follow when the viewer owns the artist profile, and Follow/Unfollow for other artists based on this collection.

## Community Wall

The wall is a merged activity feed:

- `communityPosts` for user-authored posts.
- `questSubmissions` for completed quests and visible submissions.
- `creativePassports.badges` plus submission data for badge-earned activity.
- `exhibitions` for upcoming or active exhibition cards.

`communityPosts/{postId}` fields:

- Author: `userId`, `userName`, optional `userPhotoURL`.
- Content: `prompt`, `content`, `mediaUrls`, `mediaType`.
- Engagement: `reactions`, `reactionsCount`, `comments`, `commentsCount`, `shares`.
- Moderation: `isApproved`, `isHidden`, plus `featured`, `pinned`, `tags`.

`comments/{commentId}` supports comments for posts, submissions, sessions, and exhibitions:

- `parentId`, `parentType`.
- Author fields.
- `content`, `reactions`, `reactionsCount`.
- Optional `replyTo`, `repliesCount`, edit metadata.

Comments are intentionally loaded lazily per parent rather than rendering every comment on page load.

## Quests, Submissions, and Badges

`quests/{questId}` stores creative prompts:

- `title`, `description`, `category`, `difficulty`, `estimatedTime`.
- `constraints`, `inspirationLinks`, `exampleImages`.
- Timing: `startDate`, `endDate`, `isActive`.
- Submission state: `submissions`, `submissionCount`.
- Rewards: `points`, optional `badges`.
- Meta: `featured`, `createdBy`, `tags`.

`questSubmissions/{submissionId}` stores participant responses:

- `questId`, `questTitle`, `userId`, `userName`, optional `userPhotoURL`.
- `title`, `content`, `mediaUrls`, `mediaType`, optional `thumbnailUrl`.
- Engagement: `reactions`, `reactionsCount`, `commentsCount`.
- Voting: `upvotes`, `downvotes`, `upvotesCount`, `downvotesCount`, `voteScore`.
- Status: `featured`, `approved`, optional `showOnWall`.
- `pointsAwarded`.

Badge definitions are in `lib/badges.ts`. Current badge categories are art, music, and photography, with IDs such as `art_first_mark`, `music_sound_mapper`, and `photo_observer`. Quest completion awards badges through a transaction and writes passport timeline events.

Submission voting is implemented in `lib/submissionVotes.ts`. Vote changes update only aggregate vote fields and are allowed by Firestore rules for authenticated users.

## Sessions, Exhibitions, Radio, and Map

`sessions/{sessionId}` stores events and workshops:

- Event details: `title`, `description`, `type`, `date`, `endDate`, `duration`.
- Location: `location`, `isOnline`, `onlineUrl`.
- Capacity: `capacity`, `attendees`, `waitlist`.
- Facilitators, gallery, materials, requirements, reflections, resources.
- Status: `draft`, `published`, `cancelled`, or `completed`.
- Commercial fields: `isFree`, optional `price`, `currency`.

`exhibitions/{exhibitionId}` stores curated showcases:

- `title`, `description`, optional `curatorStatement`.
- `curator`, optional `coCurators`.
- `artworks`, `coverImage`, `featured`.
- `startDate`, `endDate`.
- `isOnline`, optional `location`, `virtualTourUrl`.
- `tags`, `viewsCount`.

`radioContent/{contentId}` stores public BZR Radio entries:

- `title`, `type`, `audioUrl`, `duration`, optional `waveformData`.
- `description`, `artist`, optional `guests`.
- `coverImage`, `publishedAt`, optional `scheduledFor`.
- `playCount`, `likesCount`, `likedBy`.
- `featured`, `isPublished`, `tags`, optional `tracklist`.

`artLocations/{locationId}` stores map entries with coordinates, address data, images, contact links, hours, verification, save/visit counters, and tags.

## Access Rules Summary

- Public reads: users, artists, sessions, quests, quest submissions, community posts, comments, exhibitions, art locations, radio content, prompts.
- Authenticated creates: own users, artists, quest submissions, community posts, comments, art locations, matches.
- Admin or curator management: sessions and exhibitions.
- Admin-only management: quests, radio creation/deletion, prompts, most destructive operations.
- Owner-only private reads: creative passports, notifications, involved matches.
- Controlled aggregate updates: reactions, comments, shares, radio play/likes, art saves/visits, artist follower count, and quest submission votes.

## Storage

Storage paths are defined in `lib/config.ts`:

- `avatars`
- `portfolios`
- `sessions`
- `quests`
- `community`
- `exhibitions`
- `locations`
- `radio`

`storage.rules` allows public reads and authenticated writes to known folders with content-type and size checks. The default max upload size is 10 MB in rules. Client-side validation presets in `lib/storage.ts` allow larger categories such as portfolio images, audio, video, and documents, so keep rules and client presets aligned before enabling larger uploads.

Important path detail: quest uploads are allowed at `quests/{questId}/{fileName}`. Uploading directly to `quests/{fileName}` will be denied.

## Indexes and Deployment

`firebase/firestore.indexes.json` currently contains no composite indexes. The app relies on single-field indexes and simple collection queries. Add composite indexes as soon as a screen combines multiple `where` clauses with an `orderBy`.

Deploy commands:

```bash
npm run build
firebase deploy --only hosting
firebase deploy --only firestore:rules,firestore:indexes,storage
```
