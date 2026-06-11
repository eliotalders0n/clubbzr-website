import { Timestamp } from 'firebase/firestore';

import type { Badge, FirestoreTimestamp, Quest } from './schema';

export type BadgeCategory = 'art' | 'music' | 'photography';

export interface QuestBadgeDefinition {
  id: string;
  label: string;
  category: BadgeCategory;
  description: string;
}

export const QUEST_BADGES: QuestBadgeDefinition[] = [
  { id: 'art_first_mark', label: 'First Mark', category: 'art', description: 'Completes an introductory visual art prompt.' },
  { id: 'art_color_study', label: 'Color Study', category: 'art', description: 'Explores palette, contrast, or color mood.' },
  { id: 'art_material_play', label: 'Material Play', category: 'art', description: 'Experiments with mixed media or unusual materials.' },
  { id: 'music_sound_mapper', label: 'Sound Mapper', category: 'music', description: 'Translates sound or rhythm into a creative response.' },
  { id: 'music_loop_builder', label: 'Loop Builder', category: 'music', description: 'Builds around repetition, beat, or musical structure.' },
  { id: 'music_field_listener', label: 'Field Listener', category: 'music', description: 'Uses ambient sound or field recordings as inspiration.' },
  { id: 'photo_observer', label: 'Observer', category: 'photography', description: 'Captures a detail from daily surroundings.' },
  { id: 'photo_light_hunter', label: 'Light Hunter', category: 'photography', description: 'Uses shadow, reflection, or available light intentionally.' },
  { id: 'photo_street_eye', label: 'Street Eye', category: 'photography', description: 'Documents public space with a clear point of view.' },
];

export const getQuestBadgeDefinition = (badgeId: string) =>
  QUEST_BADGES.find((badge) => badge.id === badgeId);

export const getBadgeVisual = (badgeId: string): { icon: string; color: string; bg: string } => {
  if (badgeId.startsWith('music_')) return { icon: '♪', color: 'purple.200', bg: 'purple.500/20' };
  if (badgeId.startsWith('photo_')) return { icon: '◐', color: 'cyan.200', bg: 'cyan.500/20' };
  if (badgeId.startsWith('art_')) return { icon: '✦', color: 'brand.200', bg: 'brand.500/20' };
  return { icon: '★', color: 'yellow.200', bg: 'yellow.500/20' };
};

const titleFromId = (badgeId: string) =>
  badgeId
    .replace(/^quest_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const createQuestCompletionBadges = (
  quest: Quest,
  earnedAt: FirestoreTimestamp = Timestamp.now()
): Badge[] => {
  const badgeIds = quest.badges && quest.badges.length > 0
    ? quest.badges
    : [`quest_${quest.id}_complete`];

  return badgeIds.map((badgeId) => {
    const definition = getQuestBadgeDefinition(badgeId);

    return {
      id: badgeId,
      name: definition?.label || `${quest.title || titleFromId(badgeId)} Complete`,
      description: definition?.description || `Completed ${quest.title || 'a Club BZR quest'}.`,
      iconUrl: '',
      earnedAt,
      category: definition ? 'creation' : 'achievement',
    };
  });
};
