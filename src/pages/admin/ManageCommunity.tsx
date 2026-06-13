'use client'

import { useMemo, useState, type CSSProperties } from 'react'
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
  Input,
  Image,
  Spinner,
} from '@chakra-ui/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  EyeOff,
  MessageCircle,
  Pin,
  Search,
  ShieldCheck,
  Star,
  Trash2,
} from 'lucide-react'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { useCollection } from '@/hooks'
import { deleteDocument, updateDocument } from '../../../lib/firestore'
import type { Comment, CommunityPost, UpdateDocument } from '../../../lib/schema'

const MotionBox = motion.create(Box)

type CommunityTab = 'posts' | 'review' | 'hidden'
type PostStatus = 'published' | 'pending' | 'hidden'
type FeedbackType = 'success' | 'error' | 'info'

interface Feedback {
  type: FeedbackType
  message: string
}

const tabOptions: Array<{ id: CommunityTab; label: string }> = [
  { id: 'posts', label: 'All Posts' },
  { id: 'review', label: 'Needs Review' },
  { id: 'hidden', label: 'Hidden' },
]

const statusStyles: Record<PostStatus, { bg: string; color: string; borderColor: string }> = {
  published: { bg: 'green.500/15', color: 'green.200', borderColor: 'green.400/40' },
  pending: { bg: 'yellow.500/15', color: 'yellow.200', borderColor: 'yellow.400/40' },
  hidden: { bg: 'orange.500/15', color: 'orange.200', borderColor: 'orange.400/40' },
}

const selectStyle: CSSProperties = {
  width: '100%',
  height: '46px',
  padding: '0 16px',
  backgroundColor: '#111111',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: '12px',
  color: 'white',
  outline: 'none',
}

const filterSelectStyle: CSSProperties = {
  ...selectStyle,
  backgroundColor: 'rgba(0,0,0,0.24)',
}

const actionButtonProps = {
  h: '44px',
  px: 5,
  borderRadius: 'full',
  fontSize: 'sm',
  fontWeight: 'semibold',
  lineHeight: '1',
  whiteSpace: 'nowrap',
} as const

const compactButtonProps = {
  h: '40px',
  px: 4,
  borderRadius: 'lg',
  fontSize: 'sm',
  fontWeight: 'semibold',
  lineHeight: '1',
  whiteSpace: 'nowrap',
} as const

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

const formatDateTime = (value: unknown): string => {
  const date = toDate(value)
  if (!date) return 'Not recorded'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const getPostStatus = (post: CommunityPost): PostStatus => {
  if (post.isHidden) return 'hidden'
  if (!post.isApproved) return 'pending'
  return 'published'
}

const getReactionCount = (post: CommunityPost): number => {
  if (typeof post.reactionsCount === 'number') return post.reactionsCount
  return Object.values(post.reactions || {}).reduce((sum, users) => sum + users.length, 0)
}

function FeedbackBanner({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) return null

  const styles = {
    success: { bg: 'green.500/12', borderColor: 'green.400/30', color: 'green.200', icon: <CheckCircle2 size={18} /> },
    error: { bg: 'red.500/12', borderColor: 'red.400/30', color: 'red.200', icon: <AlertTriangle size={18} /> },
    info: { bg: 'blue.500/12', borderColor: 'blue.400/30', color: 'blue.200', icon: <ShieldCheck size={18} /> },
  }[feedback.type]

  return (
    <HStack
      gap={3}
      p={4}
      mb={6}
      borderRadius="xl"
      bg={styles.bg}
      border="1px solid"
      borderColor={styles.borderColor}
      color={styles.color}
    >
      {styles.icon}
      <Text fontSize="sm" fontWeight="medium">{feedback.message}</Text>
    </HStack>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <Box p={5} borderRadius="xl" bg="gray.900" border="1px solid" borderColor="whiteAlpha.100">
      <Text color="whiteAlpha.500" fontSize="sm" mb={2}>{label}</Text>
      <Text color={accent} fontSize="2xl" fontWeight="bold">{value}</Text>
    </Box>
  )
}

function Avatar({ post }: { post: CommunityPost }) {
  const initial = (post.userName || 'U').charAt(0).toUpperCase()

  return (
    <Box
      w="48px"
      h="48px"
      minW="48px"
      borderRadius="full"
      overflow="hidden"
      bg="whiteAlpha.100"
      display="flex"
      alignItems="center"
      justifyContent="center"
      border="1px solid"
      borderColor="whiteAlpha.100"
    >
      {post.userPhotoURL ? (
        <Image src={post.userPhotoURL} alt={post.userName} w="100%" h="100%" objectFit="cover" />
      ) : (
        <Text color="whiteAlpha.800" fontWeight="bold">{initial}</Text>
      )}
    </Box>
  )
}

function PostCard({
  post,
  commentCount,
  selected,
  onSelect,
  onApprove,
  onHide,
  onUnhide,
  onDelete,
  onTogglePinned,
  onToggleFeatured,
}: {
  post: CommunityPost
  commentCount: number
  selected: boolean
  onSelect: () => void
  onApprove: () => void
  onHide: () => void
  onUnhide: () => void
  onDelete: () => void
  onTogglePinned: () => void
  onToggleFeatured: () => void
}) {
  const status = getPostStatus(post)
  const style = statusStyles[status]

  return (
    <MotionBox
      layout
      p={{ base: 4, md: 5 }}
      borderRadius="2xl"
      bg="gray.900"
      border="1px solid"
      borderColor={selected ? 'brand.500/70' : 'whiteAlpha.100'}
      cursor="pointer"
      onClick={onSelect}
      _hover={{ borderColor: 'whiteAlpha.300' }}
    >
      <Flex justify="space-between" align="start" gap={4} mb={4}>
        <HStack align="start" gap={3} minW={0}>
          <Avatar post={post} />
          <Box minW={0}>
            <HStack gap={2} flexWrap="wrap" mb={1}>
              <Text color="white" fontWeight="semibold">{post.userName || 'Unknown user'}</Text>
              <Badge bg={style.bg} color={style.color} border="1px solid" borderColor={style.borderColor}>
                {status}
              </Badge>
              {post.pinned && (
                <Badge bg="brand.500/15" color="brand.200" border="1px solid" borderColor="brand.400/40">Pinned</Badge>
              )}
              {post.featured && (
                <Badge bg="purple.500/15" color="purple.200" border="1px solid" borderColor="purple.400/40">Featured</Badge>
              )}
            </HStack>
            <Text color="whiteAlpha.500" fontSize="sm">{formatDateTime(post.createdAt)}</Text>
          </Box>
        </HStack>

        <HStack gap={2}>
          <Button
            size="xs"
            variant="ghost"
            color={post.featured ? 'purple.300' : 'whiteAlpha.500'}
            onClick={(event) => {
              event.stopPropagation()
              onToggleFeatured()
            }}
          >
            <Star size={16} fill={post.featured ? 'currentColor' : 'none'} />
          </Button>
          <Button
            size="xs"
            variant="ghost"
            color={post.pinned ? 'brand.300' : 'whiteAlpha.500'}
            onClick={(event) => {
              event.stopPropagation()
              onTogglePinned()
            }}
          >
            <Pin size={16} fill={post.pinned ? 'currentColor' : 'none'} />
          </Button>
        </HStack>
      </Flex>

      {post.prompt && (
        <Text color="brand.300" fontSize="sm" mb={2}>Responding to {post.prompt}</Text>
      )}

      <Text color="whiteAlpha.800" fontSize="sm" whiteSpace="pre-wrap" mb={4}>
        {post.content || 'No content'}
      </Text>

      {post.mediaUrls?.length > 0 && (
        <SimpleGrid columns={{ base: 1, sm: Math.min(post.mediaUrls.length, 2) }} gap={3} mb={4}>
          {post.mediaUrls.slice(0, 2).map((url) => (
            <Box key={url} borderRadius="xl" overflow="hidden" bg="blackAlpha.300" aspectRatio="16/10">
              <Image src={url} alt="" w="100%" h="100%" objectFit="cover" />
            </Box>
          ))}
        </SimpleGrid>
      )}

      <Flex justify="space-between" align={{ base: 'start', md: 'center' }} gap={3} flexWrap="wrap">
        <HStack gap={4} color="whiteAlpha.500" fontSize="sm">
          <HStack gap={1}><Star size={15} /><Text>{getReactionCount(post)} reactions</Text></HStack>
          <HStack gap={1}><MessageCircle size={15} /><Text>{commentCount} comments</Text></HStack>
          <Text>{post.shares || 0} shares</Text>
        </HStack>
      </Flex>

      <AnimatePresence>
        {selected && (
          <MotionBox
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            overflow="hidden"
          >
            <HStack gap={2} flexWrap="wrap" mt={4} pt={4} borderTop="1px solid" borderColor="whiteAlpha.100">
              {status !== 'published' && (
                <Button {...compactButtonProps} bg="green.500" color="white" onClick={(event) => { event.stopPropagation(); onApprove() }}>
                  <CheckCircle2 size={15} />
                  Approve
                </Button>
              )}
              {status === 'hidden' ? (
                <Button {...compactButtonProps} bg="whiteAlpha.100" color="white" onClick={(event) => { event.stopPropagation(); onUnhide() }}>
                  <ShieldCheck size={15} />
                  Unhide
                </Button>
              ) : (
                <Button {...compactButtonProps} bg="orange.500" color="white" onClick={(event) => { event.stopPropagation(); onHide() }}>
                  <EyeOff size={15} />
                  Hide
                </Button>
              )}
              <Button {...compactButtonProps} bg="red.500" color="white" onClick={(event) => { event.stopPropagation(); onDelete() }}>
                <Trash2 size={15} />
                Delete
              </Button>
            </HStack>
          </MotionBox>
        )}
      </AnimatePresence>
    </MotionBox>
  )
}

export default function ManageCommunity() {
  const postsQuery = useCollection('communityPosts', { orderBy: 'createdAt', orderDirection: 'desc' })
  const commentsQuery = useCollection('comments')
  const [activeTab, setActiveTab] = useState<CommunityTab>('posts')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<PostStatus | 'all'>('all')
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const posts = useMemo(
    () => [...postsQuery.data].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)),
    [postsQuery.data]
  )

  const commentCounts = useMemo(() => {
    return commentsQuery.data.reduce<Record<string, number>>((counts, comment: Comment) => {
      if (comment.parentType !== 'post') return counts
      counts[comment.parentId] = (counts[comment.parentId] || 0) + 1
      return counts
    }, {})
  }, [commentsQuery.data])

  const stats = useMemo(() => {
    const reviewCount = posts.filter((post) => getPostStatus(post) !== 'published').length
    return {
      total: posts.length,
      published: posts.filter((post) => getPostStatus(post) === 'published').length,
      review: reviewCount,
      hidden: posts.filter((post) => post.isHidden).length,
      comments: Object.values(commentCounts).reduce((sum, count) => sum + count, 0),
    }
  }, [posts, commentCounts])

  const filteredPosts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return posts.filter((post) => {
      const status = getPostStatus(post)
      const matchesTab =
        activeTab === 'posts' ||
        (activeTab === 'review' && status !== 'published') ||
        (activeTab === 'hidden' && status === 'hidden')
      const matchesStatus = statusFilter === 'all' || status === statusFilter
      const matchesSearch =
        !query ||
        post.content.toLowerCase().includes(query) ||
        post.userName.toLowerCase().includes(query) ||
        post.tags.some((tag) => tag.toLowerCase().includes(query))
      return matchesTab && matchesStatus && matchesSearch
    })
  }, [posts, activeTab, statusFilter, searchQuery])

  const showFeedback = (nextFeedback: Feedback) => {
    setFeedback(nextFeedback)
    window.setTimeout(() => setFeedback(null), 4000)
  }

  const refreshPosts = async () => {
    await Promise.all([postsQuery.refetch(), commentsQuery.refetch()])
  }

  const updatePost = async (post: CommunityPost, data: UpdateDocument<CommunityPost>, successMessage: string) => {
    const result = await updateDocument('communityPosts', post.id, data)
    if (!result.success) {
      showFeedback({ type: 'error', message: result.error?.message || 'Post could not be updated.' })
      return
    }

    await postsQuery.refetch()
    showFeedback({ type: 'success', message: successMessage })
  }

  const approvePost = (post: CommunityPost) => {
    updatePost(post, { isApproved: true, isHidden: false }, 'Post approved.')
  }

  const hidePost = (post: CommunityPost) => {
    updatePost(post, { isHidden: true }, 'Post hidden.')
  }

  const unhidePost = (post: CommunityPost) => {
    updatePost(post, { isApproved: true, isHidden: false }, 'Post restored.')
  }

  const togglePinned = (post: CommunityPost) => {
    updatePost(post, { pinned: !post.pinned }, post.pinned ? 'Post unpinned.' : 'Post pinned.')
  }

  const toggleFeatured = (post: CommunityPost) => {
    updatePost(post, { featured: !post.featured }, post.featured ? 'Post removed from featured.' : 'Post marked as featured.')
  }

  const deletePost = async (post: CommunityPost) => {
    if (!window.confirm('Delete this community post? This cannot be undone.')) return

    const result = await deleteDocument('communityPosts', post.id)
    if (!result.success) {
      showFeedback({ type: 'error', message: result.error?.message || 'Post could not be deleted.' })
      return
    }

    setSelectedPostId(null)
    await refreshPosts()
    showFeedback({ type: 'success', message: 'Post deleted.' })
  }

  const exportCsv = () => {
    const rows = [
      ['Author', 'Content', 'Status', 'Reactions', 'Comments', 'Shares', 'Pinned', 'Featured', 'Created'],
      ...filteredPosts.map((post) => [
        post.userName,
        post.content,
        getPostStatus(post),
        String(getReactionCount(post)),
        String(commentCounts[post.id] ?? post.commentsCount ?? 0),
        String(post.shares || 0),
        post.pinned ? 'yes' : 'no',
        post.featured ? 'yes' : 'no',
        formatDateTime(post.createdAt),
      ]),
    ]

    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `community-posts-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    showFeedback({ type: 'info', message: 'Community export downloaded.' })
  }

  const isLoading = postsQuery.loading || commentsQuery.loading
  const errorMessage = postsQuery.error?.message || commentsQuery.error?.message

  return (
    <AdminLayout>
      <Box px={{ base: 5, md: 10, xl: 16 }} py={8} maxW="1440px" mx="auto">
        <Flex justify="space-between" align={{ base: 'start', md: 'center' }} gap={4} flexWrap="wrap" mb={6}>
          <Box>
            <Heading as="h1" size="lg" color="white" mb={2}>Community Management</Heading>
            <Text color="whiteAlpha.600">Moderate real Firestore posts, comments, and visibility states.</Text>
          </Box>
          <Button
            {...actionButtonProps}
            bg="transparent"
            color="whiteAlpha.800"
            border="1px solid"
            borderColor="whiteAlpha.200"
            onClick={exportCsv}
          >
            <Download size={17} />
            Export
          </Button>
        </Flex>

        <FeedbackBanner feedback={feedback} />

        {errorMessage && (
          <HStack mb={6} p={4} borderRadius="xl" bg="red.500/12" border="1px solid" borderColor="red.400/30" color="red.200">
            <AlertTriangle size={18} />
            <Text fontSize="sm">{errorMessage}</Text>
          </HStack>
        )}

        <SimpleGrid columns={{ base: 2, lg: 5 }} gap={4} mb={6}>
          <StatCard label="Total Posts" value={stats.total} accent="white" />
          <StatCard label="Published" value={stats.published} accent="green.300" />
          <StatCard label="Needs Review" value={stats.review} accent="orange.300" />
          <StatCard label="Hidden" value={stats.hidden} accent="red.300" />
          <StatCard label="Comments" value={stats.comments} accent="blue.300" />
        </SimpleGrid>

        <Box p={{ base: 4, md: 5 }} borderRadius="2xl" bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" mb={6}>
          <Grid templateColumns={{ base: '1fr', lg: 'minmax(280px, 1.6fr) minmax(180px, 0.8fr) minmax(180px, 0.8fr)' }} gap={4} alignItems="end">
            <Box>
              <Text color="whiteAlpha.500" fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="0.08em" mb={2}>
                Search
              </Text>
              <Box position="relative">
                <Box position="absolute" left={4} top="50%" transform="translateY(-50%)" color="whiteAlpha.500">
                  <Search size={18} />
                </Box>
                <Input
                  h="46px"
                  pl={11}
                  pr={4}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search content, author, or tag..."
                  bg="blackAlpha.300"
                  borderColor="whiteAlpha.200"
                  borderRadius="xl"
                  color="white"
                  _placeholder={{ color: 'whiteAlpha.400' }}
                />
              </Box>
            </Box>

            <Box>
              <Text color="whiteAlpha.500" fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="0.08em" mb={2}>
                View
              </Text>
              <select
                style={filterSelectStyle}
                value={activeTab}
                onChange={(event) => setActiveTab(event.target.value as CommunityTab)}
              >
                {tabOptions.map((tab) => {
                  const count = tab.id === 'posts' ? stats.total : tab.id === 'review' ? stats.review : stats.hidden
                  return (
                    <option key={tab.id} value={tab.id}>
                      {tab.label} ({count})
                    </option>
                  )
                })}
              </select>
            </Box>

            <Box>
              <Text color="whiteAlpha.500" fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="0.08em" mb={2}>
                Status
              </Text>
              <select
                style={filterSelectStyle}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as PostStatus | 'all')}
              >
                <option value="all">All Status</option>
                <option value="published">Published</option>
                <option value="pending">Pending</option>
                <option value="hidden">Hidden</option>
              </select>
            </Box>
          </Grid>
        </Box>

        {isLoading ? (
          <Flex justify="center" align="center" minH="240px">
            <Spinner color="brand.400" size="lg" />
          </Flex>
        ) : filteredPosts.length === 0 ? (
          <Box p={12} textAlign="center" borderRadius="2xl" bg="gray.900" border="1px solid" borderColor="whiteAlpha.100">
            <Text color="whiteAlpha.600">No community posts match this view.</Text>
          </Box>
        ) : (
          <VStack align="stretch" gap={4}>
            {filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                commentCount={commentCounts[post.id] ?? post.commentsCount ?? 0}
                selected={selectedPostId === post.id}
                onSelect={() => setSelectedPostId(selectedPostId === post.id ? null : post.id)}
                onApprove={() => approvePost(post)}
                onHide={() => hidePost(post)}
                onUnhide={() => unhidePost(post)}
                onDelete={() => deletePost(post)}
                onTogglePinned={() => togglePinned(post)}
                onToggleFeatured={() => toggleFeatured(post)}
              />
            ))}
          </VStack>
        )}
      </Box>
    </AdminLayout>
  )
}
