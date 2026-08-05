'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box,
  Container as ChakraContainer,
  Flex,
  Heading,
  Image,
  Text,
  Button as ChakraButton,
  VStack,
  HStack,
  SimpleGrid,
  Spinner,
  Textarea,
} from '@chakra-ui/react';
import { Bookmark, CalendarDays, CheckCircle2, Heart, ImageIcon, MessageCircle, Pencil, Save, Settings, Trash2, X } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useCollection, useDocument } from '@/hooks/useFirestore';
import { Timestamp } from 'firebase/firestore';
import { createQuestCompletionBadges } from '../../lib/badges';
import { createDocumentWithId, deleteDocument, updateDocument } from '../../lib/firestore';
import {
  buildDiscoveryArtworks,
  formatMedium,
  getArtworkEngagementKey,
  type DiscoveryArtwork,
} from '@/lib/artworkDiscovery';
import { createDefaultCreativePassport } from '@/lib/passportDefaults';
import { resolveProfileIdentity } from '@/lib/profileIdentity';
import type {
  Artist,
  Badge as PassportBadge,
  CommunityPost,
  Artwork,
  Exhibition,
  Quest,
  QuestSubmission,
  Session,
  SessionRegistration,
} from '../../lib/schema';

const numericValue = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

const toMillis = (value: unknown): number => {
  if (!value) return 0;
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && value !== null) {
    const timestamp = value as { toDate?: () => Date; seconds?: number };
    if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
    if (typeof timestamp.seconds === 'number') return timestamp.seconds * 1000;
  }
  return 0;
};

const readKeyList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

type PassportTab = 'posts' | 'quests' | 'events' | 'liked' | 'bookmarked';

const formatDate = (value: unknown): string => {
  const timestamp = toMillis(value);
  if (!timestamp) return 'Date pending';

  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

type ArtworkStripProps = {
  title: string;
  icon: React.ReactNode;
  items: DiscoveryArtwork[];
  isLoading: boolean;
  emptyTitle: string;
  emptyDescription: string;
};

const ArtworkStrip: React.FC<ArtworkStripProps> = ({ title, icon, items, isLoading, emptyTitle, emptyDescription }) => (
  <Box
    p={{ base: 5, md: 6 }}
    borderRadius="xl"
    bg="gray.900"
    border="1px solid"
    borderColor="whiteAlpha.100"
  >
    <HStack justify="space-between" align="center" mb={5}>
      <HStack gap={3}>
        <Flex w={10} h={10} borderRadius="full" bg="whiteAlpha.50" color="brand.300" align="center" justify="center">
          {icon}
        </Flex>
        <Box>
          <Heading as="h3" fontSize="lg" color="white">{title}</Heading>
          <Text color="whiteAlpha.500" fontSize="sm">{items.length} {items.length === 1 ? 'item' : 'items'}</Text>
        </Box>
      </HStack>
      <Link to="/artists">
        <ChakraButton
          size="sm"
          bg="whiteAlpha.50"
          color="whiteAlpha.800"
          border="1px solid"
          borderColor="whiteAlpha.100"
          borderRadius="full"
          _hover={{ bg: 'whiteAlpha.100' }}
        >
          Browse
        </ChakraButton>
      </Link>
    </HStack>

    {isLoading ? (
      <HStack gap={3} color="whiteAlpha.500">
        <Spinner size="sm" color="brand.500" />
        <Text fontSize="sm">Loading artwork...</Text>
      </HStack>
    ) : items.length > 0 ? (
      <SimpleGrid columns={{ base: 2, md: 3, xl: 4 }} gap={4}>
        {items.slice(0, 8).map((artwork) => (
          <Link key={artwork.id} to={artwork.detailHref} style={{ display: 'block', minWidth: 0 }}>
            <Box
              borderRadius="xl"
              overflow="hidden"
              bg="whiteAlpha.50"
              border="1px solid"
              borderColor="whiteAlpha.100"
              _hover={{ transform: 'translateY(-2px)', borderColor: 'brand.400/40', bg: 'whiteAlpha.100' }}
              transition="transform 160ms ease, border-color 160ms ease, background 160ms ease"
            >
              <Box aspectRatio={1} bg="gray.800" overflow="hidden">
                <img
                  src={artwork.imageUrl}
                  alt={artwork.title}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </Box>
              <Box p={3}>
                <Text color="white" fontSize="sm" fontWeight="bold" lineClamp={1}>{artwork.title}</Text>
                <Text color="whiteAlpha.500" fontSize="xs" lineClamp={1}>{artwork.credit.name}</Text>
                <Text color="whiteAlpha.400" fontSize="xs" mt={1}>{formatMedium(artwork.medium)}</Text>
              </Box>
            </Box>
          </Link>
        ))}
      </SimpleGrid>
    ) : (
      <Flex
        minH="180px"
        borderRadius="xl"
        border="1px dashed"
        borderColor="whiteAlpha.200"
        bg="blackAlpha.200"
        align="center"
        justify="center"
        textAlign="center"
        px={6}
      >
        <VStack gap={3}>
          <Flex w={12} h={12} borderRadius="full" bg="whiteAlpha.50" color="whiteAlpha.500" align="center" justify="center">
            <ImageIcon size={20} />
          </Flex>
          <Box>
            <Text color="white" fontWeight="bold">{emptyTitle}</Text>
            <Text color="whiteAlpha.500" fontSize="sm" maxW="sm">{emptyDescription}</Text>
          </Box>
        </VStack>
      </Flex>
    )}
  </Box>
);

const Passport: React.FC = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [activePassportTab, setActivePassportTab] = useState<PassportTab>('posts');
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostContent, setEditingPostContent] = useState('');
  const [busyPostId, setBusyPostId] = useState<string | null>(null);
  const [localPostContentById, setLocalPostContentById] = useState<Record<string, string>>({});
  const [locallyDeletedPostIds, setLocallyDeletedPostIds] = useState<Record<string, true>>({});

  // Get current user from auth context
  const { user: authUser, firebaseUser, loading: authLoading, initialized } = useAuth();

  // Fetch passport data from Firebase using userId (firebaseUser has uid)
  const {
    data: passport,
    loading: passportLoading,
    error: passportError,
    refetch: refetchPassport
  } = useDocument('creativePassports', firebaseUser?.uid);
  const { data: artistProfile } = useDocument('artists', firebaseUser?.uid, { skip: !firebaseUser?.uid });
  const {
    data: questSubmissions,
    loading: questSubmissionsLoading,
  } = useCollection('questSubmissions', {
    where: [{ field: 'userId', operator: '==', value: firebaseUser?.uid || '' }],
    skip: !firebaseUser?.uid,
  });
  const {
    data: communityPosts,
    loading: communityPostsLoading,
    refetch: refetchCommunityPosts,
  } = useCollection('communityPosts', {
    where: [{ field: 'userId', operator: '==', value: firebaseUser?.uid || '' }],
    skip: !firebaseUser?.uid,
  });
  const {
    data: sessionRegistrations,
    loading: sessionRegistrationsLoading,
  } = useCollection('sessionRegistrations', {
    where: [{ field: 'userId', operator: '==', value: firebaseUser?.uid || '' }],
    skip: !firebaseUser?.uid,
  });
  const {
    data: sessions,
    loading: sessionsLoading,
  } = useCollection('sessions', {
    skip: !firebaseUser?.uid,
  });
  const {
    data: quests,
    loading: questsLoading,
  } = useCollection('quests', {
    skip: !firebaseUser?.uid,
  });
  const {
    data: artists,
    loading: artistsLoading,
  } = useCollection('artists', {
    skip: !firebaseUser?.uid || !passport,
  });
  const {
    data: uploadedArtworks,
    loading: uploadedArtworksLoading,
  } = useCollection('artworks', {
    skip: !firebaseUser?.uid || !passport,
  });
  const {
    data: exhibitions,
    loading: exhibitionsLoading,
  } = useCollection('exhibitions', {
    skip: !firebaseUser?.uid || !passport,
  });

  const liveActivity = useMemo(() => {
    const completedQuestIds = new Set<string>(passport?.questsCompleted || []);
    const submissionsByQuest = new Map<string, { count: number; lastSubmittedAt: unknown }>();
    const questById = new Map((quests as Quest[]).map((quest) => [quest.id, quest]));
    const sessionById = new Map((sessions as Session[]).map((session) => [session.id, session]));
    const attendedEventIds = new Set<string>(passport?.eventsAttended || []);
    const currentUserId = firebaseUser?.uid || '';

    (questSubmissions as QuestSubmission[]).forEach((submission) => {
      if (submission.questId) {
        completedQuestIds.add(submission.questId);
        const existing = submissionsByQuest.get(submission.questId);
        const submissionTime = toMillis(submission.createdAt);
        const existingTime = toMillis(existing?.lastSubmittedAt);
        submissionsByQuest.set(submission.questId, {
          count: (existing?.count || 0) + 1,
          lastSubmittedAt: submissionTime >= existingTime ? submission.createdAt : existing?.lastSubmittedAt,
        });
      }
    });

    const postReactions = (communityPosts as CommunityPost[]).reduce(
      (total, post) => total + numericValue(post.reactionsCount),
      0
    );
    const submissionReactions = (questSubmissions as QuestSubmission[]).reduce(
      (total, submission) => total + numericValue(submission.reactionsCount),
      0
    );
    const submissionPoints = (questSubmissions as QuestSubmission[]).reduce(
      (total, submission) => total + numericValue(submission.pointsAwarded),
      0
    );
    const generatedBadges = Array.from(completedQuestIds).flatMap((questId) => {
      const quest = questById.get(questId);
      const earnedAt = submissionsByQuest.get(questId)?.lastSubmittedAt;
      return quest ? createQuestCompletionBadges(quest, earnedAt as PassportBadge['earnedAt']) : [];
    });
    const badgeMap = new Map<string, PassportBadge>();

    generatedBadges.forEach((badge) => badgeMap.set(badge.id, badge));
    (passport?.badges || []).forEach((badge) => badgeMap.set(badge.id, badge));

    const completedQuests = Array.from(completedQuestIds)
      .map((questId) => {
        const quest = questById.get(questId);
        const submissionMeta = submissionsByQuest.get(questId);
        return {
          id: questId,
          title: quest?.title || `Quest ${questId.slice(0, 8)}`,
          submissions: submissionMeta?.count || 0,
          lastSubmittedAt: submissionMeta?.lastSubmittedAt,
        };
      })
      .sort((a, b) => toMillis(b.lastSubmittedAt) - toMillis(a.lastSubmittedAt));

    (sessionRegistrations as SessionRegistration[]).forEach((registration) => {
      if (registration.status === 'confirmed' && registration.sessionId) {
        attendedEventIds.add(registration.sessionId);
      }
    });

    (sessions as Session[]).forEach((session) => {
      if (currentUserId && session.attendees?.includes(currentUserId)) {
        attendedEventIds.add(session.id);
      }
    });

    const attendedEvents = Array.from(attendedEventIds)
      .map((eventId) => {
        const session = sessionById.get(eventId);

        return {
          id: eventId,
          title: session?.title || `Event ${eventId.slice(0, 8)}`,
          date: session?.date,
          locationName: session?.isOnline ? 'Online' : session?.location?.name,
          dateMs: toMillis(session?.date),
          hasSession: !!session,
        };
      })
      .sort((a, b) => b.dateMs - a.dateMs || a.title.localeCompare(b.title));

    return {
      completedQuestIds: Array.from(completedQuestIds),
      completedQuests,
      eventsAttended: Array.from(attendedEventIds),
      attendedEvents,
      collaborations: passport?.collaborations || [],
      postsCreated: communityPosts.length,
      reactionsReceived: postReactions + submissionReactions,
      points: submissionPoints,
      badges: Array.from(badgeMap.values()).sort((a, b) => toMillis(b.earnedAt) - toMillis(a.earnedAt)),
    };
  }, [communityPosts, firebaseUser?.uid, passport, questSubmissions, quests, sessionRegistrations, sessions]);

  const savedArtwork = useMemo(() => {
    const allArtwork = buildDiscoveryArtworks({
      artists: (artists as Artist[]) || [],
      uploadedArtworks: (uploadedArtworks as Artwork[]) || [],
      exhibitions: (exhibitions as Exhibition[]) || [],
    });
    const byKey = new Map(allArtwork.map((artwork) => [getArtworkEngagementKey(artwork), artwork]));
    const loved = readKeyList(authUser?.lovedArtworkKeys)
      .map((key) => byKey.get(key))
      .filter((artwork): artwork is DiscoveryArtwork => Boolean(artwork));
    const bookmarked = readKeyList(authUser?.bookmarkedArtworkKeys)
      .map((key) => byKey.get(key))
      .filter((artwork): artwork is DiscoveryArtwork => Boolean(artwork));

    return { loved, bookmarked };
  }, [artists, authUser?.bookmarkedArtworkKeys, authUser?.lovedArtworkKeys, exhibitions, uploadedArtworks]);

  const userCommunityPosts = useMemo(
    () => [...(communityPosts as CommunityPost[])]
      .filter((post) => !locallyDeletedPostIds[post.id])
      .map((post) => {
        const localContent = localPostContentById[post.id];
        return localContent === undefined ? post : { ...post, content: localContent };
      })
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)),
    [communityPosts, localPostContentById, locallyDeletedPostIds]
  );

  const startEditingPost = useCallback((post: CommunityPost) => {
    setEditingPostId(post.id);
    setEditingPostContent(post.content);
  }, []);

  const cancelEditingPost = useCallback(() => {
    setEditingPostId(null);
    setEditingPostContent('');
  }, []);

  const handleSavePost = useCallback(async (post: CommunityPost) => {
    const content = editingPostContent.trim();

    if (!content) {
      alert('Post content cannot be empty.');
      return;
    }

    if (content === post.content.trim()) {
      cancelEditingPost();
      return;
    }

    setBusyPostId(post.id);

    const result = await updateDocument('communityPosts', post.id, {
      content,
    });

    setBusyPostId(null);

    if (result.success) {
      setLocalPostContentById((current) => ({
        ...current,
        [post.id]: content,
      }));
      cancelEditingPost();
      void refetchCommunityPosts();
      return;
    }

    console.error('Failed to update post:', result.error);
    alert('Failed to update post. Please try again.');
  }, [cancelEditingPost, editingPostContent, refetchCommunityPosts]);

  const handleDeletePost = useCallback(async (postId: string) => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;

    setBusyPostId(postId);

    const result = await deleteDocument('communityPosts', postId);

    setBusyPostId(null);

    if (result.success) {
      setLocallyDeletedPostIds((current) => ({
        ...current,
        [postId]: true,
      }));
      if (editingPostId === postId) cancelEditingPost();
      void refetchCommunityPosts();
      return;
    }

    console.error('Failed to delete post:', result.error);
    alert('Failed to delete post. Please try again.');
  }, [cancelEditingPost, editingPostId, refetchCommunityPosts]);

  const savedArtworkLoading = artistsLoading || uploadedArtworksLoading || exhibitionsLoading;

  // Loading state
  const isLoading = authLoading || passportLoading || questSubmissionsLoading || communityPostsLoading || sessionRegistrationsLoading || sessionsLoading || questsLoading || !initialized;

  // If not authenticated, show login prompt
  if (initialized && !firebaseUser) {
    return (
      <div className="min-h-screen bg-bzr-black">
        <Header />
        <Section padding="hero" className="pt-32">
          <div className="text-center">
            <h1 className="text-3xl font-display font-bold text-bzr-white mb-4">
              Creative Passport
            </h1>
            <p className="text-bzr-gray-400 mb-8">
              Please sign in to view your Creative Passport.
            </p>
            <Link to="/auth">
              <Button variant="primary">Sign In</Button>
            </Link>
          </div>
        </Section>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-bzr-black">
        <Header />
        <Section padding="hero" className="pt-32">
          <div className="text-center">
            <div className="animate-pulse">
              <div className="w-32 h-32 bg-bzr-gray-800 rounded-xl mx-auto mb-4" />
              <div className="h-8 bg-bzr-gray-800 rounded w-48 mx-auto mb-2" />
              <div className="h-4 bg-bzr-gray-800 rounded w-32 mx-auto" />
            </div>
          </div>
        </Section>
      </div>
    );
  }

  // Error state (but not for "not-found" which means user just doesn't have a passport yet)
  if (passportError && passportError.code !== 'not-found') {
    return (
      <div className="min-h-screen bg-bzr-black">
        <Header />
        <Section padding="hero" className="pt-32">
          <div className="text-center">
            <h1 className="text-3xl font-display font-bold text-bzr-white mb-4">
              Error Loading Passport
            </h1>
            <p className="text-bzr-gray-400 mb-8">
              {passportError.message || 'Unable to load your Creative Passport. Please try again.'}
            </p>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </Section>
      </div>
    );
  }

  // No passport found - show creation prompt
  if (!passport) {
    return (
      <Box bg="gray.950" minH="100vh">
        <Header />
        <Flex as="main" pt={32} pb={20} justify="center" align="center" minH="calc(100vh - 200px)">
          <ChakraContainer maxW="800px" px={{ base: 6, md: 12 }}>
            <VStack gap={8} textAlign="center" align="center">
              {/* Icon */}
              <Box
                w={24}
                h={24}
                borderRadius="2xl"
                bgGradient="linear(to-br, brand.500, purple.600)"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <svg width="48" height="48" fill="none" stroke="white" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
                </svg>
              </Box>

              <VStack gap={4}>
                <Heading
                  as="h1"
                  fontSize={{ base: '2xl', md: '4xl' }}
                  color="white"
                  fontFamily="heading"
                >
                  Create Your Creative Passport
                </Heading>
                <Text color="whiteAlpha.600" fontSize={{ base: 'md', md: 'lg' }} maxW="lg">
                  Start your creative journey with Club BZR. Track your progress, earn badges,
                  and showcase your achievements as you explore, create, and connect.
                </Text>
              </VStack>

              {/* Features */}
              <SimpleGrid columns={{ base: 1, md: 3 }} gap={6} w="full">
                <Box
                  p={6}
                  borderRadius="xl"
                  bg="gray.900"
                  border="1px solid"
                  borderColor="whiteAlpha.100"
                  textAlign="center"
                >
                  <Flex
                    w={12}
                    h={12}
                    mx="auto"
                    mb={4}
                    borderRadius="full"
                    bg="rgba(72, 187, 120, 0.2)"
                    align="center"
                    justify="center"
                  >
                    <svg width="24" height="24" fill="none" stroke="#48BB78" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </Flex>
                  <Heading as="h3" fontSize="md" color="white" mb={1}>Track Progress</Heading>
                  <Text color="whiteAlpha.500" fontSize="sm">Complete quests and level up</Text>
                </Box>

                <Box
                  p={6}
                  borderRadius="xl"
                  bg="gray.900"
                  border="1px solid"
                  borderColor="whiteAlpha.100"
                  textAlign="center"
                >
                  <Flex
                    w={12}
                    h={12}
                    mx="auto"
                    mb={4}
                    borderRadius="full"
                    bg="rgba(159, 122, 234, 0.2)"
                    align="center"
                    justify="center"
                  >
                    <svg width="24" height="24" fill="none" stroke="#9F7AEA" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </Flex>
                  <Heading as="h3" fontSize="md" color="white" mb={1}>Earn Badges</Heading>
                  <Text color="whiteAlpha.500" fontSize="sm">Unlock achievements</Text>
                </Box>

                <Box
                  p={6}
                  borderRadius="xl"
                  bg="gray.900"
                  border="1px solid"
                  borderColor="whiteAlpha.100"
                  textAlign="center"
                >
                  <Flex
                    w={12}
                    h={12}
                    mx="auto"
                    mb={4}
                    borderRadius="full"
                    bg="rgba(237, 137, 54, 0.2)"
                    align="center"
                    justify="center"
                  >
                    <svg width="24" height="24" fill="none" stroke="#ED8936" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </Flex>
                  <Heading as="h3" fontSize="md" color="white" mb={1}>Connect</Heading>
                  <Text color="whiteAlpha.500" fontSize="sm">Join the community</Text>
                </Box>
              </SimpleGrid>

              <ChakraButton
                bg="brand.500"
                color="white"
                size="lg"
                borderRadius="full"
                px={10}
                _hover={{ bg: 'brand.600' }}
                disabled={isCreating}
                onClick={async () => {
                  if (!firebaseUser?.uid) {
                    console.error('No user logged in');
                    return;
                  }
                  setIsCreating(true);
                  try {
                    const newPassport = createDefaultCreativePassport(firebaseUser.uid);
                    console.log('Creating passport for user:', firebaseUser.uid);
                    const result = await createDocumentWithId('creativePassports', firebaseUser.uid, newPassport);
                    console.log('Create result:', result);
                    if (result.success) {
                      await refetchPassport();
                    } else {
                      console.error('Failed to create passport:', result.error);
                    }
                  } catch (error) {
                    console.error('Failed to create passport:', error);
                  } finally {
                    setIsCreating(false);
                  }
                }}
              >
                {isCreating ? <Spinner size="sm" /> : 'Get Started'}
              </ChakraButton>
            </VStack>
          </ChakraContainer>
        </Flex>
        <Footer />
      </Box>
    );
  }

  // Transform passport data for display
  const identity = resolveProfileIdentity({
    artist: artistProfile,
    user: authUser,
    firebaseUser,
  });
  const displayUser = {
    id: passport.id,
    displayName: identity.accountName,
    username: identity.username,
    avatar: identity.avatar,
    bio: undefined, // Bio is in User doc, not passport
    location: undefined, // Location is in User doc
    joinedAt: passport.stats?.joinedAt as Timestamp | undefined,
    level: Math.max(passport.level || 1, Math.floor(Math.max(passport.points || 0, liveActivity.points) / 100) + 1),
    points: Math.max(passport.points || 0, liveActivity.points),
    // Calculate XP progress (assuming 100 points per level)
    xpToNextLevel: (passport.level + 1) * 100,
    stats: passport.stats,
    badges: liveActivity.badges,
    timeline: passport.timeline || [],
    streaks: passport.streaks,
    eventsAttended: liveActivity.eventsAttended,
    attendedEvents: liveActivity.attendedEvents,
    questsCompleted: liveActivity.completedQuestIds,
    completedQuests: liveActivity.completedQuests,
    questsInProgress: (passport.questsInProgress || []).filter((questId) => !liveActivity.completedQuestIds.includes(questId)),
    mediums: passport.mediums || [],
  };

  const stats = [
    {
      label: 'Events Attended',
      value: displayUser.eventsAttended.length,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Quests Completed',
      value: Math.max(displayUser.stats?.totalQuestsCompleted || 0, displayUser.questsCompleted.length),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Collaborations',
      value: Math.max(displayUser.stats?.totalCollaborations || 0, liveActivity.collaborations.length),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      label: 'Posts Created',
      value: Math.max(displayUser.stats?.totalPostsCreated || 0, liveActivity.postsCreated),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      ),
    },
    {
      label: 'Reactions Received',
      value: Math.max(displayUser.stats?.totalReactionsReceived || 0, liveActivity.reactionsReceived),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
    },
    {
      label: 'Current Streak',
      value: displayUser.streaks?.current || 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
        </svg>
      ),
    },
  ];
  const passportTabs: { id: PassportTab; label: string; count?: number }[] = [
    { id: 'posts', label: 'Posts', count: userCommunityPosts.length },
    { id: 'quests', label: 'Completed Quests', count: displayUser.completedQuests.length },
    { id: 'events', label: 'Events Attended', count: displayUser.attendedEvents.length },
    { id: 'liked', label: 'Liked Artwork', count: savedArtwork.loved.length },
    { id: 'bookmarked', label: 'Bookmarked Artwork', count: savedArtwork.bookmarked.length },
  ];

  return (
    <Box bg="gray.950" minH="100vh">
      <Header />

      <Box as="main" pt={32} pb={20}>
        <ChakraContainer maxW="1200px" px={{ base: 6, md: 12 }}>
          {/* Passport Card */}
          <Box
            p={8}
            borderRadius="2xl"
            bgGradient="linear(to-br, gray.900, gray.800)"
            border="1px solid"
            borderColor="whiteAlpha.100"
            mb={8}
          >
            <Flex gap={8} direction={{ base: 'column', md: 'row' }} align={{ base: 'center', md: 'flex-start' }}>
              {/* Avatar */}
              <Box
                w={24}
                h={24}
                borderRadius="xl"
                bg="brand.500"
                display="flex"
                alignItems="center"
                justifyContent="center"
                overflow="hidden"
                flexShrink={0}
              >
                {displayUser.avatar ? (
                  <img src={displayUser.avatar} alt={displayUser.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Text color="white" fontSize="3xl" fontWeight="bold">
                    {displayUser.displayName.charAt(0)}
                  </Text>
                )}
              </Box>

              {/* Info */}
              <VStack align={{ base: 'center', md: 'flex-start' }} gap={2} flex={1}>
                <Heading as="h1" fontSize="2xl" color="white" fontFamily="heading">
                  {displayUser.displayName}
                </Heading>
                <Text color="whiteAlpha.500" fontSize="sm">@{displayUser.username}</Text>
                <HStack gap={4} mt={2}>
                  <Box textAlign="center">
                    <Text color="brand.500" fontSize="2xl" fontWeight="bold">{displayUser.level}</Text>
                    <Text color="whiteAlpha.500" fontSize="xs">Level</Text>
                  </Box>
                  <Box textAlign="center">
                    <Text color="green.400" fontSize="2xl" fontWeight="bold">{displayUser.points}</Text>
                    <Text color="whiteAlpha.500" fontSize="xs">Points</Text>
                  </Box>
                  <Box textAlign="center">
                    <Text color="purple.400" fontSize="2xl" fontWeight="bold">{displayUser.badges.length}</Text>
                    <Text color="whiteAlpha.500" fontSize="xs">Badges</Text>
                  </Box>
                </HStack>
                <Link to="/profile">
                  <ChakraButton
                    size="sm"
                    mt={3}
                    h={10}
                    px={4}
                    gap={2}
                    bg="whiteAlpha.50"
                    color="whiteAlpha.800"
                    border="1px solid"
                    borderColor="whiteAlpha.200"
                    borderRadius="full"
                    _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
                  >
                    <Settings size={15} />
                    Manage Profile
                  </ChakraButton>
                </Link>
              </VStack>

              {/* Streak */}
              {displayUser.streaks && (
                <Box
                  p={4}
                  borderRadius="xl"
                  bg="whiteAlpha.50"
                  textAlign="center"
                >
                  <Text color="orange.400" fontSize="3xl" fontWeight="bold">{displayUser.streaks.current}</Text>
                  <Text color="whiteAlpha.500" fontSize="xs">Day Streak</Text>
                </Box>
              )}
            </Flex>
          </Box>

          {/* Stats Grid */}
          <SimpleGrid columns={{ base: 3, lg: 6 }} gap={{ base: 3, md: 4 }} mb={8}>
            {stats.map((stat) => (
              <Box
                key={stat.label}
                p={{ base: 3, md: 5 }}
                minH={{ base: '112px', md: '132px' }}
                borderRadius={{ base: 'lg', md: 'xl' }}
                bg="gray.900"
                border="1px solid"
                borderColor="whiteAlpha.100"
                textAlign="center"
              >
                <Flex justify="center" mb={{ base: 1.5, md: 2 }} color="whiteAlpha.500">
                  {stat.icon}
                </Flex>
                <Text color="white" fontSize={{ base: 'xl', md: '2xl' }} fontWeight="bold" lineHeight="1.15">{stat.value}</Text>
                <Text color="whiteAlpha.500" fontSize={{ base: '10px', md: 'xs' }} lineHeight="1.2" mt={1}>{stat.label}</Text>
              </Box>
            ))}
          </SimpleGrid>

          <Box>
            <HStack
              gap={2}
              overflowX="auto"
              pb={2}
              css={{
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
              }}
            >
              {passportTabs.map((tab) => {
                const active = activePassportTab === tab.id;

                return (
                  <ChakraButton
                    key={tab.id}
                    type="button"
                    h="44px"
                    px={4}
                    flexShrink={0}
                    borderRadius="full"
                    bg={active ? 'brand.500' : 'gray.900'}
                    color={active ? 'white' : 'whiteAlpha.700'}
                    border="1px solid"
                    borderColor={active ? 'brand.400' : 'whiteAlpha.100'}
                    fontSize="sm"
                    fontWeight="semibold"
                    _hover={{ bg: active ? 'brand.600' : 'whiteAlpha.100', color: 'white' }}
                    onClick={() => setActivePassportTab(tab.id)}
                  >
                    {tab.label}
                    {typeof tab.count === 'number' && (
                      <Text as="span" ml={2} color={active ? 'whiteAlpha.800' : 'whiteAlpha.500'} fontSize="xs">
                        {tab.count}
                      </Text>
                    )}
                  </ChakraButton>
                );
              })}
            </HStack>

            <Box mt={5}>
              {activePassportTab === 'quests' && (
                <Box p={{ base: 5, md: 6 }} borderRadius="xl" bg="gray.900" border="1px solid" borderColor="whiteAlpha.100">
                  <HStack justify="space-between" align="start" gap={4} mb={5}>
                    <Box>
                      <Heading as="h3" fontSize="lg" color="white" mb={1}>Completed Quests</Heading>
                      <Text color="whiteAlpha.500" fontSize="sm">Based on submitted responses</Text>
                    </Box>
                    <Flex w={11} h={11} borderRadius="full" bg="green.500/15" color="green.200" align="center" justify="center" flexShrink={0}>
                      <CheckCircle2 size={18} />
                    </Flex>
                  </HStack>
                  {displayUser.completedQuests.length > 0 ? (
                    <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
                      {displayUser.completedQuests.map((quest) => (
                        <Link key={quest.id} to={`/quests/${quest.id}`} style={{ display: 'block' }}>
                          <HStack p={3} borderRadius="xl" bg="whiteAlpha.50" border="1px solid" borderColor="transparent" _hover={{ bg: 'whiteAlpha.100', borderColor: 'green.400/30' }}>
                            <Flex w={10} h={10} borderRadius="full" bg="green.500/15" color="green.200" align="center" justify="center" flexShrink={0}>
                              <CheckCircle2 size={17} />
                            </Flex>
                            <Box minW={0} flex={1}>
                              <Text color="white" fontSize="sm" fontWeight="bold" lineClamp={1}>{quest.title}</Text>
                              <Text color="whiteAlpha.500" fontSize="xs">
                                {quest.submissions || 1} {(quest.submissions || 1) === 1 ? 'submission' : 'submissions'}
                              </Text>
                            </Box>
                          </HStack>
                        </Link>
                      ))}
                    </SimpleGrid>
                  ) : (
                    <VStack align="stretch" gap={3}>
                      <Text color="whiteAlpha.500" fontSize="sm" lineHeight="tall">
                        No completed quest submissions yet.
                      </Text>
                      <Link to="/quests">
                        <ChakraButton size="sm" w="fit-content" bg="green.500/15" color="green.200" border="1px solid" borderColor="green.400/30" borderRadius="full" _hover={{ bg: 'green.500/25' }}>
                          Browse Quests
                        </ChakraButton>
                      </Link>
                    </VStack>
                  )}
                </Box>
              )}

              {activePassportTab === 'events' && (
                <Box p={{ base: 5, md: 6 }} borderRadius="xl" bg="gray.900" border="1px solid" borderColor="whiteAlpha.100">
                  <HStack justify="space-between" align="start" gap={4} mb={5}>
                    <Box>
                      <Heading as="h3" fontSize="lg" color="white" mb={1}>Events Attended</Heading>
                      <Text color="whiteAlpha.500" fontSize="sm">{displayUser.attendedEvents.length} confirmed {displayUser.attendedEvents.length === 1 ? 'event' : 'events'}</Text>
                    </Box>
                    <Flex w={11} h={11} borderRadius="full" bg="green.500/15" color="green.200" align="center" justify="center" flexShrink={0}>
                      <CalendarDays size={18} />
                    </Flex>
                  </HStack>
                  {displayUser.attendedEvents.length > 0 ? (
                    <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
                      {displayUser.attendedEvents.map((event) => {
                        const eventContent = (
                          <HStack p={3} borderRadius="xl" bg="whiteAlpha.50" border="1px solid" borderColor="transparent" _hover={event.hasSession ? { bg: 'whiteAlpha.100', borderColor: 'green.400/30' } : undefined}>
                            <Flex w={10} h={10} borderRadius="full" bg="green.500/15" color="green.200" align="center" justify="center" flexShrink={0}>
                              <CalendarDays size={17} />
                            </Flex>
                            <Box minW={0} flex={1}>
                              <Text color="white" fontSize="sm" fontWeight="bold" lineClamp={1}>{event.title}</Text>
                              <Text color="whiteAlpha.500" fontSize="xs" lineClamp={1}>
                                {formatDate(event.date)}{event.locationName ? ` - ${event.locationName}` : ''}
                              </Text>
                            </Box>
                          </HStack>
                        );

                        return event.hasSession ? (
                          <Link key={event.id} to={`/sessions/${event.id}`} style={{ display: 'block' }}>
                            {eventContent}
                          </Link>
                        ) : (
                          <Box key={event.id}>{eventContent}</Box>
                        );
                      })}
                    </SimpleGrid>
                  ) : (
                    <VStack gap={3}>
                      <Text color="whiteAlpha.500" fontSize="sm">No events attended yet</Text>
                      <Link to="/sessions">
                        <ChakraButton size="sm" colorScheme="green" borderRadius="full">
                          Browse Events
                        </ChakraButton>
                      </Link>
                    </VStack>
                  )}
                </Box>
              )}

              {activePassportTab === 'liked' && (
                <ArtworkStrip
                  title="Liked Artwork"
                  icon={<Heart size={18} fill="currentColor" />}
                  items={savedArtwork.loved}
                  isLoading={savedArtworkLoading}
                  emptyTitle="No liked artwork yet"
                  emptyDescription="Love artwork from exhibitions or the artwork viewer and it will collect here."
                />
              )}

              {activePassportTab === 'bookmarked' && (
                <ArtworkStrip
                  title="Bookmarked Artwork"
                  icon={<Bookmark size={18} fill="currentColor" />}
                  items={savedArtwork.bookmarked}
                  isLoading={savedArtworkLoading}
                  emptyTitle="No bookmarks yet"
                  emptyDescription="Bookmark pieces you want to revisit and they will stay available from your Passport."
                />
              )}

              {activePassportTab === 'posts' && (
                <Box p={{ base: 5, md: 6 }} borderRadius="xl" bg="gray.900" border="1px solid" borderColor="whiteAlpha.100">
                  <HStack justify="space-between" align="center" mb={5}>
                    <HStack gap={3}>
                      <Flex w={10} h={10} borderRadius="full" bg="whiteAlpha.50" color="brand.300" align="center" justify="center">
                        <MessageCircle size={18} />
                      </Flex>
                      <Box>
                        <Heading as="h3" fontSize="lg" color="white">Community Posts</Heading>
                        <Text color="whiteAlpha.500" fontSize="sm">
                          {userCommunityPosts.length} {userCommunityPosts.length === 1 ? 'post' : 'posts'}
                        </Text>
                      </Box>
                    </HStack>
                    <Link to="/community/wall">
                      <ChakraButton
                        size="sm"
                        bg="whiteAlpha.50"
                        color="whiteAlpha.800"
                        border="1px solid"
                        borderColor="whiteAlpha.100"
                        borderRadius="full"
                        _hover={{ bg: 'whiteAlpha.100' }}
                      >
                        Wall
                      </ChakraButton>
                    </Link>
                  </HStack>

                  {communityPostsLoading ? (
                    <HStack gap={3} color="whiteAlpha.500">
                      <Spinner size="sm" color="brand.500" />
                      <Text fontSize="sm">Loading posts...</Text>
                    </HStack>
                  ) : userCommunityPosts.length > 0 ? (
                    <VStack align="stretch" gap={3}>
                      {userCommunityPosts.map((post) => {
                        const thumbnail = post.mediaType === 'image' ? post.mediaUrls?.[0] : undefined;
                        const isEditing = editingPostId === post.id;
                        const isPostBusy = busyPostId === post.id;

                        return (
                          <Box key={post.id} p={4} borderRadius="xl" bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.100">
                            <Flex gap={4} align="flex-start" direction={{ base: 'column', sm: 'row' }}>
                              {thumbnail && (
                                <Box w={{ base: 'full', sm: '120px' }} h={{ base: '180px', sm: '120px' }} borderRadius="lg" overflow="hidden" bg="gray.800" flexShrink={0}>
                                  <Image src={thumbnail} alt="Community post media" w="full" h="full" objectFit="cover" />
                                </Box>
                              )}
                              <Box flex={1} minW={0}>
                                <Flex justify="space-between" align="flex-start" gap={3} mb={2}>
                                  <HStack gap={3} color="whiteAlpha.500" fontSize="xs" flexWrap="wrap" pt={1}>
                                    <Text>{formatDate(post.createdAt)}</Text>
                                    <Text>{post.reactionsCount || 0} reactions</Text>
                                    <Text>{post.commentsCount || 0} comments</Text>
                                  </HStack>
                                  <HStack gap={2} flexShrink={0}>
                                    {isEditing ? (
                                      <>
                                        <ChakraButton
                                          size="xs"
                                          h="34px"
                                          px={3}
                                          borderRadius="full"
                                          bg="whiteAlpha.100"
                                          color="whiteAlpha.800"
                                          _hover={{ bg: 'whiteAlpha.200' }}
                                          onClick={cancelEditingPost}
                                          disabled={isPostBusy}
                                        >
                                          <X size={14} />
                                          Cancel
                                        </ChakraButton>
                                        <ChakraButton
                                          size="xs"
                                          h="34px"
                                          px={3}
                                          borderRadius="full"
                                          bg="brand.500"
                                          color="white"
                                          _hover={{ bg: 'brand.600' }}
                                          onClick={() => void handleSavePost(post)}
                                          disabled={isPostBusy || !editingPostContent.trim()}
                                        >
                                          {isPostBusy ? <Spinner size="xs" /> : <Save size={14} />}
                                          Save
                                        </ChakraButton>
                                      </>
                                    ) : (
                                      <>
                                        <ChakraButton
                                          size="xs"
                                          h="34px"
                                          px={3}
                                          borderRadius="full"
                                          bg="whiteAlpha.100"
                                          color="whiteAlpha.800"
                                          _hover={{ bg: 'whiteAlpha.200' }}
                                          onClick={() => startEditingPost(post)}
                                          disabled={!!busyPostId}
                                        >
                                          <Pencil size={14} />
                                          Edit
                                        </ChakraButton>
                                        <ChakraButton
                                          size="xs"
                                          h="34px"
                                          px={3}
                                          borderRadius="full"
                                          bg="red.500/12"
                                          color="red.200"
                                          _hover={{ bg: 'red.500/20' }}
                                          onClick={() => void handleDeletePost(post.id)}
                                          disabled={!!busyPostId}
                                        >
                                          {isPostBusy ? <Spinner size="xs" /> : <Trash2 size={14} />}
                                          Delete
                                        </ChakraButton>
                                      </>
                                    )}
                                  </HStack>
                                </Flex>
                                {post.prompt && (
                                  <Text color="brand.300" fontSize="xs" fontWeight="semibold" mb={2} lineClamp={1}>
                                    {post.prompt}
                                  </Text>
                                )}
                                {isEditing ? (
                                  <Textarea
                                    value={editingPostContent}
                                    onChange={(event) => setEditingPostContent(event.target.value)}
                                    minH="120px"
                                    bg="blackAlpha.300"
                                    borderColor="whiteAlpha.200"
                                    color="white"
                                    fontSize="sm"
                                    lineHeight="tall"
                                    resize="vertical"
                                    disabled={isPostBusy}
                                  />
                                ) : (
                                  <Text color="whiteAlpha.900" fontSize="sm" lineHeight="tall" whiteSpace="pre-wrap">
                                    {post.content}
                                  </Text>
                                )}
                                {post.tags?.length > 0 && (
                                  <HStack gap={2} mt={3} flexWrap="wrap">
                                    {post.tags.slice(0, 8).map((tag) => (
                                      <Text key={tag} px={2.5} py={1} borderRadius="full" bg="blackAlpha.300" color="whiteAlpha.600" fontSize="xs">
                                        #{tag}
                                      </Text>
                                    ))}
                                  </HStack>
                                )}
                              </Box>
                            </Flex>
                          </Box>
                        );
                      })}
                    </VStack>
                  ) : (
                    <Flex
                      minH="180px"
                      borderRadius="xl"
                      border="1px dashed"
                      borderColor="whiteAlpha.200"
                      bg="blackAlpha.200"
                      align="center"
                      justify="center"
                      textAlign="center"
                      px={6}
                    >
                      <VStack gap={3}>
                        <Flex w={12} h={12} borderRadius="full" bg="whiteAlpha.50" color="whiteAlpha.500" align="center" justify="center">
                          <MessageCircle size={20} />
                        </Flex>
                        <Box>
                          <Text color="white" fontWeight="bold">No community posts yet</Text>
                          <Text color="whiteAlpha.500" fontSize="sm" maxW="sm">Posts you make on the community wall will show here.</Text>
                        </Box>
                        <Link to="/community/wall">
                          <ChakraButton size="sm" bg="brand.500" color="white" borderRadius="full" _hover={{ bg: 'brand.600' }}>
                            Create Post
                          </ChakraButton>
                        </Link>
                      </VStack>
                    </Flex>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        </ChakraContainer>
      </Box>

      <Footer />
    </Box>
  );
};

export default Passport;
