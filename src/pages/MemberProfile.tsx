'use client'

import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Timestamp } from 'firebase/firestore'
import {
  AspectRatio,
  Badge,
  Box,
  Button,
  Container,
  Flex,
  Grid,
  Heading,
  HStack,
  Image,
  SimpleGrid,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { Award, BadgeCheck, ExternalLink, ImageIcon, MessageCircle, Sparkles, UserRound } from 'lucide-react'

import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { useCollection, useDocument } from '@/hooks/useFirestore'
import type { Artwork, CommunityPost, Quest, QuestSubmission } from '../../lib/schema'

const MotionBox = motion.create(Box)

const toMillis = (value: unknown): number => {
  if (!value) return 0
  if (value instanceof Timestamp) return value.toMillis()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'object' && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis()
  }
  return 0
}

const formatDate = (value: unknown): string => {
  const millis = toMillis(value)
  if (!millis) return 'Recently'

  return new Date(millis).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const countPostReactions = (post: CommunityPost): number =>
  Object.values(post.reactions || {}).reduce(
    (count, userIds) => count + (Array.isArray(userIds) ? userIds.length : 0),
    0
  )

const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'M'

function ProfileAvatar({ name, photoURL }: { name: string; photoURL?: string | null }) {
  return (
    <Flex
      boxSize={{ base: '92px', md: '116px' }}
      borderRadius="full"
      bg="brand.500"
      color="white"
      align="center"
      justify="center"
      overflow="hidden"
      border="1px solid"
      borderColor="whiteAlpha.200"
      flexShrink={0}
    >
      {photoURL ? (
        <Image src={photoURL} alt={name} w="full" h="full" objectFit="cover" />
      ) : (
        <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="bold">
          {getInitials(name)}
        </Text>
      )}
    </Flex>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Box
      p={{ base: 4, md: 5 }}
      bg="whiteAlpha.50"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="xl"
      minH="116px"
    >
      <Flex color="whiteAlpha.500" mb={3}>
        {icon}
      </Flex>
      <Text color="white" fontSize={{ base: '2xl', md: '3xl' }} fontWeight="bold" lineHeight={1}>
        {value}
      </Text>
      <Text color="whiteAlpha.500" fontSize="sm" mt={2}>
        {label}
      </Text>
    </Box>
  )
}

function MemberPostCard({ post }: { post: CommunityPost }) {
  const reactionCount = countPostReactions(post)
  const primaryMedia = post.mediaUrls?.[0]

  return (
    <MotionBox
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      p={{ base: 4, md: 5 }}
      bg="gray.900"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="xl"
    >
      {primaryMedia && (
        <AspectRatio ratio={16 / 9} mb={4} bg="gray.800" borderRadius="lg" overflow="hidden">
          {post.mediaType === 'video' ? (
            <video src={primaryMedia} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Image src={primaryMedia} alt="" w="full" h="full" objectFit="cover" />
          )}
        </AspectRatio>
      )}
      <Text color="whiteAlpha.800" whiteSpace="pre-wrap" lineClamp={5} lineHeight="tall">
        {post.content}
      </Text>
      <Flex justify="space-between" align="center" gap={3} mt={4} flexWrap="wrap">
        <HStack gap={3} color="whiteAlpha.500" fontSize="sm">
          <Text>{formatDate(post.createdAt)}</Text>
          <Text>{reactionCount} reaction{reactionCount === 1 ? '' : 's'}</Text>
          <Text>{post.commentsCount || 0} comment{post.commentsCount === 1 ? '' : 's'}</Text>
        </HStack>
        {post.prompt && (
          <Badge bg="purple.500/15" color="purple.200" borderRadius="full" px={3} py={1}>
            {post.prompt}
          </Badge>
        )}
      </Flex>
    </MotionBox>
  )
}

function EmptySection({ title, description }: { title: string; description: string }) {
  return (
    <Box p={6} bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.100" borderRadius="xl" textAlign="center">
      <Text color="white" fontWeight="semibold">{title}</Text>
      <Text color="whiteAlpha.500" fontSize="sm" mt={1}>{description}</Text>
    </Box>
  )
}

export default function MemberProfile() {
  const { id } = useParams<{ id: string }>()
  const {
    data: publicProfile,
    loading: publicProfileLoading,
  } = useDocument('publicProfiles', id, { skip: !id })
  const {
    data: artist,
    loading: artistLoading,
  } = useDocument('artists', id, { skip: !id })
  const {
    data: communityPosts,
    loading: postsLoading,
  } = useCollection('communityPosts', {
    where: id ? [{ field: 'userId', operator: '==', value: id }] : [],
    skip: !id,
  })
  const {
    data: questSubmissions,
    loading: submissionsLoading,
  } = useCollection('questSubmissions', {
    where: id ? [{ field: 'userId', operator: '==', value: id }] : [],
    skip: !id,
  })
  const {
    data: quests,
    loading: questsLoading,
  } = useCollection('quests', { skip: !id })
  const {
    data: artworks,
    loading: artworksLoading,
  } = useCollection('artworks', {
    where: id && artist ? [{ field: 'artistId', operator: '==', value: id }] : [],
    skip: !id || !artist,
  })

  const visiblePosts = useMemo(
    () =>
      [...(communityPosts as CommunityPost[])]
        .filter((post) => !post.isHidden && post.isApproved !== false)
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)),
    [communityPosts]
  )
  const questById = useMemo(
    () => new Map((quests as Quest[]).map((quest) => [quest.id, quest])),
    [quests]
  )
  const completedSubmissions = useMemo(
    () =>
      [...(questSubmissions as QuestSubmission[])]
        .filter((submission) => submission.approved)
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)),
    [questSubmissions]
  )
  const displayArtworks = useMemo(
    () =>
      [...(artworks as Artwork[])]
        .filter((artwork) => artwork.visibility !== 'unlisted')
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)),
    [artworks]
  )

  const latestPost = visiblePosts[0]
  const memberName =
    publicProfile?.displayName ||
    artist?.artistName ||
    artist?.name ||
    latestPost?.userName ||
    'Club BZR member'
  const memberPhoto = publicProfile?.photoURL || artist?.photoURL || latestPost?.userPhotoURL
  const username = publicProfile?.username || `member.${id?.slice(0, 5).toLowerCase() || 'club'}`
  const interests = publicProfile?.interests?.length ? publicProfile.interests : artist?.interests || []
  const hasAnyProfile = Boolean(publicProfile || artist || visiblePosts.length > 0 || completedSubmissions.length > 0)
  const isLoading = publicProfileLoading || artistLoading || postsLoading || submissionsLoading || questsLoading || artworksLoading
  const totalReactions = visiblePosts.reduce((sum, post) => sum + countPostReactions(post), 0)
  const worksCount = Math.max(publicProfile?.worksCount || 0, artist?.worksCount || 0, displayArtworks.length, artist?.portfolio?.length || 0)

  if (isLoading && !hasAnyProfile) {
    return (
      <Box bg="gray.950" minH="100vh">
        <Header />
        <Flex as="main" minH="80vh" pt={32} align="center" justify="center">
          <Spinner size="xl" color="brand.500" />
        </Flex>
      </Box>
    )
  }

  if (!id || !hasAnyProfile) {
    return (
      <Box bg="gray.950" minH="100vh">
        <Header />
        <Box as="main" pt={32} pb={20}>
          <Container maxW="760px" px={{ base: 5, md: 8 }}>
            <VStack gap={5} textAlign="center" p={{ base: 6, md: 10 }} bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="xl">
              <Flex boxSize="56px" borderRadius="full" bg="whiteAlpha.100" color="whiteAlpha.600" align="center" justify="center">
                <UserRound size={26} />
              </Flex>
              <Box>
                <Heading as="h1" color="white" fontSize={{ base: '2xl', md: '3xl' }}>
                  Member not found
                </Heading>
                <Text color="whiteAlpha.500" mt={2}>
                  This member has not created public community activity yet.
                </Text>
              </Box>
              <Link to="/community/wall">
                <Button bg="brand.500" color="white" borderRadius="full" _hover={{ bg: 'brand.600' }}>
                  Browse Community
                </Button>
              </Link>
            </VStack>
          </Container>
        </Box>
        <Footer />
      </Box>
    )
  }

  return (
    <Box bg="gray.950" minH="100vh">
      <Header />

      <Box as="main" pt={{ base: 28, md: 32 }} pb={{ base: 28, md: 20 }}>
        <Container maxW="1280px" px={{ base: 5, md: 10, lg: 14 }}>
          <MotionBox
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            p={{ base: 5, md: 8 }}
            bg="gray.900"
            border="1px solid"
            borderColor="whiteAlpha.100"
            borderRadius="xl"
            mb={6}
          >
            <Flex gap={{ base: 5, md: 7 }} align={{ base: 'flex-start', md: 'center' }} direction={{ base: 'column', md: 'row' }}>
              <ProfileAvatar name={memberName} photoURL={memberPhoto} />
              <Box flex={1} minW={0}>
                <HStack gap={3} flexWrap="wrap" mb={2}>
                  <Heading as="h1" color="white" fontSize={{ base: '3xl', md: '5xl' }} lineHeight={1.05} letterSpacing="normal">
                    {memberName}
                  </Heading>
                  {artist && (
                    <Badge bg="brand.500/20" color="brand.200" borderRadius="full" px={3} py={1}>
                      <HStack gap={1.5}>
                        <BadgeCheck size={14} />
                        <Text as="span">Artist</Text>
                      </HStack>
                    </Badge>
                  )}
                </HStack>
                <Text color="whiteAlpha.500" fontSize="md">@{username}</Text>
                {(publicProfile?.bio || artist?.bio) && (
                  <Text color="whiteAlpha.700" mt={4} maxW="3xl" lineHeight="tall">
                    {publicProfile?.bio || artist?.bio}
                  </Text>
                )}
                {interests.length > 0 && (
                  <HStack gap={2} mt={5} flexWrap="wrap">
                    {interests.slice(0, 10).map((interest) => (
                      <Badge key={interest} bg="whiteAlpha.100" color="whiteAlpha.800" borderRadius="full" px={3} py={1}>
                        {interest}
                      </Badge>
                    ))}
                  </HStack>
                )}
              </Box>
              {artist && (
                <Link to={`/artists/${id}`}>
                  <Button bg="brand.500" color="white" borderRadius="full" _hover={{ bg: 'brand.600' }}>
                    <ExternalLink size={17} />
                    Artist Profile
                  </Button>
                </Link>
              )}
            </Flex>
          </MotionBox>

          <SimpleGrid columns={{ base: 2, md: 4 }} gap={4} mb={8}>
            <StatCard label="Posts" value={visiblePosts.length} icon={<MessageCircle size={20} />} />
            <StatCard label="Reactions" value={totalReactions} icon={<Sparkles size={20} />} />
            <StatCard label="Quests" value={completedSubmissions.length} icon={<Award size={20} />} />
            <StatCard label="Works" value={worksCount} icon={<ImageIcon size={20} />} />
          </SimpleGrid>

          <Grid templateColumns={{ base: '1fr', lg: 'minmax(0, 1.5fr) minmax(320px, 0.8fr)' }} gap={6} alignItems="start">
            <VStack align="stretch" gap={5}>
              <Flex justify="space-between" align="center" gap={4}>
                <Heading as="h2" color="white" fontSize={{ base: 'xl', md: '2xl' }}>
                  Community Posts
                </Heading>
                <Text color="whiteAlpha.500" fontSize="sm">{visiblePosts.length} total</Text>
              </Flex>
              {visiblePosts.length > 0 ? (
                visiblePosts.map((post) => <MemberPostCard key={post.id} post={post} />)
              ) : (
                <EmptySection title="No posts yet" description="Community posts from this member will appear here." />
              )}
            </VStack>

            <VStack align="stretch" gap={5}>
              {artist && (
                <Box p={{ base: 5, md: 6 }} bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="xl">
                  <Flex justify="space-between" gap={4} align="flex-start" mb={4}>
                    <Box>
                      <Heading as="h2" color="white" fontSize="xl">
                        Artist Profile
                      </Heading>
                      <Text color="whiteAlpha.500" fontSize="sm" mt={1}>{artist.artistName || artist.name}</Text>
                    </Box>
                    <Link to={`/artists/${id}`}>
                      <Button size="sm" bg="whiteAlpha.100" color="white" borderRadius="full" _hover={{ bg: 'whiteAlpha.200' }}>
                        View
                      </Button>
                    </Link>
                  </Flex>
                  <Text color="whiteAlpha.650" fontSize="sm" lineClamp={4} lineHeight="tall">
                    {artist.bio}
                  </Text>
                  {displayArtworks.length > 0 && (
                    <SimpleGrid columns={3} gap={2} mt={5}>
                      {displayArtworks.slice(0, 3).map((artwork) => (
                        <AspectRatio key={artwork.id} ratio={1} bg="gray.800" borderRadius="md" overflow="hidden">
                          <Image src={artwork.thumbnailUrl || artwork.imageUrl} alt={artwork.title} objectFit="cover" />
                        </AspectRatio>
                      ))}
                    </SimpleGrid>
                  )}
                </Box>
              )}

              <Box p={{ base: 5, md: 6 }} bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="xl">
                <Heading as="h2" color="white" fontSize="xl" mb={4}>
                  Completed Quests
                </Heading>
                {completedSubmissions.length > 0 ? (
                  <VStack align="stretch" gap={3}>
                    {completedSubmissions.slice(0, 6).map((submission) => {
                      const quest = questById.get(submission.questId)
                      return (
                        <Box key={submission.id} p={4} bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.100" borderRadius="lg">
                          <Text color="white" fontWeight="semibold" lineClamp={1}>
                            {quest?.title || submission.questTitle || 'Quest submission'}
                          </Text>
                          <HStack gap={3} mt={2} color="whiteAlpha.500" fontSize="xs">
                            <Text>{formatDate(submission.createdAt)}</Text>
                            <Text>{submission.pointsAwarded || quest?.points || 0} pts</Text>
                          </HStack>
                        </Box>
                      )
                    })}
                  </VStack>
                ) : (
                  <EmptySection title="No completed quests yet" description="Approved quest submissions will collect here." />
                )}
              </Box>
            </VStack>
          </Grid>
        </Container>
      </Box>

      <Footer />
    </Box>
  )
}
