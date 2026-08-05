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
  buildDiscoveryArtworks,
  formatMedium,
  getArtworkEngagementKey,
  getArtworkProfileHref,
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

function ArtistWorkCard({ artwork }: { artwork: DiscoveryArtwork }) {
  return (
    <Link to={artwork.detailHref} aria-label={`View ${artwork.title}`}>
      <Box
        role="group"
        aspectRatio={1}
        borderRadius={{ base: 'md', md: 'xl' }}
        overflow="hidden"
        bg="gray.800"
        border="1px solid"
        borderColor="whiteAlpha.100"
        _hover={{ borderColor: 'whiteAlpha.300' }}
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
  const artistWorks = useMemo(() => {
    if (!artwork) return []
    const normalizedArtistName = artwork.credit.name.trim().toLowerCase()

    return allArtworks
      .filter((item) => {
        if (item.id === artwork.id) return false
        if (artwork.credit.artistId && item.credit.artistId) {
          return item.credit.artistId === artwork.credit.artistId
        }
        return item.credit.name.trim().toLowerCase() === normalizedArtistName
      })
      .filter(
        (item, index, items) =>
          items.findIndex((candidate) => candidate.imageUrl === item.imageUrl) === index
      )
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
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
  const moreByArtist = artistWorks.slice(0, 12)

  const artistIdentity = (
    <HStack gap={3} minW={0} borderRadius="xl" _hover={{ opacity: 0.82 }} transition="opacity 0.2s ease">
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

          <Grid templateColumns={{ base: '1fr', xl: 'minmax(0, 1fr) 320px' }} gap={{ base: 6, xl: 8 }} alignItems="start">
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

            <VStack align="stretch" gap={4} position={{ xl: 'sticky' }} top={{ xl: '120px' }}>
              <Box>
                <Badge bg="whiteAlpha.100" color="whiteAlpha.800" borderRadius="full" px={3} py={1} mb={3}>
                  {formatMedium(artwork.medium)}
                </Badge>
                <Heading as="h1" color="white" fontSize={{ base: '3xl', md: '3xl' }} fontFamily="heading" lineHeight={1.05} mb={4}>
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

              <VStack align="stretch" gap={3} color="whiteAlpha.700" fontSize="sm">
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

          {moreByArtist.length > 0 && (
            <Box mt={{ base: 10, md: 14 }}>
              <Flex justify="space-between" align="center" gap={4} mb={6}>
                <Heading as="h2" color="white" fontSize={{ base: 'xl', md: '2xl' }} fontFamily="heading">
                  More by {artwork.credit.name}
                </Heading>
                {profileHref && (
                  <Link to={profileHref}>
                    <Text color="brand.300" fontWeight="semibold" whiteSpace="nowrap" _hover={{ color: 'brand.200' }}>
                      View profile
                    </Text>
                  </Link>
                )}
              </Flex>
              <SimpleGrid columns={{ base: 3, md: 4, lg: 6 }} gap={{ base: 2, md: 4 }}>
                {moreByArtist.map((item) => (
                  <ArtistWorkCard key={item.id} artwork={item} />
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
