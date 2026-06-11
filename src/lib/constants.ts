export const SITE_CONFIG = {
  name: 'Club BZR',
  description: 'An art initiative and creative community platform dedicated to bringing people together through shared creative experiences.',
  url: 'https://clubbzr.com',
  social: {
    instagram: 'https://instagram.com/clubbzr',
    twitter: 'https://twitter.com/clubbzr',
  },
};

export const NAVIGATION = [
  { label: 'Sessions', href: '/sessions' },
  { label: 'Side Quests', href: '/quests' },
  { label: 'Artists', href: '/artists' },
  { label: 'Community', href: '/community/wall' },
  { label: 'Exhibitions', href: '/exhibitions' },
  { label: 'Radio', href: '/radio' },
] as const;

export const HERO_ACTIONS = [
  { label: 'Join A Session', href: '/sessions', cursor: 'ENTER' },
  { label: 'Start A Side Quest', href: '/quests', cursor: 'EXPLORE' },
  { label: 'Discover Artists', href: '/artists', cursor: 'DISCOVER' },
  { label: 'Enter The Archive', href: '/exhibitions', cursor: 'OPEN' },
] as const;

export const MEDIUMS = [
  'photography',
  'illustration',
  'painting',
  'sculpture',
  'performance',
  'mixed-media',
  'film',
  'sound',
  'digital',
  'textile',
  'ceramics',
  'writing',
  'other',
] as const;

export const QUEST_CATEGORIES = [
  { value: 'drawing', label: 'Drawing' },
  { value: 'photography', label: 'Photography' },
  { value: 'writing', label: 'Writing' },
  { value: 'collage', label: 'Collage' },
  { value: 'observation', label: 'Observation' },
  { value: 'sound', label: 'Sound' },
  { value: 'movement', label: 'Movement' },
  { value: 'collaboration', label: 'Collaboration' },
  { value: 'daily', label: 'Daily' },
  { value: 'challenge', label: 'Challenge' },
] as const;

export const QUEST_DIFFICULTIES = [
  { value: 'beginner', label: 'Beginner', color: 'bzr-green' },
  { value: 'intermediate', label: 'Intermediate', color: 'bzr-blue' },
  { value: 'advanced', label: 'Advanced', color: 'bzr-orange' },
  { value: 'master', label: 'Master', color: 'bzr-lavender' },
] as const;

export const SESSION_TYPES = [
  { value: 'workshop', label: 'Workshop' },
  { value: 'exhibition', label: 'Exhibition' },
  { value: 'talk', label: 'Talk' },
  { value: 'gathering', label: 'Gathering' },
  { value: 'sidequest', label: 'Side Quest' },
] as const;

export const ART_LOCATION_TYPES = [
  { value: 'gallery', label: 'Gallery' },
  { value: 'mural', label: 'Mural' },
  { value: 'studio', label: 'Studio' },
  { value: 'venue', label: 'Venue' },
  { value: 'popup', label: 'Pop-up' },
  { value: 'public-art', label: 'Public Art' },
] as const;

export const RADIO_TYPES = [
  { value: 'podcast', label: 'Podcast' },
  { value: 'conversation', label: 'Conversation' },
  { value: 'session-recording', label: 'Session Recording' },
  { value: 'playlist', label: 'Playlist' },
  { value: 'ambient', label: 'Ambient' },
] as const;

export const REACTIONS = ['✨', '🔥', '💜', '👀', '🎨', '💡'] as const;

export const COMMUNITY_PROMPTS = [
  'Show us something unfinished.',
  'Share a failed experiment.',
  'What inspired you today?',
  'Capture a moment of stillness.',
  'Document your creative space.',
  'Show us your hands at work.',
  'What are you struggling with?',
  'Share your favorite mistake.',
] as const;

export const INSPIRATION_THEMES = [
  'Memory',
  'Silence',
  'Movement',
  'Decay',
  'Growth',
  'Connection',
  'Solitude',
  'Light',
  'Shadow',
  'Time',
  'Nature',
  'Urban',
  'Body',
  'Home',
  'Journey',
  'Ritual',
  'Play',
  'Rest',
] as const;

export const INSPIRATION_CONSTRAINTS = [
  'Only use reflections.',
  'Complete in 3 minutes.',
  'Use only found materials.',
  'Work with one hand.',
  'No digital tools allowed.',
  'Must involve water.',
  'Create in total darkness.',
  'Use only your non-dominant hand.',
  'Collaborate with a stranger.',
  'Work silently.',
  'Use only circles.',
  'Include something broken.',
  'Start from the end.',
  'Use only natural light.',
  'Include text.',
] as const;

export const BADGES = {
  firstSession: {
    id: 'first-session',
    name: 'First Steps',
    description: 'Attended your first session',
    icon: '👣',
  },
  questCompleter: {
    id: 'quest-completer',
    name: 'Quest Seeker',
    description: 'Completed 5 side quests',
    icon: '🗺️',
  },
  weekStreak: {
    id: 'week-streak',
    name: 'Weekly Warrior',
    description: 'Maintained a 7-day creative streak',
    icon: '🔥',
  },
  collaborator: {
    id: 'collaborator',
    name: 'Creative Collaborator',
    description: 'Completed your first collaboration',
    icon: '🤝',
  },
  explorer: {
    id: 'explorer',
    name: 'Medium Explorer',
    description: 'Explored 5 different mediums',
    icon: '🧭',
  },
  contributor: {
    id: 'contributor',
    name: 'Community Voice',
    description: 'Made 10 community posts',
    icon: '💬',
  },
} as const;

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export const ANIMATION_DURATION = {
  fast: 0.15,
  normal: 0.3,
  slow: 0.5,
  slower: 0.8,
  transition: 1,
} as const;

export const EASING = {
  outExpo: [0.16, 1, 0.3, 1],
  inExpo: [0.7, 0, 0.84, 0],
  inOutExpo: [0.87, 0, 0.13, 1],
  outCirc: [0, 0.55, 0.45, 1],
  outBack: [0.34, 1.56, 0.64, 1],
} as const;

export const Z_INDEX = {
  base: 0,
  content: 10,
  header: 100,
  modal: 200,
  toast: 300,
  cursor: 9999,
} as const;
