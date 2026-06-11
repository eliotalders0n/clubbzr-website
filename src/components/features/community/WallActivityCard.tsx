'use client'

import { Link as RouterLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import {
  AspectRatio,
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Image,
  Text,
  VStack,
} from '@chakra-ui/react'
import { Award, CalendarDays, CheckCircle2, ExternalLink, Trophy } from 'lucide-react'

import { SubmissionVoteButtons, type SubmissionVoteValue } from '@/components/features/quests'
import { getBadgeVisual } from '../../../../lib/badges'
import type { Badge as PassportBadge, Exhibition, Quest, QuestSubmission } from '../../../../lib/schema'

type ActivityTimestamp = QuestSubmission['createdAt'] | Exhibition['createdAt'] | Exhibition['startDate']

export type WallActivityItem =
  | {
      type: 'quest_completed'
      id: string
      timestamp: number
      submission: QuestSubmission
      quest?: Quest
    }
  | {
      type: 'badge_earned'
      id: string
      timestamp: number
      submission: QuestSubmission
      quest?: Quest
      badge: PassportBadge
    }
  | {
      type: 'exhibition'
      id: string
      timestamp: number
      exhibition: Exhibition
      status: 'upcoming' | 'active'
    }

interface WallActivityCardProps {
  item: WallActivityItem
  currentUserId?: string | null
  onSubmissionVote: (submission: QuestSubmission, vote: SubmissionVoteValue) => void | Promise<void>
}

const getInitial = (name?: string) => (name?.trim()?.charAt(0) || '?').toUpperCase()

const formatRelative = (timestamp: ActivityTimestamp | undefined): string => {
  if (!timestamp) return 'Recently'

  const date =
    typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp && typeof timestamp.toDate === 'function'
      ? timestamp.toDate()
      : undefined

  if (!date) return 'Recently'

  const diffMs = Date.now() - date.getTime()
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const formatDateRange = (start: ActivityTimestamp, end?: ActivityTimestamp) => {
  const startDate =
    typeof start === 'object' && start !== null && 'toDate' in start && typeof start.toDate === 'function'
      ? start.toDate()
      : undefined
  const endDate =
    typeof end === 'object' && end !== null && 'toDate' in end && typeof end.toDate === 'function'
      ? end.toDate()
      : undefined

  if (!startDate) return 'Dates to be announced'

  const format = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return endDate ? `${format(startDate)} - ${format(endDate)}` : format(startDate)
}

const Avatar = ({ name, photoURL }: { name?: string; photoURL?: string }) => (
  <Box
    w={11}
    h={11}
    borderRadius="full"
    overflow="hidden"
    bg="brand.500"
    flexShrink={0}
    display="flex"
    alignItems="center"
    justifyContent="center"
  >
    {photoURL ? (
      <Image src={photoURL} alt={name || 'Member'} w="full" h="full" objectFit="cover" />
    ) : (
      <Text color="white" fontWeight="bold">
        {getInitial(name)}
      </Text>
    )}
  </Box>
)

const CardShell = ({ children }: { children: ReactNode }) => (
  <Box
    borderRadius="2xl"
    bg="gray.900"
    border="1px solid"
    borderColor="whiteAlpha.100"
    overflow="hidden"
    _hover={{ borderColor: 'whiteAlpha.200', bg: 'whiteAlpha.50' }}
    transition="border-color 0.2s ease, background 0.2s ease"
  >
    {children}
  </Box>
)

export function WallActivityCard({ item, currentUserId, onSubmissionVote }: WallActivityCardProps) {
  if (item.type === 'badge_earned') {
    const visual = getBadgeVisual(item.badge.id)

    return (
      <CardShell>
        <Flex p={{ base: 4, md: 5 }} gap={4} align="center">
          <Box
            w={{ base: 14, md: 16 }}
            h={{ base: 14, md: 16 }}
            borderRadius="2xl"
            bg={visual.bg}
            color={visual.color}
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontSize="2xl"
            fontWeight="bold"
            flexShrink={0}
          >
            {visual.icon}
          </Box>
          <Box minW={0} flex={1}>
            <HStack gap={2} mb={1} color="brand.300">
              <Award size={16} />
              <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="0.14em">
                Badge earned
              </Text>
            </HStack>
            <Text color="white" fontSize={{ base: 'md', md: 'lg' }} fontWeight="bold" lineClamp={2}>
              {item.submission.userName} earned {item.badge.name}
            </Text>
            <Text color="whiteAlpha.500" fontSize="sm" lineClamp={2}>
              {item.badge.description}
            </Text>
          </Box>
          <Text color="whiteAlpha.400" fontSize="xs" flexShrink={0}>
            {formatRelative(item.submission.createdAt)}
          </Text>
        </Flex>
      </CardShell>
    )
  }

  if (item.type === 'exhibition') {
    const exhibition = item.exhibition
    const firstArtwork = exhibition.artworks?.[0]
    const cover = exhibition.coverImage || firstArtwork?.thumbnailUrl || firstArtwork?.mediaUrls?.[0]

    return (
      <CardShell>
        <Flex direction={{ base: 'column', sm: 'row' }}>
          {cover && (
            <Box
              w={{ base: 'full', sm: '180px' }}
              aspectRatio={{ base: '16 / 10', sm: '4 / 5' }}
              overflow="hidden"
              flexShrink={0}
            >
              <Image src={cover} alt={exhibition.title} w="full" h="full" objectFit="cover" />
            </Box>
          )}
          <VStack align="stretch" gap={4} p={{ base: 4, md: 5 }} flex={1}>
            <Flex justify="space-between" align="start" gap={3}>
              <Box>
                <HStack gap={2} color={item.status === 'upcoming' ? 'blue.300' : 'green.300'} mb={2}>
                  <CalendarDays size={16} />
                  <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="0.14em">
                    {item.status === 'upcoming' ? 'Upcoming exhibition' : 'Now showing'}
                  </Text>
                </HStack>
                <Text color="white" fontSize={{ base: 'lg', md: 'xl' }} fontWeight="bold" lineClamp={2}>
                  {exhibition.title}
                </Text>
              </Box>
              <Badge bg="whiteAlpha.100" color="whiteAlpha.700" borderRadius="full" px={3}>
                {exhibition.isOnline === false ? 'Physical' : 'Online'}
              </Badge>
            </Flex>
            <Text color="whiteAlpha.600" fontSize="sm" lineClamp={3}>
              {exhibition.description}
            </Text>
            <Flex justify="space-between" align={{ base: 'stretch', sm: 'center' }} gap={3} direction={{ base: 'column', sm: 'row' }}>
              <Text color="whiteAlpha.500" fontSize="sm">
                {formatDateRange(exhibition.startDate, exhibition.endDate)}
              </Text>
              <RouterLink to={`/exhibitions/${exhibition.id}`}>
                <Button
                  size="sm"
                  borderRadius="full"
                  bg="brand.500"
                  color="white"
                  w={{ base: 'full', sm: 'auto' }}
                  _hover={{ bg: 'brand.600' }}
                >
                  View Exhibition
                  <ExternalLink size={15} />
                </Button>
              </RouterLink>
            </Flex>
          </VStack>
        </Flex>
      </CardShell>
    )
  }

  const { submission, quest } = item
  const mediaUrl = submission.thumbnailUrl || submission.mediaUrls?.[0]
  const questTitle = quest?.title || submission.questTitle || 'a side quest'

  return (
    <CardShell>
      <VStack align="stretch" gap={0}>
        {mediaUrl && (
          <AspectRatio ratio={16 / 10} bg="black">
            <Image src={mediaUrl} alt={submission.title || questTitle} objectFit="cover" />
          </AspectRatio>
        )}

        <VStack align="stretch" gap={4} p={{ base: 4, md: 5 }}>
          <Flex justify="space-between" gap={4} align="start">
            <HStack gap={3} minW={0}>
              <Avatar name={submission.userName} photoURL={submission.userPhotoURL} />
              <Box minW={0}>
                <HStack gap={2} color="green.300" mb={1}>
                  <CheckCircle2 size={15} />
                  <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="0.14em">
                    Quest completed
                  </Text>
                </HStack>
                <Text color="white" fontWeight="bold" lineClamp={1}>
                  {submission.userName}
                </Text>
              </Box>
            </HStack>
            <Text color="whiteAlpha.400" fontSize="xs" flexShrink={0}>
              {formatRelative(submission.createdAt)}
            </Text>
          </Flex>

          <Box>
            <Text color="whiteAlpha.500" fontSize="sm" mb={1}>
              completed{' '}
              <RouterLink to={`/quests/${submission.questId}`}>
                <Text as="span" color="brand.300" fontWeight="bold">
                  {questTitle}
                </Text>
              </RouterLink>
            </Text>
            {submission.title && (
              <Text color="white" fontSize={{ base: 'lg', md: 'xl' }} fontWeight="bold" lineClamp={2}>
                {submission.title}
              </Text>
            )}
            <Text color="whiteAlpha.600" fontSize="sm" mt={2} lineClamp={3}>
              {submission.content}
            </Text>
          </Box>

          <Flex
            justify="space-between"
            align={{ base: 'stretch', sm: 'center' }}
            gap={3}
            direction={{ base: 'column', sm: 'row' }}
          >
            <HStack gap={2} color="green.300">
              <Trophy size={16} />
              <Text fontSize="sm" fontWeight="bold">
                {submission.pointsAwarded || quest?.points || 0} pts
              </Text>
            </HStack>
            <SubmissionVoteButtons
              submission={submission}
              currentUserId={currentUserId}
              onVote={(vote) => onSubmissionVote(submission, vote)}
              compact
            />
          </Flex>
        </VStack>
      </VStack>
    </CardShell>
  )
}
