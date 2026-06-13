'use client';

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box,
  Container as ChakraContainer,
  Flex,
  Heading,
  Text,
  Button as ChakraButton,
  VStack,
  HStack,
  SimpleGrid,
  Spinner,
} from '@chakra-ui/react';
import { Award, Bookmark, CheckCircle2, Eye, Heart, ImageIcon, Pencil, UserRound } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useCollection, useDocument } from '@/hooks/useFirestore';
import { Timestamp } from 'firebase/firestore';
import { createQuestCompletionBadges, getBadgeVisual } from '../../lib/badges';
import { createDocumentWithId } from '../../lib/firestore';
import {
  buildDiscoveryArtworks,
  formatMedium,
  getArtworkEngagementKey,
  type DiscoveryArtwork,
} from '@/lib/artworkDiscovery';
import { resolveProfileIdentity } from '@/lib/profileIdentity';
import type {
  Artist,
  Badge as PassportBadge,
  CreativePassport,
  CommunityPost,
  CreateDocument,
  Artwork,
  Exhibition,
  Quest,
  QuestSubmission,
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

  // Get current user from auth context
  const { user: authUser, firebaseUser, loading: authLoading, initialized } = useAuth();

  // Fetch passport data from Firebase using userId (firebaseUser has uid)
  const {
    data: passport,
    loading: passportLoading,
    error: passportError,
    refetch: refetchPassport
  } = useDocument('creativePassports', firebaseUser?.uid);
  const {
    data: artistProfile,
    loading: artistProfileLoading,
  } = useDocument('artists', firebaseUser?.uid, { skip: !firebaseUser?.uid });
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
  } = useCollection('communityPosts', {
    where: [{ field: 'userId', operator: '==', value: firebaseUser?.uid || '' }],
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

    return {
      completedQuestIds: Array.from(completedQuestIds),
      completedQuests,
      eventsAttended: passport?.eventsAttended || [],
      collaborations: passport?.collaborations || [],
      postsCreated: communityPosts.length,
      reactionsReceived: postReactions + submissionReactions,
      points: submissionPoints,
      badges: Array.from(badgeMap.values()).sort((a, b) => toMillis(b.earnedAt) - toMillis(a.earnedAt)),
    };
  }, [communityPosts, passport, questSubmissions, quests]);

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

  const savedArtworkLoading = artistsLoading || uploadedArtworksLoading || exhibitionsLoading;

  // Loading state
  const isLoading = authLoading || passportLoading || questSubmissionsLoading || communityPostsLoading || questsLoading || !initialized;

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
                    const now = Timestamp.now();
                    const newPassport: CreateDocument<CreativePassport> = {
                      userId: firebaseUser.uid,
                      level: 1,
                      points: 0,
                      badges: [],
                      questsCompleted: [],
                      questsInProgress: [],
                      eventsAttended: [],
                      mediums: [],
                      interests: [],
                      collaborations: [],
                      timeline: [],
                      streaks: {
                        current: 0,
                        longest: 0,
                        lastActivityDate: now,
                        weeklyGoal: 3,
                        weeklyProgress: 0,
                      },
                      stats: {
                        totalQuestsCompleted: 0,
                        totalEventsAttended: 0,
                        totalCollaborations: 0,
                        totalPostsCreated: 0,
                        totalReactionsReceived: 0,
                        joinedAt: now,
                      },
                    };
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
    questsCompleted: liveActivity.completedQuestIds,
    completedQuests: liveActivity.completedQuests,
    questsInProgress: (passport.questsInProgress || []).filter((questId) => !liveActivity.completedQuestIds.includes(questId)),
    mediums: passport.mediums || [],
  };

  const stats = [
    {
      label: 'Events Attended',
      value: Math.max(displayUser.stats?.totalEventsAttended || 0, displayUser.eventsAttended.length),
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
  const hasArtistProfile = !!artistProfile;
  const artistDisplayName = artistProfile?.artistName || artistProfile?.name || 'Artist profile';

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
          <SimpleGrid columns={{ base: 2, md: 4 }} gap={4} mb={8}>
            {stats.map((stat) => (
              <Box
                key={stat.label}
                p={5}
                borderRadius="xl"
                bg="gray.900"
                border="1px solid"
                borderColor="whiteAlpha.100"
                textAlign="center"
              >
                <Flex justify="center" mb={2} color="whiteAlpha.500">
                  {stat.icon}
                </Flex>
                <Text color="white" fontSize="2xl" fontWeight="bold">{stat.value}</Text>
                <Text color="whiteAlpha.500" fontSize="xs">{stat.label}</Text>
              </Box>
            ))}
          </SimpleGrid>

          {/* Quick Actions */}
          <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap={6}>
            {/* Artist Profile */}
            <Box
              p={{ base: 5, md: 6 }}
              borderRadius="xl"
              bg="gray.900"
              border="1px solid"
              borderColor="whiteAlpha.100"
              minH="260px"
              display="flex"
              flexDirection="column"
            >
              <HStack justify="space-between" align="start" gap={4} mb={5}>
                <Box>
                  <Heading as="h3" fontSize="lg" color="white" mb={1}>Artist Profile</Heading>
                  <Text color="whiteAlpha.500" fontSize="sm">
                    Public creator presence
                  </Text>
                </Box>
                <Flex
                  w={12}
                  h={12}
                  borderRadius="full"
                  bg={hasArtistProfile ? 'brand.500/20' : 'whiteAlpha.50'}
                  color={hasArtistProfile ? 'brand.300' : 'whiteAlpha.500'}
                  align="center"
                  justify="center"
                  flexShrink={0}
                >
                  {hasArtistProfile ? <Pencil size={20} /> : <UserRound size={20} />}
                </Flex>
              </HStack>

              {artistProfileLoading ? (
                <HStack gap={3} color="whiteAlpha.500" mt="auto">
                  <Spinner size="sm" color="brand.500" />
                  <Text fontSize="sm">Checking artist profile...</Text>
                </HStack>
              ) : hasArtistProfile ? (
                <VStack align="stretch" gap={5} flex={1} justify="space-between">
                  <Box>
                    <Text color="white" fontSize="xl" fontWeight="bold" lineClamp={1} mb={2}>
                      {artistDisplayName}
                    </Text>
                    <Text color="whiteAlpha.600" fontSize="sm" lineHeight="tall">
                      Update your public bio, mediums, links, and availability.
                    </Text>
                  </Box>
                  <SimpleGrid columns={2} gap={3}>
                    <Link to="/artists/create" style={{ display: 'block' }}>
                      <ChakraButton w="full" h={11} gap={2} bg="brand.500" color="white" borderRadius="full" fontSize="sm" _hover={{ bg: 'brand.600' }}>
                        <Pencil size={15} />
                        Edit
                      </ChakraButton>
                    </Link>
                    <Link to={`/artists/${firebaseUser?.uid}`} style={{ display: 'block' }}>
                      <ChakraButton
                        w="full"
                        h={11}
                        gap={2}
                        bg="whiteAlpha.50"
                        color="white"
                        border="1px solid"
                        borderColor="whiteAlpha.200"
                        borderRadius="full"
                        fontSize="sm"
                        _hover={{ bg: 'whiteAlpha.100' }}
                      >
                        <Eye size={15} />
                        View
                      </ChakraButton>
                    </Link>
                  </SimpleGrid>
                </VStack>
              ) : (
                <VStack align="stretch" gap={5} flex={1} justify="space-between">
                  <Text color="whiteAlpha.600" fontSize="sm" lineHeight="tall">
                    Create a public profile so artists can discover your work and collaboration interests.
                  </Text>
                  <Link to="/artists/create" style={{ display: 'block' }}>
                    <ChakraButton w="full" h={11} gap={2} bg="brand.500" color="white" borderRadius="full" fontSize="sm" _hover={{ bg: 'brand.600' }}>
                      <UserRound size={15} />
                      Create Profile
                    </ChakraButton>
                  </Link>
                </VStack>
              )}
            </Box>

            {/* Badges */}
            <Box
              p={6}
              borderRadius="xl"
              bg="gray.900"
              border="1px solid"
              borderColor="whiteAlpha.100"
              minH="260px"
            >
              <HStack justify="space-between" align="start" gap={4} mb={4}>
                <Box>
                  <Heading as="h3" fontSize="md" color="white" mb={1}>Recent Badges</Heading>
                  <Text color="whiteAlpha.500" fontSize="sm">Earned from quest submissions</Text>
                </Box>
                <Flex w={11} h={11} borderRadius="full" bg="purple.500/15" color="purple.200" align="center" justify="center" flexShrink={0}>
                  <Award size={18} />
                </Flex>
              </HStack>
              {displayUser.badges.length > 0 ? (
                <VStack align="stretch" gap={3}>
                  {displayUser.badges.slice(0, 4).map((badge) => {
                    const visual = getBadgeVisual(badge.id);

                    return (
                    <HStack key={badge.id} p={3} borderRadius="xl" bg="whiteAlpha.50" gap={3}>
                      <Box
                        w={10}
                        h={10}
                        borderRadius="full"
                        bg={visual.bg}
                        color={visual.color}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        fontWeight="bold"
                        flexShrink={0}
                      >
                        {visual.icon}
                      </Box>
                      <Box minW={0}>
                        <Text color="white" fontSize="sm" fontWeight="bold" lineClamp={1}>{badge.name}</Text>
                        <Text color="whiteAlpha.500" fontSize="xs" lineClamp={1}>{badge.description}</Text>
                      </Box>
                    </HStack>
                    );
                  })}
                </VStack>
              ) : (
                <VStack align="stretch" gap={3}>
                  <Text color="whiteAlpha.500" fontSize="sm" lineHeight="tall">
                    No badges earned yet. Submit a quest response to unlock your first badge.
                  </Text>
                  <Link to="/quests" style={{ display: 'block' }}>
                    <ChakraButton size="sm" w="fit-content" bg="purple.500/15" color="purple.200" border="1px solid" borderColor="purple.400/30" borderRadius="full" _hover={{ bg: 'purple.500/25' }}>
                      Browse Quests
                    </ChakraButton>
                  </Link>
                </VStack>
              )}
            </Box>

            {/* Quests */}
            <Box
              p={6}
              borderRadius="xl"
              bg="gray.900"
              border="1px solid"
              borderColor="whiteAlpha.100"
              minH="260px"
            >
              <HStack justify="space-between" align="start" gap={4} mb={4}>
                <Box>
                  <Heading as="h3" fontSize="md" color="white" mb={1}>Completed Quests</Heading>
                  <Text color="whiteAlpha.500" fontSize="sm">Based on submitted responses</Text>
                </Box>
                <Flex w={11} h={11} borderRadius="full" bg="green.500/15" color="green.200" align="center" justify="center" flexShrink={0}>
                  <CheckCircle2 size={18} />
                </Flex>
              </HStack>
              {displayUser.completedQuests.length > 0 ? (
                <VStack align="stretch" gap={3}>
                  {displayUser.completedQuests.slice(0, 4).map((quest) => (
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
                </VStack>
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

            {/* Events */}
            <Box
              p={6}
              borderRadius="xl"
              bg="gray.900"
              border="1px solid"
              borderColor="whiteAlpha.100"
            >
              <Heading as="h3" fontSize="md" color="white" mb={4}>Events Attended</Heading>
              {displayUser.eventsAttended.length > 0 ? (
                <VStack align="stretch" gap={2}>
                  {displayUser.eventsAttended.slice(0, 3).map((eventId) => (
                    <HStack key={eventId} p={2} borderRadius="lg" bg="whiteAlpha.50">
                      <Box w={8} h={8} borderRadius="md" bg="green.500" display="flex" alignItems="center" justifyContent="center">
                        <svg width="16" height="16" fill="none" stroke="white" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </Box>
                      <Text color="white" fontSize="sm" fontFamily="mono">{eventId.slice(0, 8)}...</Text>
                    </HStack>
                  ))}
                </VStack>
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
          </SimpleGrid>

          <SimpleGrid columns={{ base: 1, xl: 2 }} gap={6} mt={8}>
            <ArtworkStrip
              title="Liked Artwork"
              icon={<Heart size={18} fill="currentColor" />}
              items={savedArtwork.loved}
              isLoading={savedArtworkLoading}
              emptyTitle="No liked artwork yet"
              emptyDescription="Love artwork from exhibitions or the artwork viewer and it will collect here."
            />
            <ArtworkStrip
              title="Bookmarked Artwork"
              icon={<Bookmark size={18} fill="currentColor" />}
              items={savedArtwork.bookmarked}
              isLoading={savedArtworkLoading}
              emptyTitle="No bookmarks yet"
              emptyDescription="Bookmark pieces you want to revisit and they will stay available from your Passport."
            />
          </SimpleGrid>
        </ChakraContainer>
      </Box>

      <Footer />
    </Box>
  );
};

export default Passport;
