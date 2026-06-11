'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  collection,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import {
  Box,
  Container,
  Flex,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Spinner,
} from '@chakra-ui/react'
import { motion } from 'framer-motion'

import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CommunityPost, CommunityPostSkeleton, PostForm, WallActivityCard, type WallActivityItem } from '@/components/features/community'
import { useCollection, useInfinitePagination } from '@/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '../../lib/config'
import { createDocument, deleteDocument, getDocumentCount, updateDocument } from '../../lib/firestore'
import { createQuestCompletionBadges } from '../../lib/badges'
import {
  getNextQuestSubmissionVoteState,
  getQuestSubmissionVoteSnapshot,
  updateQuestSubmissionVote,
  type QuestSubmissionVoteState,
  type SubmissionVoteValue,
} from '../../lib/submissionVotes'
import type {
  CommunityPost as CommunityPostType,
  Comment,
  CreateDocument,
  Exhibition,
  Quest,
  QuestSubmission,
  ReactionType,
  Reactions,
} from '../../lib/schema'

const MotionBox = motion.create(Box)
const POST_PAGE_SIZE = 8
const POST_RENDER_BATCH_SIZE = 8
const COMMENTS_PAGE_SIZE = 5

const communityPrompts = [
  "What's inspiring you creatively this week?",
  "Share your latest work in progress",
  "What creative challenge are you facing?",
  "Recommend an artist or resource",
]

type LocationPromptState = {
  prompt?: unknown
}

type CommentPageState = {
  comments: Comment[]
  cursor: QueryDocumentSnapshot<DocumentData> | null
  hasMore: boolean
  loading: boolean
  loaded: boolean
}

type FeedItem =
  | {
      type: 'post'
      id: string
      timestamp: number
      post: CommunityPostType
    }
  | WallActivityItem

type CommunityStats = {
  members: number
  wallPosts: number
  postsThisWeek: number
  questCompletions: number
  completionsThisWeek: number
  upcomingExhibitions: number
}

const getPromptFromLocationState = (state: unknown): string | null => {
  if (!state || typeof state !== 'object') return null

  const prompt = (state as LocationPromptState).prompt
  return typeof prompt === 'string' && prompt.trim().length > 0 ? prompt : null
}

const getCommentTime = (comment: Comment): number => {
  return comment.createdAt instanceof Timestamp ? comment.createdAt.toMillis() : 0
}

const toMillis = (value: unknown): number => {
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

const sortComments = (comments: Comment[]): Comment[] => {
  return [...comments].sort((a, b) => getCommentTime(a) - getCommentTime(b))
}

const mergeComments = (existing: Comment[], incoming: Comment[]): Comment[] => {
  const byId = new Map<string, Comment>()

  existing.forEach((comment) => {
    byId.set(comment.id, comment)
  })

  incoming.forEach((comment) => {
    byId.set(comment.id, comment)
  })

  return sortComments(Array.from(byId.values()))
}

const getReactionsCount = (reactions: Reactions): number => {
  return Object.values(reactions).reduce((sum, arr) => sum + (arr?.length || 0), 0)
}

const formatStatValue = (value: number | null): string => {
  if (value === null) return '-'
  return value.toLocaleString()
}

const toggleReaction = (
  reactions: Reactions,
  reactionType: ReactionType,
  userId: string
): Reactions => {
  const currentArray = reactions[reactionType] || []
  const userReacted = currentArray.includes(userId)

  return {
    ...reactions,
    [reactionType]: userReacted
      ? currentArray.filter(id => id !== userId)
      : [...currentArray, userId],
  }
}

// Conversation starters as clickable prompts - horizontal scroll
const ConversationStarters = ({
  prompts,
  onSelect
}: {
  prompts: string[]
  onSelect: (prompt: string) => void
}) => (
  <Box>
    <Text color="whiteAlpha.500" fontSize="xs" fontWeight="medium" mb={3} textTransform="uppercase" letterSpacing="wider">
      Quick prompts
    </Text>
    <Box
      overflowX="auto"
      mx={-4}
      px={4}
      css={{
        '&::-webkit-scrollbar': { display: 'none' },
        scrollbarWidth: 'none',
      }}
    >
      <HStack gap={2} pb={1}>
        {prompts.map((prompt, i) => (
          <Button
            key={i}
            onClick={() => onSelect(prompt)}
            size="sm"
            bg="whiteAlpha.50"
            color="whiteAlpha.700"
            borderRadius="full"
            px={4}
            py={2}
            h="auto"
            fontSize="xs"
            fontWeight="normal"
            whiteSpace="nowrap"
            flexShrink={0}
            _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
            transition="all 0.2s"
          >
            {prompt}
          </Button>
        ))}
      </HStack>
    </Box>
  </Box>
)

export default function CommunityWall() {
  const location = useLocation()
  const navigate = useNavigate()
  const locationPrompt = getPromptFromLocationState(location.state)
  const { user, firebaseUser } = useAuth()
  const [activeTab, setActiveTab] = useState<'all' | 'following'>('all')
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(() => locationPrompt)
  const [localPostReactions, setLocalPostReactions] = useState<Record<string, Reactions>>({})
  const [localSubmissionVotes, setLocalSubmissionVotes] = useState<Record<string, QuestSubmissionVoteState>>({})
  const [localCommentCountDeltas, setLocalCommentCountDeltas] = useState<Record<string, number>>({})
  const [renderedFeedCount, setRenderedFeedCount] = useState(POST_RENDER_BATCH_SIZE)
  const [wallLoadedAtMs] = useState(() => Date.now())
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null)
  const [commentPages, setCommentPages] = useState<Record<string, CommentPageState>>({})
  const postLoadSentinelRef = useRef<HTMLDivElement | null>(null)
  const postLoadInFlightRef = useRef(false)

  // Current user info for posts/comments
  const currentUserId = firebaseUser?.uid || null
  const currentUserName = user?.displayName || firebaseUser?.displayName || 'Anonymous'
  const currentUserPhoto = user?.photoURL || firebaseUser?.photoURL || null

  // Check for prompt passed from navigation (e.g., from Quests page)
  useEffect(() => {
    if (locationPrompt) {
      window.history.replaceState({}, document.title)
    }
  }, [locationPrompt])

  // Fetch posts from Firebase
  const {
    data: posts,
    loading: postsLoading,
    hasMore,
    loadMore,
    reset: refetchPosts,
  } = useInfinitePagination<'communityPosts'>(
    'communityPosts',
    POST_PAGE_SIZE,
    {
      orderBy: 'createdAt',
      orderDirection: 'desc',
    }
  )

  const {
    data: rawQuestSubmissions,
    loading: questSubmissionsLoading,
    refetch: refetchQuestSubmissions,
  } = useCollection('questSubmissions', {
    orderBy: 'createdAt',
    orderDirection: 'desc',
    limit: 24,
  })

  const { data: quests } = useCollection('quests', {
    limit: 80,
  })

  const {
    data: rawExhibitions,
    loading: exhibitionsLoading,
  } = useCollection('exhibitions', {
    orderBy: 'createdAt',
    orderDirection: 'desc',
    limit: 16,
  })

  const questMap = useMemo(() => {
    return new Map((quests as Quest[]).map((quest) => [quest.id, quest]))
  }, [quests])

  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = posts.map((post) => ({
      type: 'post',
      id: `post:${post.id}`,
      timestamp: toMillis(post.createdAt),
      post,
    }))

    ;(rawQuestSubmissions as QuestSubmission[])
      .filter((submission) => submission.approved !== false && submission.showOnWall !== false)
      .forEach((submission) => {
        const quest = questMap.get(submission.questId)
        const voteState = localSubmissionVotes[submission.id]
        const displaySubmission: QuestSubmission = voteState
          ? { ...submission, ...voteState }
          : submission
        const timestamp = toMillis(submission.createdAt)

        items.push({
          type: 'quest_completed',
          id: `quest_completed:${submission.id}`,
          timestamp,
          submission: displaySubmission,
          quest,
        })

        if (quest) {
          createQuestCompletionBadges(quest, submission.createdAt).forEach((badge) => {
            items.push({
              type: 'badge_earned',
              id: `badge_earned:${submission.id}:${badge.id}`,
              timestamp,
              submission: displaySubmission,
              quest,
              badge,
            })
          })
        }
      })

    ;(rawExhibitions as Exhibition[])
      .filter((exhibition) => {
        const isPublished = (exhibition as Exhibition & { isPublished?: boolean }).isPublished
        const endTime = toMillis(exhibition.endDate)
        return isPublished !== false && (!endTime || endTime >= wallLoadedAtMs)
      })
      .forEach((exhibition) => {
        const startTime = toMillis(exhibition.startDate)
        items.push({
          type: 'exhibition',
          id: `exhibition:${exhibition.id}`,
          timestamp: toMillis(exhibition.createdAt) || startTime,
          exhibition,
          status: startTime > wallLoadedAtMs ? 'upcoming' : 'active',
        })
      })

    return items.sort((a, b) => b.timestamp - a.timestamp)
  }, [localSubmissionVotes, posts, questMap, rawExhibitions, rawQuestSubmissions, wallLoadedAtMs])

  const recentBadgeAwardsCount = useMemo(() => {
    return feedItems.filter((item) => item.type === 'badge_earned').length
  }, [feedItems])

  useEffect(() => {
    let cancelled = false

    const loadCommunityStats = async () => {
      const weekAgo = Timestamp.fromDate(new Date(wallLoadedAtMs - 7 * 24 * 60 * 60 * 1000))
      const now = Timestamp.fromDate(new Date(wallLoadedAtMs))
      const [
        members,
        wallPosts,
        postsThisWeek,
        questCompletions,
        completionsThisWeek,
        upcomingExhibitions,
      ] = await Promise.all([
        getDocumentCount('users'),
        getDocumentCount('communityPosts'),
        getDocumentCount('communityPosts', [{ field: 'createdAt', operator: '>=', value: weekAgo }]),
        getDocumentCount('questSubmissions'),
        getDocumentCount('questSubmissions', [{ field: 'createdAt', operator: '>=', value: weekAgo }]),
        getDocumentCount('exhibitions', [{ field: 'startDate', operator: '>=', value: now }]),
      ])

      if (cancelled) return

      setCommunityStats({
        members: members.success ? members.data || 0 : 0,
        wallPosts: wallPosts.success ? wallPosts.data || 0 : 0,
        postsThisWeek: postsThisWeek.success ? postsThisWeek.data || 0 : 0,
        questCompletions: questCompletions.success ? questCompletions.data || 0 : 0,
        completionsThisWeek: completionsThisWeek.success ? completionsThisWeek.data || 0 : 0,
        upcomingExhibitions: upcomingExhibitions.success ? upcomingExhibitions.data || 0 : 0,
      })
    }

    void loadCommunityStats()

    return () => {
      cancelled = true
    }
  }, [wallLoadedAtMs])

  const visibleFeedItems = useMemo(() => {
    return feedItems.slice(0, renderedFeedCount)
  }, [feedItems, renderedFeedCount])

  const hasHiddenLoadedFeedItems = renderedFeedCount < feedItems.length
  const canLoadMorePosts = hasHiddenLoadedFeedItems || hasMore

  const handleLoadMorePosts = useCallback(() => {
    if (postsLoading || postLoadInFlightRef.current) return

    if (hasHiddenLoadedFeedItems) {
      setRenderedFeedCount((count) => Math.min(count + POST_RENDER_BATCH_SIZE, feedItems.length))
      return
    }

    if (hasMore) {
      postLoadInFlightRef.current = true
      setRenderedFeedCount((count) => count + POST_RENDER_BATCH_SIZE)
      void loadMore().finally(() => {
        postLoadInFlightRef.current = false
      })
    }
  }, [feedItems.length, hasHiddenLoadedFeedItems, hasMore, loadMore, postsLoading])

  useEffect(() => {
    const sentinel = postLoadSentinelRef.current
    if (!sentinel || !canLoadMorePosts || postsLoading || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          handleLoadMorePosts()
        }
      },
      { rootMargin: '480px 0px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [canLoadMorePosts, handleLoadMorePosts, postsLoading])

  const loadPostComments = useCallback(async (postId: string, reset = false) => {
    const currentPage = commentPages[postId]

    if (currentPage?.loading) return
    if (!reset && currentPage?.loaded && !currentPage.hasMore) return

    setCommentPages((prev) => ({
      ...prev,
      [postId]: {
        comments: reset ? [] : prev[postId]?.comments || [],
        cursor: reset ? null : prev[postId]?.cursor || null,
        hasMore: reset ? true : prev[postId]?.hasMore ?? true,
        loaded: prev[postId]?.loaded || false,
        loading: true,
      },
    }))

    try {
      const cursor = reset ? null : currentPage?.cursor || null
      const constraints = [
        where('parentId', '==', postId),
        orderBy('createdAt', 'asc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(COMMENTS_PAGE_SIZE),
      ]

      const snapshot = await getDocs(query(collection(db, 'comments'), ...constraints))
      const nextComments = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Comment[]

      setCommentPages((prev) => {
        const previousComments = reset ? [] : prev[postId]?.comments || []
        const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null

        return {
          ...prev,
          [postId]: {
            comments: mergeComments(previousComments, nextComments),
            cursor: lastDoc,
            hasMore: snapshot.docs.length === COMMENTS_PAGE_SIZE,
            loaded: true,
            loading: false,
          },
        }
      })
    } catch (error) {
      console.error('Failed to load comments:', error)
      setCommentPages((prev) => ({
        ...prev,
        [postId]: {
          comments: prev[postId]?.comments || [],
          cursor: prev[postId]?.cursor || null,
          hasMore: prev[postId]?.hasMore ?? true,
          loaded: prev[postId]?.loaded || false,
          loading: false,
        },
      }))
    }
  }, [commentPages])

  const handleCommentsOpen = useCallback((postId: string) => {
    const page = commentPages[postId]
    if (!page?.loaded && !page?.loading) {
      void loadPostComments(postId, true)
    }
  }, [commentPages, loadPostComments])

  // Handle creating a new post
  const handleCreatePost = useCallback(async (postData: CreateDocument<CommunityPostType>) => {
    console.log('Creating post with data:', postData)
    const result = await createDocument('communityPosts', postData)
    console.log('Create result:', result)
    if (result.success) {
      console.log('Post created successfully, refetching...')
      setRenderedFeedCount(POST_RENDER_BATCH_SIZE)
      void refetchPosts()
      setSelectedPrompt(null)
    } else {
      console.error('Failed to create post:', result.error)
    }
  }, [refetchPosts])

  const handleSubmissionVote = useCallback(async (submission: QuestSubmission, vote: SubmissionVoteValue) => {
    if (!currentUserId) {
      navigate('/auth/login')
      return
    }

    const previousState = getQuestSubmissionVoteSnapshot(submission)
    const nextState = getNextQuestSubmissionVoteState(submission, currentUserId, vote)

    setLocalSubmissionVotes((prev) => ({
      ...prev,
      [submission.id]: nextState,
    }))

    const result = await updateQuestSubmissionVote(submission.id, currentUserId, vote)

    if (result.success && result.data) {
      setLocalSubmissionVotes((prev) => ({
        ...prev,
        [submission.id]: result.data!,
      }))
      void refetchQuestSubmissions()
    } else {
      setLocalSubmissionVotes((prev) => ({
        ...prev,
        [submission.id]: previousState,
      }))
      console.error('Failed to update submission vote:', result.error)
    }
  }, [currentUserId, navigate, refetchQuestSubmissions])

  // Handle reaction toggle
  const handleReaction = useCallback(async (postId: string, reactionType: ReactionType, currentReactions: CommunityPostType['reactions']) => {
    if (!currentUserId) {
      navigate('/auth/login')
      return
    }

    const userId = currentUserId
    const previousReactions = currentReactions || {}
    const updatedReactions = toggleReaction(previousReactions, reactionType, userId)
    const newReactionsCount = getReactionsCount(updatedReactions)

    setLocalPostReactions((prev) => ({
      ...prev,
      [postId]: updatedReactions,
    }))

    try {
      await updateDoc(doc(db, 'communityPosts', postId), {
        reactions: updatedReactions,
        reactionsCount: newReactionsCount,
      })
    } catch (error) {
      setLocalPostReactions((prev) => ({
        ...prev,
        [postId]: previousReactions,
      }))
      console.error('Failed to update reaction:', error)
    }
  }, [currentUserId, navigate])

  // Handle adding a comment
  const handleComment = useCallback(async (postId: string, content: string) => {
    if (!currentUserId) return

    // Build comment data, omitting undefined/null optional fields
    const commentData: CreateDocument<Comment> = {
      parentId: postId,
      parentType: 'post',
      userId: currentUserId,
      userName: currentUserName,
      ...(currentUserPhoto ? { userPhotoURL: currentUserPhoto } : {}),
      content,
      reactions: {
        love: [],
        fire: [],
        mind_blown: [],
        inspire: [],
        curious: [],
      },
      reactionsCount: 0,
      repliesCount: 0,
      isEdited: false,
    }

    const result = await createDocument('comments', commentData)

    if (result.success && result.data) {
      setCommentPages((prev) => {
        const currentPage = prev[postId]

        return {
          ...prev,
          [postId]: {
            comments: mergeComments(currentPage?.comments || [], [result.data!]),
            cursor: currentPage?.cursor || null,
            hasMore: currentPage?.hasMore ?? false,
            loaded: true,
            loading: false,
          },
        }
      })
      setLocalCommentCountDeltas((prev) => ({
        ...prev,
        [postId]: (prev[postId] || 0) + 1,
      }))

      try {
        await updateDoc(doc(db, 'communityPosts', postId), {
          commentsCount: increment(1),
        })
      } catch (error) {
        console.error('Failed to update comment count:', error)
      }
    } else {
      console.error('Failed to create comment:', result.error)
    }
  }, [currentUserId, currentUserName, currentUserPhoto])

  // Handle deleting a post
  const handleDeletePost = useCallback(async (postId: string) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return

    const result = await deleteDocument('communityPosts', postId)
    if (result.success) {
      refetchPosts()
    } else {
      console.error('Failed to delete post:', result.error)
      alert('Failed to delete post. Please try again.')
    }
  }, [refetchPosts])

  // Handle editing a post (for now just prompt for new content)
  const handleEditPost = useCallback(async (postId: string, currentContent: string) => {
    const newContent = window.prompt('Edit your post:', currentContent)
    if (newContent === null || newContent.trim() === currentContent) return

    const result = await updateDocument('communityPosts', postId, { content: newContent.trim() })
    if (result.success) {
      refetchPosts()
    } else {
      console.error('Failed to update post:', result.error)
      alert('Failed to update post. Please try again.')
    }
  }, [refetchPosts])

  // Handle prompt selection
  const handlePromptSelect = (prompt: string) => {
    setSelectedPrompt(prompt)
    // Scroll to top smoothly to show the post form
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const communityStatRows = [
    { label: 'Members', value: formatStatValue(communityStats?.members ?? null) },
    { label: 'Wall posts', value: formatStatValue(communityStats?.wallPosts ?? null) },
    { label: 'Posts this week', value: formatStatValue(communityStats?.postsThisWeek ?? null) },
    { label: 'Quest completions', value: formatStatValue(communityStats?.questCompletions ?? null) },
    { label: 'Completions this week', value: formatStatValue(communityStats?.completionsThisWeek ?? null) },
    { label: 'Upcoming exhibitions', value: formatStatValue(communityStats?.upcomingExhibitions ?? null) },
    { label: 'Recent badge awards', value: recentBadgeAwardsCount.toLocaleString() },
  ]

  return (
    <Box bg="gray.950" minH="100vh">
      <Header />

      <Box as="main" pt={{ base: 20, md: 32 }} pb={20}>
        <Container maxW="1440px" px={{ base: 4, md: 12, lg: 16, xl: 20 }}>
          {/* Hero - More compact on mobile */}
          <MotionBox
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            mb={{ base: 6, md: 12 }}
          >
            <Text
              color="brand.500"
              fontSize="xs"
              textTransform="uppercase"
              letterSpacing="0.3em"
              mb={2}
            >
              Community
            </Text>

            <Heading
              as="h1"
              fontSize={{ base: '2rem', md: '4rem', lg: '5rem' }}
              lineHeight={1.1}
              color="white"
              fontFamily="heading"
              mb={{ base: 2, md: 6 }}
            >
              The Wall
            </Heading>

            <Text
              color="whiteAlpha.500"
              fontSize={{ base: 'sm', md: 'lg' }}
              maxW="2xl"
              display={{ base: 'none', md: 'block' }}
            >
              Share your creative journey, connect with fellow artists, and find inspiration.
            </Text>
          </MotionBox>

          {/* Two column layout - stacks on mobile */}
          <Flex gap={8} direction={{ base: 'column', lg: 'row' }}>
            {/* Main Feed */}
            <Box flex={{ lg: 2 }}>
              {/* Post Composer */}
              <MotionBox
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                mb={6}
              >
                <PostForm
                  userId={currentUserId || ''}
                  userName={currentUserName}
                  userPhotoURL={currentUserPhoto}
                  onSubmit={handleCreatePost}
                  initialPrompt={selectedPrompt || undefined}
                  onPromptClear={() => setSelectedPrompt(null)}
                />
              </MotionBox>

              {/* Quick Prompts - Mobile only, below composer */}
              <Box display={{ base: 'block', lg: 'none' }} mb={6}>
                <ConversationStarters
                  prompts={communityPrompts}
                  onSelect={handlePromptSelect}
                />
              </Box>

              {/* Tabs and Stats Row */}
              <Flex
                justify="space-between"
                align="center"
                mb={4}
                gap={4}
                flexWrap={{ base: 'wrap', sm: 'nowrap' }}
              >
                <HStack gap={2}>
                  <Button
                    onClick={() => setActiveTab('all')}
                    bg={activeTab === 'all' ? 'brand.500' : 'transparent'}
                    color={activeTab === 'all' ? 'white' : 'whiteAlpha.600'}
                    border="1px solid"
                    borderColor={activeTab === 'all' ? 'brand.500' : 'whiteAlpha.200'}
                    borderRadius="full"
                    px={5}
                    size="sm"
                    fontSize="xs"
                    _hover={{
                      bg: activeTab === 'all' ? 'brand.600' : 'whiteAlpha.50',
                    }}
                  >
                    All Activity
                  </Button>
                  <Button
                    onClick={() => setActiveTab('following')}
                    bg={activeTab === 'following' ? 'brand.500' : 'transparent'}
                    color={activeTab === 'following' ? 'white' : 'whiteAlpha.600'}
                    border="1px solid"
                    borderColor={activeTab === 'following' ? 'brand.500' : 'whiteAlpha.200'}
                    borderRadius="full"
                    px={5}
                    size="sm"
                    fontSize="xs"
                    _hover={{
                      bg: activeTab === 'following' ? 'brand.600' : 'whiteAlpha.50',
                    }}
                  >
                    Following
                  </Button>
                </HStack>

                {/* Inline stats for mobile */}
                <HStack
                  gap={4}
                  display={{ base: 'flex', lg: 'none' }}
                  color="whiteAlpha.500"
                  fontSize="xs"
                >
                  <Text>
                    <Text as="span" color="white" fontWeight="medium">
                      {formatStatValue(communityStats?.members ?? null)}
                    </Text>{' '}
                    members
                  </Text>
                  <Text>
                    <Text as="span" color="white" fontWeight="medium">
                      {formatStatValue(communityStats?.postsThisWeek ?? null)}
                    </Text>{' '}
                    posts this week
                  </Text>
                </HStack>
              </Flex>

              {/* Activity Feed */}
              <VStack align="stretch" gap={4}>
                {(postsLoading || questSubmissionsLoading || exhibitionsLoading) && feedItems.length === 0 ? (
                  <>
                    <CommunityPostSkeleton />
                    <CommunityPostSkeleton />
                    <CommunityPostSkeleton />
                  </>
                ) : feedItems.length === 0 ? (
                  <Box
                    p={{ base: 6, md: 8 }}
                    borderRadius="2xl"
                    bg="gray.900"
                    border="1px solid"
                    borderColor="whiteAlpha.100"
                    textAlign="center"
                  >
                    <Box
                      w={16}
                      h={16}
                      mx="auto"
                      mb={4}
                      borderRadius="full"
                      bg="whiteAlpha.50"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="rgba(255,255,255,0.3)" />
                      </svg>
                    </Box>
                    <Text color="whiteAlpha.700" fontSize="md" fontWeight="medium" mb={1}>
                      No activity yet
                    </Text>
                    <Text color="whiteAlpha.400" fontSize="sm">
                      Be the first to share a post, complete a quest, or publish an exhibition.
                    </Text>
                  </Box>
                ) : (
                  visibleFeedItems.map((item, i) => {
                    if (item.type !== 'post') {
                      return (
                        <MotionBox
                          key={item.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: i * 0.04 }}
                          style={{
                            contentVisibility: 'auto',
                            containIntrinsicSize: item.type === 'exhibition' ? '320px' : '520px',
                          }}
                        >
                          <WallActivityCard
                            item={item}
                            currentUserId={currentUserId}
                            onSubmissionVote={handleSubmissionVote}
                          />
                        </MotionBox>
                      )
                    }

                    const post = item.post
                    const reactions = localPostReactions[post.id] || post.reactions || {}
                    const commentPage = commentPages[post.id]
                    const displayPost: CommunityPostType = {
                      ...post,
                      reactions,
                      reactionsCount: getReactionsCount(reactions),
                      commentsCount: (post.commentsCount || 0) + (localCommentCountDeltas[post.id] || 0),
                    }

                    return (
                      <MotionBox
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: i * 0.04 }}
                        style={{
                          contentVisibility: 'auto',
                          containIntrinsicSize: '720px',
                        }}
                      >
                        <CommunityPost
                          post={displayPost}
                          comments={commentPage?.comments || []}
                          commentsLoading={commentPage?.loading || false}
                          commentsHasMore={commentPage?.hasMore || false}
                          currentUserId={currentUserId || undefined}
                          onReaction={(reactionType) => handleReaction(post.id, reactionType, displayPost.reactions)}
                          onComment={(content) => handleComment(post.id, content)}
                          onCommentsOpen={() => handleCommentsOpen(post.id)}
                          onLoadMoreComments={() => loadPostComments(post.id)}
                          onEdit={() => handleEditPost(post.id, post.content)}
                          onDelete={() => handleDeletePost(post.id)}
                          onShare={() => {
                            const url = `${window.location.origin}/community/wall?post=${post.id}`
                            if (navigator.share) {
                              navigator.share({
                                title: `Post by ${post.userName}`,
                                text: post.content.slice(0, 100) + (post.content.length > 100 ? '...' : ''),
                                url,
                              }).catch(() => {})
                            } else {
                              navigator.clipboard.writeText(url)
                              alert('Link copied to clipboard!')
                            }
                          }}
                        />
                      </MotionBox>
                    )
                  })
                )}

                {/* Load more button */}
                {canLoadMorePosts && feedItems.length > 0 && (
                  <Flex ref={postLoadSentinelRef} justify="center" pt={4}>
                    <Button
                      onClick={handleLoadMorePosts}
                      disabled={postsLoading}
                      bg="transparent"
                      borderColor="whiteAlpha.200"
                      border="1px solid"
                      color="whiteAlpha.600"
                      borderRadius="full"
                      px={8}
                      size="sm"
                      _hover={{ bg: 'whiteAlpha.50', borderColor: 'whiteAlpha.400' }}
                    >
                      {hasHiddenLoadedFeedItems ? 'Show More Activity' : 'Load More'}
                    </Button>
                  </Flex>
                )}

                {/* Loading indicator */}
                {(postsLoading || questSubmissionsLoading || exhibitionsLoading) && feedItems.length > 0 && (
                  <Flex justify="center" pt={4}>
                    <Spinner color="brand.500" size="sm" />
                  </Flex>
                )}
              </VStack>

            </Box>

            {/* Sidebar - Desktop only */}
            <Box
              flex={{ lg: 1 }}
              display={{ base: 'none', lg: 'block' }}
              maxW={{ lg: '320px' }}
            >
              <MotionBox
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                position="sticky"
                top={24}
              >
                {/* Conversation Starters */}
                <Box
                  p={5}
                  borderRadius="2xl"
                  bg="gray.900"
                  border="1px solid"
                  borderColor="whiteAlpha.100"
                  mb={5}
                >
                  <Heading as="h3" fontSize="sm" color="white" fontFamily="heading" mb={4} textTransform="uppercase" letterSpacing="wider">
                    Conversation Starters
                  </Heading>
                  <VStack align="stretch" gap={2}>
                    {communityPrompts.map((prompt, i) => (
                      <Button
                        key={i}
                        type="button"
                        onClick={() => handlePromptSelect(prompt)}
                        h="auto"
                        minH={11}
                        px={4}
                        py={3}
                        borderRadius="xl"
                        bg="whiteAlpha.50"
                        color="whiteAlpha.700"
                        justifyContent="flex-start"
                        textAlign="left"
                        whiteSpace="normal"
                        fontSize="sm"
                        fontWeight="normal"
                        lineHeight={1.35}
                        _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </VStack>
                </Box>

                {/* Community Stats */}
                <Box
                  p={5}
                  borderRadius="2xl"
                  bg="gray.900"
                  border="1px solid"
                  borderColor="whiteAlpha.100"
                >
                  <Heading as="h3" fontSize="sm" color="white" fontFamily="heading" mb={4} textTransform="uppercase" letterSpacing="wider">
                    Community Stats
                  </Heading>
                  <VStack align="stretch" gap={3}>
                    {communityStatRows.map((stat) => (
                      <Flex key={stat.label} justify="space-between" align="center" gap={4}>
                        <Text color="whiteAlpha.500" fontSize="sm">{stat.label}</Text>
                        <Text color="white" fontSize="sm" fontWeight="semibold" fontFamily="mono">
                          {stat.value}
                        </Text>
                      </Flex>
                    ))}
                  </VStack>
                </Box>
              </MotionBox>
            </Box>
          </Flex>
        </Container>
      </Box>

      <Footer />
    </Box>
  )
}
