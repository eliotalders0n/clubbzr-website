'use client'

import { useEffect, useRef, useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
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
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Expand,
  ExternalLink,
  Monitor,
  UserRound,
  X,
} from 'lucide-react'

import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { useDocument } from '@/hooks/useFirestore'
import { incrementField } from '../../lib/firestore'
import type { Exhibition as FirebaseExhibition, ExhibitionArtwork } from '../../lib/schema'

interface Artwork {
  id: string
  title: string
  artist: string
  artistId: string
  year?: number
  medium: string
  description?: string
  image: string
  curatorNote?: string
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

const transformArtwork = (artwork: ExhibitionArtwork): Artwork => ({
  id: artwork.id,
  title: artwork.title || 'Untitled work',
  artist: artwork.artistName || 'Unknown artist',
  artistId: artwork.artistId || '',
  year: artwork.year,
  medium: formatMedium(artwork.medium || 'mixed_media'),
  description: artwork.description,
  image: artwork.thumbnailUrl || artwork.mediaUrls?.[0] || '',
  curatorNote: artwork.curatorNote,
})

const transformExhibition = (doc: FirebaseExhibition): ExhibitionDisplay => {
  const artistMap = new Map<string, { id: string; name: string }>()
  const artworks = [...(doc.artworks || [])].sort((a, b) => a.order - b.order).map(transformArtwork)

  artworks.forEach((artwork) => {
    if (artwork.artistId && !artistMap.has(artwork.artistId)) {
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

function FullscreenGallery({
  artwork,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  artwork: Artwork
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
}) {
  const x = useMotionValue(0)
  const scale = useTransform(x, [-200, 0, 200], [0.94, 1, 0.94])
  const opacity = useTransform(x, [-200, 0, 200], [0.6, 1, 0.6])

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > 100 && hasPrev) onPrev()
    if (info.offset.x < -100 && hasNext) onNext()
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && hasPrev) onPrev()
      if (event.key === 'ArrowRight' && hasNext) onNext()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasNext, hasPrev, onClose, onNext, onPrev])

  return (
    <Flex position="fixed" inset={0} zIndex={100} bg="black" align="center" justify="center" p={{ base: 4, md: 8 }}>
      <Button
        aria-label="Close fullscreen"
        position="absolute"
        top={{ base: 4, md: 6 }}
        right={{ base: 4, md: 6 }}
        borderRadius="full"
        w={12}
        h={12}
        bg="whiteAlpha.100"
        color="white"
        _hover={{ bg: 'whiteAlpha.200' }}
        onClick={onClose}
      >
        <X size={22} />
      </Button>

      {hasPrev && (
        <Button
          aria-label="Previous artwork"
          position="absolute"
          left={{ base: 4, md: 6 }}
          top="50%"
          transform="translateY(-50%)"
          borderRadius="full"
          w={12}
          h={12}
          bg="whiteAlpha.100"
          color="white"
          _hover={{ bg: 'whiteAlpha.200' }}
          onClick={onPrev}
        >
          <ChevronLeft size={24} />
        </Button>
      )}

      {hasNext && (
        <Button
          aria-label="Next artwork"
          position="absolute"
          right={{ base: 4, md: 6 }}
          top="50%"
          transform="translateY(-50%)"
          borderRadius="full"
          w={12}
          h={12}
          bg="whiteAlpha.100"
          color="white"
          _hover={{ bg: 'whiteAlpha.200' }}
          onClick={onNext}
        >
          <ChevronRight size={24} />
        </Button>
      )}

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.18}
        onDragEnd={handleDragEnd}
        style={{ x, scale, opacity, width: '100%' }}
      >
        <Center w="full">
          {artwork.image ? (
            <Image
              src={artwork.image}
              alt={artwork.title}
              maxW="min(1200px, 92vw)"
              maxH="78vh"
              objectFit="contain"
              borderRadius="lg"
            />
          ) : (
            <Box maxW="900px" w="full">
              <EmptyArtwork />
            </Box>
          )}
        </Center>
      </motion.div>

      <Box position="absolute" left={0} right={0} bottom={0} p={{ base: 5, md: 8 }} bgGradient="linear(to-t, black, blackAlpha.800, transparent)">
        <Container maxW="1200px">
          <Heading as="h2" color="white" fontSize={{ base: 'xl', md: '2xl' }} mb={2}>
            {artwork.title}
          </Heading>
          <Text color="whiteAlpha.700">
            {artwork.artist}{artwork.year ? `, ${artwork.year}` : ''} · {artwork.medium}
          </Text>
        </Container>
      </Box>
    </Flex>
  )
}

export default function ExhibitionView() {
  const { id } = useParams<{ id: string }>()
  const [currentArtworkIndex, setCurrentArtworkIndex] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const viewCountIncrementedRef = useRef(false)

  const { data: firebaseExhibition, loading, error } = useDocument('exhibitions', id)

  useEffect(() => {
    if (id && firebaseExhibition && !viewCountIncrementedRef.current) {
      viewCountIncrementedRef.current = true
      incrementField('exhibitions', id, 'viewsCount', 1).catch((err) => {
        console.error('Failed to increment exhibition view count:', err)
      })
    }
  }, [firebaseExhibition, id])

  const exhibition = firebaseExhibition ? transformExhibition(firebaseExhibition) : null
  const artworkCount = exhibition?.artworks.length || 0
  const selectedArtworkIndex = artworkCount > 0 ? Math.min(currentArtworkIndex, artworkCount - 1) : 0
  const currentArtwork = exhibition?.artworks[selectedArtworkIndex]
  const hasMultipleArtworks = artworkCount > 1

  const handlePrevArtwork = () => {
    setCurrentArtworkIndex((prev) => Math.max(0, prev - 1))
  }

  const handleNextArtwork = () => {
    setCurrentArtworkIndex((prev) => Math.min(artworkCount - 1, prev + 1))
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
                        onClick={() => setIsFullscreen(true)}
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
                        {currentArtwork.artistId ? (
                          <RouterLink to={`/artists/${currentArtwork.artistId}`}>
                            <Text color="brand.300" _hover={{ color: 'brand.200' }}>
                              {currentArtwork.artist}
                            </Text>
                          </RouterLink>
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

      {isFullscreen && currentArtwork && (
        <FullscreenGallery
          artwork={currentArtwork}
          onClose={() => setIsFullscreen(false)}
          onPrev={handlePrevArtwork}
          onNext={handleNextArtwork}
          hasPrev={selectedArtworkIndex > 0}
          hasNext={selectedArtworkIndex < artworkCount - 1}
        />
      )}

      <Footer />
    </Box>
  )
}
