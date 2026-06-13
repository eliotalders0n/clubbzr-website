'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
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
import {
  ArrowLeft,
  Bookmark,
  Download,
  ExternalLink,
  Heart,
  Share2,
} from 'lucide-react'

import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { useAuth } from '@/contexts/AuthContext'
import { useCollection } from '@/hooks/useFirestore'
import {
  DISCOVERY_SHUFFLE_SEED,
  buildDiscoveryArtworks,
  formatMedium,
  getArtworkEngagementKey,
  getArtworkProfileHref,
  stableScore,
  type DiscoveryArtwork,
} from '@/lib/artworkDiscovery'
import { addToArray, removeFromArray } from '../../lib/firestore'

const MotionBox = motion.create(Box)

const readUserKeys = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string')
  : []

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

function InitialAvatar({ artwork, size = 11 }: { artwork: DiscoveryArtwork; size?: number }) {
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
      {artwork.credit.avatarUrl ? (
        <Image src={artwork.credit.avatarUrl} alt={artwork.credit.name} w="full" h="full" objectFit="cover" />
      ) : (
        <Text color="white" fontWeight="bold">
          {artwork.credit.name.charAt(0)}
        </Text>
      )}
    </Flex>
  )
}

function IconAction({
  label,
  active = false,
  disabled = false,
  children,
  onClick,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <Button
      aria-label={label}
      title={label}
      h={11}
      w={11}
      minW={11}
      p={0}
      borderRadius="full"
      bg={active ? 'brand.500' : 'whiteAlpha.100'}
      color="white"
      border="1px solid"
      borderColor={active ? 'brand.500' : 'whiteAlpha.200'}
      disabled={disabled}
      _hover={{ bg: active ? 'brand.600' : 'whiteAlpha.200' }}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function RecommendationCard({ artwork, compact = false }: { artwork: DiscoveryArtwork; compact?: boolean }) {
  return (
    <Link to={artwork.detailHref}>
      <Box
        role="group"
        display="grid"
        gridTemplateColumns={compact ? '86px minmax(0, 1fr)' : '1fr'}
        gap={compact ? 3 : 0}
        alignItems="center"
      >
        <Box
          aspectRatio={compact ? 1 : '4 / 5'}
          borderRadius="xl"
          overflow="hidden"
          bg="gray.800"
          border="1px solid"
          borderColor="whiteAlpha.100"
        >
          <Image
            src={artwork.imageUrl}
            alt={artwork.title}
            w="full"
            h="full"
            objectFit="cover"
            transition="transform 0.3s ease"
            _groupHover={{ transform: 'scale(1.04)' }}
          />
        </Box>
        <Box mt={compact ? 0 : 3} minW={0}>
          <Text color="white" fontSize="sm" fontWeight="semibold" lineClamp={1}>
            {artwork.title}
          </Text>
          <Text color="whiteAlpha.500" fontSize="xs" lineClamp={1}>
            {artwork.credit.name}
          </Text>
        </Box>
      </Box>
    </Link>
  )
}

export default function ArtworkDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<{
    uid: string | null
    loved: Record<string, boolean>
    bookmarked: Record<string, boolean>
  }>({ uid: null, loved: {}, bookmarked: {} })

  const { data: artists, loading: artistsLoading, error: artistsError } = useCollection('artists', {
    orderBy: 'createdAt',
    orderDirection: 'desc',
  })
  const { data: uploadedArtworks, loading: artworksLoading, error: artworksError } = useCollection('artworks', {
    orderBy: 'createdAt',
    orderDirection: 'desc',
  })
  const { data: exhibitions, loading: exhibitionsLoading } = useCollection('exhibitions', {
    orderBy: 'createdAt',
    orderDirection: 'desc',
  })

  const decodedId = id ? decodeURIComponent(id) : ''
  const allArtworks = useMemo(
    () => buildDiscoveryArtworks({ artists, uploadedArtworks, exhibitions }),
    [artists, exhibitions, uploadedArtworks]
  )
  const artwork = useMemo(
    () => allArtworks.find((item) => item.id === decodedId),
    [allArtworks, decodedId]
  )
  const related = useMemo(() => {
    if (!artwork) return []
    const tagSet = new Set([...artwork.tags, ...artwork.genres].map((tag) => tag.toLowerCase()))

    return allArtworks
      .filter((item) => item.id !== artwork.id)
      .map((item) => {
        const sharedTags = [...item.tags, ...item.genres].filter((tag) => tagSet.has(tag.toLowerCase())).length
        const score =
          (item.medium === artwork.medium ? 30 : 0) +
          (item.credit.artistId && item.credit.artistId === artwork.credit.artistId ? 24 : 0) +
          sharedTags * 8

        return { item, score }
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return stableScore(a.item.id, `${DISCOVERY_SHUFFLE_SEED}:${artwork.id}`) -
          stableScore(b.item.id, `${DISCOVERY_SHUFFLE_SEED}:${artwork.id}`)
      })
      .map(({ item }) => item)
  }, [allArtworks, artwork])

  const lovedKeys = useMemo(() => {
    const keys = new Set(readUserKeys(user?.lovedArtworkKeys))
    if (overrides.uid === user?.uid) {
      Object.entries(overrides.loved).forEach(([key, active]) => {
        if (active) keys.add(key)
        else keys.delete(key)
      })
    }
    return keys
  }, [overrides, user?.lovedArtworkKeys, user?.uid])

  const bookmarkedKeys = useMemo(() => {
    const keys = new Set(readUserKeys(user?.bookmarkedArtworkKeys))
    if (overrides.uid === user?.uid) {
      Object.entries(overrides.bookmarked).forEach(([key, active]) => {
        if (active) keys.add(key)
        else keys.delete(key)
      })
    }
    return keys
  }, [overrides, user?.bookmarkedArtworkKeys, user?.uid])

  const showFeedback = useCallback((message: string) => {
    setFeedback(message)
    window.setTimeout(() => setFeedback(null), 2200)
  }, [])

  const toggleUserKey = useCallback(async (kind: 'love' | 'save') => {
    if (!artwork) return
    if (!user) {
      showFeedback(kind === 'love' ? 'Sign in to love artworks' : 'Sign in to bookmark artworks')
      return
    }

    const artworkKey = getArtworkEngagementKey(artwork)
    const actionKey = `${artworkKey}:${kind}`
    const field = kind === 'love' ? 'lovedArtworkKeys' : 'bookmarkedArtworkKeys'
    const currentSet = kind === 'love' ? lovedKeys : bookmarkedKeys
    const isActive = currentSet.has(artworkKey)
    const overrideKey = kind === 'love' ? 'loved' : 'bookmarked'

    setPendingAction(actionKey)
    setOverrides((current) => {
      const next = current.uid === user.uid ? current : { uid: user.uid, loved: {}, bookmarked: {} }

      return {
        ...next,
        [overrideKey]: {
          ...next[overrideKey],
          [artworkKey]: !isActive,
        },
      }
    })

    const result = isActive
      ? await removeFromArray('users', user.uid, field, artworkKey)
      : await addToArray('users', user.uid, field, artworkKey)

    setPendingAction(null)

    if (!result.success) {
      setOverrides((current) => {
        const next = current.uid === user.uid ? current : { uid: user.uid, loved: {}, bookmarked: {} }
        return {
          ...next,
          [overrideKey]: {
            ...next[overrideKey],
            [artworkKey]: isActive,
          },
        }
      })
      showFeedback('Could not update artwork')
      return
    }

    showFeedback(
      kind === 'love'
        ? isActive ? 'Love removed' : 'Loved artwork'
        : isActive ? 'Bookmark removed' : 'Bookmarked artwork'
    )
  }, [artwork, bookmarkedKeys, lovedKeys, showFeedback, user])

  const handleShare = useCallback(async () => {
    if (!artwork) return
    const url = window.location.href
    const payload = {
      title: `${artwork.title} by ${artwork.credit.name}`,
      text: artwork.description || `View ${artwork.title} on Club BZR.`,
      url,
    }

    try {
      if (navigator.share) {
        await navigator.share(payload)
        showFeedback('Shared artwork')
        return
      }
      await copyTextToClipboard(url)
      showFeedback('Link copied')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      await copyTextToClipboard(url)
      showFeedback('Link copied')
    }
  }, [artwork, showFeedback])

  const handleDownload = useCallback(() => {
    if (!artwork) return
    const link = document.createElement('a')
    link.href = artwork.imageUrl
    link.download = `${artwork.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'club-bzr-artwork'}.jpg`
    link.rel = 'noopener noreferrer'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showFeedback('Download started')
  }, [artwork, showFeedback])

  const isLoading = artistsLoading || artworksLoading || exhibitionsLoading
  const error = artistsError || artworksError

  if (isLoading) {
    return (
      <Box bg="gray.950" minH="100vh">
        <Header />
        <Flex as="main" minH="70vh" align="center" justify="center" pt={28}>
          <Spinner color="brand.500" size="xl" />
        </Flex>
      </Box>
    )
  }

  if (error || !artwork) {
    return (
      <Box bg="gray.950" minH="100vh">
        <Header />
        <Flex as="main" minH="70vh" align="center" justify="center" pt={28} px={6}>
          <VStack gap={5} textAlign="center">
            <Heading as="h1" color="white" fontSize="3xl">
              Artwork not found
            </Heading>
            <Text color="whiteAlpha.600">
              {error?.message || 'This artwork may have moved or is no longer available.'}
            </Text>
            <Link to="/artists">
              <Button bg="brand.500" color="white" borderRadius="full" _hover={{ bg: 'brand.600' }}>
                Browse Artwork
              </Button>
            </Link>
          </VStack>
        </Flex>
        <Footer />
      </Box>
    )
  }

  const artworkKey = getArtworkEngagementKey(artwork)
  const loved = lovedKeys.has(artworkKey)
  const bookmarked = bookmarkedKeys.has(artworkKey)
  const lovePending = pendingAction === `${artworkKey}:love`
  const savePending = pendingAction === `${artworkKey}:save`
  const profileHref = getArtworkProfileHref(artwork.credit)
  const sideRecommendations = related.slice(0, 4)
  const bottomRecommendations = related.slice(0, 8)

  const artistIdentity = (
    <HStack gap={3} minW={0}>
      <InitialAvatar artwork={artwork} />
      <Box minW={0}>
        <Text color="white" fontWeight="semibold" lineClamp={1}>
          {artwork.credit.name}
        </Text>
        <Text color="whiteAlpha.500" fontSize="sm">
          {artwork.credit.isExternal ? 'Credited artist' : 'Club BZR artist'}
        </Text>
      </Box>
    </HStack>
  )

  return (
    <Box bg="gray.950" minH="100vh">
      <Header />

      <Box as="main" pt={{ base: 24, md: 30 }} pb={{ base: 16, md: 20 }}>
        <Container maxW="1680px" px={{ base: 4, md: 8, xl: 12 }}>
          <Button
            mb={6}
            h="42px"
            px={4}
            borderRadius="full"
            bg="whiteAlpha.50"
            color="whiteAlpha.800"
            border="1px solid"
            borderColor="whiteAlpha.100"
            _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={17} />
            Back
          </Button>

          <Grid templateColumns={{ base: '1fr', xl: '260px minmax(0, 1fr) 340px' }} gap={{ base: 6, xl: 8 }} alignItems="start">
            <VStack align="stretch" gap={4} display={{ base: 'none', xl: 'flex' }}>
              <Text color="whiteAlpha.500" fontSize="sm" textTransform="uppercase" letterSpacing="0.16em">
                Recommended
              </Text>
              {sideRecommendations.map((item) => (
                <RecommendationCard key={item.id} artwork={item} compact />
              ))}
            </VStack>

            <MotionBox initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
              <Box
                bg="gray.900"
                border="1px solid"
                borderColor="whiteAlpha.100"
                borderRadius={{ base: '2xl', md: '28px' }}
                overflow="hidden"
              >
                <Flex minH={{ base: '420px', md: '72vh' }} align="center" justify="center" bg="black">
                  <Image
                    src={artwork.imageUrl}
                    alt={artwork.title}
                    w="full"
                    h="full"
                    maxH={{ base: '68vh', md: '78vh' }}
                    objectFit="contain"
                  />
                </Flex>
              </Box>
            </MotionBox>

            <VStack align="stretch" gap={5}>
              <Box>
                <Badge bg="whiteAlpha.100" color="whiteAlpha.800" borderRadius="full" px={3} py={1} mb={4}>
                  {formatMedium(artwork.medium)}
                </Badge>
                <Heading as="h1" color="white" fontSize={{ base: '3xl', md: '4xl' }} fontFamily="heading" lineHeight={1.05} mb={4}>
                  {artwork.title}
                </Heading>

                {profileHref ? (
                  <Link to={profileHref}>{artistIdentity}</Link>
                ) : artwork.credit.externalUrl ? (
                  <a href={artwork.credit.externalUrl} target="_blank" rel="noopener noreferrer">
                    <HStack gap={2}>
                      {artistIdentity}
                      <ExternalLink size={16} color="rgba(255,255,255,0.45)" />
                    </HStack>
                  </a>
                ) : (
                  artistIdentity
                )}
              </Box>

              <HStack gap={3} flexWrap="wrap">
                <IconAction label={loved ? 'Remove love' : 'Love artwork'} active={loved} disabled={lovePending} onClick={() => toggleUserKey('love')}>
                  <Heart size={19} fill={loved ? 'currentColor' : 'none'} />
                </IconAction>
                <IconAction label={bookmarked ? 'Remove bookmark' : 'Bookmark artwork'} active={bookmarked} disabled={savePending} onClick={() => toggleUserKey('save')}>
                  <Bookmark size={19} fill={bookmarked ? 'currentColor' : 'none'} />
                </IconAction>
                <IconAction label="Share artwork" onClick={handleShare}>
                  <Share2 size={19} />
                </IconAction>
                <IconAction label="Download artwork" onClick={handleDownload}>
                  <Download size={19} />
                </IconAction>
              </HStack>

              {feedback && (
                <Box p={3} borderRadius="xl" bg="whiteAlpha.100" border="1px solid" borderColor="whiteAlpha.200">
                  <Text color="whiteAlpha.900" fontSize="sm">{feedback}</Text>
                </Box>
              )}

              <VStack align="stretch" gap={3} color="whiteAlpha.700">
                {artwork.description && (
                  <Text lineHeight="tall">
                    {artwork.description}
                  </Text>
                )}
                <HStack gap={2} flexWrap="wrap">
                  {artwork.year && <Badge bg="whiteAlpha.100" color="whiteAlpha.700" borderRadius="full" px={3}>{artwork.year}</Badge>}
                  {artwork.location && <Badge bg="whiteAlpha.100" color="whiteAlpha.700" borderRadius="full" px={3}>{artwork.location}</Badge>}
                  {artwork.source === 'exhibition' && artwork.parentId && (
                    <Link to={`/exhibitions/${artwork.parentId}`}>
                      <Badge bg="brand.500/20" color="brand.200" borderRadius="full" px={3}>
                        Exhibition
                      </Badge>
                    </Link>
                  )}
                </HStack>
                {artwork.genres.length > 0 && (
                  <HStack gap={2} flexWrap="wrap">
                    {artwork.genres.slice(0, 6).map((tag) => (
                      <Badge key={tag} bg="whiteAlpha.100" color="whiteAlpha.700" borderRadius="full" px={3} textTransform="capitalize">
                        {tag}
                      </Badge>
                    ))}
                  </HStack>
                )}
              </VStack>
            </VStack>
          </Grid>

          {bottomRecommendations.length > 0 && (
            <Box mt={{ base: 10, md: 14 }}>
              <Heading as="h2" color="white" fontSize="2xl" fontFamily="heading" mb={6}>
                More To See
              </Heading>
              <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={5}>
                {bottomRecommendations.map((item) => (
                  <RecommendationCard key={item.id} artwork={item} />
                ))}
              </SimpleGrid>
            </Box>
          )}
        </Container>
      </Box>

      <Footer />
    </Box>
  )
}
