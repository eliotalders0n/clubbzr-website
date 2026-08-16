'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Box,
  Container,
  Flex,
  Grid,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Badge,
  SimpleGrid,
  Textarea,
  Spinner,
  Center,
  Image,
} from '@chakra-ui/react'
import { AnimatePresence, motion } from 'framer-motion'
import { Send } from 'lucide-react'

import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { useDocument, useCollection, useMutation } from '@/hooks/useFirestore'
import { useAuth } from '@/contexts/AuthContext'
import { SubmissionVoteButtons, type SubmissionVoteValue } from '@/components/features/quests'
import { getBadgeVisual } from '../../lib/badges'
import { uploadMultiple, STORAGE_PATHS } from '../../lib/storage'
import { addToArray, removeFromArray, incrementField } from '../../lib/firestore'
import { updateQuestSubmissionVote } from '../../lib/submissionVotes'
import type { Badge as PassportBadge, QuestSubmission, ReactionType } from '../../lib/schema'
import { Timestamp } from 'firebase/firestore'

const MotionBox = motion.create(Box)

const REACTION_TYPES: { type: ReactionType; emoji: string }[] = [
  { type: 'love', emoji: '❤️' },
  { type: 'fire', emoji: '🔥' },
  { type: 'mind_blown', emoji: '🤯' },
  { type: 'inspire', emoji: '✨' },
  { type: 'curious', emoji: '🤔' },
]

const IMAGE_URL_PATTERN = /\.(avif|gif|jpe?g|png|webp)(?:$|[?#])/i

const isUsableImageReference = (url: string): boolean => {
  const value = url.trim()
  if (!value) return false
  if (value.startsWith('/') || value.startsWith('data:image/') || value.startsWith('blob:')) return true

  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const getQuestImageCandidates = (quest: {
  inspirationLinks?: string[]
  exampleImages?: string[]
}) => {
  const candidates = [...(quest.inspirationLinks || []), ...(quest.exampleImages || [])]
    .map((url) => url.trim())
    .filter(isUsableImageReference)

  return [...new Set(candidates)]
}

const isImageUrl = (url: string): boolean => {
  const value = url.trim()
  if (!value) return false
  if (value.startsWith('data:image/') || value.startsWith('blob:')) return true

  try {
    const parsed = value.startsWith('/') ? new URL(value, window.location.origin) : new URL(value)
    return IMAGE_URL_PATTERN.test(parsed.pathname) || IMAGE_URL_PATTERN.test(parsed.href)
  } catch {
    return IMAGE_URL_PATTERN.test(value)
  }
}

function InspirationLink({ link, index }: { link: string; index: number }) {
  const [imageFailed, setImageFailed] = useState(false)
  const trimmedLink = link.trim()
  const shouldPreviewImage = isImageUrl(trimmedLink) && !imageFailed

  if (shouldPreviewImage) {
    return (
      <a href={trimmedLink} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none' }}>
        <Box
          borderRadius="xl"
          overflow="hidden"
          bg="blackAlpha.300"
          border="1px solid"
          borderColor="whiteAlpha.100"
          _hover={{ borderColor: 'green.400/50' }}
          transition="border-color 0.2s"
        >
          <Box
            h={{ base: '220px', md: '360px' }}
            maxH={{ base: '45vh', md: '420px' }}
            display="flex"
            alignItems="center"
            justifyContent="center"
            bg="blackAlpha.400"
          >
            <Image
              src={trimmedLink}
              alt={`Quest inspiration ${index + 1}`}
              w="full"
              h="full"
              objectFit="contain"
              onError={() => setImageFailed(true)}
            />
          </Box>
          <Text
            color="whiteAlpha.500"
            fontSize="xs"
            px={3}
            py={2}
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
          >
            {trimmedLink}
          </Text>
        </Box>
      </a>
    )
  }

  return (
    <a href={trimmedLink} target="_blank" rel="noopener noreferrer">
      <Text color="blue.400" fontSize="sm" _hover={{ textDecor: 'underline' }} overflowWrap="anywhere">
        {trimmedLink}
      </Text>
    </a>
  )
}

function formatDate(timestamp: Timestamp | { seconds: number } | undefined): string {
  if (!timestamp) return ''
  const date = 'toDate' in timestamp ? timestamp.toDate() : new Date(timestamp.seconds * 1000)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString()
}

function toMillis(value: unknown): number {
  if (!value) return 0
  if (value instanceof Timestamp) return value.toMillis()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'object' && value !== null) {
    const timestamp = value as { toDate?: () => Date; seconds?: number }
    if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime()
    if (typeof timestamp.seconds === 'number') return timestamp.seconds * 1000
  }
  return 0
}

function SubmissionCard({
  submission,
  currentUserId,
  onReact,
  onVote,
}: {
  submission: QuestSubmission
  currentUserId: string | null
  onReact: (submissionId: string, reactionType: ReactionType) => void
  onVote: (submission: QuestSubmission, vote: SubmissionVoteValue) => void
}) {
  return (
    <MotionBox
      whileHover={{ y: -8 }}
      borderRadius="2xl"
      overflow="hidden"
      bg="gray.900"
      border="1px solid"
      borderColor="whiteAlpha.100"
    >
      {submission.mediaUrls && submission.mediaUrls.length > 0 ? (
        <Box aspectRatio={1} overflow="hidden">
          <Image
            src={submission.mediaUrls[0]}
            alt={submission.title || 'Submission'}
            w="full"
            h="full"
            objectFit="cover"
          />
        </Box>
      ) : (
        <Box aspectRatio={1} bg="gray.800" display="flex" alignItems="center" justifyContent="center">
          <Text color="whiteAlpha.300">No image</Text>
        </Box>
      )}
      <Box p={5}>
        <HStack gap={3} mb={3}>
          <Box
            w={8}
            h={8}
            borderRadius="full"
            bg="green.500"
            display="flex"
            alignItems="center"
            justifyContent="center"
            overflow="hidden"
          >
            {submission.userPhotoURL ? (
              <Image src={submission.userPhotoURL} alt={submission.userName} w="full" h="full" objectFit="cover" />
            ) : (
              <Text color="white" fontSize="sm" fontWeight="bold">
                {submission.userName?.charAt(0) || '?'}
              </Text>
            )}
          </Box>
          <Text color="white" fontSize="sm" fontWeight="medium">
            {submission.userName}
          </Text>
          <Text color="whiteAlpha.400" fontSize="xs" ml="auto">
            {formatDate(submission.createdAt as Timestamp)}
          </Text>
        </HStack>

        {submission.title && (
          <Text color="white" fontSize="md" fontWeight="medium" mb={2}>
            {submission.title}
          </Text>
        )}

        <Text color="whiteAlpha.600" fontSize="sm" lineClamp={2} mb={4}>
          {submission.content}
        </Text>

        <Flex justify="space-between" align={{ base: 'stretch', sm: 'center' }} gap={3} direction={{ base: 'column', sm: 'row' }}>
          <HStack gap={1} flexWrap="wrap">
            {REACTION_TYPES.map(({ type, emoji }) => {
              const reactedUsers = submission.reactions?.[type] || []
              const hasReacted = currentUserId ? reactedUsers.includes(currentUserId) : false
              const count = reactedUsers.length

              return (
                <Button
                  key={type}
                  size="xs"
                  px={2}
                  bg={hasReacted ? 'green.500' : 'whiteAlpha.100'}
                  color="white"
                  borderRadius="full"
                  _hover={{ bg: hasReacted ? 'green.600' : 'whiteAlpha.200' }}
                  onClick={() => onReact(submission.id, type)}
                >
                  {emoji} {count > 0 && count}
                </Button>
              )
            })}
          </HStack>

          <SubmissionVoteButtons
            submission={submission}
            currentUserId={currentUserId}
            onVote={(vote) => onVote(submission, vote)}
            compact
          />
        </Flex>
      </Box>
    </MotionBox>
  )
}

export default function QuestDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [showSubmitForm, setShowSubmitForm] = useState(false)
  const [submissionContent, setSubmissionContent] = useState('')
  const [submissionTitle, setSubmissionTitle] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [failedQuestImages, setFailedQuestImages] = useState<Record<string, true>>({})
  const [awardedBadges] = useState<PassportBadge[]>([])
  const [showAwardModal, setShowAwardModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch quest from Firebase
  const { data: quest, loading: questLoading, error: questError } = useDocument('quests', id)

  // Fetch submissions for this quest
  const {
    data: rawSubmissions,
    loading: submissionsLoading,
    error: submissionsError,
    refetch: refetchSubmissions,
  } = useCollection('questSubmissions', {
    where: [{ field: 'questId', operator: '==', value: id || '' }],
    skip: !id,
  })
  const submissions = useMemo(
    () => [...rawSubmissions].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)),
    [rawSubmissions]
  )
  const questImageCandidates = useMemo(() => (quest ? getQuestImageCandidates(quest) : []), [quest])
  const questImage = questImageCandidates.find((candidate) => !failedQuestImages[candidate])

  const { create: createSubmission } = useMutation('questSubmissions')

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setSelectedFiles(files)
  }, [])

  const handleSubmit = async () => {
    if (!user || !quest || !id) return
    if (!submissionContent.trim() && selectedFiles.length === 0) {
      setSubmitError('Please add content or upload media')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      let mediaUrls: string[] = []
      let thumbnailUrl: string | undefined

      // Upload files if any
      if (selectedFiles.length > 0) {
        const uploadResult = await uploadMultiple(selectedFiles, `${STORAGE_PATHS.QUESTS}/${id}`, { compress: true })
        if (uploadResult.success) {
          mediaUrls = uploadResult.urls
          thumbnailUrl = mediaUrls[0]
        } else {
          const failedUpload = uploadResult.results.find((result) => !result.success)
          throw new Error(
            failedUpload?.error?.message ||
              uploadResult.error?.message ||
              'Failed to upload files'
          )
        }
      }

      // Create submission
      const result = await createSubmission({
        questId: id,
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userPhotoURL: user.photoURL || undefined,
        title: submissionTitle.trim() || undefined,
        content: submissionContent.trim(),
        mediaUrls,
        mediaType: selectedFiles.length > 0 ? 'image' : 'document',
        thumbnailUrl,
        reactions: {},
        reactionsCount: 0,
        commentsCount: 0,
        upvotes: [],
        downvotes: [],
        upvotesCount: 0,
        downvotesCount: 0,
        voteScore: 0,
        featured: false,
        approved: false,
        showOnWall: true,
        pointsAwarded: 0,
        questTitle: quest.title,
      })

      if (result.success) {
        // Reset form
        setShowSubmitForm(false)
        setSubmissionContent('')
        setSubmissionTitle('')
        setSelectedFiles([])
        // The server-side quest engine evaluates progress and grants rewards.
        refetchSubmissions()
      } else {
        throw new Error(result.error?.message || 'Failed to create submission')
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReaction = async (submissionId: string, reactionType: ReactionType) => {
    if (!user) return

    const submission = submissions.find(s => s.id === submissionId)
    if (!submission) return

    const reactedUsers = submission.reactions?.[reactionType] || []
    const hasReacted = reactedUsers.includes(user.uid)

    if (hasReacted) {
      await removeFromArray('questSubmissions', submissionId, `reactions.${reactionType}`, user.uid)
      await incrementField('questSubmissions', submissionId, 'reactionsCount', -1)
    } else {
      await addToArray('questSubmissions', submissionId, `reactions.${reactionType}`, user.uid)
      await incrementField('questSubmissions', submissionId, 'reactionsCount', 1)
    }

    refetchSubmissions()
  }

  const handleSubmissionVote = async (submission: QuestSubmission, vote: SubmissionVoteValue) => {
    if (!user) return

    const result = await updateQuestSubmissionVote(submission.id, user.uid, vote)
    if (!result.success) {
      console.error('Failed to update submission vote:', result.error)
      return
    }

    refetchSubmissions()
  }

  if (questLoading) {
    return (
      <Box bg="gray.950" minH="100vh">
        <Header />
        <Center h="60vh">
          <Spinner size="xl" color="green.500" />
        </Center>
        <Footer />
      </Box>
    )
  }

  if (questError || !quest) {
    return (
      <Box bg="gray.950" minH="100vh">
        <Header />
        <Center h="60vh">
          <VStack gap={4}>
            <Text color="red.400" fontSize="xl">Quest not found</Text>
            <Link to="/quests">
              <Button colorScheme="green">Back to Quests</Button>
            </Link>
          </VStack>
        </Center>
        <Footer />
      </Box>
    )
  }

  const difficultyColor = {
    beginner: 'green',
    intermediate: 'blue',
    advanced: 'orange',
    any: 'purple',
  }[quest.difficulty] || 'green'

  return (
    <Box bg="gray.950" minH="100vh">
      <Header />

      <Box as="main" pt={{ base: 24, md: 32 }} pb={{ base: 32, md: 20 }} overflowX="hidden">
        <Container maxW="1440px" px={{ base: 4, md: 12, lg: 16, xl: 20 }}>
          {/* Hero */}
          <MotionBox
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            mb={{ base: 10, md: 16 }}
          >
            <Grid
              templateColumns={{ base: '1fr', lg: questImage ? 'minmax(0, 1fr) minmax(420px, 0.9fr)' : '1fr' }}
              gap={{ base: 8, md: 10, lg: 14 }}
              alignItems="center"
            >
              <Box minW={0}>
                <HStack gap={3} mb={{ base: 4, md: 6 }} flexWrap="wrap">
                  <Badge
                    bg="green.500"
                    color="white"
                    px={3}
                    py={1}
                    borderRadius="full"
                    fontSize="sm"
                    textTransform="capitalize"
                  >
                    {quest.category.replace('_', ' ')}
                  </Badge>
                  <Badge
                    bg={`${difficultyColor}.500`}
                    color="white"
                    px={3}
                    py={1}
                    borderRadius="full"
                    fontSize="sm"
                    textTransform="capitalize"
                  >
                    {quest.difficulty}
                  </Badge>
                </HStack>

                <Heading
                  as="h1"
                  fontSize={{ base: '2.35rem', md: '4rem', lg: '5rem' }}
                  lineHeight={1.1}
                  color="white"
                  fontFamily="heading"
                  mb={{ base: 4, md: 6 }}
                  overflowWrap="anywhere"
                >
                  {quest.title}
                </Heading>

                <Text color="whiteAlpha.600" fontSize={{ base: 'md', md: 'xl' }} maxW="2xl" mb={{ base: 6, md: 8 }} lineHeight="tall">
                  {quest.description}
                </Text>

                <Flex direction={{ base: 'column', sm: 'row' }} gap={{ base: 4, sm: 6 }} align={{ base: 'stretch', sm: 'center' }}>
                  <Button
                    bg="green.500"
                    color="white"
                    px={8}
                    py={6}
                    borderRadius="full"
                    fontSize="md"
                    fontWeight="medium"
                    w={{ base: 'full', sm: 'auto' }}
                    _hover={{ bg: 'green.600' }}
                    onClick={() => {
                      if (!user) {
                        window.location.href = '/auth/login'
                      } else {
                        setShowSubmitForm(true)
                      }
                    }}
                  >
                    {user ? 'Submit Response' : 'Sign in to Submit'}
                  </Button>
                  <HStack gap={6} justify={{ base: 'space-between', sm: 'flex-start' }}>
                    <Text color="whiteAlpha.500">
                      <Text as="span" color="white" fontWeight="bold">
                        {quest.submissionCount}
                      </Text>{' '}
                      submissions
                    </Text>
                    <Text color="green.400" fontWeight="medium">
                      {quest.points} pts
                    </Text>
                  </HStack>
                </Flex>
              </Box>

              {questImage && (
                <Box
                  minW={0}
                  p={{ base: 2, md: 3 }}
                  bg="gray.900"
                  border="1px solid"
                  borderColor="whiteAlpha.200"
                  borderRadius={{ base: 'xl', md: '2xl' }}
                  overflow="hidden"
                  boxShadow="0 24px 70px rgba(0, 0, 0, 0.32)"
                >
                  <Image
                    src={questImage}
                    alt={`${quest.title} quest artwork`}
                    display="block"
                    w="full"
                    h="auto"
                    maxH={{ base: '70vh', lg: '560px' }}
                    objectFit="contain"
                    borderRadius={{ base: 'lg', md: 'xl' }}
                    bg="black"
                    onError={() => setFailedQuestImages((current) => ({ ...current, [questImage]: true }))}
                  />
                </Box>
              )}
            </Grid>
          </MotionBox>

          {/* Instructions & Sidebar */}
          <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={{ base: 5, lg: 12 }} mb={{ base: 12, md: 20 }}>
            {/* Instructions / Description */}
            <MotionBox
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              p={{ base: 5, md: 8 }}
              borderRadius="2xl"
              bg="gray.900"
              border="1px solid"
              borderColor="whiteAlpha.100"
              minW={0}
              overflow="hidden"
            >
              <Heading as="h2" fontSize={{ base: 'lg', md: 'xl' }} color="white" fontFamily="heading" mb={{ base: 4, md: 6 }}>
                About This Quest
              </Heading>
              <Text color="whiteAlpha.700" whiteSpace="pre-wrap" lineHeight="tall" fontSize={{ base: 'sm', md: 'md' }}>
                {quest.description}
              </Text>

              {quest.inspirationLinks && quest.inspirationLinks.length > 0 && (
                <Box mt={6}>
                  <Text color="green.400" fontSize="sm" fontWeight="medium" mb={3}>
                    Inspiration Links
                  </Text>
                  <VStack align="stretch" gap={2}>
                    {quest.inspirationLinks.map((link, i) => (
                      <InspirationLink key={`${link}-${i}`} link={link} index={i} />
                    ))}
                  </VStack>
                </Box>
              )}
            </MotionBox>

            {/* Sidebar */}
            <VStack align="stretch" gap={{ base: 5, md: 6 }} minW={0}>
              {/* Constraints */}
              {quest.constraints && quest.constraints.length > 0 && (
                <MotionBox
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  p={{ base: 5, md: 6 }}
                  borderRadius="2xl"
                  bg="gray.900"
                  border="1px solid"
                  borderColor="whiteAlpha.100"
                  minW={0}
                >
                  <Text
                    color="green.400"
                    fontSize="xs"
                    textTransform="uppercase"
                    letterSpacing="wider"
                    mb={4}
                  >
                    Constraints
                  </Text>
                  <VStack align="stretch" gap={3}>
                    {quest.constraints.map((constraint, i) => (
                      <HStack key={i} gap={3} align="flex-start">
                        <Box w={2} h={2} borderRadius="full" bg={constraint.required ? 'red.400' : 'green.400'} flexShrink={0} mt={2} />
                        <Box minW={0}>
                          <Text color="white" fontSize="sm">
                            {constraint.description}
                          </Text>
                          <Badge
                            size="sm"
                            mt={2}
                            bg={constraint.required ? 'red.500/15' : 'whiteAlpha.100'}
                            color={constraint.required ? 'red.200' : 'whiteAlpha.700'}
                            borderRadius="full"
                            px={2}
                          >
                            {constraint.required ? 'Required' : 'Optional'}
                          </Badge>
                        </Box>
                      </HStack>
                    ))}
                  </VStack>
                </MotionBox>
              )}

              {/* Tags */}
              {quest.tags && quest.tags.length > 0 && (
                <MotionBox
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  p={{ base: 5, md: 6 }}
                  borderRadius="2xl"
                  bg="gray.900"
                  border="1px solid"
                  borderColor="whiteAlpha.100"
                  minW={0}
                >
                  <Text
                    color="green.400"
                    fontSize="xs"
                    textTransform="uppercase"
                    letterSpacing="wider"
                    mb={4}
                  >
                    Tags
                  </Text>
                  <HStack gap={2} flexWrap="wrap">
                    {quest.tags.map((tag) => (
                      <Badge
                        key={tag}
                        bg="whiteAlpha.100"
                        color="whiteAlpha.700"
                        px={3}
                        py={1}
                        borderRadius="full"
                        fontSize="sm"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </HStack>
                </MotionBox>
              )}

              {/* Estimated Time */}
              {quest.estimatedTime && (
                <MotionBox
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                  p={{ base: 5, md: 6 }}
                  borderRadius="2xl"
                  bg="gray.900"
                  border="1px solid"
                  borderColor="whiteAlpha.100"
                  minW={0}
                >
                  <Text
                    color="green.400"
                    fontSize="xs"
                    textTransform="uppercase"
                    letterSpacing="wider"
                    mb={2}
                  >
                    Estimated Time
                  </Text>
                  <Text color="white" fontSize="2xl" fontFamily="heading">
                    {quest.estimatedTime}
                  </Text>
                </MotionBox>
              )}
            </VStack>
          </Grid>

          {/* Community Submissions */}
          <MotionBox
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <Flex justify="space-between" align={{ base: 'flex-start', sm: 'center' }} gap={3} mb={{ base: 5, md: 8 }} direction={{ base: 'column', sm: 'row' }}>
              <Heading as="h2" fontSize={{ base: 'xl', md: '2xl' }} color="white" fontFamily="heading">
                Community Submissions
              </Heading>
              <Text color="whiteAlpha.500">{quest.submissionCount} total</Text>
            </Flex>

            {submissionsError ? (
              <Box
                p={5}
                borderRadius="xl"
                bg="red.500/10"
                border="1px solid"
                borderColor="red.500/30"
                mb={8}
              >
                <Text color="red.200" fontWeight="medium" mb={1}>
                  Could not load submissions
                </Text>
                <Text color="red.100" fontSize="sm">
                  {submissionsError.message}
                </Text>
              </Box>
            ) : submissionsLoading ? (
              <Center py={12}>
                <Spinner size="lg" color="green.500" />
              </Center>
            ) : submissions.length > 0 ? (
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6} mb={12}>
                {submissions.map((submission, i) => (
                  <MotionBox
                    key={submission.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <SubmissionCard
                      submission={submission}
                      currentUserId={user?.uid || null}
                      onReact={handleReaction}
                      onVote={handleSubmissionVote}
                    />
                  </MotionBox>
                ))}
              </SimpleGrid>
            ) : (
              <Box textAlign="center" py={12}>
                <Text color="whiteAlpha.500" fontSize="lg" mb={4}>
                  No submissions yet. Be the first!
                </Text>
                {user && (
                  <Button
                    bg="green.500"
                    color="white"
                    h="52px"
                    px={{ base: 6, sm: 8 }}
                    gap={2.5}
                    borderRadius="full"
                    border="1px solid"
                    borderColor="green.400"
                    fontSize="md"
                    fontWeight="semibold"
                    letterSpacing="-0.01em"
                    boxShadow="0 10px 30px rgba(34, 197, 94, 0.2)"
                    transition="transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease"
                    _hover={{
                      bg: 'green.400',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 14px 34px rgba(34, 197, 94, 0.3)',
                    }}
                    _active={{ bg: 'green.600', transform: 'translateY(0)' }}
                    _focusVisible={{ outline: '2px solid', outlineColor: 'green.200', outlineOffset: '3px' }}
                    onClick={() => setShowSubmitForm(true)}
                  >
                    <Send size={17} />
                    Submit Your Response
                  </Button>
                )}
              </Box>
            )}
          </MotionBox>
        </Container>
      </Box>

      <Footer />

      <AnimatePresence>
        {showAwardModal && (
          <Box position="fixed" inset={0} zIndex={120} display="flex" alignItems="center" justifyContent="center" p={4}>
            <MotionBox
              position="absolute"
              inset={0}
              bg="blackAlpha.800"
              backdropFilter="blur(8px)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAwardModal(false)}
            />
            <MotionBox
              position="relative"
              zIndex={10}
              w="full"
              maxW="520px"
              p={{ base: 6, md: 8 }}
              borderRadius="2xl"
              bg="gray.900"
              border="1px solid"
              borderColor="green.400/40"
              boxShadow="0 24px 80px rgba(72, 187, 120, 0.18)"
              textAlign="center"
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.25 }}
            >
              <Box
                w={20}
                h={20}
                mx="auto"
                mb={5}
                borderRadius="full"
                bg="green.500/18"
                color="green.200"
                border="1px solid"
                borderColor="green.300/40"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontSize="3xl"
                fontWeight="bold"
              >
                ★
              </Box>
              <Text color="green.300" fontSize="sm" fontWeight="bold" textTransform="uppercase" letterSpacing="0.12em" mb={2}>
                Quest Complete
              </Text>
              <Heading as="h2" color="white" fontSize={{ base: '2xl', md: '3xl' }} mb={3}>
                Badge Earned
              </Heading>
              <Text color="whiteAlpha.600" fontSize="sm" mb={6}>
                Your Creative Passport has been updated.
              </Text>

              <VStack align="stretch" gap={3} mb={7}>
                {awardedBadges.map((badge) => {
                  const visual = getBadgeVisual(badge.id)

                  return (
                    <HStack key={badge.id} gap={4} p={4} borderRadius="xl" bg="whiteAlpha.50" textAlign="left">
                      <Box
                        w={12}
                        h={12}
                        borderRadius="full"
                        bg={visual.bg}
                        color={visual.color}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        fontSize="xl"
                        fontWeight="bold"
                        flexShrink={0}
                      >
                        {visual.icon}
                      </Box>
                      <Box minW={0}>
                        <Text color="white" fontWeight="bold">{badge.name}</Text>
                        <Text color="whiteAlpha.600" fontSize="sm" lineClamp={2}>{badge.description}</Text>
                      </Box>
                    </HStack>
                  )
                })}
              </VStack>

              <HStack gap={3} justify="center" flexWrap="wrap">
                <Link to="/passport">
                  <Button bg="green.500" color="white" borderRadius="full" px={6} _hover={{ bg: 'green.600' }}>
                    View Passport
                  </Button>
                </Link>
                <Button
                  bg="transparent"
                  color="white"
                  border="1px solid"
                  borderColor="whiteAlpha.300"
                  borderRadius="full"
                  px={6}
                  _hover={{ bg: 'whiteAlpha.100' }}
                  onClick={() => setShowAwardModal(false)}
                >
                  Continue
                </Button>
              </HStack>
            </MotionBox>
          </Box>
        )}
      </AnimatePresence>

      {/* Submit Modal */}
      {showSubmitForm && (
        <Box position="fixed" inset={0} zIndex={100} display="flex" alignItems="center" justifyContent="center" p={4}>
          <Box
            position="absolute"
            inset={0}
            bg="blackAlpha.800"
            backdropFilter="blur(4px)"
            onClick={() => setShowSubmitForm(false)}
          />
          <MotionBox
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            position="relative"
            zIndex={10}
            w="full"
            maxW="xl"
            p={8}
            borderRadius="2xl"
            bg="gray.900"
            border="1px solid"
            borderColor="whiteAlpha.100"
          >
            <Heading as="h2" fontSize="2xl" color="white" fontFamily="heading" mb={6}>
              Submit Your Response
            </Heading>

            {submitError && (
              <Box mb={4} p={3} borderRadius="lg" bg="red.900" border="1px solid" borderColor="red.500">
                <Text color="red.200" fontSize="sm">{submitError}</Text>
              </Box>
            )}

            <VStack align="stretch" gap={4}>
              <Box>
                <Text color="whiteAlpha.600" fontSize="sm" mb={2}>
                  Title (optional)
                </Text>
                <input
                  type="text"
                  placeholder="Give your submission a title"
                  value={submissionTitle}
                  onChange={(e) => setSubmissionTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: '#1a1a2e',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'white',
                    outline: 'none',
                  }}
                />
              </Box>

              <Box>
                <Text color="whiteAlpha.600" fontSize="sm" mb={2}>
                  Upload your work
                </Text>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*,video/*"
                  multiple
                  style={{ display: 'none' }}
                />
                <Box
                  p={8}
                  borderRadius="xl"
                  border="2px dashed"
                  borderColor={selectedFiles.length > 0 ? 'green.500' : 'whiteAlpha.200'}
                  textAlign="center"
                  cursor="pointer"
                  _hover={{ borderColor: 'green.500' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {selectedFiles.length > 0 ? (
                    <Text color="green.400">{selectedFiles.length} file(s) selected</Text>
                  ) : (
                    <Text color="whiteAlpha.400">Click to upload or drag and drop</Text>
                  )}
                </Box>
              </Box>

              <Box>
                <Text color="whiteAlpha.600" fontSize="sm" mb={2}>
                  Add a caption
                </Text>
                <Textarea
                  placeholder="Share your experience, process, or thoughts..."
                  value={submissionContent}
                  onChange={(e) => setSubmissionContent(e.target.value)}
                  bg="gray.800"
                  border="1px solid"
                  borderColor="whiteAlpha.200"
                  color="white"
                  _placeholder={{ color: 'whiteAlpha.400' }}
                  _focus={{ borderColor: 'green.500' }}
                  rows={4}
                />
              </Box>

              <HStack gap={4} pt={4}>
                <Button
                  flex={1}
                  bg="green.500"
                  color="white"
                  borderRadius="full"
                  _hover={{ bg: 'green.600' }}
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Spinner size="sm" /> : 'Submit'}
                </Button>
                <Button
                  flex={1}
                  bg="transparent"
                  color="white"
                  border="1px solid"
                  borderColor="whiteAlpha.300"
                  borderRadius="full"
                  _hover={{ bg: 'whiteAlpha.50' }}
                  onClick={() => setShowSubmitForm(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </HStack>
            </VStack>
          </MotionBox>
        </Box>
      )}
    </Box>
  )
}
