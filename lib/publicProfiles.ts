import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { COLLECTIONS, db } from './config';
import type { ArtMedium, PublicProfile } from './schema';
import type { OperationResult } from './firestore';

export interface PublicProfileInput {
  userId: string;
  displayName?: string | null;
  photoURL?: string | null;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  interests?: string[];
  mediums?: ArtMedium[];
  hasArtistProfile?: boolean;
  artistName?: string | null;
  postsCount?: number;
  followersCount?: number;
  worksCount?: number;
  questsCompletedCount?: number;
  badgesCount?: number;
  eventsAttendedCount?: number;
}

const cleanString = (value?: string | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const cleanStringList = (items?: string[]): string[] => {
  const seen = new Set<string>();

  return (items || [])
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const cleanMediumList = (items?: ArtMedium[]): ArtMedium[] => Array.from(new Set(items || []));

const cleanNumber = (value?: number): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

const removeUndefined = <T extends Record<string, unknown>>(value: T): T =>
  Object.entries(value).reduce<Record<string, unknown>>((cleaned, [key, entry]) => {
    if (entry !== undefined) {
      cleaned[key] = entry;
    }
    return cleaned;
  }, {}) as T;

export const createPublicUsername = (displayName: string, userId: string): string => {
  const slug = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 28);
  const suffix = userId.slice(0, 5).toLowerCase();

  return `${slug || 'member'}.${suffix}`;
};

export const buildPublicProfilePayload = (
  input: PublicProfileInput,
  includeDefaultLists = false
): Partial<Omit<PublicProfile, 'id' | 'createdAt' | 'updatedAt'>> & Pick<PublicProfile, 'userId' | 'displayName' | 'username'> => {
  const displayName = cleanString(input.displayName) || 'Club BZR member';

  return removeUndefined({
    userId: input.userId,
    displayName,
    username: createPublicUsername(displayName, input.userId),
    photoURL: input.photoURL || null,
    bio: cleanString(input.bio),
    location: cleanString(input.location),
    website: cleanString(input.website),
    ...(input.interests !== undefined || includeDefaultLists ? { interests: cleanStringList(input.interests) } : {}),
    ...(input.mediums !== undefined || includeDefaultLists ? { mediums: cleanMediumList(input.mediums) } : {}),
    hasArtistProfile: input.hasArtistProfile,
    artistName: cleanString(input.artistName),
    postsCount: cleanNumber(input.postsCount),
    followersCount: cleanNumber(input.followersCount),
    worksCount: cleanNumber(input.worksCount),
    questsCompletedCount: cleanNumber(input.questsCompletedCount),
    badgesCount: cleanNumber(input.badgesCount),
    eventsAttendedCount: cleanNumber(input.eventsAttendedCount),
  });
};

export const upsertPublicProfile = async (
  input: PublicProfileInput
): Promise<OperationResult<PublicProfile>> => {
  try {
    const profileRef = doc(db, COLLECTIONS.PUBLIC_PROFILES, input.userId);
    const existingProfile = await getDoc(profileRef);
    const payload = buildPublicProfilePayload(input, !existingProfile.exists());

    await setDoc(
      profileRef,
      removeUndefined({
        ...payload,
        updatedAt: serverTimestamp(),
        ...(existingProfile.exists() ? {} : { createdAt: serverTimestamp() }),
      }),
      { merge: true }
    );

    const nextProfile = await getDoc(profileRef);
    return {
      success: true,
      data: { id: nextProfile.id, ...nextProfile.data() } as PublicProfile,
    };
  } catch (error) {
    const err = error as { code?: string; message?: string };
    return {
      success: false,
      error: {
        code: err?.code || 'unknown',
        message: err?.message || 'Could not save public profile.',
      },
    };
  }
};
