'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  HStack,
  SimpleGrid,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Gauge,
  Megaphone,
  Target,
  UsersRound,
} from 'lucide-react'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { useCollection } from '@/hooks'
import {
  getAdminPaymentsDashboard,
  type AdminPaymentDashboard,
} from '../../../lib/adminPayments'
import type {
  ArtLocation,
  CommunityPost,
  Exhibition,
  Quest,
  QuestSubmission,
  RadioContent,
  Session,
  SessionRegistration,
  User,
} from '../../../lib/schema'

const MotionBox = motion.create(Box)

type DateRangeKey = '7d' | '30d' | '90d' | 'all'
type Tone = 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'cyan' | 'yellow'
type SessionRisk = 'low_fill' | 'payment_backlog' | 'near_capacity' | 'waitlist_pressure' | 'healthy'
type QuestSignal = 'promote' | 'review' | 'ending' | 'healthy'

interface RangeOption {
  key: DateRangeKey
  label: string
  days?: number
}

interface DetailMetric {
  label: string
  value: string
}

interface ExecutiveMetric {
  title: string
  value: string
  subtitle: string
  details: DetailMetric[]
  tone: Tone
  icon: ReactNode
  href: string
  actionLabel: string
  trend?: string
  trendTone?: 'positive' | 'negative' | 'neutral'
}

interface SessionForecastRow {
  id: string
  title: string
  dateLabel: string
  confirmed: number
  capacity: number
  fillRate: number
  waitlist: number
  pending: number
  revenue: number
  risk: SessionRisk
  riskLabel: string
}

interface QuestPerformanceRow {
  id: string
  title: string
  submissions: number
  approved: number
  pending: number
  engagement: number
  daysLabel: string
  signal: QuestSignal
  signalLabel: string
}

interface SurfaceRow {
  id: string
  label: string
  value: number
  helper: string
  href: string
  tone: Tone
}

interface AttentionItem {
  id: string
  title: string
  detail: string
  count: number
  href: string
  actionLabel: string
  tone: Tone
}

interface GrowthPoint {
  month: string
  users: number
  active: number
}

const rangeOptions: RangeOption[] = [
  { key: '7d', label: '7d', days: 7 },
  { key: '30d', label: '30d', days: 30 },
  { key: '90d', label: '90d', days: 90 },
  { key: 'all', label: 'All' },
]

const toneStyles: Record<Tone, { bg: string; border: string; text: string; softBg: string }> = {
  blue: {
    bg: 'blue.500',
    border: 'blue.500/30',
    text: 'blue.300',
    softBg: 'blue.500/12',
  },
  green: {
    bg: 'green.500',
    border: 'green.500/30',
    text: 'green.300',
    softBg: 'green.500/12',
  },
  orange: {
    bg: 'brand.500',
    border: 'brand.500/35',
    text: 'brand.400',
    softBg: 'brand.500/12',
  },
  purple: {
    bg: 'purple.500',
    border: 'purple.500/30',
    text: 'purple.300',
    softBg: 'purple.500/12',
  },
  red: {
    bg: 'red.500',
    border: 'red.500/35',
    text: 'red.300',
    softBg: 'red.500/12',
  },
  cyan: {
    bg: 'cyan.500',
    border: 'cyan.500/30',
    text: 'cyan.300',
    softBg: 'cyan.500/12',
  },
  yellow: {
    bg: 'yellow.500',
    border: 'yellow.500/30',
    text: 'yellow.300',
    softBg: 'yellow.500/12',
  },
}

const sessionRiskStyles: Record<SessionRisk, { label: string; tone: Tone; priority: number }> = {
  low_fill: { label: 'Low fill', tone: 'red', priority: 1 },
  payment_backlog: { label: 'Payment backlog', tone: 'orange', priority: 2 },
  near_capacity: { label: 'Near capacity', tone: 'yellow', priority: 3 },
  waitlist_pressure: { label: 'Waitlist pressure', tone: 'purple', priority: 4 },
  healthy: { label: 'Healthy', tone: 'green', priority: 5 },
}

const questSignalStyles: Record<QuestSignal, { label: string; tone: Tone; priority: number }> = {
  promote: { label: 'Promote', tone: 'orange', priority: 1 },
  review: { label: 'Review work', tone: 'red', priority: 2 },
  ending: { label: 'Ending soon', tone: 'yellow', priority: 3 },
  healthy: { label: 'Healthy', tone: 'green', priority: 4 },
}

const moneyFormatter = new Intl.NumberFormat('en-ZM', {
  style: 'currency',
  currency: 'ZMW',
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat('en-US')
const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const dayMs = 86_400_000

const toDate = (value: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value === 'object') {
    const maybeTimestamp = value as { toDate?: () => Date; seconds?: number }
    if (typeof maybeTimestamp.toDate === 'function') return maybeTimestamp.toDate()
    if (typeof maybeTimestamp.seconds === 'number') return new Date(maybeTimestamp.seconds * 1000)
  }
  return null
}

const toMillis = (value: unknown): number => toDate(value)?.getTime() || 0

const toNumber = (value: unknown): number => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

const formatCount = (value: number): string => numberFormatter.format(Math.round(value))

const formatCompact = (value: number): string => compactFormatter.format(Math.round(value))

const formatMoney = (value: number): string => moneyFormatter.format(Math.round(value))

const formatPercent = (value: number): string => `${Math.round(value)}%`

const getRangeStart = (range: DateRangeKey, now = new Date()): Date | null => {
  const option = rangeOptions.find((entry) => entry.key === range)
  if (!option?.days) return null
  return new Date(now.getTime() - option.days * dayMs)
}

const isInRange = (value: unknown, range: DateRangeKey, now = new Date()): boolean => {
  const date = toDate(value)
  if (!date) return false
  const start = getRangeStart(range, now)
  return start ? date >= start && date <= now : true
}

const isInPreviousRange = (value: unknown, range: DateRangeKey, now = new Date()): boolean => {
  const date = toDate(value)
  const option = rangeOptions.find((entry) => entry.key === range)
  if (!date || !option?.days) return false

  const currentStart = new Date(now.getTime() - option.days * dayMs)
  const previousStart = new Date(now.getTime() - option.days * 2 * dayMs)
  return date >= previousStart && date < currentStart
}

const formatTrend = (current: number, previous: number, range: DateRangeKey): string | undefined => {
  if (range === 'all') return undefined
  if (previous === 0 && current === 0) return '0%'
  if (previous === 0) return 'New'
  const change = ((current - previous) / previous) * 100
  const rounded = Math.round(change)
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

const getTrendTone = (current: number, previous: number): 'positive' | 'negative' | 'neutral' => {
  if (current > previous) return 'positive'
  if (current < previous) return 'negative'
  return 'neutral'
}

const getDateLabel = (value: unknown): string => {
  const date = toDate(value)
  if (!date) return 'No date'
  return date.toLocaleDateString('en-ZM', {
    month: 'short',
    day: 'numeric',
  })
}

const getDaysUntil = (value: unknown): number | null => {
  const date = toDate(value)
  if (!date) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / dayMs)
}

const formatDaysUntil = (value: unknown): string => {
  const days = getDaysUntil(value)
  if (days === null) return 'No deadline'
  if (days < 0) return `${Math.abs(days)}d past`
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `${days}d left`
}

const countBy = <T,>(items: T[], predicate: (item: T) => boolean): number =>
  items.filter(predicate).length

const sumBy = <T,>(items: T[], mapper: (item: T) => unknown): number =>
  items.reduce((sum, item) => sum + toNumber(mapper(item)), 0)

const getRegistrationStatusCounts = (registrations: SessionRegistration[]) => ({
  confirmed: countBy(registrations, (registration) => registration.status === 'confirmed'),
  waitlisted: countBy(registrations, (registration) => registration.status === 'waitlisted'),
  requested: countBy(registrations, (registration) => registration.status === 'requested'),
  pendingPayment: countBy(registrations, (registration) => registration.status === 'pending_payment'),
  paidPendingConfirmation: countBy(registrations, (registration) => registration.status === 'paid_pending_confirmation'),
  activeIntent: countBy(registrations, (registration) =>
    ['requested', 'pending_payment', 'paid_pending_confirmation', 'confirmed'].includes(registration.status)
  ),
})

const getRegistrationValue = (registration: SessionRegistration, session?: Session): number => {
  const recorded = toNumber(registration.paymentAmount)
  if (recorded > 0) return recorded
  return toNumber(session?.price)
}

const getSessionRisk = (
  session: Session,
  counts: ReturnType<typeof getRegistrationStatusCounts>,
  fillRate: number
): SessionRisk => {
  const daysUntil = getDaysUntil(session.date)
  if (daysUntil !== null && daysUntil <= 7 && fillRate < 40) return 'low_fill'
  if (counts.pendingPayment + counts.paidPendingConfirmation > 0) return 'payment_backlog'
  if (session.capacity > 0 && fillRate >= 90) return 'near_capacity'
  if (counts.waitlisted > 0) return 'waitlist_pressure'
  return 'healthy'
}

const getQuestSignal = (quest: Quest, submissions: QuestSubmission[]): QuestSignal => {
  const pending = countBy(submissions, (submission) => !submission.approved)
  const daysUntil = getDaysUntil(quest.endDate)

  if (pending > 0) return 'review'
  if (submissions.length === 0) return 'promote'
  if (daysUntil !== null && daysUntil <= 5 && daysUntil >= 0) return 'ending'
  return 'healthy'
}

const getSubmissionEngagement = (submission: QuestSubmission): number =>
  toNumber(submission.reactionsCount) +
  toNumber(submission.commentsCount) +
  toNumber(submission.upvotesCount) +
  toNumber(submission.downvotesCount)

const getPostEngagement = (post: CommunityPost): number =>
  toNumber(post.reactionsCount) + toNumber(post.commentsCount) + toNumber(post.shares)

const buildUserGrowth = (users: User[]): GrowthPoint[] => {
  const now = new Date()
  return Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1)
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999)
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)

    return {
      month: monthDate.toLocaleDateString('en-US', { month: 'short' }),
      users: countBy(users, (user) => {
        const createdAt = toDate(user.createdAt)
        return createdAt ? createdAt <= monthEnd : false
      }),
      active: countBy(users, (user) => {
        const activeAt = toDate(user.lastActiveAt)
        return activeAt ? activeAt >= monthStart && activeAt <= monthEnd : false
      }),
    }
  })
}

function ToneBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const style = toneStyles[tone]
  return (
    <Badge bg={style.softBg} color={style.text} border="1px solid" borderColor={style.border} borderRadius="full" px={2.5} py={1}>
      {children}
    </Badge>
  )
}

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Box bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="xl" overflow="hidden">
      <Flex px={5} py={4} justify="space-between" gap={4} align={{ base: 'flex-start', md: 'center' }} borderBottom="1px solid" borderColor="whiteAlpha.100" direction={{ base: 'column', md: 'row' }}>
        <Box>
          <Heading as="h2" fontSize="md" fontFamily="heading" fontWeight="semibold" color="white">
            {title}
          </Heading>
          {description && <Text color="whiteAlpha.500" fontSize="sm" mt={1}>{description}</Text>}
        </Box>
        {action}
      </Flex>
      <Box p={5}>{children}</Box>
    </Box>
  )
}

function ExecutiveCard({ metric, index }: { metric: ExecutiveMetric; index: number }) {
  const tone = toneStyles[metric.tone]
  const trendColor = metric.trendTone === 'negative'
    ? 'red.300'
    : metric.trendTone === 'positive'
      ? 'green.300'
      : 'whiteAlpha.500'

  return (
    <MotionBox initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
      <Link to={metric.href}>
        <Box h="full" bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="xl" p={5} _hover={{ borderColor: tone.border, bg: 'whiteAlpha.50' }} transition="all 0.2s">
          <Flex justify="space-between" gap={4} align="flex-start" mb={4}>
            <Flex w={11} h={11} align="center" justify="center" borderRadius="lg" bg={tone.softBg} color={tone.text} flexShrink={0}>
              {metric.icon}
            </Flex>
            {metric.trend && (
              <Badge bg="whiteAlpha.50" color={trendColor} border="1px solid" borderColor="whiteAlpha.100" borderRadius="full" px={2.5} py={1}>
                {metric.trend}
              </Badge>
            )}
          </Flex>

          <Text color="whiteAlpha.500" fontSize="xs" textTransform="uppercase" fontWeight="semibold" mb={1}>
            {metric.title}
          </Text>
          <Text fontSize="3xl" fontFamily="heading" color="white" fontWeight="bold" lineHeight="1">
            {metric.value}
          </Text>
          <Text color="whiteAlpha.600" fontSize="sm" mt={2} minH="40px">
            {metric.subtitle}
          </Text>

          <VStack align="stretch" gap={2.5} mt={5} pt={4} borderTop="1px solid" borderColor="whiteAlpha.100">
            {metric.details.map((detail) => (
              <Flex key={detail.label} justify="space-between" gap={3}>
                <Text color="whiteAlpha.500" fontSize="xs">{detail.label}</Text>
                <Text color="white" fontSize="xs" fontWeight="semibold">{detail.value}</Text>
              </Flex>
            ))}
          </VStack>

          <Flex align="center" gap={2} color={tone.text} fontSize="sm" fontWeight="semibold" mt={5}>
            <Text>{metric.actionLabel}</Text>
            <ArrowRight size={15} />
          </Flex>
        </Box>
      </Link>
    </MotionBox>
  )
}

function ProgressBar({ value, tone = 'orange' }: { value: number; tone?: Tone }) {
  const style = toneStyles[tone]
  const clamped = Math.max(0, Math.min(100, value))

  return (
    <Box h={2} bg="whiteAlpha.100" borderRadius="full" overflow="hidden">
      <Box h="full" w={`${clamped}%`} bg={style.bg} borderRadius="full" transition="width 0.2s" />
    </Box>
  )
}

function MiniBarChart({ data }: { data: GrowthPoint[] }) {
  const maxValue = Math.max(1, ...data.map((point) => Math.max(point.users, point.active)))

  return (
    <Flex h="190px" align="flex-end" gap={3}>
      {data.map((point, index) => (
        <Flex key={`${point.month}-${index}`} flex={1} direction="column" align="center" gap={2} minW={0}>
          <Flex h="150px" w="full" align="flex-end" gap={1.5}>
            <MotionBox
              flex={1}
              bg="brand.500"
              borderTopRadius="md"
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(6, (point.users / maxValue) * 100)}%` }}
              transition={{ delay: index * 0.05, duration: 0.35 }}
            />
            <MotionBox
              flex={1}
              bg="blue.400"
              borderTopRadius="md"
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(3, (point.active / maxValue) * 100)}%` }}
              transition={{ delay: 0.08 + index * 0.05, duration: 0.35 }}
            />
          </Flex>
          <Text color="whiteAlpha.500" fontSize="xs">{point.month}</Text>
        </Flex>
      ))}
    </Flex>
  )
}

function DataLine({
  label,
  value,
  helper,
  tone = 'orange',
}: {
  label: string
  value: string
  helper?: string
  tone?: Tone
}) {
  const style = toneStyles[tone]

  return (
    <Flex justify="space-between" gap={4} align="center" py={2.5} borderBottom="1px solid" borderColor="whiteAlpha.100" _last={{ borderBottom: 'none' }}>
      <Box minW={0}>
        <Text color="white" fontSize="sm" fontWeight="medium">{label}</Text>
        {helper && <Text color="whiteAlpha.500" fontSize="xs" mt={0.5}>{helper}</Text>}
      </Box>
      <Text color={style.text} fontSize="sm" fontWeight="bold" flexShrink={0}>{value}</Text>
    </Flex>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <Flex py={8} align="center" justify="center" color="whiteAlpha.500" textAlign="center">
      <Text fontSize="sm">{text}</Text>
    </Flex>
  )
}

export default function AdminDashboard() {
  const [dateRange, setDateRange] = useState<DateRangeKey>('30d')
  const [paymentDashboard, setPaymentDashboard] = useState<AdminPaymentDashboard | null>(null)
  const [paymentsLoading, setPaymentsLoading] = useState(true)
  const [paymentsError, setPaymentsError] = useState<string | null>(null)

  const usersQuery = useCollection('users', { orderBy: 'createdAt', orderDirection: 'desc' })
  const sessionsQuery = useCollection('sessions', { orderBy: 'date', orderDirection: 'desc' })
  const registrationsQuery = useCollection('sessionRegistrations', { orderBy: 'createdAt', orderDirection: 'desc' })
  const questsQuery = useCollection('quests', { orderBy: 'createdAt', orderDirection: 'desc' })
  const submissionsQuery = useCollection('questSubmissions', { orderBy: 'createdAt', orderDirection: 'desc' })
  const postsQuery = useCollection('communityPosts', { orderBy: 'createdAt', orderDirection: 'desc' })
  const commentsQuery = useCollection('comments', { orderBy: 'createdAt', orderDirection: 'desc', limit: 200 })
  const exhibitionsQuery = useCollection('exhibitions', { orderBy: 'startDate', orderDirection: 'desc' })
  const locationsQuery = useCollection('artLocations')
  const radioQuery = useCollection('radioContent')

  useEffect(() => {
    let mounted = true

    getAdminPaymentsDashboard({ limit: 500 })
      .then((dashboard) => {
        if (mounted) setPaymentDashboard(dashboard)
      })
      .catch((error) => {
        if (mounted) {
          setPaymentDashboard(null)
          setPaymentsError(error instanceof Error ? error.message : 'Unable to load payment summary.')
        }
      })
      .finally(() => {
        if (mounted) setPaymentsLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const users = usersQuery.data
  const sessions = sessionsQuery.data
  const registrations = registrationsQuery.data
  const quests = questsQuery.data
  const submissions = submissionsQuery.data
  const posts = postsQuery.data
  const comments = commentsQuery.data
  const exhibitions = exhibitionsQuery.data
  const locations = locationsQuery.data
  const radio = radioQuery.data

  const loading =
    usersQuery.loading ||
    sessionsQuery.loading ||
    registrationsQuery.loading ||
    questsQuery.loading ||
    submissionsQuery.loading ||
    postsQuery.loading ||
    commentsQuery.loading ||
    exhibitionsQuery.loading ||
    locationsQuery.loading ||
    radioQuery.loading

  const error =
    usersQuery.error ||
    sessionsQuery.error ||
    registrationsQuery.error ||
    questsQuery.error ||
    submissionsQuery.error ||
    postsQuery.error ||
    commentsQuery.error ||
    exhibitionsQuery.error ||
    locationsQuery.error ||
    radioQuery.error

  const dashboardData = useMemo(() => {
    const now = new Date()
    const currentRangeLabel = rangeOptions.find((entry) => entry.key === dateRange)?.label || '30d'

    const activeProfiles = users.filter((user) => user.isActive !== false)
    const onboardedUsers = users.filter((user) => user.isOnboarded)
    const incompleteUsers = users.length - onboardedUsers.length
    const newUsers = users.filter((user) => isInRange(user.createdAt, dateRange, now))
    const previousNewUsers = users.filter((user) => isInPreviousRange(user.createdAt, dateRange, now))
    const activeThisRange = users.filter((user) => isInRange(user.lastActiveAt, dateRange, now))
    const adminsAndCurators = users.filter((user) => ['admin', 'curator'].includes(user.role))
    const artists = users.filter((user) => user.role === 'artist')

    const periodPosts = posts.filter((post) => isInRange(post.createdAt, dateRange, now))
    const previousPosts = posts.filter((post) => isInPreviousRange(post.createdAt, dateRange, now))
    const periodSubmissions = submissions.filter((submission) => isInRange(submission.createdAt, dateRange, now))
    const previousSubmissions = submissions.filter((submission) => isInPreviousRange(submission.createdAt, dateRange, now))
    const periodComments = comments.filter((comment) => isInRange(comment.createdAt, dateRange, now))
    const previousComments = comments.filter((comment) => isInPreviousRange(comment.createdAt, dateRange, now))
    const periodRegistrations = registrations.filter((registration) => isInRange(registration.createdAt, dateRange, now))
    const previousRegistrations = registrations.filter((registration) => isInPreviousRange(registration.createdAt, dateRange, now))
    const engagementEvents =
      periodPosts.length +
      periodSubmissions.length +
      periodComments.length +
      periodRegistrations.length
    const previousEngagementEvents =
      previousPosts.length +
      previousSubmissions.length +
      previousComments.length +
      previousRegistrations.length

    const contributors = new Set<string>()
    periodPosts.forEach((post) => contributors.add(post.userId))
    periodSubmissions.forEach((submission) => contributors.add(submission.userId))
    periodComments.forEach((comment) => contributors.add(comment.userId))
    periodRegistrations.forEach((registration) => contributors.add(registration.userId))
    const avgDepth = contributors.size ? engagementEvents / contributors.size : 0

    const registrationsBySessionId = registrations.reduce<Map<string, SessionRegistration[]>>((map, registration) => {
      const existing = map.get(registration.sessionId) || []
      existing.push(registration)
      map.set(registration.sessionId, existing)
      return map
    }, new Map())

    const upcomingSessions = sessions.filter((session) => {
      const date = toDate(session.date)
      return date && date >= now && session.status !== 'completed' && session.status !== 'cancelled'
    })
    const publishedUpcomingSessions = upcomingSessions.filter((session) => session.status === 'published')
    const draftSessions = sessions.filter((session) => session.status === 'draft')
    const completedSessions = sessions.filter((session) => session.status === 'completed')

    const sessionForecastRows: SessionForecastRow[] = upcomingSessions
      .map((session) => {
        const sessionRegistrations = registrationsBySessionId.get(session.id) || []
        const counts = getRegistrationStatusCounts(sessionRegistrations)
        const capacity = toNumber(session.capacity)
        const fillRate = capacity > 0 ? (counts.confirmed / capacity) * 100 : 0
        const risk = getSessionRisk(session, counts, fillRate)
        const revenue = sessionRegistrations
          .filter((registration) => ['confirmed', 'paid_pending_confirmation', 'pending_payment'].includes(registration.status))
          .reduce((sum, registration) => sum + getRegistrationValue(registration, session), 0)

        return {
          id: session.id,
          title: session.title,
          dateLabel: getDateLabel(session.date),
          confirmed: counts.confirmed,
          capacity,
          fillRate,
          waitlist: counts.waitlisted,
          pending: counts.pendingPayment + counts.paidPendingConfirmation,
          revenue,
          risk,
          riskLabel: sessionRiskStyles[risk].label,
        }
      })
      .sort((a, b) => {
        const riskDiff = sessionRiskStyles[a.risk].priority - sessionRiskStyles[b.risk].priority
        if (riskDiff !== 0) return riskDiff
        return toMillis(upcomingSessions.find((session) => session.id === a.id)?.date) - toMillis(upcomingSessions.find((session) => session.id === b.id)?.date)
      })
      .slice(0, 6)

    const totalConfirmedSeats = sessionForecastRows.reduce((sum, row) => sum + row.confirmed, 0)
    const totalCapacity = sessionForecastRows.reduce((sum, row) => sum + row.capacity, 0)
    const pendingPaymentRegistrations = registrations.filter((registration) =>
      ['pending_payment', 'paid_pending_confirmation'].includes(registration.status)
    )
    const waitlistedRegistrations = registrations.filter((registration) => registration.status === 'waitlisted')

    const activeQuests = quests.filter((quest) => quest.isActive)
    const submissionsByQuestId = submissions.reduce<Map<string, QuestSubmission[]>>((map, submission) => {
      const existing = map.get(submission.questId) || []
      existing.push(submission)
      map.set(submission.questId, existing)
      return map
    }, new Map())
    const questRows: QuestPerformanceRow[] = activeQuests
      .map((quest) => {
        const questSubmissions = submissionsByQuestId.get(quest.id) || []
        const pending = countBy(questSubmissions, (submission) => !submission.approved)
        const approved = countBy(questSubmissions, (submission) => submission.approved)
        const signal = getQuestSignal(quest, questSubmissions)
        const recordedCount = Math.max(toNumber(quest.submissionCount), questSubmissions.length)

        return {
          id: quest.id,
          title: quest.title,
          submissions: recordedCount,
          approved,
          pending,
          engagement: sumBy(questSubmissions, getSubmissionEngagement),
          daysLabel: formatDaysUntil(quest.endDate),
          signal,
          signalLabel: questSignalStyles[signal].label,
        }
      })
      .sort((a, b) => {
        const signalDiff = questSignalStyles[a.signal].priority - questSignalStyles[b.signal].priority
        if (signalDiff !== 0) return signalDiff
        return b.engagement - a.engagement
      })
      .slice(0, 6)

    const approvedSubmissions = submissions.filter((submission) => submission.approved)
    const pendingSubmissions = submissions.filter((submission) => !submission.approved)
    const unapprovedPosts = posts.filter((post) => !post.isApproved && !post.isHidden)
    const hiddenPosts = posts.filter((post) => post.isHidden)

    const radioPlays = sumBy(radio, (item) => item.playCount)
    const radioLikes = sumBy(radio, (item) => item.likesCount)
    const publishedRadio = radio.filter((item) => item.isPublished)
    const exhibitionViews = sumBy(exhibitions, (exhibition) => exhibition.viewsCount)
    const exhibitionArtworkEngagement = exhibitions.reduce((sum, exhibition) => {
      return sum + exhibition.artworks.reduce((artworkSum, artwork) =>
        artworkSum + toNumber(artwork.likesCount) + toNumber(artwork.savesCount) + toNumber(artwork.sharesCount),
      0)
    }, 0)
    const mapSaves = sumBy(locations, (location) => location.savesCount)
    const mapVisits = sumBy(locations, (location) => location.visitsCount)
    const verifiedLocations = locations.filter((location) => location.verified)
    const unverifiedLocations = locations.filter((location) => !location.verified)
    const communityEngagement = sumBy(posts, getPostEngagement) + sumBy(submissions, getSubmissionEngagement)
    const trackedReach = radioPlays + radioLikes + exhibitionViews + exhibitionArtworkEngagement + mapSaves + mapVisits + communityEngagement

    const surfaceRows = ([
      {
        id: 'community',
        label: 'Community',
        value: communityEngagement,
        helper: `${formatCount(posts.length)} posts, ${formatCount(submissions.length)} submissions`,
        href: '/admin/community',
        tone: 'orange',
      },
      {
        id: 'radio',
        label: 'Radio',
        value: radioPlays + radioLikes,
        helper: `${formatCount(publishedRadio.length)} published, ${formatCount(radioLikes)} likes`,
        href: '/admin/radio',
        tone: 'purple',
      },
      {
        id: 'exhibitions',
        label: 'Exhibitions',
        value: exhibitionViews + exhibitionArtworkEngagement,
        helper: `${formatCount(exhibitionViews)} views, ${formatCount(exhibitionArtworkEngagement)} artwork actions`,
        href: '/admin/exhibitions',
        tone: 'blue',
      },
      {
        id: 'map',
        label: 'Art Map',
        value: mapSaves + mapVisits,
        helper: `${formatCount(verifiedLocations.length)} verified locations`,
        href: '/admin/map',
        tone: 'green',
      },
    ] satisfies SurfaceRow[]).sort((a, b) => b.value - a.value)

    const topRadio = [...radio]
      .sort((a, b) => (toNumber(b.playCount) + toNumber(b.likesCount)) - (toNumber(a.playCount) + toNumber(a.likesCount)))
      .slice(0, 3)
    const topExhibitions = [...exhibitions]
      .sort((a, b) => toNumber(b.viewsCount) - toNumber(a.viewsCount))
      .slice(0, 3)
    const topLocations = [...locations]
      .sort((a, b) => (toNumber(b.savesCount) + toNumber(b.visitsCount)) - (toNumber(a.savesCount) + toNumber(a.visitsCount)))
      .slice(0, 3)

    const paymentTotals = paymentDashboard?.totals
    const registrationRevenueFallback = registrations
      .filter((registration) =>
        ['paid_online', 'paid_external'].includes(registration.paymentStatus) ||
        (
          registration.paymentStatus === 'refunded' &&
          ['paid_online', 'paid_external'].includes(registration.paymentStatusBeforeReturn || '')
        )
      )
      .reduce((sum, registration) => sum + getRegistrationValue(registration), 0)
    const registrationReturnsFallback = registrations
      .filter((registration) => registration.returnStatus === 'completed')
      .reduce((sum, registration) => sum + toNumber(registration.returnedAmount), 0)
    const registrationCorrectionsFallback = registrations
      .filter((registration) => registration.returnStatus === 'completed')
      .reduce((sum, registration) => sum + toNumber(registration.correctedAmount), 0)
    const netCollected = paymentDashboard
      ? toNumber(paymentTotals?.netCollected)
      : registrationRevenueFallback -
        registrationCorrectionsFallback -
        registrationReturnsFallback
    const grossCollected = paymentDashboard
      ? toNumber(paymentTotals?.grossCollected)
      : registrationRevenueFallback - registrationCorrectionsFallback
    const pendingRevenue = paymentDashboard
      ? toNumber(paymentTotals?.pending)
      : pendingPaymentRegistrations.reduce((sum, registration) => sum + getRegistrationValue(registration), 0)
    const paymentIssueCount = paymentDashboard?.reconciliation.issueCount || 0
    const sessionRevenuePipeline = sessionForecastRows.reduce((sum, row) => sum + row.revenue, 0)

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const daysElapsed = Math.max(1, Math.ceil((now.getTime() - monthStart.getTime()) / dayMs))
    const daysInMonth = Math.round((nextMonth.getTime() - monthStart.getTime()) / dayMs)
    const daysRemaining = Math.max(0, daysInMonth - daysElapsed)
    const usersMonthToDate = users.filter((user) => {
      const createdAt = toDate(user.createdAt)
      return createdAt ? createdAt >= monthStart && createdAt <= now : false
    }).length
    const projectedNewUsers = usersMonthToDate > 0
      ? Math.round((usersMonthToDate / daysElapsed) * daysInMonth)
      : 0
    const projectedTotalUsers = users.length + Math.max(0, projectedNewUsers - usersMonthToDate)
    const monthEngagementEvents =
      posts.filter((post) => {
        const createdAt = toDate(post.createdAt)
        return createdAt ? createdAt >= monthStart && createdAt <= now : false
      }).length +
      submissions.filter((submission) => {
        const createdAt = toDate(submission.createdAt)
        return createdAt ? createdAt >= monthStart && createdAt <= now : false
      }).length +
      comments.filter((comment) => {
        const createdAt = toDate(comment.createdAt)
        return createdAt ? createdAt >= monthStart && createdAt <= now : false
      }).length +
      registrations.filter((registration) => {
        const createdAt = toDate(registration.createdAt)
        return createdAt ? createdAt >= monthStart && createdAt <= now : false
      }).length
    const engagementPace = Math.round((monthEngagementEvents / daysElapsed) * daysInMonth)
    const attendancePotential = sessionForecastRows.reduce((sum, row) =>
      sum + row.confirmed + Math.round(row.pending * 0.65),
    0)

    const attentionItems = ([
      {
        id: 'payments',
        title: 'Payment reconciliation',
        detail: `${formatMoney(pendingRevenue)} pending or mismatched`,
        count: paymentIssueCount + pendingPaymentRegistrations.length,
        href: '/admin/payments',
        actionLabel: 'Open payments',
        tone: paymentIssueCount > 0 ? 'red' : 'orange',
      },
      {
        id: 'community',
        title: 'Community moderation',
        detail: `${formatCount(hiddenPosts.length)} hidden posts, ${formatCount(unapprovedPosts.length)} awaiting approval`,
        count: hiddenPosts.length + unapprovedPosts.length,
        href: '/admin/community',
        actionLabel: 'Review posts',
        tone: hiddenPosts.length ? 'red' : 'orange',
      },
      {
        id: 'submissions',
        title: 'Quest submissions',
        detail: `${formatCount(pendingSubmissions.length)} submissions need review`,
        count: pendingSubmissions.length,
        href: '/admin/quests',
        actionLabel: 'Review work',
        tone: 'purple',
      },
      {
        id: 'locations',
        title: 'Map verification',
        detail: `${formatCount(unverifiedLocations.length)} locations are not verified`,
        count: unverifiedLocations.length,
        href: '/admin/map',
        actionLabel: 'Verify places',
        tone: 'green',
      },
      {
        id: 'sessions',
        title: 'Session pressure',
        detail: `${formatCount(waitlistedRegistrations.length)} waitlisted, ${formatCount(draftSessions.length)} drafts`,
        count: waitlistedRegistrations.length + draftSessions.length,
        href: '/admin/sessions',
        actionLabel: 'Manage sessions',
        tone: 'yellow',
      },
      {
        id: 'users',
        title: 'Incomplete onboarding',
        detail: `${formatCount(incompleteUsers)} profiles have not finished setup`,
        count: incompleteUsers,
        href: '/admin/users',
        actionLabel: 'View users',
        tone: 'blue',
      },
    ] satisfies AttentionItem[])
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)

    const growthData = buildUserGrowth(users)

    const paymentDetail = (value: number): string => {
      if (paymentDashboard) return formatMoney(value)
      return paymentsLoading ? 'Loading' : 'Unavailable'
    }

    const executiveMetrics: ExecutiveMetric[] = [
      {
        title: 'Audience Growth',
        value: formatCount(users.length),
        subtitle: `${formatCount(newUsers.length)} new users in ${currentRangeLabel}; ${formatCount(activeProfiles.length)} active profiles total.`,
        details: [
          { label: 'Active this range', value: formatCount(activeThisRange.length) },
          { label: 'Onboarded', value: `${formatPercent(users.length ? (onboardedUsers.length / users.length) * 100 : 0)} complete` },
          { label: 'Artists', value: formatCount(artists.length) },
        ],
        tone: 'blue',
        icon: <UsersRound size={22} />,
        href: '/admin/users',
        actionLabel: 'Open user intelligence',
        trend: formatTrend(newUsers.length, previousNewUsers.length, dateRange),
        trendTone: getTrendTone(newUsers.length, previousNewUsers.length),
      },
      {
        title: 'Participation Depth',
        value: formatCount(engagementEvents),
        subtitle: `${formatCount(contributors.size)} contributors, averaging ${avgDepth.toFixed(1)} actions each.`,
        details: [
          { label: 'Posts', value: formatCount(periodPosts.length) },
          { label: 'Quest submissions', value: formatCount(periodSubmissions.length) },
          { label: 'Session signups', value: formatCount(periodRegistrations.length) },
        ],
        tone: 'orange',
        icon: <Gauge size={22} />,
        href: '/admin/community',
        actionLabel: 'Inspect engagement',
        trend: formatTrend(engagementEvents, previousEngagementEvents, dateRange),
        trendTone: getTrendTone(engagementEvents, previousEngagementEvents),
      },
      {
        title: 'Program Pipeline',
        value: formatCount(publishedUpcomingSessions.length),
        subtitle: `${formatCount(totalConfirmedSeats)} confirmed seats across visible upcoming sessions.`,
        details: [
          { label: 'Capacity filled', value: formatPercent(totalCapacity ? (totalConfirmedSeats / totalCapacity) * 100 : 0) },
          { label: 'Payment backlog', value: formatCount(pendingPaymentRegistrations.length) },
          { label: 'Draft sessions', value: formatCount(draftSessions.length) },
        ],
        tone: 'green',
        icon: <CalendarDays size={22} />,
        href: '/admin/sessions',
        actionLabel: 'Review session forecast',
      },
      {
        title: 'Tracked Reach',
        value: formatCompact(trackedReach),
        subtitle: 'Combined public counters from community, radio, exhibitions, and map interactions.',
        details: [
          { label: 'Radio plays', value: formatCount(radioPlays) },
          { label: 'Exhibition views', value: formatCount(exhibitionViews) },
          { label: 'Map actions', value: formatCount(mapSaves + mapVisits) },
        ],
        tone: 'purple',
        icon: <Megaphone size={22} />,
        href: '/admin/exhibitions',
        actionLabel: 'Open content reach',
      },
      {
        title: 'Revenue Health',
        value: formatMoney(netCollected),
        subtitle: paymentsLoading
          ? 'Loading payment ledger...'
          : paymentsError
            ? 'Payment ledger unavailable; using paid registration fallback where possible.'
            : `${formatMoney(grossCollected)} gross collected with ${formatMoney(pendingRevenue)} pending.`,
        details: [
          { label: 'Online collected', value: paymentDetail(toNumber(paymentTotals?.onlineCollected)) },
          { label: 'External collected', value: paymentDetail(toNumber(paymentTotals?.externalCollected)) },
          { label: 'Completed returns', value: paymentDetail(toNumber(paymentTotals?.returned)) },
          { label: 'Revenue corrections', value: paymentDetail(toNumber(paymentTotals?.corrections)) },
          { label: 'Withdrawals', value: paymentDetail(toNumber(paymentTotals?.withdrawn)) },
        ],
        tone: paymentIssueCount > 0 ? 'red' : 'cyan',
        icon: <CircleDollarSign size={22} />,
        href: '/admin/payments',
        actionLabel: 'Open finance control',
      },
      {
        title: 'Admin Attention',
        value: formatCount(attentionItems.reduce((sum, item) => sum + item.count, 0)),
        subtitle: attentionItems.length ? `${formatCount(attentionItems.length)} operational queues need attention.` : 'No outstanding queues in the loaded dataset.',
        details: [
          { label: 'Community queue', value: formatCount(hiddenPosts.length + unapprovedPosts.length) },
          { label: 'Quest queue', value: formatCount(pendingSubmissions.length) },
          { label: 'Map queue', value: formatCount(unverifiedLocations.length) },
        ],
        tone: attentionItems.length ? 'red' : 'green',
        icon: <AlertTriangle size={22} />,
        href: attentionItems[0]?.href || '/admin',
        actionLabel: attentionItems[0]?.actionLabel || 'All clear',
      },
    ]

    return {
      activeProfiles,
      adminsAndCurators,
      attentionItems,
      completedSessions,
      currentRangeLabel,
      draftSessions,
      engagementEvents,
      engagementPace,
      executiveMetrics,
      grossCollected,
      growthData,
      incompleteUsers,
      netCollected,
      onboardedUsers,
      pendingPaymentRegistrations,
      projectedTotalUsers,
      publishedRadio,
      publishedUpcomingSessions,
      questRows,
      sessionForecastRows,
      sessionRevenuePipeline,
      surfaceRows,
      topExhibitions,
      topLocations,
      topRadio,
      trackedReach,
      attendancePotential,
      usersMonthToDate,
      daysRemaining,
      verifiedLocations,
      pendingSubmissions,
      approvedSubmissions,
      unapprovedPosts,
    }
  }, [
    comments,
    dateRange,
    exhibitions,
    locations,
    paymentDashboard,
    paymentsError,
    paymentsLoading,
    posts,
    quests,
    radio,
    registrations,
    sessions,
    submissions,
    users,
  ])

  const exportReport = () => {
    const report = [
      ['Metric', 'Value'],
      ['Date range', dashboardData.currentRangeLabel],
      ['Total users', users.length],
      ['Active profiles', dashboardData.activeProfiles.length],
      ['Onboarded users', dashboardData.onboardedUsers.length],
      ['Incomplete users', dashboardData.incompleteUsers],
      ['Engagement actions', dashboardData.engagementEvents],
      ['Tracked reach', dashboardData.trackedReach],
      ['Published upcoming sessions', dashboardData.publishedUpcomingSessions.length],
      ['Pending payment registrations', dashboardData.pendingPaymentRegistrations.length],
      ['Active quest rows shown', dashboardData.questRows.length],
      ['Pending quest submissions', dashboardData.pendingSubmissions.length],
      ['Published radio content', dashboardData.publishedRadio.length],
      ['Verified map locations', dashboardData.verifiedLocations.length],
      ['Net collected', dashboardData.netCollected],
      ['Gross collected', dashboardData.grossCollected],
      ['Month-end user projection', dashboardData.projectedTotalUsers],
      ['Session revenue pipeline', dashboardData.sessionRevenuePipeline],
    ]
      .map((row) => row.join(','))
      .join('\n')

    const blob = new Blob([report], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `club-bzr-admin-report-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <AdminLayout>
      <Box px={{ base: 5, md: 10, xl: 16 }} py={8}>
        <Flex direction={{ base: 'column', xl: 'row' }} justify="space-between" align={{ base: 'stretch', xl: 'center' }} gap={5} mb={8}>
          <Box>
            <Heading as="h1" fontSize={{ base: '2xl', md: '3xl' }} fontFamily="heading" color="white" mb={2}>
              Admin Dashboard
            </Heading>
            <Text color="whiteAlpha.500" maxW="720px">
              Central performance view across growth, participation depth, reach, projections, and admin risk.
            </Text>
          </Box>

          <Flex gap={3} align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }}>
            <HStack bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.100" borderRadius="lg" p={1} gap={1}>
              {rangeOptions.map((option) => (
                <Button
                  key={option.key}
                  size="sm"
                  minW="54px"
                  bg={dateRange === option.key ? 'brand.500' : 'transparent'}
                  color={dateRange === option.key ? 'white' : 'whiteAlpha.650'}
                  _hover={{ bg: dateRange === option.key ? 'brand.600' : 'whiteAlpha.100', color: 'white' }}
                  onClick={() => setDateRange(option.key)}
                >
                  {option.label}
                </Button>
              ))}
            </HStack>
            <Button variant="outline" size="sm" color="whiteAlpha.800" borderColor="whiteAlpha.200" _hover={{ bg: 'whiteAlpha.50', borderColor: 'whiteAlpha.300' }} onClick={exportReport}>
              Export Report
            </Button>
          </Flex>
        </Flex>

        {(error || paymentsError) && (
          <Box p={4} bg="red.500/10" border="1px solid" borderColor="red.500/30" borderRadius="xl" mb={6}>
            {error && <Text color="red.200" fontSize="sm">{error.message}</Text>}
            {paymentsError && <Text color="red.200" fontSize="sm">Payments summary: {paymentsError}</Text>}
          </Box>
        )}

        {(loading || paymentsLoading) && (
          <Flex align="center" gap={3} color="whiteAlpha.600" mb={6}>
            <Spinner size="sm" color="brand.500" />
            <Text fontSize="sm">
              Loading {loading ? 'Firestore performance data' : 'payment summary'}...
            </Text>
          </Flex>
        )}

        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap={4} mb={6}>
          {dashboardData.executiveMetrics.map((metric, index) => (
            <ExecutiveCard key={metric.title} metric={metric} index={index} />
          ))}
        </SimpleGrid>

        <Grid templateColumns={{ base: '1fr', xl: '1.25fr 0.75fr' }} gap={6} mb={6}>
          <Panel
            title="Growth & Activation"
            description="Six-month member growth compared with users who were active inside each month."
            action={
              <HStack gap={4}>
                <HStack gap={2}>
                  <Box w={2.5} h={2.5} borderRadius="full" bg="brand.500" />
                  <Text color="whiteAlpha.500" fontSize="xs">Total</Text>
                </HStack>
                <HStack gap={2}>
                  <Box w={2.5} h={2.5} borderRadius="full" bg="blue.400" />
                  <Text color="whiteAlpha.500" fontSize="xs">Active</Text>
                </HStack>
              </HStack>
            }
          >
            <MiniBarChart data={dashboardData.growthData} />
            <SimpleGrid columns={{ base: 1, md: 2 }} gap={4} mt={5}>
              <Box>
                <DataLine label="Active profiles" value={formatCount(dashboardData.activeProfiles.length)} helper="Accounts not marked inactive" tone="blue" />
                <DataLine label="Onboarding complete" value={formatPercent(users.length ? (dashboardData.onboardedUsers.length / users.length) * 100 : 0)} helper={`${formatCount(dashboardData.incompleteUsers)} incomplete profiles`} tone="green" />
              </Box>
              <Box>
                <DataLine label="Admins & curators" value={formatCount(dashboardData.adminsAndCurators.length)} helper="Operational staff roles" tone="purple" />
                <DataLine label="Completed sessions" value={formatCount(dashboardData.completedSessions.length)} helper="Historical programming archive" tone="orange" />
              </Box>
            </SimpleGrid>
          </Panel>

          <Panel title="Projections" description="Simple pace-based projections from currently loaded data.">
            <VStack align="stretch" gap={4}>
              <Box>
                <Flex justify="space-between" gap={4} mb={2}>
                  <Text color="white" fontWeight="semibold">Month-end users</Text>
                  <Text color="blue.300" fontWeight="bold">{formatCount(dashboardData.projectedTotalUsers)}</Text>
                </Flex>
                <Text color="whiteAlpha.500" fontSize="xs">
                  Based on {formatCount(dashboardData.usersMonthToDate)} users added this month, with {formatCount(dashboardData.daysRemaining)} days remaining.
                </Text>
              </Box>
              <Box>
                <Flex justify="space-between" gap={4} mb={2}>
                  <Text color="white" fontWeight="semibold">Monthly engagement pace</Text>
                  <Text color="brand.400" fontWeight="bold">{formatCount(dashboardData.engagementPace)}</Text>
                </Flex>
                <Text color="whiteAlpha.500" fontSize="xs">
                  Posts, comments, quest submissions, and session signups projected from the selected range.
                </Text>
              </Box>
              <Box>
                <Flex justify="space-between" gap={4} mb={2}>
                  <Text color="white" fontWeight="semibold">Attendance potential</Text>
                  <Text color="green.300" fontWeight="bold">{formatCount(dashboardData.attendancePotential)}</Text>
                </Flex>
                <Text color="whiteAlpha.500" fontSize="xs">
                  Confirmed seats plus a conservative share of pending signups.
                </Text>
              </Box>
              <Box>
                <Flex justify="space-between" gap={4} mb={2}>
                  <Text color="white" fontWeight="semibold">Session revenue pipeline</Text>
                  <Text color="cyan.300" fontWeight="bold">{formatMoney(dashboardData.sessionRevenuePipeline)}</Text>
                </Flex>
                <Text color="whiteAlpha.500" fontSize="xs">
                  Confirmed, paid-pending, and payment-pending registrations on upcoming sessions.
                </Text>
              </Box>
            </VStack>
          </Panel>
        </Grid>

        <Grid templateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={6} mb={6}>
          <Panel
            title="Session Forecast"
            description="Upcoming sessions ranked by operational risk, fill rate, and payment pressure."
            action={<Link to="/admin/sessions"><Button size="sm" variant="outline" color="whiteAlpha.800" borderColor="whiteAlpha.200">Manage Sessions</Button></Link>}
          >
            {dashboardData.sessionForecastRows.length === 0 ? (
              <EmptyState text="No upcoming sessions in Firestore." />
            ) : (
              <VStack align="stretch" gap={4}>
                {dashboardData.sessionForecastRows.map((row) => {
                  const risk = sessionRiskStyles[row.risk]
                  return (
                    <Box key={row.id} borderBottom="1px solid" borderColor="whiteAlpha.100" pb={4} _last={{ borderBottom: 'none', pb: 0 }}>
                      <Flex justify="space-between" gap={3} align="flex-start" mb={3}>
                        <Box minW={0}>
                          <Text color="white" fontWeight="semibold" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{row.title}</Text>
                          <HStack gap={3} color="whiteAlpha.500" fontSize="xs" mt={1}>
                            <HStack gap={1}><Clock3 size={13} /><Text>{row.dateLabel}</Text></HStack>
                            <Text>{formatCount(row.confirmed)} / {formatCount(row.capacity)} confirmed</Text>
                          </HStack>
                        </Box>
                        <ToneBadge tone={risk.tone}>{row.riskLabel}</ToneBadge>
                      </Flex>
                      <ProgressBar value={row.fillRate} tone={risk.tone} />
                      <SimpleGrid columns={{ base: 2, md: 4 }} gap={3} mt={3}>
                        <DataLine label="Fill" value={formatPercent(row.fillRate)} tone={risk.tone} />
                        <DataLine label="Pending" value={formatCount(row.pending)} tone="orange" />
                        <DataLine label="Waitlist" value={formatCount(row.waitlist)} tone="purple" />
                        <DataLine label="Pipeline" value={formatMoney(row.revenue)} tone="cyan" />
                      </SimpleGrid>
                    </Box>
                  )
                })}
              </VStack>
            )}
          </Panel>

          <Panel
            title="Operations Queue"
            description="Prioritized admin work. This replaces the old recent activity feed."
            action={<ToneBadge tone={dashboardData.attentionItems.length ? 'red' : 'green'}>{dashboardData.attentionItems.length ? `${formatCount(dashboardData.attentionItems.length)} queues` : 'Clear'}</ToneBadge>}
          >
            {dashboardData.attentionItems.length === 0 ? (
              <EmptyState text="No operational queues require action in the loaded data." />
            ) : (
              <VStack align="stretch" gap={3}>
                {dashboardData.attentionItems.map((item) => {
                  const tone = toneStyles[item.tone]
                  return (
                    <Flex key={item.id} gap={3} align="center" p={3} border="1px solid" borderColor="whiteAlpha.100" borderRadius="lg" bg="whiteAlpha.50">
                      <Flex w={10} h={10} borderRadius="lg" align="center" justify="center" bg={tone.softBg} color={tone.text} flexShrink={0}>
                        <Text fontWeight="bold">{formatCompact(item.count)}</Text>
                      </Flex>
                      <Box flex={1} minW={0}>
                        <Text color="white" fontSize="sm" fontWeight="semibold">{item.title}</Text>
                        <Text color="whiteAlpha.500" fontSize="xs" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{item.detail}</Text>
                      </Box>
                      <Link to={item.href}>
                        <Button size="sm" bg="whiteAlpha.100" color="white" _hover={{ bg: tone.softBg, color: tone.text }}>
                          {item.actionLabel}
                        </Button>
                      </Link>
                    </Flex>
                  )
                })}
              </VStack>
            )}
          </Panel>
        </Grid>

        <Grid templateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={6} mb={6}>
          <Panel
            title="Quest Performance"
            description="Active quests ranked by moderation need, promotion need, deadline pressure, and engagement."
            action={<Link to="/admin/quests"><Button size="sm" variant="outline" color="whiteAlpha.800" borderColor="whiteAlpha.200">Manage Quests</Button></Link>}
          >
            {dashboardData.questRows.length === 0 ? (
              <EmptyState text="No active quests are currently running." />
            ) : (
              <VStack align="stretch" gap={3}>
                {dashboardData.questRows.map((quest) => {
                  const signal = questSignalStyles[quest.signal]
                  return (
                    <Flex key={quest.id} align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={4} py={3} borderBottom="1px solid" borderColor="whiteAlpha.100" _last={{ borderBottom: 'none' }}>
                      <Box flex={1} minW={0}>
                        <Flex align="center" gap={2} mb={1}>
                          <Target size={15} color="var(--chakra-colors-brand-400)" />
                          <Text color="white" fontSize="sm" fontWeight="semibold" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{quest.title}</Text>
                        </Flex>
                        <HStack gap={3} color="whiteAlpha.500" fontSize="xs" wrap="wrap">
                          <Text>{formatCount(quest.submissions)} submissions</Text>
                          <Text>{formatCount(quest.approved)} approved</Text>
                          <Text>{formatCount(quest.engagement)} engagements</Text>
                          <Text>{quest.daysLabel}</Text>
                        </HStack>
                      </Box>
                      <HStack justify="space-between">
                        {quest.pending > 0 && <ToneBadge tone="red">{formatCount(quest.pending)} pending</ToneBadge>}
                        <ToneBadge tone={signal.tone}>{quest.signalLabel}</ToneBadge>
                      </HStack>
                    </Flex>
                  )
                })}
              </VStack>
            )}
          </Panel>

          <Panel title="Reach By Surface" description="Where Club BZR is earning visible public interaction.">
            <VStack align="stretch" gap={4}>
              {dashboardData.surfaceRows.map((surface) => {
                const maxValue = Math.max(1, ...dashboardData.surfaceRows.map((row) => row.value))
                return (
                  <Link key={surface.id} to={surface.href}>
                    <Box p={3} borderRadius="lg" _hover={{ bg: 'whiteAlpha.50' }} transition="background 0.2s">
                      <Flex justify="space-between" gap={4} align="center" mb={2}>
                        <Box minW={0}>
                          <Text color="white" fontSize="sm" fontWeight="semibold">{surface.label}</Text>
                          <Text color="whiteAlpha.500" fontSize="xs">{surface.helper}</Text>
                        </Box>
                        <Text color={toneStyles[surface.tone].text} fontWeight="bold">{formatCompact(surface.value)}</Text>
                      </Flex>
                      <ProgressBar value={(surface.value / maxValue) * 100} tone={surface.tone} />
                    </Box>
                  </Link>
                )
              })}
            </VStack>
          </Panel>
        </Grid>

        <Grid templateColumns={{ base: '1fr', xl: 'repeat(3, 1fr)' }} gap={6}>
          <Panel title="Radio Leaders" description="Top audio by plays and likes.">
            {dashboardData.topRadio.length === 0 ? (
              <EmptyState text="No radio content yet." />
            ) : (
              <VStack align="stretch" gap={1}>
                {dashboardData.topRadio.map((item: RadioContent) => (
                  <DataLine
                    key={item.id}
                    label={item.title}
                    value={formatCount(toNumber(item.playCount) + toNumber(item.likesCount))}
                    helper={`${formatCount(toNumber(item.playCount))} plays, ${formatCount(toNumber(item.likesCount))} likes`}
                    tone="purple"
                  />
                ))}
              </VStack>
            )}
          </Panel>

          <Panel title="Exhibition Leaders" description="Top shows by recorded views.">
            {dashboardData.topExhibitions.length === 0 ? (
              <EmptyState text="No exhibitions yet." />
            ) : (
              <VStack align="stretch" gap={1}>
                {dashboardData.topExhibitions.map((item: Exhibition) => (
                  <DataLine
                    key={item.id}
                    label={item.title}
                    value={formatCount(toNumber(item.viewsCount))}
                    helper={`${formatCount(item.artworks.length)} artworks`}
                    tone="blue"
                  />
                ))}
              </VStack>
            )}
          </Panel>

          <Panel title="Map Leaders" description="Top places by visits and saves.">
            {dashboardData.topLocations.length === 0 ? (
              <EmptyState text="No map locations yet." />
            ) : (
              <VStack align="stretch" gap={1}>
                {dashboardData.topLocations.map((item: ArtLocation) => (
                  <DataLine
                    key={item.id}
                    label={item.name}
                    value={formatCount(toNumber(item.savesCount) + toNumber(item.visitsCount))}
                    helper={`${formatCount(toNumber(item.savesCount))} saves, ${formatCount(toNumber(item.visitsCount))} visits`}
                    tone="green"
                  />
                ))}
              </VStack>
            )}
          </Panel>
        </Grid>
      </Box>
    </AdminLayout>
  )
}
