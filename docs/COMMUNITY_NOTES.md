# Community Notes

Community Notes are AI-assisted, platform-authored posts mixed into the existing
`communityPosts` feed. They use the normal reaction, comment, and sharing flows,
but have a distinct Club BZR editorial presentation and cannot be followed,
edited, or deleted as member profiles.

## Generation

The `generateDailyCommunityNote` scheduled function runs at 08:00, 14:00, and
20:00 in `Africa/Lusaka`. All three windows target the deterministic document
`community-note-YYYY-MM-DD`, so only one post can be published per Lusaka day.
The additional windows recover from a temporary provider failure without
creating extra posts.

The model is not asked to invent facts. A rotating, curated studio-practice seed
supplies the factual statement and practical method. The model turns that source
material into a title, two short paragraphs, and a concise action. Structured
output and server-side length checks reject malformed responses.

Run state and a ten-minute generation lease live in
`communityNoteRuns/{YYYY-MM-DD}`. A successful post records its model and
grounding label in the nested `communityNote` object.

## Configuration

The API credential is a server-only Firebase secret:

```bash
firebase functions:secrets:set AZURE_OPENAI_API_KEY
```

Non-secret defaults can be overridden in `functions/.env`:

```dotenv
AZURE_OPENAI_BASE_URL=https://pukuta-core-resource.services.ai.azure.com/openai/v1
COMMUNITY_NOTES_MODEL=gpt-5.6-luna
```

Deploy the scheduler and Firestore rules after setting the secret:

```bash
firebase deploy --only functions:generateDailyCommunityNote,firestore:rules
```

The API key must never be added to a `VITE_` environment variable or committed
to the repository because either would expose it to browsers or source history.
