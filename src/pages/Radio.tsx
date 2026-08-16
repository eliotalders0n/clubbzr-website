'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AspectRatio,
  Avatar,
  Badge,
  Box,
  Button,
  Container,
  Flex,
  Grid,
  Heading,
  HStack,
  Image,
  Input,
  SimpleGrid,
  Slider,
  Spinner,
  Text,
  VStack,
  VisuallyHidden,
} from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { Timestamp } from 'firebase/firestore'
import {
  Clock3,
  Headphones,
  Heart,
  Music2,
  Pause,
  Play,
  Radio as RadioIcon,
  Search,
  Volume2,
} from 'lucide-react'

import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { useAuth } from '@/contexts/AuthContext'
import { useCollection } from '@/hooks/useFirestore'
import { addToArray, incrementField, removeFromArray } from '../../lib'
import type { RadioContent, RadioContentType, TracklistItem } from '../../lib'

const MotionBox = motion.create(Box)

type ContentFilter = 'all' | RadioContentType

const filterOptions: { value: ContentFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'mix', label: 'Mixes' },
  { value: 'interview', label: 'Interviews' },
  { value: 'ambient', label: 'Ambient' },
  { value: 'podcast', label: 'Podcasts' },
  { value: 'playlist', label: 'Playlists' },
  { value: 'live_session', label: 'Live Sessions' },
]

const typeLabels: Record<RadioContentType, string> = {
  mix: 'Mix',
  interview: 'Interview',
  ambient: 'Ambient',
  podcast: 'Podcast',
  live_session: 'Live Session',
  playlist: 'Playlist',
}

const typeStyles: Record<RadioContentType, { bg: string; color: string }> = {
  mix: { bg: 'brand.500', color: 'white' },
  interview: { bg: 'blue.500', color: 'white' },
  ambient: { bg: 'purple.500', color: 'white' },
  podcast: { bg: 'green.500', color: 'black' },
  live_session: { bg: 'orange.500', color: 'black' },
  playlist: { bg: 'cyan.500', color: 'black' },
}

const fallbackCoverImage = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&q=80'
const fallbackAudioUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'

function formatDuration(seconds = 0): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const hrs = Math.floor(safeSeconds / 3600)
  const mins = Math.floor((safeSeconds % 3600) / 60)
  const secs = safeSeconds % 60

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function toMillis(value: RadioContent['publishedAt'] | undefined): number {
  if (!value) return 0
  if (value instanceof Timestamp) return value.toMillis()
  if (value instanceof Date) return value.getTime()

  if (typeof value === 'object') {
    if ('toMillis' in value && typeof value.toMillis === 'function') {
      return value.toMillis()
    }

    if ('toDate' in value && typeof value.toDate === 'function') {
      return value.toDate().getTime()
    }
  }

  return 0
}

function formatDate(value: RadioContent['publishedAt'] | undefined): string {
  const millis = toMillis(value)
  if (!millis) return 'Draft'

  return new Date(millis).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getArtistName(content: RadioContent): string {
  return content.artist?.name || 'Club BZR Radio'
}

function isRadioContentType(value: string): value is RadioContentType {
  return value in typeLabels
}

function normalizeRadioContent(item: RadioContent): RadioContent {
  const now = Timestamp.fromDate(new Date())
  const type = isRadioContentType(item.type) ? item.type : 'mix'

  return {
    ...item,
    title: item.title || 'Untitled radio drop',
    type,
    audioUrl: item.audioUrl || fallbackAudioUrl,
    duration: Number.isFinite(item.duration) ? item.duration : 0,
    description: item.description || 'Audio from the Club BZR community.',
    artist: item.artist?.name ? item.artist : { name: 'Club BZR Radio' },
    coverImage: item.coverImage || fallbackCoverImage,
    createdAt: item.createdAt || now,
    publishedAt: item.publishedAt || item.createdAt || now,
    playCount: Number.isFinite(item.playCount) ? item.playCount : 0,
    likesCount: Number.isFinite(item.likesCount) ? item.likesCount : 0,
    likedBy: Array.isArray(item.likedBy) ? item.likedBy : [],
    featured: Boolean(item.featured),
    isPublished: item.isPublished !== false,
    tags: Array.isArray(item.tags) ? item.tags : [],
    tracklist: Array.isArray(item.tracklist) ? item.tracklist : undefined,
  }
}

function getWaveBars(id: string): number[] {
  const seed = id.split('').reduce((total, char) => total + char.charCodeAt(0), 0)
  return Array.from({ length: 34 }, (_, index) => 18 + ((seed + index * 23) % 42))
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: string
  onClick: () => void
}) {
  return (
    <Button
      onClick={onClick}
      size="sm"
      borderRadius="full"
      px={5}
      bg={active ? 'brand.500' : 'whiteAlpha.50'}
      color={active ? 'white' : 'whiteAlpha.700'}
      border="1px solid"
      borderColor={active ? 'brand.500' : 'whiteAlpha.200'}
      _hover={{ bg: active ? 'brand.600' : 'whiteAlpha.100', color: 'white' }}
    >
      {children}
    </Button>
  )
}

function ArtistAvatar({ content, size = 'sm' }: { content: RadioContent; size?: 'sm' | 'md' }) {
  const name = getArtistName(content)

  return (
    <Avatar.Root size={size}>
      <Avatar.Fallback bg="whiteAlpha.200" color="white">
        {name.charAt(0)}
      </Avatar.Fallback>
      {content.artist?.photoURL && <Avatar.Image src={content.artist.photoURL} alt={name} />}
    </Avatar.Root>
  )
}

function Waveform({ contentId, isPlaying }: { contentId: string; isPlaying: boolean }) {
  const bars = useMemo(() => getWaveBars(contentId), [contentId])

  return (
    <HStack align="center" justify="center" gap="2px" h={{ base: 20, md: 24 }} w="full" px={4}>
      {bars.map((height, index) => (
        <MotionBox
          key={`${contentId}-${index}`}
          w="4px"
          borderRadius="full"
          bg="brand.500"
          animate={{ height: isPlaying ? [18, height, 18] : height * 0.55 }}
          transition={{
            duration: 0.55 + (index % 6) * 0.08,
            repeat: isPlaying ? Infinity : 0,
            repeatType: 'reverse',
            delay: index * 0.015,
          }}
        />
      ))}
    </HStack>
  )
}

function Tracklist({
  tracklist,
  currentTime,
  onSeek,
}: {
  tracklist?: TracklistItem[]
  currentTime: number
  onSeek: (time: number) => void
}) {
  if (!tracklist || tracklist.length === 0) return null

  return (
    <Box
      mt={4}
      p={4}
      bg="whiteAlpha.50"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="xl"
    >
      <Text color="white" fontWeight="semibold" mb={3}>
        Tracklist
      </Text>
      <VStack align="stretch" gap={2} maxH="220px" overflowY="auto">
        {tracklist.map((track, index) => {
          const nextTimestamp = tracklist[index + 1]?.timestamp
          const active =
            track.timestamp !== undefined &&
            currentTime >= track.timestamp &&
            (nextTimestamp === undefined || currentTime < nextTimestamp)

          return (
            <Button
              key={`${track.position}-${track.title}`}
              onClick={() => track.timestamp !== undefined && onSeek(track.timestamp)}
              justifyContent="start"
              h="auto"
              py={2}
              px={3}
              borderRadius="lg"
              bg={active ? 'brand.500/20' : 'transparent'}
              color={active ? 'brand.300' : 'whiteAlpha.700'}
              _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
              disabled={track.timestamp === undefined}
            >
              <HStack w="full" gap={3} minW={0}>
                <Text fontSize="xs" fontFamily="mono" color="whiteAlpha.500" w="44px">
                  {track.timestamp !== undefined ? formatDuration(track.timestamp) : `${track.position}.`}
                </Text>
                <Text fontSize="sm" truncate>
                  {track.artist} - {track.title}
                </Text>
              </HStack>
            </Button>
          )
        })}
      </VStack>
    </Box>
  )
}

function PlayerPanel({
  content,
  isPlaying,
  currentTime,
  duration,
  volume,
  onPlayPause,
  onSeek,
  onVolumeChange,
}: {
  content: RadioContent
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  onPlayPause: () => void
  onSeek: (time: number) => void
  onVolumeChange: (volume: number) => void
}) {
  const seekValue = duration > 0 ? Math.min(duration, currentTime) : 0

  return (
    <Box
      bg="gray.900"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="2xl"
      p={{ base: 4, md: 5 }}
      boxShadow="0 20px 80px rgba(0,0,0,0.35)"
    >
      <Grid templateColumns={{ base: '1fr', md: 'auto 1fr auto' }} gap={5} alignItems="center">
        <HStack gap={4} minW={0}>
          <Box w={16} h={16} borderRadius="xl" overflow="hidden" flexShrink={0} bg="whiteAlpha.100">
            <Image src={content.coverImage} alt={content.title} w="full" h="full" objectFit="cover" />
          </Box>
          <Box minW={0}>
            <Text color="white" fontWeight="semibold" truncate>
              {content.title}
            </Text>
            <Text color="whiteAlpha.500" fontSize="sm" truncate>
              {getArtistName(content)}
            </Text>
          </Box>
        </HStack>

        <Box>
          <HStack mb={2} gap={3}>
            <Text color="whiteAlpha.500" fontSize="xs" fontFamily="mono" minW="42px">
              {formatDuration(currentTime)}
            </Text>
            <Slider.Root
              value={[seekValue]}
              min={0}
              max={Math.max(duration, 0)}
              step={1}
              flex={1}
              disabled={duration <= 0}
              onValueChange={(details) => onSeek(details.value[0] ?? seekValue)}
            >
              <VisuallyHidden>
                <Text as="span">Seek audio position</Text>
              </VisuallyHidden>
              <Slider.Control h="18px">
                <Slider.Track h="6px" bg="whiteAlpha.100" borderRadius="full">
                  <Slider.Range bg="brand.500" borderRadius="full" />
                </Slider.Track>
                <Slider.Thumbs
                  boxSize="14px"
                  bg="white"
                  border="2px solid"
                  borderColor="brand.500"
                  boxShadow="0 0 0 4px rgba(255, 107, 53, 0.14)"
                />
              </Slider.Control>
            </Slider.Root>
            <Text color="whiteAlpha.500" fontSize="xs" fontFamily="mono" minW="42px" textAlign="right">
              {formatDuration(duration)}
            </Text>
          </HStack>
        </Box>

        <HStack gap={4} justify={{ base: 'space-between', md: 'end' }}>
          <Button
            onClick={onPlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            w={12}
            h={12}
            minW={12}
            p={0}
            borderRadius="full"
            bg="brand.500"
            color="white"
            _hover={{ bg: 'brand.600' }}
          >
            {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
          </Button>

          <HStack w={{ base: '140px', md: '150px' }} gap={3}>
            <Volume2 size={18} color="rgba(255,255,255,0.55)" />
            <Slider.Root
              value={[volume]}
              min={0}
              max={1}
              step={0.05}
              flex={1}
              onValueChange={(details) => onVolumeChange(details.value[0] ?? volume)}
            >
              <VisuallyHidden>
                <Text as="span">Volume</Text>
              </VisuallyHidden>
              <Slider.Control h="18px">
                <Slider.Track h="5px" bg="whiteAlpha.200" borderRadius="full">
                  <Slider.Range bg="brand.500" borderRadius="full" />
                </Slider.Track>
                <Slider.Thumbs boxSize="12px" bg="white" border="2px solid" borderColor="whiteAlpha.700" />
              </Slider.Control>
            </Slider.Root>
          </HStack>
        </HStack>
      </Grid>
    </Box>
  )
}

function ContentCard({
  content,
  isCurrent,
  isPlaying,
  isLiked,
  userId,
  onPlay,
  onLike,
}: {
  content: RadioContent
  isCurrent: boolean
  isPlaying: boolean
  isLiked: boolean
  userId?: string
  onPlay: (content: RadioContent) => void
  onLike: (content: RadioContent) => void
}) {
  const typeStyle = typeStyles[content.type]

  return (
    <MotionBox
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      bg="gray.900"
      border="1px solid"
      borderColor={isCurrent ? 'brand.500' : 'whiteAlpha.100'}
      borderRadius="2xl"
      overflow="hidden"
      role="group"
    >
      <Grid templateColumns={{ base: '104px minmax(0, 1fr)', md: '144px minmax(0, 1fr)' }}>
        <Box position="relative" bg="whiteAlpha.100">
          <Image src={content.coverImage} alt={content.title} w="full" h="full" minH={{ base: 36, md: 40 }} objectFit="cover" />
          <Flex position="absolute" inset={0} align="center" justify="center" bg="blackAlpha.500" opacity={isCurrent ? 1 : 0} _groupHover={{ opacity: 1 }} transition="opacity 0.2s">
            <Button
              onClick={() => onPlay(content)}
              aria-label={isCurrent && isPlaying ? 'Pause content' : 'Play content'}
              w={12}
              h={12}
              minW={12}
              p={0}
              borderRadius="full"
              bg="brand.500"
              color="white"
              _hover={{ bg: 'brand.600' }}
            >
              {isCurrent && isPlaying ? (
                <Pause size={20} fill="currentColor" />
              ) : (
                <Play size={20} fill="currentColor" />
              )}
            </Button>
          </Flex>
        </Box>

        <Flex direction="column" gap={3} p={{ base: 4, md: 5 }} minW={0}>
          <HStack justify="space-between" align="start" gap={3}>
            <Box minW={0}>
              <HStack gap={2} mb={2} flexWrap="wrap">
                <Badge bg={typeStyle.bg} color={typeStyle.color} borderRadius="full" px={2} py={0.5}>
                  {typeLabels[content.type]}
                </Badge>
                {content.featured && (
                  <Badge bg="whiteAlpha.100" color="whiteAlpha.800" borderRadius="full" px={2} py={0.5}>
                    Featured
                  </Badge>
                )}
              </HStack>
              <Heading
                as="h3"
                color="white"
                fontFamily="heading"
                fontSize={{ base: 'md', md: 'xl' }}
                lineHeight={1.15}
                truncate
              >
                {content.title}
              </Heading>
            </Box>

            <Button
              onClick={() => onLike(content)}
              aria-label={isLiked ? 'Unlike content' : 'Like content'}
              disabled={!userId}
              variant="ghost"
              size="sm"
              color={isLiked ? 'red.400' : 'whiteAlpha.500'}
              _hover={{ color: 'red.300', bg: 'whiteAlpha.100' }}
              px={2}
            >
              <Heart size={17} fill={isLiked ? 'currentColor' : 'none'} />
              <Text as="span" ml={1}>
                {content.likesCount || 0}
              </Text>
            </Button>
          </HStack>

          <Text color="whiteAlpha.600" fontSize="sm" lineClamp={2}>
            {content.description}
          </Text>

          <Flex
            justify="space-between"
            align={{ base: 'start', md: 'center' }}
            direction={{ base: 'column', md: 'row' }}
            gap={3}
            mt="auto"
          >
            <HStack minW={0} gap={2}>
              <ArtistAvatar content={content} />
              <Text color="whiteAlpha.600" fontSize="sm" truncate>
                {getArtistName(content)}
              </Text>
            </HStack>

            <HStack color="whiteAlpha.500" fontSize="xs" gap={4} flexWrap="wrap">
              <HStack gap={1.5}>
                <Clock3 size={14} />
                <Text>{formatDuration(content.duration)}</Text>
              </HStack>
              <HStack gap={1.5}>
                <Headphones size={14} />
                <Text>{(content.playCount || 0).toLocaleString()}</Text>
              </HStack>
              <Text>{formatDate(content.publishedAt)}</Text>
            </HStack>
          </Flex>
        </Flex>
      </Grid>
    </MotionBox>
  )
}

export default function Radio() {
  const { user, hasRole } = useAuth()
  const [activeFilter, setActiveFilter] = useState<ContentFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const loadedContentIdRef = useRef<string | null>(null)
  const loadedAudioUrlRef = useRef<string | null>(null)
  const countedPlaysRef = useRef(new Set<string>())

  const { data: fetchedContent, loading, error } = useCollection('radioContent', {
    orderBy: 'publishedAt',
    orderDirection: 'desc',
  })

  const content = useMemo(() => {
    return fetchedContent
      .map(normalizeRadioContent)
      .filter((item) => item.isPublished !== false)
      .sort((a, b) => toMillis(b.publishedAt) - toMillis(a.publishedAt))
  }, [fetchedContent])

  const hiddenDraftCount = useMemo(
    () => fetchedContent.filter((item) => item.isPublished === false).length,
    [fetchedContent]
  )
  const canSeeAdminHint = hasRole(['admin', 'curator'])

  const currentContent = useMemo(() => {
    return (
      content.find((item) => item.id === selectedId) ||
      content.find((item) => item.featured) ||
      content[0] ||
      null
    )
  }, [content, selectedId])

  const filteredContent = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return content.filter((item) => {
      const matchesType = activeFilter === 'all' || item.type === activeFilter
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        getArtistName(item).toLowerCase().includes(query) ||
        item.tags.some((tag) => tag.toLowerCase().includes(query))

      return matchesType && matchesSearch
    })
  }, [activeFilter, content, searchQuery])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentContent) return

    if (
      loadedContentIdRef.current !== currentContent.id ||
      loadedAudioUrlRef.current !== currentContent.audioUrl
    ) {
      audio.pause()
      audio.src = currentContent.audioUrl
      audio.preload = 'metadata'
      audio.volume = volume
      audio.load()
      loadedContentIdRef.current = currentContent.id
      loadedAudioUrlRef.current = currentContent.audioUrl
      setCurrentTime(0)
      setAudioDuration(currentContent.duration || 0)
    }
  }, [currentContent, volume])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const getNativeDuration = () => (
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : currentContent?.duration || 0
    )
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleLoadedMetadata = () => setAudioDuration(getNativeDuration())
    const handleDurationChange = () => setAudioDuration(getNativeDuration())
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
      audio.currentTime = 0
    }
    const handleError = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('durationchange', handleDurationChange)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('durationchange', handleDurationChange)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [currentContent?.duration])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  useEffect(() => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.play().catch((playError) => {
        console.error('Radio playback failed:', playError)
        setIsPlaying(false)
      })
    } else {
      audioRef.current.pause()
    }
  }, [isPlaying, currentContent?.id])

  useEffect(() => {
    const audio = audioRef.current

    return () => {
      audio?.pause()
    }
  }, [])

  useEffect(() => {
    if (!isPlaying || !currentContent || countedPlaysRef.current.has(currentContent.id)) return

    countedPlaysRef.current.add(currentContent.id)
    void incrementField('radioContent', currentContent.id, 'playCount', 1)
  }, [currentContent, isPlaying])

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current

    if (!audio) {
      setIsPlaying((playing) => !playing)
      return
    }

    if (audio.paused || audio.ended) {
      setIsPlaying(true)
      return
    }

    audio.pause()
    setIsPlaying(false)
  }, [])

  const handlePlayContent = useCallback(
    (nextContent: RadioContent) => {
      if (currentContent?.id === nextContent.id) {
        handlePlayPause()
        return
      }

      setSelectedId(nextContent.id)
      setCurrentTime(0)
      setAudioDuration(nextContent.duration || 0)
      setIsPlaying(true)
    },
    [currentContent?.id, handlePlayPause]
  )

  const handleSeek = useCallback((time: number) => {
    const duration = audioDuration || currentContent?.duration || 0
    const maxTime = duration > 0 ? duration : Number.POSITIVE_INFINITY
    const safeTime = Number.isFinite(time) ? Math.min(Math.max(0, time), maxTime) : 0
    setCurrentTime(safeTime)
    if (audioRef.current) {
      try {
        audioRef.current.currentTime = safeTime
      } catch (seekError) {
        console.error('Radio seek failed:', seekError)
      }
    }
  }, [audioDuration, currentContent?.duration])

  const handleLike = useCallback(
    async (item: RadioContent) => {
      if (!user) return

      const liked = item.likedBy?.includes(user.uid) ?? false

      try {
        if (liked) {
          await removeFromArray('radioContent', item.id, 'likedBy', user.uid)
          await incrementField('radioContent', item.id, 'likesCount', -1)
        } else {
          await addToArray('radioContent', item.id, 'likedBy', user.uid)
          await incrementField('radioContent', item.id, 'likesCount', 1)
        }
      } catch (likeError) {
        console.error('Radio like update failed:', likeError)
      }
    },
    [user]
  )

  const isContentLiked = useCallback(
    (item: RadioContent) => (user ? item.likedBy?.includes(user.uid) ?? false : false),
    [user]
  )

  const displayDuration = audioDuration || currentContent?.duration || 0

  if (loading && fetchedContent.length === 0) {
    return (
      <Box bg="gray.950" minH="100vh">
        <Header />
        <Flex align="center" justify="center" minH="70vh">
          <Spinner size="xl" color="brand.500" borderWidth="3px" />
        </Flex>
        <Footer />
      </Box>
    )
  }

  return (
    <Box bg="gray.950" minH="100vh">
      <audio ref={audioRef} preload="metadata" />
      <Header />

      <Box as="main" pt={{ base: '76px', md: '112px' }} pb={{ base: 16, md: 20 }}>
        <Container maxW="1680px" px={{ base: 4, md: 8, lg: 10 }}>
          <MotionBox
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            mb={{ base: 5, md: 6 }}
          >
            <Text color="brand.500" fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="0.18em" mb={2}>
              BZR Radio
            </Text>
            <Heading
              as="h1"
              color="white"
              fontFamily="heading"
              fontSize={{ base: '2.35rem', md: '3rem', lg: '3.5rem' }}
              lineHeight={0.98}
              mb={3}
            >
              Sounds From The Community
            </Heading>
            <Text color="whiteAlpha.500" fontSize={{ base: 'sm', md: 'md' }} maxW="2xl">
              Mixes, interviews, ambient sessions, and artist-led audio from the Club BZR network.
            </Text>
          </MotionBox>

          {currentContent && (
            <Grid
              templateColumns={{ base: '1fr', lg: 'minmax(0, 0.95fr) minmax(360px, 1.05fr)' }}
              gap={{ base: 5, lg: 8 }}
              alignItems="stretch"
              mb={{ base: 8, md: 10 }}
            >
              <MotionBox
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.1 }}
                bg="gray.900"
                border="1px solid"
                borderColor="whiteAlpha.100"
                borderRadius="2xl"
                overflow="hidden"
              >
                <AspectRatio ratio={1}>
                  <Image src={currentContent.coverImage} alt={currentContent.title} objectFit="cover" />
                </AspectRatio>
              </MotionBox>

              <MotionBox
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.2 }}
                bg="gray.900"
                border="1px solid"
                borderColor="whiteAlpha.100"
                borderRadius="2xl"
                p={{ base: 5, md: 8 }}
              >
                <VStack align="stretch" gap={6}>
                  <HStack gap={2} flexWrap="wrap">
                    <Badge
                      bg={typeStyles[currentContent.type].bg}
                      color={typeStyles[currentContent.type].color}
                      borderRadius="full"
                      px={3}
                      py={1}
                    >
                      {typeLabels[currentContent.type]}
                    </Badge>
                    {currentContent.featured && (
                      <Badge bg="whiteAlpha.100" color="whiteAlpha.800" borderRadius="full" px={3} py={1}>
                        Featured
                      </Badge>
                    )}
                  </HStack>

                  <Box>
                    <Heading
                      as="h2"
                      color="white"
                      fontFamily="heading"
                      fontSize={{ base: '2xl', md: '4xl' }}
                      lineHeight={1.05}
                      mb={3}
                    >
                      {currentContent.title}
                    </Heading>
                    <Text color="whiteAlpha.650" fontSize={{ base: 'sm', md: 'md' }}>
                      {currentContent.description}
                    </Text>
                  </Box>

                  <HStack gap={3}>
                    <ArtistAvatar content={currentContent} size="md" />
                    <Box>
                      <Text color="white" fontWeight="semibold">
                        {getArtistName(currentContent)}
                      </Text>
                      <Text color="whiteAlpha.500" fontSize="sm">
                        Artist
                      </Text>
                    </Box>
                  </HStack>

                  <Waveform contentId={currentContent.id} isPlaying={isPlaying} />

                  <SimpleGrid columns={{ base: 2, md: 4 }} gap={3}>
                    <InfoMetric icon={<Clock3 size={16} />} label="Length" value={formatDuration(displayDuration)} />
                    <InfoMetric
                      icon={<Headphones size={16} />}
                      label="Plays"
                      value={(currentContent.playCount || 0).toLocaleString()}
                    />
                    <InfoMetric icon={<Heart size={16} />} label="Likes" value={`${currentContent.likesCount || 0}`} />
                    <InfoMetric icon={<Music2 size={16} />} label="Published" value={formatDate(currentContent.publishedAt)} />
                  </SimpleGrid>
                </VStack>
              </MotionBox>
            </Grid>
          )}

          {currentContent && (
            <Box position="sticky" top={{ base: '84px', md: '92px' }} zIndex={20} mb={{ base: 8, md: 10 }}>
              <PlayerPanel
                content={currentContent}
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={displayDuration}
                volume={volume}
                onPlayPause={handlePlayPause}
                onSeek={handleSeek}
                onVolumeChange={setVolume}
              />
              {currentContent.type === 'mix' && (
                <Tracklist
                  tracklist={currentContent.tracklist}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                />
              )}
            </Box>
          )}

          <MotionBox
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.25 }}
            mb={8}
          >
            <Flex
              justify="space-between"
              align={{ base: 'start', lg: 'center' }}
              gap={5}
              direction={{ base: 'column', lg: 'row' }}
              mb={6}
            >
              <Box>
                <Heading as="h2" color="white" fontFamily="heading" fontSize={{ base: '2xl', md: '3xl' }} mb={2}>
                  Browse Radio
                </Heading>
                <Text color="whiteAlpha.600">
                  Search the archive and keep listening while you move through the page.
                </Text>
              </Box>

              <Box position="relative" w={{ base: 'full', lg: '340px' }}>
                <Box position="absolute" left={4} top="50%" transform="translateY(-50%)" color="whiteAlpha.500">
                  <Search size={18} />
                </Box>
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search radio..."
                  bg="whiteAlpha.50"
                  border="1px solid"
                  borderColor="whiteAlpha.200"
                  color="white"
                  borderRadius="full"
                  h={12}
                  pl={11}
                  _placeholder={{ color: 'whiteAlpha.500' }}
                  _focus={{ borderColor: 'brand.500', boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)' }}
                />
              </Box>
            </Flex>

            <HStack gap={3} flexWrap="wrap">
              {filterOptions.map((filter) => (
                <FilterButton
                  key={filter.value}
                  active={activeFilter === filter.value}
                  onClick={() => setActiveFilter(filter.value)}
                >
                  {filter.label}
                </FilterButton>
              ))}
            </HStack>
          </MotionBox>

          {error && (
            <Box
              mb={6}
              p={4}
              bg="red.500/10"
              border="1px solid"
              borderColor="red.500/30"
              borderRadius="xl"
            >
              <Text color="red.200" fontSize="sm">
                Live radio content could not be loaded. Check Firestore rules or network access.
              </Text>
            </Box>
          )}

          {filteredContent.length > 0 ? (
            <VStack align="stretch" gap={4} mb={16}>
              {filteredContent.map((item) => (
                <ContentCard
                  key={item.id}
                  content={item}
                  isCurrent={currentContent?.id === item.id}
                  isPlaying={isPlaying}
                  isLiked={isContentLiked(item)}
                  userId={user?.uid}
                  onPlay={handlePlayContent}
                  onLike={handleLike}
                />
              ))}
            </VStack>
          ) : (
            <Box
              textAlign="center"
              py={16}
              px={6}
              bg="gray.900"
              border="1px solid"
              borderColor="whiteAlpha.100"
              borderRadius="2xl"
              mb={16}
            >
              <RadioIcon size={36} color="rgba(255,255,255,0.45)" />
              <Heading as="h3" color="white" fontSize="xl" mt={4} mb={2}>
                No radio found
              </Heading>
              <Text color="whiteAlpha.600">
                {canSeeAdminHint && hiddenDraftCount > 0
                  ? `${hiddenDraftCount} radio item${hiddenDraftCount === 1 ? ' is' : 's are'} still in draft. Publish from Admin > Radio to show publicly.`
                  : 'Try another filter or search term.'}
              </Text>
            </Box>
          )}

        </Container>
      </Box>

      <Footer />
    </Box>
  )
}

function InfoMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Box
      bg="blackAlpha.300"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="xl"
      p={4}
      minH="96px"
    >
      <HStack color="whiteAlpha.500" mb={3} gap={2}>
        {icon}
        <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide">
          {label}
        </Text>
      </HStack>
      <Text color="white" fontSize="sm" fontWeight="medium" lineClamp={2}>
        {value}
      </Text>
    </Box>
  )
}
