'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AspectRatio,
  Badge,
  Box,
  Button,
  Center,
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
import {
  ArrowLeft,
  Bookmark,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Expand,
  ExternalLink,
  Heart,
  Link2,
  Monitor,
  UserRound,
  X,
} from 'lucide-react'

import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { PannellumRoom, type PannellumHotSpot, type PannellumRoomHandle } from '@/components/immersive/PannellumRoom'
import { useAuth } from '@/contexts/AuthContext'
import { useDocument } from '@/hooks/useFirestore'
import galleryRoomImage from '@/assets/images/backgrounds/shot-panoramic-composition-living-room.jpg'
import { addToArray, incrementField, removeFromArray } from '../../lib/firestore'
import type { Exhibition as FirebaseExhibition, ExhibitionArtwork } from '../../lib/schema'

interface Artwork {
  id: string
  title: string
  artist: string
  artistId?: string
  artistExternalUrl?: string
  canOpenArtistProfile: boolean
  year?: number
  medium: string
  description?: string
  image: string
  curatorNote?: string
  likedBy: string[]
  likesCount: number
  savedBy: string[]
  savesCount: number
  sharesCount: number
}

interface ExhibitionDisplay {
  id: string
  title: string
  description: string
  curatorStatement?: string
  curator: { name: string; avatar?: string; bio?: string }
  artists: { id: string; name: string; avatar?: string }[]
  artworks: Artwork[]
  startDate?: Date
  endDate?: Date
  tags: string[]
  isOnline: boolean
  virtualTourUrl?: string
}

const MotionBox = motion.create(Box)

const playfulSpring = {
  type: 'spring',
  stiffness: 620,
  damping: 16,
  mass: 0.58,
} as const

const controlPulse = (pulse: number, strength: 'soft' | 'strong' = 'soft') => {
  const direction = pulse % 2 === 0 ? 1 : -1
  const distance = strength === 'strong' ? 5 : 3
  const twist = strength === 'strong' ? 4 : 2

  return {
    y: [0, -distance * direction, distance * 0.32 * direction, 0],
    rotate: [0, -twist * direction, twist * 0.65 * direction, 0],
    scale: [1, strength === 'strong' ? 1.05 : 1.03, 0.995, 1],
  }
}

const ROOM_YAW_SLOTS = [0, 68, -68, 136, -136, 180, 34, -34, 102, -102, 154, -154]

const normalizeYaw = (yaw: number) => {
  const normalized = ((yaw + 180) % 360 + 360) % 360
  return normalized - 180
}

const getRoomArtworkAnchor = (index: number) => ({
  yaw: ROOM_YAW_SLOTS[index] ?? normalizeYaw(index * 48),
  pitch: -4 + ((index % 3) - 1) * 1.15,
})

type MutableRefValue<T> = { current: T }

type ArtworkHotspotTooltipArgs = {
  artwork: Artwork
  index: number
  artworkCount: number
  selectedIndexRef: MutableRefValue<number>
  focusArtworkRef: MutableRefValue<(index: number, duration?: number) => void>
  hotspotElementsRef: MutableRefValue<Map<number, HTMLElement>>
}

const createArtworkHotspotElement = (hotSpotDiv: HTMLElement, args: unknown) => {
  const {
    artwork,
    index,
    artworkCount,
    selectedIndexRef,
    focusArtworkRef,
    hotspotElementsRef,
  } = args as ArtworkHotspotTooltipArgs

  hotSpotDiv.setAttribute('data-gallery-control', '')
  hotSpotDiv.setAttribute('aria-label', artwork.title)

  const card = document.createElement('button')
  card.type = 'button'
  card.className = 'club-wall-artwork-card'
  card.setAttribute('aria-label', `View ${artwork.title}`)
  card.setAttribute('aria-current', selectedIndexRef.current === index ? 'true' : 'false')
  if (selectedIndexRef.current === index) card.classList.add('is-active')

  const media = document.createElement('div')
  media.className = 'club-wall-artwork-media'

  if (artwork.image) {
    const image = document.createElement('img')
    image.className = 'club-wall-artwork-image'
    image.src = artwork.image
    image.alt = artwork.title
    image.decoding = 'async'
    image.loading = 'eager'
    media.appendChild(image)
  } else {
    const fallback = document.createElement('div')
    fallback.className = 'club-wall-artwork-empty'
    fallback.textContent = 'Artwork image unavailable'
    media.appendChild(fallback)
  }

  const body = document.createElement('div')
  body.className = 'club-wall-artwork-body'

  const header = document.createElement('div')
  header.className = 'club-wall-artwork-header'

  const titleGroup = document.createElement('div')
  titleGroup.className = 'club-wall-artwork-title-group'

  const title = document.createElement('h2')
  title.className = 'club-wall-artwork-title'
  title.textContent = artwork.title

  const meta = document.createElement('p')
  meta.className = 'club-wall-artwork-meta'
  meta.textContent = `${artwork.medium}${artwork.year ? ` · ${artwork.year}` : ''}`

  const count = document.createElement('span')
  count.className = 'club-wall-artwork-count'
  count.textContent = `${String(index + 1).padStart(2, '0')} / ${String(artworkCount).padStart(2, '0')}`

  titleGroup.append(title, meta)
  header.append(titleGroup, count)
  body.appendChild(header)

  if (artwork.description) {
    const description = document.createElement('p')
    description.className = 'club-wall-artwork-description'
    description.textContent = artwork.description
    body.appendChild(description)
  }

  card.append(media, body)
  card.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    focusArtworkRef.current(index)
  })

  hotSpotDiv.appendChild(card)
  hotspotElementsRef.current.set(index, card)
}

const toDate = (value: unknown): Date | undefined => {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate()
  }
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }
}

const formatDate = (date?: Date) =>
  date
    ? date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'TBD'

const formatDateRange = (startDate?: Date, endDate?: Date) =>
  `${formatDate(startDate)} - ${endDate ? formatDate(endDate) : 'Ongoing'}`

const formatMedium = (medium: string) =>
  medium.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

const readUserIds = (value: unknown) => Array.isArray(value)
  ? value.filter((id): id is string => typeof id === 'string')
  : []

const readCount = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback

const getArtworkEngagementKey = (exhibitionId: string, artworkId: string) => `${exhibitionId}:${artworkId}`

const transformArtwork = (artwork: ExhibitionArtwork): Artwork => ({
  id: artwork.id,
  title: artwork.title || 'Untitled work',
  artist: artwork.artistName || 'Unknown artist',
  artistId: artwork.artistId || '',
  artistExternalUrl: artwork.artistExternalUrl,
  canOpenArtistProfile: artwork.creditType === 'club_artist' && !!artwork.artistId,
  year: artwork.year,
  medium: formatMedium(artwork.medium || 'mixed_media'),
  description: artwork.description,
  image: artwork.thumbnailUrl || artwork.mediaUrls?.[0] || '',
  curatorNote: artwork.curatorNote,
  likedBy: readUserIds(artwork.likedBy),
  likesCount: readCount(artwork.likesCount, readUserIds(artwork.likedBy).length),
  savedBy: readUserIds(artwork.savedBy),
  savesCount: readCount(artwork.savesCount, readUserIds(artwork.savedBy).length),
  sharesCount: readCount(artwork.sharesCount),
})

const transformExhibition = (doc: FirebaseExhibition): ExhibitionDisplay => {
  const artistMap = new Map<string, { id: string; name: string }>()
  const artworks = [...(doc.artworks || [])].sort((a, b) => a.order - b.order).map(transformArtwork)

  artworks.forEach((artwork) => {
    if (artwork.canOpenArtistProfile && artwork.artistId && !artistMap.has(artwork.artistId)) {
      artistMap.set(artwork.artistId, { id: artwork.artistId, name: artwork.artist })
    }
  })

  return {
    id: doc.id,
    title: doc.title || 'Untitled exhibition',
    description: doc.description || '',
    curatorStatement: doc.curatorStatement,
    curator: {
      name: doc.curator?.name || 'Club BZR Curator',
      avatar: doc.curator?.photoURL,
      bio: doc.curator?.bio,
    },
    artists: Array.from(artistMap.values()),
    artworks,
    startDate: toDate(doc.startDate),
    endDate: toDate(doc.endDate),
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    isOnline: doc.isOnline !== false,
    virtualTourUrl: doc.virtualTourUrl,
  }
}

const uniqueImageSources = (sources: Array<string | undefined>) =>
  Array.from(new Set(sources.filter((source): source is string => Boolean(source))))

const wait = (duration: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, duration)
  })

const preloadImage = (source: string): Promise<boolean> =>
  new Promise((resolve) => {
    const image = new window.Image()
    image.decoding = 'async'

    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      resolve(ok)
    }

    const timeout = window.setTimeout(() => finish(false), 30000)

    image.onload = () => {
      if (image.decode) {
        image.decode().then(() => finish(true)).catch(() => finish(true))
        return
      }
      finish(true)
    }
    image.onerror = () => finish(false)
    image.src = source
  })

const preloadImageSet = async (
  sources: string[],
  onProgress: (progress: number) => void
): Promise<{ loaded: number; failed: number }> => {
  if (sources.length === 0) {
    onProgress(100)
    return { loaded: 0, failed: 0 }
  }

  let completed = 0
  let loaded = 0
  let failed = 0

  await Promise.all(
    sources.map(async (source) => {
      const ok = await preloadImage(source)
      completed += 1
      if (ok) loaded += 1
      else failed += 1
      onProgress(Math.round((completed / sources.length) * 100))
    })
  )

  return { loaded, failed }
}

const copyTextToClipboard = async (text: string) => {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.setAttribute('readonly', '')
  textArea.style.position = 'fixed'
  textArea.style.top = '-1000px'
  document.body.appendChild(textArea)
  textArea.select()
  document.execCommand('copy')
  document.body.removeChild(textArea)
}

const createArtworkShareUrl = (artworkId: string) => {
  const url = new URL(window.location.href)
  url.searchParams.set('artwork', artworkId)
  return url.toString()
}

function InitialAvatar({ name, src, size = 12 }: { name: string; src?: string; size?: number }) {
  return (
    <Flex
      w={size}
      h={size}
      borderRadius="full"
      bg="brand.500"
      align="center"
      justify="center"
      overflow="hidden"
      flexShrink={0}
    >
      {src ? (
        <Image src={src} alt={name} w="full" h="full" objectFit="cover" />
      ) : (
        <Text color="white" fontWeight="bold">
          {name
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)}
        </Text>
      )}
    </Flex>
  )
}

function EmptyArtwork() {
  return (
    <Center w="full" h="full" minH={{ base: '280px', md: '460px' }} bg="gray.900">
      <VStack gap={3}>
        <Box color="whiteAlpha.300">
          <Monitor size={40} />
        </Box>
        <Text color="whiteAlpha.500">Artwork image unavailable</Text>
      </VStack>
    </Center>
  )
}

function ImmersiveGalleryLoading({
  progress,
  error,
  onRetry,
  onCancel,
}: {
  progress: number
  error?: string
  onRetry?: () => void
  onCancel?: () => void
}) {
  return (
    <Flex position="fixed" inset={0} zIndex={100} bg="black" align="center" justify="center" px={6}>
      <VStack gap={5} textAlign="center" maxW="420px">
        <Text color="brand.300" fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="0.22em">
          Preparing Gallery
        </Text>
        <Heading as="h2" color="white" fontSize={{ base: '2xl', md: '3xl' }} fontFamily="heading">
          Loading the full room experience
        </Heading>
        <Text color={error ? 'red.200' : 'whiteAlpha.600'} lineHeight="tall">
          {error || 'Artwork and room assets are being decoded before the immersive view opens.'}
        </Text>
        <Box w="full" h="6px" borderRadius="full" bg="whiteAlpha.100" overflow="hidden">
          <Box h="full" w={`${progress}%`} bg="brand.500" transition="width 0.25s ease" />
        </Box>
        <Text color="whiteAlpha.500" fontFamily="mono" fontSize="sm">
          {progress}%
        </Text>
        {error && (
          <HStack gap={3} justify="center" pt={2}>
            <Button onClick={onCancel} variant="ghost" color="whiteAlpha.800" borderRadius="full" _hover={{ bg: 'whiteAlpha.100' }}>
              Back
            </Button>
            <Button onClick={onRetry} bg="brand.500" color="white" borderRadius="full" _hover={{ bg: 'brand.600' }}>
              Retry
            </Button>
          </HStack>
        )}
      </VStack>
    </Flex>
  )
}

function PlayfulControl({
  children,
  pulse = 0,
  disabled = false,
  strength = 'soft',
  onEngage,
}: {
  children: ReactNode
  pulse?: number
  disabled?: boolean
  strength?: 'soft' | 'strong'
  onEngage?: () => void
}) {
  return (
    <MotionBox
      as="span"
      display="inline-flex"
      flexShrink={0}
      style={{ transformOrigin: 'center' }}
      animate={pulse ? controlPulse(pulse, strength) : undefined}
      transition={playfulSpring}
      whileHover={disabled ? undefined : {
        scale: strength === 'strong' ? 1.15 : 1.1,
        y: strength === 'strong' ? -4 : -2,
        rotate: strength === 'strong' ? -4 : -2,
      }}
      whileTap={disabled ? undefined : {
        scale: strength === 'strong' ? 0.82 : 0.86,
        y: 2,
        rotate: strength === 'strong' ? 8 : 6,
      }}
      onPointerDown={() => {
        if (!disabled) onEngage?.()
      }}
    >
      {children}
    </MotionBox>
  )
}

function GalleryActionRail({
  liked,
  saved,
  onToggleLiked,
  onToggleSaved,
  onShare,
  pulse = 0,
  onEngage,
  mobile = false,
  loveDisabled = false,
  saveDisabled = false,
  shareDisabled = false,
}: {
  liked: boolean
  saved: boolean
  onToggleLiked: () => void
  onToggleSaved: () => void
  onShare: () => void
  pulse?: number
  onEngage?: () => void
  mobile?: boolean
  loveDisabled?: boolean
  saveDisabled?: boolean
  shareDisabled?: boolean
}) {
  const actions = [
    { label: 'Share artwork', icon: <Link2 size={20} />, onClick: onShare, active: false, disabled: shareDisabled },
    { label: liked ? 'Remove love' : 'Love artwork', icon: <Heart size={20} fill={liked ? 'currentColor' : 'none'} />, onClick: onToggleLiked, active: liked, disabled: loveDisabled },
    { label: saved ? 'Remove bookmark' : 'Bookmark artwork', icon: <Bookmark size={20} fill={saved ? 'currentColor' : 'none'} />, onClick: onToggleSaved, active: saved, disabled: saveDisabled },
  ]

  return (
    <Flex
      data-gallery-control
      direction={mobile ? 'row' : 'column'}
      gap={mobile ? 3 : 4}
      p={mobile ? 2 : 3}
      bg="rgba(255,255,255,0.18)"
      border="1px solid"
      borderColor="whiteAlpha.300"
      borderRadius="full"
      backdropFilter="blur(18px)"
      boxShadow="0 22px 70px rgba(0,0,0,0.32)"
    >
      {actions.map((action, index) => (
        <PlayfulControl key={action.label} pulse={pulse + index} strength="strong" onEngage={onEngage}>
          <Button
            aria-label={action.label}
            onClick={action.onClick}
            disabled={action.disabled}
            w={mobile ? 12 : 11}
            h={mobile ? 12 : 11}
            minW={mobile ? 12 : 11}
            p={0}
            borderRadius="full"
            bg={action.active ? 'whiteAlpha.300' : 'whiteAlpha.100'}
            color={action.active ? 'white' : 'whiteAlpha.900'}
            boxShadow={action.active ? '0 0 0 8px rgba(255,255,255,0.1), 0 14px 32px rgba(0,0,0,0.28)' : 'inset 0 0 0 1px rgba(255,255,255,0.08)'}
            transition="background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease"
            _hover={{ bg: 'whiteAlpha.300', color: 'white', boxShadow: '0 0 0 10px rgba(255,255,255,0.08), 0 18px 38px rgba(0,0,0,0.3)' }}
          >
            {action.icon}
          </Button>
        </PlayfulControl>
      ))}
    </Flex>
  )
}

function FullscreenGallery({
  exhibition,
  selectedIndex,
  lovedArtworkKeys,
  bookmarkedArtworkKeys,
  actionFeedback,
  pendingAction,
  onClose,
  onSelect,
  onToggleLove,
  onToggleSave,
  onShareArtwork,
}: {
  exhibition: ExhibitionDisplay
  selectedIndex: number
  lovedArtworkKeys: Set<string>
  bookmarkedArtworkKeys: Set<string>
  actionFeedback?: string
  pendingAction?: string | null
  onClose: () => void
  onSelect: (index: number) => void
  onToggleLove: (artwork: Artwork) => void
  onToggleSave: (artwork: Artwork) => void
  onShareArtwork: (artwork: Artwork) => void
}) {
  const currentArtwork = exhibition.artworks[selectedIndex]
  const artworkCount = exhibition.artworks.length
  const hasPrev = artworkCount > 1
  const hasNext = artworkCount > 1
  const [interactionPulse, setInteractionPulse] = useState(0)
  const panoramaRef = useRef<PannellumRoomHandle>(null)
  const selectedIndexRef = useRef(selectedIndex)
  const focusArtworkRef = useRef<(index: number, duration?: number) => void>(() => undefined)
  const hotspotElementsRef = useRef(new Map<number, HTMLElement>())
  const programmaticMoveRef = useRef(false)
  const programmaticMoveTimeoutRef = useRef<number | undefined>(undefined)
  const lastPulseRef = useRef(0)

  const triggerInteraction = useCallback((force = false) => {
    const now = Date.now()
    if (!force && now - lastPulseRef.current < 140) return
    lastPulseRef.current = now
    setInteractionPulse((value) => value + 1)
  }, [])

  const currentArtworkKey = getArtworkEngagementKey(exhibition.id, currentArtwork.id)
  const liked = lovedArtworkKeys.has(currentArtworkKey)
  const saved = bookmarkedArtworkKeys.has(currentArtworkKey)
  const lovePending = pendingAction === `${currentArtwork.id}:love`
  const savePending = pendingAction === `${currentArtwork.id}:save`

  const roomAnchors = useMemo(
    () => exhibition.artworks.map((artwork, index) => ({
      artwork,
      index,
      ...getRoomArtworkAnchor(index),
    })),
    [exhibition.artworks]
  )

  const getNearestArtwork = useCallback((yaw: number) => {
    return roomAnchors.reduce<{ index: number; distance: number } | null>((nearest, anchor) => {
      const distance = Math.abs(normalizeYaw(anchor.yaw - yaw))
      if (!nearest || distance < nearest.distance) {
        return { index: anchor.index, distance }
      }
      return nearest
    }, null)
  }, [roomAnchors])

  const moveToArtwork = useCallback((index: number, duration = 1000) => {
    const anchor = roomAnchors[index]
    if (!anchor) return

    if (programmaticMoveTimeoutRef.current !== undefined) {
      window.clearTimeout(programmaticMoveTimeoutRef.current)
    }

    programmaticMoveRef.current = duration > 0
    panoramaRef.current?.lookAt({
      pitch: anchor.pitch,
      yaw: anchor.yaw,
      hfov: 78,
      duration,
    })

    if (duration > 0) {
      programmaticMoveTimeoutRef.current = window.setTimeout(() => {
        programmaticMoveRef.current = false
        programmaticMoveTimeoutRef.current = undefined
      }, duration + 180)
    }
  }, [roomAnchors])

  const focusArtwork = useCallback((index: number, duration = 1000) => {
    const roundedIndex = Math.round(index)
    const nextIndex = artworkCount > 1
      ? ((roundedIndex % artworkCount) + artworkCount) % artworkCount
      : 0

    if (selectedIndexRef.current === nextIndex) {
      moveToArtwork(nextIndex, duration)
      return
    }

    onSelect(nextIndex)
  }, [artworkCount, moveToArtwork, onSelect])

  useEffect(() => {
    selectedIndexRef.current = selectedIndex
    hotspotElementsRef.current.forEach((element, index) => {
      const active = index === selectedIndex
      element.classList.toggle('is-active', active)
      element.setAttribute('aria-current', active ? 'true' : 'false')
    })
    moveToArtwork(selectedIndex)
  }, [moveToArtwork, selectedIndex])

  useEffect(() => {
    focusArtworkRef.current = focusArtwork
  }, [focusArtwork])

  const artworkHotSpots = useMemo<PannellumHotSpot[]>(() => roomAnchors.map(({
    artwork,
    index,
    pitch,
    yaw,
  }) => {
    const tooltipArgs: ArtworkHotspotTooltipArgs = {
      artwork,
      index,
      artworkCount,
      selectedIndexRef,
      focusArtworkRef,
      hotspotElementsRef,
    }

    return {
      id: `artwork-${artwork.id}-${index}`,
      pitch,
      yaw,
      type: 'info',
      cssClass: 'club-wall-artwork-hotspot',
      scale: false,
      createTooltipFunc: createArtworkHotspotElement,
      createTooltipArgs: tooltipArgs,
    }
  }), [artworkCount, roomAnchors])

  const handleRoomViewSettled = useCallback((view: { pitch: number; yaw: number; hfov: number }) => {
    if (programmaticMoveRef.current) return

    const nearest = getNearestArtwork(view.yaw)
    if (nearest && nearest.index !== selectedIndex && nearest.distance < Math.max(14, view.hfov * 0.18)) {
      onSelect(nearest.index)
    }
  }, [getNearestArtwork, onSelect, selectedIndex])

  const pulseDirection = interactionPulse % 2 === 0 ? 1 : -1

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && hasPrev) focusArtwork(selectedIndex - 1)
      if (event.key === 'ArrowRight' && hasNext) focusArtwork(selectedIndex + 1)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
      if (programmaticMoveTimeoutRef.current !== undefined) {
        window.clearTimeout(programmaticMoveTimeoutRef.current)
      }
    }
  }, [focusArtwork, hasNext, hasPrev, onClose, selectedIndex])

  return (
    <Box
      position="fixed"
      inset={0}
      zIndex={100}
      bg="black"
      overflow="hidden"
      color="white"
      userSelect="none"
    >
      <Box position="absolute" inset={0}>
        <PannellumRoom
          ref={panoramaRef}
          src={galleryRoomImage}
          hotSpots={artworkHotSpots}
          onLoad={() => moveToArtwork(selectedIndex, 0)}
          onSettle={handleRoomViewSettled}
        />
      </Box>
      <Box position="absolute" inset={0} bg="rgba(0,0,0,0.32)" pointerEvents="none" />
      <Box position="absolute" inset={0} bg="radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.38) 82%)" pointerEvents="none" />
      <MotionBox
        position="absolute"
        inset="-18%"
        pointerEvents="none"
        bg="linear-gradient(105deg, transparent 34%, rgba(255,255,255,0.13) 49%, transparent 64%)"
        mixBlendMode="screen"
        animate={interactionPulse ? {
          x: pulseDirection > 0 ? ['-22%', '8%', '34%'] : ['34%', '8%', '-22%'],
          opacity: [0, 0.16, 0],
        } : undefined}
        transition={{ duration: 0.62, ease: 'easeOut' }}
      />

      <Flex data-gallery-control position="absolute" top={{ base: 5, md: 7 }} left={{ base: 5, md: 8 }} right={{ base: 5, md: 8 }} justify="space-between" align="center" zIndex={4}>
        <PlayfulControl pulse={interactionPulse} strength="soft" onEngage={() => triggerInteraction(true)}>
          <Button
            onClick={onClose}
            bg="rgba(255,255,255,0.14)"
            color="white"
            border="1px solid"
            borderColor="rgba(255,255,255,0.25)"
            borderRadius="full"
            px={4}
            h={11}
            backdropFilter="blur(16px)"
            boxShadow="0 14px 34px rgba(0,0,0,0.24)"
            _hover={{ bg: 'rgba(255,255,255,0.24)', boxShadow: '0 18px 42px rgba(0,0,0,0.3)' }}
          >
            <ChevronLeft size={18} />
            Exhibition
          </Button>
        </PlayfulControl>
        <PlayfulControl pulse={interactionPulse + 1} strength="strong" onEngage={() => triggerInteraction(true)}>
          <Button
            aria-label="Close immersive viewer"
            onClick={onClose}
            bg="rgba(255,255,255,0.14)"
            color="white"
            border="1px solid"
            borderColor="rgba(255,255,255,0.25)"
            borderRadius="full"
            w={11}
            h={11}
            backdropFilter="blur(16px)"
            boxShadow="0 14px 34px rgba(0,0,0,0.24)"
            _hover={{ bg: 'rgba(255,255,255,0.24)', boxShadow: '0 18px 42px rgba(0,0,0,0.3)' }}
          >
            <X size={20} />
          </Button>
        </PlayfulControl>
      </Flex>

      <Box position="absolute" display={{ base: 'none', md: 'block' }} left={{ md: 8, xl: 12 }} top="50%" transform="translateY(-50%)" zIndex={4}>
        <GalleryActionRail
          liked={liked}
          saved={saved}
          onToggleLiked={() => onToggleLove(currentArtwork)}
          onToggleSaved={() => onToggleSave(currentArtwork)}
          onShare={() => onShareArtwork(currentArtwork)}
          pulse={interactionPulse}
          onEngage={() => triggerInteraction(true)}
          loveDisabled={lovePending}
          saveDisabled={savePending}
        />
      </Box>

      <Box
        data-gallery-control
        position="absolute"
        left="50%"
        bottom={{ base: 24, md: 8 }}
        transform="translateX(-50%)"
        zIndex={4}
      >
        <MotionBox
          display="flex"
          alignItems="center"
          gap={{ base: 3, md: 4 }}
          p={2}
          pr={{ base: 2, md: 4 }}
          borderRadius="full"
          bg="rgba(255,255,255,0.18)"
          border="1px solid"
          borderColor="whiteAlpha.300"
          backdropFilter="blur(18px)"
          boxShadow="0 22px 70px rgba(0,0,0,0.32)"
          minW={{ base: 'min(88vw, 460px)', md: '460px' }}
          animate={interactionPulse ? controlPulse(interactionPulse, 'soft') : undefined}
          transition={playfulSpring}
        >
          <PlayfulControl pulse={interactionPulse + 2} disabled={!hasPrev} strength="strong" onEngage={() => triggerInteraction(true)}>
            <Button
              aria-label="Previous artwork"
              onClick={() => focusArtwork(selectedIndex - 1)}
              disabled={!hasPrev}
              w={11}
              h={11}
              minW={11}
              p={0}
              borderRadius="full"
              bg="rgba(255,255,255,0.12)"
              color="white"
              _hover={{ bg: 'rgba(255,255,255,0.25)' }}
            >
              <ChevronLeft size={20} />
            </Button>
          </PlayfulControl>
          <InitialAvatar name={currentArtwork.artist} size={14} />
          <Box flex={1} minW={0}>
            <Text color="white" fontWeight="semibold" truncate>
              {currentArtwork.artist}
            </Text>
            <Text color="whiteAlpha.600" fontSize="sm" truncate>
              {exhibition.title}
            </Text>
          </Box>
          <PlayfulControl pulse={interactionPulse + 3} disabled={!hasNext} strength="strong" onEngage={() => triggerInteraction(true)}>
            <Button
              aria-label="Next artwork"
              onClick={() => focusArtwork(selectedIndex + 1)}
              disabled={!hasNext}
              w={11}
              h={11}
              minW={11}
              p={0}
              borderRadius="full"
              bg="rgba(255,255,255,0.12)"
              color="white"
              _hover={{ bg: 'rgba(255,255,255,0.25)' }}
            >
              <ChevronRight size={20} />
            </Button>
          </PlayfulControl>
        </MotionBox>
      </Box>

      <Box position="absolute" display={{ base: 'block', md: 'none' }} left="50%" bottom={5} transform="translateX(-50%)" zIndex={5}>
        <GalleryActionRail
          mobile
          liked={liked}
          saved={saved}
          onToggleLiked={() => onToggleLove(currentArtwork)}
          onToggleSaved={() => onToggleSave(currentArtwork)}
          onShare={() => onShareArtwork(currentArtwork)}
          pulse={interactionPulse}
          onEngage={() => triggerInteraction(true)}
          loveDisabled={lovePending}
          saveDisabled={savePending}
        />
      </Box>
      {actionFeedback && (
        <Text
          data-gallery-control
          position="absolute"
          left="50%"
          bottom={{ base: 24, md: 24 }}
          transform="translateX(-50%)"
          zIndex={6}
          px={4}
          py={2}
          borderRadius="full"
          bg="rgba(0,0,0,0.58)"
          border="1px solid"
          borderColor="whiteAlpha.200"
          color="whiteAlpha.900"
          fontSize="sm"
          backdropFilter="blur(14px)"
          whiteSpace="nowrap"
          pointerEvents="none"
        >
          {actionFeedback}
        </Text>
      )}
    </Box>
  )
}

export default function ExhibitionView() {
  const { id } = useParams<{ id: string }>()
  const [currentArtworkIndex, setCurrentArtworkIndex] = useState(0)
  const [immersiveState, setImmersiveState] = useState<'idle' | 'loading' | 'open'>('idle')
  const [immersiveProgress, setImmersiveProgress] = useState(0)
  const [immersiveError, setImmersiveError] = useState<string | undefined>()
  const [pendingArtworkAction, setPendingArtworkAction] = useState<string | null>(null)
  const [actionFeedback, setActionFeedback] = useState<string | undefined>()
  const [engagementOverrides, setEngagementOverrides] = useState<{
    uid: string | null
    loved: Record<string, boolean>
    bookmarked: Record<string, boolean>
  }>({ uid: null, loved: {}, bookmarked: {} })
  const actionFeedbackTimeoutRef = useRef<number | undefined>(undefined)
  const sharedArtworkAppliedRef = useRef<string | null>(null)
  const viewCountIncrementedRef = useRef(false)

  const { user } = useAuth()
  const { data: firebaseExhibition, loading, error } = useDocument('exhibitions', id)

  const showActionFeedback = useCallback((message: string) => {
    setActionFeedback(message)
    if (actionFeedbackTimeoutRef.current !== undefined) {
      window.clearTimeout(actionFeedbackTimeoutRef.current)
    }
    actionFeedbackTimeoutRef.current = window.setTimeout(() => {
      setActionFeedback(undefined)
      actionFeedbackTimeoutRef.current = undefined
    }, 1800)
  }, [])

  useEffect(() => () => {
    if (actionFeedbackTimeoutRef.current !== undefined) {
      window.clearTimeout(actionFeedbackTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (id && firebaseExhibition && !viewCountIncrementedRef.current) {
      viewCountIncrementedRef.current = true
      incrementField('exhibitions', id, 'viewsCount', 1).catch((err) => {
        console.error('Failed to increment exhibition view count:', err)
      })
    }
  }, [firebaseExhibition, id])

  const exhibition = useMemo(
    () => firebaseExhibition ? transformExhibition(firebaseExhibition) : null,
    [firebaseExhibition]
  )
  const lovedArtworkKeys = useMemo(() => {
    const keys = new Set(readUserIds(user?.lovedArtworkKeys))
    if (user && engagementOverrides.uid === user.uid) {
      Object.entries(engagementOverrides.loved).forEach(([key, active]) => {
        if (active) keys.add(key)
        else keys.delete(key)
      })
    }
    return keys
  }, [engagementOverrides, user])
  const bookmarkedArtworkKeys = useMemo(() => {
    const keys = new Set(readUserIds(user?.bookmarkedArtworkKeys))
    if (user && engagementOverrides.uid === user.uid) {
      Object.entries(engagementOverrides.bookmarked).forEach(([key, active]) => {
        if (active) keys.add(key)
        else keys.delete(key)
      })
    }
    return keys
  }, [engagementOverrides, user])
  const artworkCount = exhibition?.artworks.length || 0
  const selectedArtworkIndex = artworkCount > 0 ? Math.min(currentArtworkIndex, artworkCount - 1) : 0
  const currentArtwork = exhibition?.artworks[selectedArtworkIndex]
  const hasMultipleArtworks = artworkCount > 1
  const isFullscreen = immersiveState === 'open'
  const isImmersiveLoading = immersiveState === 'loading'

  useEffect(() => {
    if (!exhibition) return
    if (sharedArtworkAppliedRef.current === exhibition.id) return

    const artworkId = new URLSearchParams(window.location.search).get('artwork')
    sharedArtworkAppliedRef.current = exhibition.id
    if (!artworkId) return

    const sharedArtworkIndex = exhibition.artworks.findIndex((artwork) => artwork.id === artworkId)
    if (sharedArtworkIndex >= 0) {
      const frame = window.requestAnimationFrame(() => {
        setCurrentArtworkIndex(sharedArtworkIndex)
      })
      return () => window.cancelAnimationFrame(frame)
    }
  }, [exhibition])

  const toggleArtworkUserKey = useCallback(async (artwork: Artwork, kind: 'love' | 'save') => {
    if (!user) {
      showActionFeedback(kind === 'love' ? 'Sign in to love artworks' : 'Sign in to bookmark artworks')
      return
    }
    if (!exhibition || pendingArtworkAction) return

    const actionKey = `${artwork.id}:${kind}`
    const field = kind === 'love' ? 'lovedArtworkKeys' : 'bookmarkedArtworkKeys'
    const currentSet = kind === 'love' ? lovedArtworkKeys : bookmarkedArtworkKeys
    const artworkKey = getArtworkEngagementKey(exhibition.id, artwork.id)
    const isActive = currentSet.has(artworkKey)

    setPendingArtworkAction(actionKey)
    setEngagementOverrides((current) => {
      const next = current.uid === user.uid
        ? current
        : { uid: user.uid, loved: {}, bookmarked: {} }
      const key = kind === 'love' ? 'loved' : 'bookmarked'

      return {
        ...next,
        [key]: {
          ...next[key],
          [artworkKey]: !isActive,
        },
      }
    })

    const result = isActive
      ? await removeFromArray('users', user.uid, field, artworkKey)
      : await addToArray('users', user.uid, field, artworkKey)

    setPendingArtworkAction(null)

    if (!result.success) {
      setEngagementOverrides((current) => {
        const next = current.uid === user.uid
          ? current
          : { uid: user.uid, loved: {}, bookmarked: {} }
        const key = kind === 'love' ? 'loved' : 'bookmarked'

        return {
          ...next,
          [key]: {
            ...next[key],
            [artworkKey]: isActive,
          },
        }
      })
      showActionFeedback('Could not update artwork')
      console.error('Artwork engagement update failed:', result.error)
      return
    }

    if (kind === 'love') {
      showActionFeedback(isActive ? 'Love removed' : 'Loved artwork')
    } else {
      showActionFeedback(isActive ? 'Bookmark removed' : 'Bookmarked artwork')
    }
  }, [
    bookmarkedArtworkKeys,
    exhibition,
    lovedArtworkKeys,
    pendingArtworkAction,
    showActionFeedback,
    user,
  ])

  const handleShareArtwork = useCallback(async (artwork: Artwork) => {
    if (!exhibition) return

    const url = createArtworkShareUrl(artwork.id)
    const payload = {
      title: `${artwork.title} by ${artwork.artist}`,
      text: artwork.description || `View ${artwork.title} in ${exhibition.title}.`,
      url,
    }

    try {
      if (navigator.share) {
        await navigator.share(payload)
        showActionFeedback('Shared artwork')
        return
      }

      await copyTextToClipboard(url)
      showActionFeedback('Link copied')
    } catch (shareError) {
      const errorName = shareError instanceof DOMException ? shareError.name : ''
      if (errorName === 'AbortError') return

      try {
        await copyTextToClipboard(url)
        showActionFeedback('Link copied')
      } catch (copyError) {
        console.error('Artwork share failed:', copyError)
        showActionFeedback('Could not share artwork')
      }
    }
  }, [exhibition, showActionFeedback])

  const handlePrevArtwork = () => {
    setCurrentArtworkIndex((prev) => Math.max(0, prev - 1))
  }

  const handleNextArtwork = () => {
    setCurrentArtworkIndex((prev) => Math.min(artworkCount - 1, prev + 1))
  }

  const handleOpenImmersiveGallery = async () => {
    if (!exhibition || !currentArtwork) return

    setImmersiveProgress(0)
    setImmersiveError(undefined)
    setImmersiveState('loading')

    const sources = uniqueImageSources([
      galleryRoomImage,
      ...exhibition.artworks.map((artwork) => artwork.image),
    ])

    const [result] = await Promise.all([
      preloadImageSet(sources, setImmersiveProgress),
      wait(900),
    ])

    if (result.failed > 0) {
      setImmersiveError('The immersive gallery could not open because one or more artwork assets failed to load.')
      return
    }

    setImmersiveState('open')
  }

  const handleCloseImmersiveGallery = () => {
    setImmersiveState('idle')
    setImmersiveProgress(0)
    setImmersiveError(undefined)
  }

  if (loading) {
    return (
      <Box bg="gray.950" minH="100vh">
        <Header />
        <Center minH="70vh" pt={24}>
          <Spinner size="xl" color="brand.500" />
        </Center>
      </Box>
    )
  }

  if (!exhibition) {
    return (
      <Box bg="gray.950" minH="100vh">
        <Header />
        <Center minH="70vh" pt={24} px={6}>
          <VStack gap={4} textAlign="center">
            <Heading as="h1" color="white" fontSize={{ base: '2xl', md: '3xl' }}>
              Exhibition Not Found
            </Heading>
            <Text color="whiteAlpha.600" maxW="lg">
              {error?.message || 'This exhibition could not be loaded.'}
            </Text>
            <RouterLink to="/exhibitions">
              <Button bg="brand.500" color="white" borderRadius="full" _hover={{ bg: 'brand.600' }}>
                Browse Exhibitions
              </Button>
            </RouterLink>
          </VStack>
        </Center>
        <Footer />
      </Box>
    )
  }

  return (
    <Box bg="gray.950" minH="100vh">
      <Header />

      <Box as="main" pt={{ base: 28, md: 32 }} pb={{ base: 14, md: 20 }}>
        <Container maxW="1440px" px={{ base: 4, sm: 6, md: 10, lg: 14 }}>
          <RouterLink to="/exhibitions">
            <Button
              size="sm"
              mb={6}
              gap={2}
              bg="transparent"
              color="whiteAlpha.700"
              _hover={{ color: 'white', bg: 'whiteAlpha.50' }}
            >
              <ArrowLeft size={16} />
              Exhibitions
            </Button>
          </RouterLink>

          <Grid templateColumns={{ base: '1fr', xl: 'minmax(0, 1.25fr) 420px' }} gap={{ base: 6, xl: 8 }} alignItems="start">
            <VStack align="stretch" gap={5}>
              <MotionBox
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
                bg="gray.900"
                border="1px solid"
                borderColor="whiteAlpha.100"
                borderRadius="2xl"
                overflow="hidden"
              >
                <AspectRatio ratio={{ base: 4 / 3, md: 16 / 10 }}>
                  <Box position="relative" bg="black">
                    {currentArtwork?.image ? (
                      <Image src={currentArtwork.image} alt={currentArtwork.title} w="full" h="full" objectFit="contain" />
                    ) : (
                      <EmptyArtwork />
                    )}

                    {currentArtwork && (
                      <Button
                        aria-label="Open fullscreen"
                        position="absolute"
                        top={4}
                        right={4}
                        w={11}
                        h={11}
                        borderRadius="full"
                        bg="blackAlpha.600"
                        color="white"
                        _hover={{ bg: 'blackAlpha.800' }}
                        onClick={() => void handleOpenImmersiveGallery()}
                      >
                        <Expand size={18} />
                      </Button>
                    )}

                    {hasMultipleArtworks && (
                      <HStack position="absolute" right={4} bottom={4} gap={2}>
                        <Button
                          aria-label="Previous artwork"
                          w={11}
                          h={11}
                          borderRadius="full"
                          bg="blackAlpha.600"
                          color="white"
                          disabled={selectedArtworkIndex === 0}
                          _hover={{ bg: 'blackAlpha.800' }}
                          onClick={handlePrevArtwork}
                        >
                          <ChevronLeft size={20} />
                        </Button>
                        <Button
                          aria-label="Next artwork"
                          w={11}
                          h={11}
                          borderRadius="full"
                          bg="blackAlpha.600"
                          color="white"
                          disabled={selectedArtworkIndex === artworkCount - 1}
                          _hover={{ bg: 'blackAlpha.800' }}
                          onClick={handleNextArtwork}
                        >
                          <ChevronRight size={20} />
                        </Button>
                      </HStack>
                    )}

                    {currentArtwork && (
                      <Text
                        position="absolute"
                        left={4}
                        bottom={4}
                        color="whiteAlpha.800"
                        fontFamily="mono"
                        fontSize="sm"
                        bg="blackAlpha.500"
                        px={3}
                        py={1.5}
                        borderRadius="full"
                      >
                        {String(selectedArtworkIndex + 1).padStart(2, '0')} / {String(artworkCount).padStart(2, '0')}
                      </Text>
                    )}
                  </Box>
                </AspectRatio>
              </MotionBox>

              {hasMultipleArtworks && (
                <HStack gap={3} overflowX="auto" pb={2} css={{ '&::-webkit-scrollbar': { display: 'none' } }}>
                  {exhibition.artworks.map((artwork, index) => {
                    const selected = index === selectedArtworkIndex
                    return (
                      <Box
                        as="button"
                        key={artwork.id}
                        aria-label={`Show ${artwork.title}`}
                        onClick={() => setCurrentArtworkIndex(index)}
                        flexShrink={0}
                        w={{ base: 20, md: 24 }}
                        h={{ base: 16, md: 20 }}
                        borderRadius="lg"
                        overflow="hidden"
                        border="2px solid"
                        borderColor={selected ? 'brand.500' : 'whiteAlpha.100'}
                        opacity={selected ? 1 : 0.62}
                        transition="opacity 0.2s, border-color 0.2s"
                        _hover={{ opacity: 1, borderColor: 'brand.500' }}
                      >
                        {artwork.image ? (
                          <Image src={artwork.image} alt={artwork.title} w="full" h="full" objectFit="cover" />
                        ) : (
                          <EmptyArtwork />
                        )}
                      </Box>
                    )
                  })}
                </HStack>
              )}

              <Box bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="2xl" p={{ base: 5, md: 7 }}>
                {currentArtwork ? (
                  <VStack align="stretch" gap={4}>
                    <Box>
                      <Heading as="h2" color="white" fontSize={{ base: '2xl', md: '3xl' }} fontFamily="heading" mb={3}>
                        {currentArtwork.title}
                      </Heading>
                      <HStack gap={3} flexWrap="wrap" color="whiteAlpha.600">
                        {currentArtwork.canOpenArtistProfile && currentArtwork.artistId ? (
                          <RouterLink to={`/artists/${currentArtwork.artistId}`}>
                            <Text color="brand.300" _hover={{ color: 'brand.200' }}>
                              {currentArtwork.artist}
                            </Text>
                          </RouterLink>
                        ) : currentArtwork.artistExternalUrl ? (
                          <a href={currentArtwork.artistExternalUrl} target="_blank" rel="noopener noreferrer">
                            <Text color="brand.300" _hover={{ color: 'brand.200' }}>
                              {currentArtwork.artist}
                            </Text>
                          </a>
                        ) : (
                          <Text>{currentArtwork.artist}</Text>
                        )}
                        <Text>{currentArtwork.medium}</Text>
                        {currentArtwork.year && <Text>{currentArtwork.year}</Text>}
                      </HStack>
                    </Box>
                    {currentArtwork.description && (
                      <Text color="whiteAlpha.700" fontSize={{ base: 'md', md: 'lg' }} lineHeight="tall">
                        {currentArtwork.description}
                      </Text>
                    )}
                    {currentArtwork.curatorNote && (
                      <Box borderTop="1px solid" borderColor="whiteAlpha.100" pt={5}>
                        <Text color="whiteAlpha.500" fontSize="sm" mb={2}>
                          Curator Note
                        </Text>
                        <Text color="whiteAlpha.700" lineHeight="tall">
                          {currentArtwork.curatorNote}
                        </Text>
                      </Box>
                    )}
                  </VStack>
                ) : (
                  <VStack gap={3} py={8}>
                    <Text color="white" fontSize="lg" fontWeight="semibold">
                      No artworks yet
                    </Text>
                    <Text color="whiteAlpha.600" textAlign="center">
                      This exhibition has been published, but no works have been added.
                    </Text>
                  </VStack>
                )}
              </Box>
            </VStack>

            <VStack align="stretch" gap={5} position={{ xl: 'sticky' }} top={{ xl: 28 }}>
              <Box bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="2xl" p={{ base: 5, md: 7 }}>
                <HStack gap={2} mb={4} flexWrap="wrap">
                  <Badge bg="brand.500" color="white" borderRadius="full" px={3} py={1}>
                    {exhibition.isOnline ? 'Online' : 'Physical'}
                  </Badge>
                  <Badge bg="whiteAlpha.100" color="whiteAlpha.800" borderRadius="full" px={3} py={1}>
                    {artworkCount} work{artworkCount === 1 ? '' : 's'}
                  </Badge>
                </HStack>

                <Heading as="h1" color="white" fontSize={{ base: '3xl', md: '4xl' }} fontFamily="heading" lineHeight={1.05} mb={4}>
                  {exhibition.title}
                </Heading>
                <Text color="whiteAlpha.700" lineHeight="tall" mb={5}>
                  {exhibition.description}
                </Text>

                {exhibition.tags.length > 0 && (
                  <HStack gap={2} flexWrap="wrap" mb={6}>
                    {exhibition.tags.map((tag) => (
                      <Badge key={tag} bg="whiteAlpha.100" color="whiteAlpha.700" borderRadius="full" px={3} py={1}>
                        {tag}
                      </Badge>
                    ))}
                  </HStack>
                )}

                <SimpleGrid columns={{ base: 1, sm: 2, xl: 1 }} gap={4}>
                  <HStack gap={3} align="start">
                    <Box color="whiteAlpha.500" mt={1}>
                      <CalendarDays size={18} />
                    </Box>
                    <Box>
                      <Text color="whiteAlpha.500" fontSize="sm">
                        Dates
                      </Text>
                      <Text color="white">{formatDateRange(exhibition.startDate, exhibition.endDate)}</Text>
                    </Box>
                  </HStack>
                  <HStack gap={3} align="start">
                    <Box color="whiteAlpha.500" mt={1}>
                      <Monitor size={18} />
                    </Box>
                    <Box>
                      <Text color="whiteAlpha.500" fontSize="sm">
                        Format
                      </Text>
                      <Text color="white">{exhibition.isOnline ? 'Online Exhibition' : 'Physical Venue'}</Text>
                    </Box>
                  </HStack>
                </SimpleGrid>

                {exhibition.virtualTourUrl && (
                  <Box mt={6}>
                    <Button asChild bg="whiteAlpha.100" color="white" borderRadius="full" _hover={{ bg: 'whiteAlpha.200' }}>
                      <a href={exhibition.virtualTourUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={16} />
                        Virtual Tour
                      </a>
                    </Button>
                  </Box>
                )}
              </Box>

              <Box bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="2xl" p={{ base: 5, md: 6 }}>
                <Text color="whiteAlpha.500" fontSize="sm" textTransform="uppercase" letterSpacing="wide" mb={4}>
                  Curated By
                </Text>
                <HStack gap={3} align="center">
                  <InitialAvatar name={exhibition.curator.name} src={exhibition.curator.avatar} />
                  <Box>
                    <Text color="white" fontWeight="semibold">
                      {exhibition.curator.name}
                    </Text>
                    {exhibition.curator.bio && (
                      <Text color="whiteAlpha.500" fontSize="sm" lineClamp={2}>
                        {exhibition.curator.bio}
                      </Text>
                    )}
                  </Box>
                </HStack>
                {exhibition.curatorStatement && (
                  <Text color="whiteAlpha.700" fontSize="sm" lineHeight="tall" mt={5}>
                    {exhibition.curatorStatement}
                  </Text>
                )}
              </Box>

              <Box bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="2xl" p={{ base: 5, md: 6 }}>
                <Text color="whiteAlpha.500" fontSize="sm" textTransform="uppercase" letterSpacing="wide" mb={4}>
                  Featured Artists
                </Text>
                {exhibition.artists.length > 0 ? (
                  <VStack align="stretch" gap={2}>
                    {exhibition.artists.map((artist) => (
                      <RouterLink key={artist.id} to={`/artists/${artist.id}`}>
                        <HStack
                          gap={3}
                          p={2}
                          mx={-2}
                          borderRadius="lg"
                          _hover={{ bg: 'whiteAlpha.50' }}
                          transition="background 0.2s"
                        >
                          <InitialAvatar name={artist.name} src={artist.avatar} size={9} />
                          <Text color="white">{artist.name}</Text>
                        </HStack>
                      </RouterLink>
                    ))}
                  </VStack>
                ) : (
                  <HStack color="whiteAlpha.500">
                    <UserRound size={16} />
                    <Text fontSize="sm">Artists will appear once artworks are added.</Text>
                  </HStack>
                )}
              </Box>
            </VStack>
          </Grid>
        </Container>
      </Box>

      {isImmersiveLoading && (
        <ImmersiveGalleryLoading
          progress={immersiveProgress}
          error={immersiveError}
          onRetry={() => void handleOpenImmersiveGallery()}
          onCancel={handleCloseImmersiveGallery}
        />
      )}

      {isFullscreen && exhibition && currentArtwork && (
        <FullscreenGallery
          exhibition={exhibition}
          selectedIndex={selectedArtworkIndex}
          lovedArtworkKeys={lovedArtworkKeys}
          bookmarkedArtworkKeys={bookmarkedArtworkKeys}
          actionFeedback={actionFeedback}
          pendingAction={pendingArtworkAction}
          onClose={handleCloseImmersiveGallery}
          onSelect={setCurrentArtworkIndex}
          onToggleLove={(artwork) => void toggleArtworkUserKey(artwork, 'love')}
          onToggleSave={(artwork) => void toggleArtworkUserKey(artwork, 'save')}
          onShareArtwork={(artwork) => void handleShareArtwork(artwork)}
        />
      )}

      <Footer />
    </Box>
  )
}
