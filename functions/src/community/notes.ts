import OpenAI from "openai";
import {defineSecret} from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import {onSchedule} from "firebase-functions/v2/scheduler";

import {admin, db} from "../core/firebase";

const azureOpenAiApiKey = defineSecret("AZURE_OPENAI_API_KEY");
const AZURE_OPENAI_BASE_URL = process.env.AZURE_OPENAI_BASE_URL ||
  "https://pukuta-core-resource.services.ai.azure.com/openai/v1";
const COMMUNITY_NOTES_MODEL = process.env.COMMUNITY_NOTES_MODEL ||
  "gpt-5.6-luna";
const COMMUNITY_NOTES_TIME_ZONE = "Africa/Lusaka";
const PLATFORM_AUTHOR_ID = "club-bzr-platform";
const GENERATION_LEASE_MS = 10 * 60 * 1000;

interface ArtNoteSeed {
  category: string;
  groundingLabel: string;
  fact: string;
  practice: string;
}

interface GeneratedCommunityNote {
  title: string;
  body: string;
  takeaway: string;
}

const ART_NOTE_SEEDS: ArtNoteSeed[] = [
  {
    category: "Colour",
    groundingLabel: "Studio practice · colour mixing",
    fact: "Complementary colours can mute each other and produce useful " +
      "chromatic neutrals without relying on black.",
    practice: "Mix a dominant colour with tiny additions of its complement, " +
      "testing each step on scrap paper before applying it to the work.",
  },
  {
    category: "Composition",
    groundingLabel: "Studio practice · value structure",
    fact: "A thumbnail that reduces a scene to three broad values can reveal " +
      "the composition more clearly than detailed drawing.",
    practice: "Make three small versions using only light, middle, and dark " +
      "shapes; choose the clearest one before scaling up.",
  },
  {
    category: "Watercolour",
    groundingLabel: "Material practice · watercolour",
    fact: "Transparent watercolour usually preserves its brightest whites by " +
      "leaving the paper unpainted.",
    practice: "Mark the brightest areas lightly before painting and work from " +
      "pale washes toward darker passages.",
  },
  {
    category: "Acrylic",
    groundingLabel: "Material practice · acrylic paint",
    fact: "Acrylic paint dries through water evaporation, so thin mixtures " +
      "and warm moving air shorten working time.",
    practice: "Use a covered stay-wet palette and a fine mist of clean water " +
      "to keep mixtures workable without flooding them.",
  },
  {
    category: "Drawing",
    groundingLabel: "Material practice · charcoal",
    fact: "A kneaded eraser can lift charcoal gradually instead of cutting a " +
      "hard-edged white mark into the drawing.",
    practice: "Shape the eraser to a point for highlights, or press and lift a " +
      "broad face to soften an over-dark area.",
  },
  {
    category: "Photography",
    groundingLabel: "Documentation · artwork photography",
    fact: "Uneven lighting can make one side of an artwork appear brighter " +
      "and can distort the colour recorded by a camera.",
    practice: "Place two similar lights at matching angles, switch off mixed " +
      "room lighting, and keep the camera square to the artwork.",
  },
  {
    category: "Archiving",
    groundingLabel: "Conservation basics · works on paper",
    fact: "Acidic backing materials can yellow and weaken works on paper over " +
      "time.",
    practice: "Use acid-free folders or interleaving sheets, handle with clean " +
      "dry hands, and store work away from damp and direct sun.",
  },
  {
    category: "Collage",
    groundingLabel: "Material practice · collage",
    fact: "Different papers and found materials can react differently to the " +
      "same adhesive, causing staining, buckling, or poor adhesion.",
    practice: "Make a small material test with the intended adhesive and let " +
      "it dry fully before committing it to the final piece.",
  },
  {
    category: "Printmaking",
    groundingLabel: "Studio practice · hand printing",
    fact: "Consistent pressure matters more than speed when burnishing a " +
      "simple relief print by hand.",
    practice: "Place clean paper over the block, hold it steady, then overlap " +
      "slow circular passes with a baren or the back of a smooth spoon.",
  },
  {
    category: "Brush care",
    groundingLabel: "Studio practice · tool care",
    fact: "Paint left to dry near a brush ferrule spreads the bristles and " +
      "shortens the useful life of the brush.",
    practice: "Rinse water-based paint before it dries, wash gently from the " +
      "ferrule outward, reshape the tip, and dry the brush flat.",
  },
  {
    category: "Pattern",
    groundingLabel: "Visual language · rhythm and pattern",
    fact: "Changing the spacing, scale, or direction of a repeated motif can " +
      "create visual rhythm without adding more colours.",
    practice: "Repeat one simple shape in a grid, then alter only one variable " +
      "at a time to see which change creates the strongest movement.",
  },
  {
    category: "Found materials",
    groundingLabel: "Material practice · assemblage",
    fact: "Dust, oils, loose rust, and unstable organic matter can prevent " +
      "found materials from bonding reliably.",
    practice: "Clean and dry each piece, remove loose material, and test the " +
      "joint before using it in a finished assemblage.",
  },
];

function getLusakaDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: COMMUNITY_NOTES_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function getDailySeed(dateKey: string): ArtNoteSeed {
  const dayNumber = Math.floor(
    new Date(`${dateKey}T00:00:00+02:00`).getTime() / 86400000
  );
  return ART_NOTE_SEEDS[Math.abs(dayNumber) % ART_NOTE_SEEDS.length];
}

function requireText(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number
): string {
  if (typeof value !== "string") {
    throw new Error(`Community note ${field} was not a string.`);
  }
  const text = value.trim();
  if (text.length < minimum || text.length > maximum) {
    throw new Error(
      `Community note ${field} must be ${minimum}-${maximum} characters.`
    );
  }
  return text;
}

function parseGeneratedNote(outputText: string): GeneratedCommunityNote {
  const parsed = JSON.parse(outputText) as Record<string, unknown>;
  return {
    title: requireText(parsed.title, "title", 8, 80),
    body: requireText(parsed.body, "body", 120, 700),
    takeaway: requireText(parsed.takeaway, "takeaway", 20, 180),
  };
}

async function createNoteCopy(
  apiKey: string,
  seed: ArtNoteSeed,
  dateKey: string
): Promise<GeneratedCommunityNote> {
  const openai = new OpenAI({
    apiKey,
    baseURL: AZURE_OPENAI_BASE_URL,
  });
  const response = await openai.responses.create({
    model: COMMUNITY_NOTES_MODEL,
    instructions: [
      "You are the careful studio editor for Club BZR, a contemporary art",
      "community in Zambia. Write one useful daily Community Note.",
      "Use only the supplied grounding for factual claims. Do not invent",
      "artists, quotations, dates, scientific claims, or cultural provenance.",
      "Use warm, direct international English. No hashtags, emojis, markdown,",
      "hype, or mention of AI. Make the advice practical for emerging and",
      "working artists. The body should be two short paragraphs.",
    ].join(" "),
    input: JSON.stringify({
      publicationDate: dateKey,
      category: seed.category,
      groundedFact: seed.fact,
      practicalMethod: seed.practice,
    }),
    max_output_tokens: 500,
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "community_note",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: {type: "string"},
            body: {type: "string"},
            takeaway: {type: "string"},
          },
          required: ["title", "body", "takeaway"],
        },
      },
    },
  });
  if (!response.output_text) {
    throw new Error("Azure OpenAI returned no Community Note text.");
  }
  return parseGeneratedNote(response.output_text);
}

async function claimDailyRun(dateKey: string): Promise<boolean> {
  const postRef = db.collection("communityPosts")
    .doc(`community-note-${dateKey}`);
  const runRef = db.collection("communityNoteRuns").doc(dateKey);
  const now = admin.firestore.Timestamp.now();
  const leaseUntil = admin.firestore.Timestamp.fromMillis(
    now.toMillis() + GENERATION_LEASE_MS
  );

  return db.runTransaction(async (transaction) => {
    const [postSnapshot, runSnapshot] = await Promise.all([
      transaction.get(postRef),
      transaction.get(runRef),
    ]);
    const run = runSnapshot.data();
    if (postSnapshot.exists || run?.status === "published") {
      return false;
    }
    const activeLease = run?.status === "generating" &&
      run.leaseUntil instanceof admin.firestore.Timestamp &&
      run.leaseUntil.toMillis() > now.toMillis();
    if (activeLease) return false;

    transaction.set(runRef, {
      dateKey,
      status: "generating",
      leaseUntil,
      attempts: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
    return true;
  });
}

async function publishDailyCommunityNote(): Promise<{
  created: boolean;
  postId: string;
}> {
  const dateKey = getLusakaDateKey();
  const postId = `community-note-${dateKey}`;
  const runRef = db.collection("communityNoteRuns").doc(dateKey);
  if (!(await claimDailyRun(dateKey))) return {created: false, postId};

  try {
    const seed = getDailySeed(dateKey);
    const note = await createNoteCopy(
      azureOpenAiApiKey.value(),
      seed,
      dateKey
    );
    const postRef = db.collection("communityPosts").doc(postId);
    await db.runTransaction(async (transaction) => {
      const postSnapshot = await transaction.get(postRef);
      if (!postSnapshot.exists) {
        transaction.create(postRef, {
          userId: PLATFORM_AUTHOR_ID,
          userName: "Club BZR Notes",
          content: note.body,
          mediaUrls: [],
          mediaType: null,
          reactions: {},
          reactionsCount: 0,
          comments: [],
          commentsCount: 0,
          shares: 0,
          featured: false,
          pinned: false,
          tags: ["community-note", seed.category.toLowerCase()],
          postType: "community_note",
          communityNote: {
            title: note.title,
            category: seed.category,
            takeaway: note.takeaway,
            groundingLabel: seed.groundingLabel,
            dateKey,
            aiGenerated: true,
            model: COMMUNITY_NOTES_MODEL,
          },
          isApproved: true,
          isHidden: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      transaction.set(runRef, {
        status: "published",
        postId,
        leaseUntil: null,
        publishedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
    });
    return {created: true, postId};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await runRef.set({
      status: "failed",
      error: message.slice(0, 500),
      leaseUntil: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
    throw error;
  }
}

export const generateDailyCommunityNote = onSchedule({
  schedule: "0 8,14,20 * * *",
  timeZone: COMMUNITY_NOTES_TIME_ZONE,
  secrets: [azureOpenAiApiKey],
  timeoutSeconds: 120,
  retryCount: 2,
}, async () => {
  const result = await publishDailyCommunityNote();
  logger.info("Daily Community Note run completed", result);
});
