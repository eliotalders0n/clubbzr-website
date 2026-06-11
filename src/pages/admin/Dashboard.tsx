'use client'

import { Link } from 'react-router-dom'
import {
  Box,
  Flex,
  Grid,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  SimpleGrid,
  Badge,
  Image,
  Spinner,
} from '@chakra-ui/react'
import { motion } from 'framer-motion'
import {
  CalendarDays,
  CheckCircle2,
  FileText,
  ImageIcon,
  UploadCloud,
  UserPlus,
  UsersRound,
} from 'lucide-react'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { useCollection } from '@/hooks'
import type {
  CommunityPost,
  Exhibition,
  Quest,
  QuestSubmission,
  Session,
  User,
} from '../../../lib/schema'

const MotionBox = motion.create(Box)
const MotionFlex = motion.create(Flex)

type StatColor = 'blue' | 'green' | 'orange' | 'purple'
type ActivityType = 'user' | 'quest' | 'session' | 'exhibition' | 'submission' | 'post'

interface StatCardData {
  label: string
  value: string | number
  helper: string
  icon: React.ReactNode
  color: StatColor
}

interface RecentActivity {
  id: string
  type: ActivityType
  title: string
  description: string
  timestamp: string
  sortTime: number
  user?: { name: string; avatar?: string }
}

interface ChartPoint {
  month: string
  users: number
}

const colorMap: Record<StatColor, { bg: string; text: string; iconBg: string }> = {
  blue: { bg: 'blue.500/10', text: 'blue.300', iconBg: 'blue.500/18' },
  green: { bg: 'green.500/10', text: 'green.300', iconBg: 'green.500/18' },
  orange: { bg: 'brand.500/10', text: 'brand.400', iconBg: 'brand.500/18' },
  purple: { bg: 'purple.500/10', text: 'purple.300', iconBg: 'purple.500/18' },
}

const activityColors: Record<ActivityType, { bg: string; text: string; icon: React.ReactNode }> = {
  user: { bg: 'blue.500/18', text: 'blue.300', icon: <UserPlus size={16} /> },
  quest: { bg: 'green.500/18', text: 'green.300', icon: <CheckCircle2 size={16} /> },
  session: { bg: 'brand.500/18', text: 'brand.400', icon: <CalendarDays size={16} /> },
  exhibition: { bg: 'purple.500/18', text: 'purple.300', icon: <ImageIcon size={16} /> },
  submission: { bg: 'pink.500/18', text: 'pink.300', icon: <UploadCloud size={16} /> },
  post: { bg: 'whiteAlpha.100', text: 'whiteAlpha.700', icon: <FileText size={16} /> },
}

const toDate = (value: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate()
  }
  return null
}

const toMillis = (value: unknown): number => toDate(value)?.getTime() || 0

const formatRelative = (value: unknown): string => {
  const date = toDate(value)
  if (!date) return 'Not recorded'
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const isThisWeek = (value: unknown): boolean => {
  const date = toDate(value)
  if (!date) return false
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - now.getDay())
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 7)
  return date >= start && date < end
}

const buildUserGrowth = (users: User[]): ChartPoint[] => {
  const now = new Date()
  return Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1)
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999)
    return {
      month: monthDate.toLocaleDateString('en-US', { month: 'short' }),
      users: users.filter((user) => {
        const createdAt = toDate(user.createdAt)
        return createdAt ? createdAt <= monthEnd : false
      }).length,
    }
  })
}

const buildRecentActivity = ({
  users,
  submissions,
  sessions,
  quests,
  exhibitions,
  posts,
}: {
  users: User[]
  submissions: QuestSubmission[]
  sessions: Session[]
  quests: Quest[]
  exhibitions: Exhibition[]
  posts: CommunityPost[]
}): RecentActivity[] => {
  const activity: RecentActivity[] = [
    ...users.map((user) => ({
      id: `user-${user.id}`,
      type: 'user' as const,
      title: 'User joined',
      description: `${user.displayName || user.email || 'A user'} joined Club BZR`,
      timestamp: formatRelative(user.createdAt),
      sortTime: toMillis(user.createdAt),
      user: { name: user.displayName || user.email || 'User', avatar: user.photoURL || undefined },
    })),
    ...submissions.map((submission) => ({
      id: `submission-${submission.id}`,
      type: 'submission' as const,
      title: 'Quest submission',
      description: `${submission.userName || 'A user'} submitted ${submission.title || 'a quest response'}`,
      timestamp: formatRelative(submission.createdAt),
      sortTime: toMillis(submission.createdAt),
      user: { name: submission.userName || 'User', avatar: submission.userPhotoURL },
    })),
    ...sessions.map((session) => ({
      id: `session-${session.id}`,
      type: 'session' as const,
      title: 'Session updated',
      description: session.title,
      timestamp: formatRelative(session.createdAt),
      sortTime: toMillis(session.createdAt),
    })),
    ...quests.map((quest) => ({
      id: `quest-${quest.id}`,
      type: 'quest' as const,
      title: quest.isActive ? 'Quest active' : 'Quest drafted',
      description: quest.title,
      timestamp: formatRelative(quest.createdAt),
      sortTime: toMillis(quest.createdAt),
    })),
    ...exhibitions.map((exhibition) => ({
      id: `exhibition-${exhibition.id}`,
      type: 'exhibition' as const,
      title: 'Exhibition updated',
      description: exhibition.title,
      timestamp: formatRelative(exhibition.createdAt),
      sortTime: toMillis(exhibition.createdAt),
    })),
    ...posts.map((post) => ({
      id: `post-${post.id}`,
      type: 'post' as const,
      title: 'Community post',
      description: `${post.userName || 'A user'} posted on The Wall`,
      timestamp: formatRelative(post.createdAt),
      sortTime: toMillis(post.createdAt),
      user: { name: post.userName || 'User', avatar: post.userPhotoURL },
    })),
  ]

  return activity.sort((a, b) => b.sortTime - a.sortTime).slice(0, 8)
}

function SimpleChart({ data }: { data: ChartPoint[] }) {
  const maxUsers = Math.max(1, ...data.map((point) => point.users))

  return (
    <Flex h="192px" align="flex-end" gap={2}>
      {data.map((item, index) => (
        <Flex key={`${item.month}-${index}`} flex={1} direction="column" align="center" gap={2}>
          <MotionBox
            w="full"
            bg="blue.500/18"
            borderTopRadius="lg"
            position="relative"
            overflow="hidden"
            initial={{ height: 0 }}
            animate={{ height: `${Math.max(8, (item.users / maxUsers) * 100)}%` }}
            transition={{ delay: index * 0.07, duration: 0.45 }}
          >
            <MotionBox position="absolute" inset={0} bg="blue.500" />
          </MotionBox>
          <Text fontSize="xs" color="whiteAlpha.500">
            {item.month}
          </Text>
        </Flex>
      ))}
    </Flex>
  )
}

function ActivityIcon({ type }: { type: ActivityType }) {
  const colors = activityColors[type]

  return (
    <Flex w={8} h={8} borderRadius="lg" align="center" justify="center" bg={colors.bg} color={colors.text}>
      {colors.icon}
    </Flex>
  )
}

export default function AdminDashboard() {
  const usersQuery = useCollection('users', { orderBy: 'createdAt', orderDirection: 'desc' })
  const sessionsQuery = useCollection('sessions', { orderBy: 'date', orderDirection: 'desc' })
  const questsQuery = useCollection('quests', { orderBy: 'createdAt', orderDirection: 'desc' })
  const submissionsQuery = useCollection('questSubmissions', { orderBy: 'createdAt', orderDirection: 'desc' })
  const exhibitionsQuery = useCollection('exhibitions', { orderBy: 'startDate', orderDirection: 'desc' })
  const postsQuery = useCollection('communityPosts', { orderBy: 'createdAt', orderDirection: 'desc', limit: 20 })
  const locationsQuery = useCollection('artLocations')
  const radioQuery = useCollection('radioContent')

  const loading =
    usersQuery.loading ||
    sessionsQuery.loading ||
    questsQuery.loading ||
    submissionsQuery.loading ||
    exhibitionsQuery.loading

  const error =
    usersQuery.error ||
    sessionsQuery.error ||
    questsQuery.error ||
    submissionsQuery.error ||
    exhibitionsQuery.error ||
    postsQuery.error ||
    locationsQuery.error ||
    radioQuery.error

  const activeQuests = questsQuery.data.filter((quest) => quest.isActive).length
  const sessionsThisWeek = sessionsQuery.data.filter((session) => isThisWeek(session.date)).length
  const approvedSubmissions = submissionsQuery.data.filter((submission) => submission.approved).length
  const publishedRadio = radioQuery.data.filter((item) => item.isPublished).length
  const verifiedLocations = locationsQuery.data.filter((location) => location.verified).length
  const publishedExhibitions = exhibitionsQuery.data.length

  const stats: StatCardData[] = [
    {
      label: 'Total Users',
      value: usersQuery.data.length.toLocaleString(),
      helper: `${usersQuery.data.filter((user) => user.isActive !== false).length.toLocaleString()} active profiles`,
      icon: <UsersRound size={24} />,
      color: 'blue',
    },
    {
      label: 'Active Quests',
      value: activeQuests,
      helper: `${submissionsQuery.data.length.toLocaleString()} total submissions`,
      icon: <CheckCircle2 size={24} />,
      color: 'green',
    },
    {
      label: 'Sessions This Week',
      value: sessionsThisWeek,
      helper: `${sessionsQuery.data.length.toLocaleString()} sessions in Firestore`,
      icon: <CalendarDays size={24} />,
      color: 'orange',
    },
    {
      label: 'Approved Work',
      value: approvedSubmissions,
      helper: `${postsQuery.data.length.toLocaleString()} recent wall posts loaded`,
      icon: <UploadCloud size={24} />,
      color: 'purple',
    },
  ]

  const quickActions = [
    { label: 'Create Quest', description: 'Open quest management', href: '/admin/quests', icon: <CheckCircle2 size={20} /> },
    { label: 'Schedule Session', description: 'Open session management', href: '/admin/sessions', icon: <CalendarDays size={20} /> },
    { label: 'Manage Users', description: 'View and manage profiles', href: '/admin/users', icon: <UsersRound size={20} /> },
    { label: 'Review Community', description: 'Moderate wall posts', href: '/admin/community', icon: <FileText size={20} /> },
  ]

  const chartData = buildUserGrowth(usersQuery.data)
  const recentActivity = buildRecentActivity({
    users: usersQuery.data,
    submissions: submissionsQuery.data,
    sessions: sessionsQuery.data,
    quests: questsQuery.data,
    exhibitions: exhibitionsQuery.data,
    posts: postsQuery.data,
  })

  const navCards = [
    { label: 'Users', href: '/admin/users', count: usersQuery.data.length.toLocaleString() },
    { label: 'Sessions', href: '/admin/sessions', count: sessionsQuery.data.length.toLocaleString() },
    { label: 'Quests', href: '/admin/quests', count: questsQuery.data.length.toLocaleString() },
    { label: 'Exhibitions', href: '/admin/exhibitions', count: publishedExhibitions.toLocaleString() },
    { label: 'Radio', href: '/admin/radio', count: publishedRadio.toLocaleString() },
    { label: 'Map', href: '/admin/map', count: verifiedLocations.toLocaleString() },
  ]

  const exportReport = () => {
    const report = [
      ['Metric', 'Value'],
      ['Users', usersQuery.data.length],
      ['Active quests', activeQuests],
      ['Sessions this week', sessionsThisWeek],
      ['Quest submissions', submissionsQuery.data.length],
      ['Community posts loaded', postsQuery.data.length],
      ['Exhibitions', exhibitionsQuery.data.length],
      ['Published radio content', publishedRadio],
      ['Verified map locations', verifiedLocations],
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
      <Box px={{ base: 6, md: 12, lg: 16, xl: 20 }} py={8}>
        <Flex direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={4} mb={8}>
          <Box>
            <Heading as="h1" fontSize={{ base: '2xl', md: '3xl' }} fontFamily="heading" color="white" mb={2}>
              Admin Dashboard
            </Heading>
            <Text color="whiteAlpha.500">
              Live Firestore overview for Club BZR admin operations.
            </Text>
          </Box>
          <HStack gap={3}>
            <Button variant="outline" size="sm" color="whiteAlpha.700" borderColor="whiteAlpha.200" _hover={{ bg: 'whiteAlpha.50', borderColor: 'whiteAlpha.300' }} onClick={exportReport}>
              Export Report
            </Button>
            <Link to="/admin/community">
              <Button size="sm" bg="brand.500" color="white" _hover={{ bg: 'brand.600' }}>
                View Activity
              </Button>
            </Link>
          </HStack>
        </Flex>

        {error && (
          <Box p={4} bg="red.500/10" border="1px solid" borderColor="red.500/30" borderRadius="xl" mb={6}>
            <Text color="red.200" fontSize="sm">{error.message}</Text>
          </Box>
        )}

        {loading && (
          <Flex align="center" gap={3} color="whiteAlpha.600" mb={6}>
            <Spinner size="sm" color="brand.500" />
            <Text fontSize="sm">Loading Firestore dashboard data...</Text>
          </Flex>
        )}

        <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={4} mb={8}>
          {stats.map((stat, index) => {
            const colors = colorMap[stat.color]
            return (
              <MotionBox key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.07 }}>
                <Box bg="gray.900" borderRadius="xl" border="1px solid" borderColor="whiteAlpha.100" p={6} _hover={{ borderColor: 'whiteAlpha.200' }} transition="border-color 0.2s">
                  <Flex justify="space-between" align="flex-start" mb={4}>
                    <Flex w={12} h={12} borderRadius="xl" align="center" justify="center" bg={colors.iconBg} color={colors.text}>
                      {stat.icon}
                    </Flex>
                    <Badge bg={colors.bg} color={colors.text} px={2} py={0.5} borderRadius="full" fontSize="xs">
                      Firestore
                    </Badge>
                  </Flex>
                  <Text fontSize="3xl" fontFamily="heading" fontWeight="bold" color="white" mb={1}>
                    {stat.value}
                  </Text>
                  <Text fontSize="sm" color="whiteAlpha.500">{stat.label}</Text>
                  <Text fontSize="xs" color="whiteAlpha.400" mt={1}>{stat.helper}</Text>
                </Box>
              </MotionBox>
            )
          })}
        </SimpleGrid>

        <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6} mb={6}>
          <MotionBox initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Box bg="gray.900" borderRadius="xl" border="1px solid" borderColor="whiteAlpha.100" p={6}>
              <Flex justify="space-between" align="center" mb={6}>
                <Box>
                  <Heading as="h2" fontSize="lg" fontFamily="heading" fontWeight="semibold" color="white">
                    User Growth
                  </Heading>
                  <Text fontSize="sm" color="whiteAlpha.500">Cumulative Firestore users over six months</Text>
                </Box>
                <HStack gap={2}>
                  <Box w={3} h={3} borderRadius="full" bg="blue.500" />
                  <Text fontSize="sm" color="whiteAlpha.500">Users</Text>
                </HStack>
              </Flex>
              <SimpleChart data={chartData} />
            </Box>
          </MotionBox>

          <MotionBox initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Box bg="gray.900" borderRadius="xl" border="1px solid" borderColor="whiteAlpha.100" p={6}>
              <Heading as="h2" fontSize="lg" fontFamily="heading" fontWeight="semibold" color="white" mb={4}>
                Quick Actions
              </Heading>
              <VStack align="stretch" gap={3}>
                {quickActions.map((action) => (
                  <Link key={action.label} to={action.href}>
                    <Flex align="center" gap={3} p={3} mx={-3} borderRadius="lg" role="group" cursor="pointer" _hover={{ bg: 'whiteAlpha.50' }} transition="background 0.2s">
                      <Flex w={10} h={10} borderRadius="lg" align="center" justify="center" bg="gray.800" color="whiteAlpha.600" _groupHover={{ bg: 'brand.500', color: 'white' }} transition="all 0.2s">
                        {action.icon}
                      </Flex>
                      <Box flex={1}>
                        <Text fontSize="sm" fontWeight="medium" color="white">{action.label}</Text>
                        <Text fontSize="xs" color="whiteAlpha.400">{action.description}</Text>
                      </Box>
                    </Flex>
                  </Link>
                ))}
              </VStack>
            </Box>
          </MotionBox>
        </Grid>

        <MotionBox initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} mb={8}>
          <Box bg="gray.900" borderRadius="xl" border="1px solid" borderColor="whiteAlpha.100" p={6}>
            <Flex justify="space-between" align="center" mb={6}>
              <Heading as="h2" fontSize="lg" fontFamily="heading" fontWeight="semibold" color="white">
                Recent Activity
              </Heading>
              <Text color="whiteAlpha.500" fontSize="sm">{recentActivity.length} live records</Text>
            </Flex>
            {recentActivity.length === 0 ? (
              <Box py={8} textAlign="center">
                <Text color="whiteAlpha.500">No Firestore activity yet.</Text>
              </Box>
            ) : (
              <VStack align="stretch" gap={4}>
                {recentActivity.map((activity, index) => (
                  <MotionFlex key={activity.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + index * 0.04 }} align="flex-start" gap={4} pb={4} borderBottom={index < recentActivity.length - 1 ? '1px solid' : 'none'} borderColor="whiteAlpha.100">
                    {activity.user?.avatar ? (
                      <Image src={activity.user.avatar} alt={activity.user.name} w={8} h={8} borderRadius="full" objectFit="cover" />
                    ) : (
                      <ActivityIcon type={activity.type} />
                    )}
                    <Box flex={1} minW={0}>
                      <Text fontSize="sm" color="white">{activity.title}</Text>
                      <Text fontSize="sm" color="whiteAlpha.500" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                        {activity.description}
                      </Text>
                    </Box>
                    <Text fontSize="xs" color="whiteAlpha.400" flexShrink={0}>{activity.timestamp}</Text>
                  </MotionFlex>
                ))}
              </VStack>
            )}
          </Box>
        </MotionBox>

        <SimpleGrid columns={{ base: 2, md: 3, xl: 6 }} gap={4}>
          {navCards.map((item) => (
            <Link key={item.label} to={item.href}>
              <Box bg="gray.900" borderRadius="xl" border="1px solid" borderColor="whiteAlpha.100" p={6} textAlign="center" _hover={{ borderColor: 'brand.500', boxShadow: '0 0 20px rgba(255, 107, 53, 0.15)' }} transition="all 0.2s">
                <Text fontSize="2xl" fontFamily="heading" fontWeight="bold" color="white">{item.count}</Text>
                <Text fontSize="sm" color="whiteAlpha.500">{item.label}</Text>
              </Box>
            </Link>
          ))}
        </SimpleGrid>
      </Box>
    </AdminLayout>
  )
}
