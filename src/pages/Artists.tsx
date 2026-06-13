'use client'

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Box,
  Button,
  Container,
  Flex,
  Heading,
  HStack,
  Image,
  Input,
  SimpleGrid,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { Eye, Pencil, Search, SlidersHorizontal, UserRound, X } from 'lucide-react'

import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { useAuth } from '@/contexts/AuthContext'
import { useCollection, useDocument } from '@/hooks/useFirestore'
import {
  DISCOVERY_MEDIUMS,
  DISCOVERY_SHUFFLE_SEED,
  buildDiscoveryArtworks,
  formatMedium,
  stableScore,
  type DiscoveryArtwork,
} from '@/lib/artworkDiscovery'
import type { ArtMedium } from '../../lib/schema'

const MotionBox = motion.create(Box)

const CARD_RATIOS = ['4 / 5', '1 / 1', '3 / 4', '5 / 4', '2 / 3', '4 / 3']
const MOBILE_DISCOVERY_MEDIUMS: ArtMedium[] = ['painting', 'photography', 'digital', 'illustration']

function ArtworkCard({ artwork, index }: { artwork: DiscoveryArtwork; index: number }) {
  return (
    <Link to={artwork.detailHref}>
      <MotionBox
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: Math.min(index * 0.025, 0.35) }}
        role="group"
        cursor="pointer"
      >
        <Box
          bg="gray.900"
          border="1px solid"
          borderColor="whiteAlpha.100"
          borderRadius="2xl"
          overflow="hidden"
          _hover={{ borderColor: 'whiteAlpha.300' }}
        >
          <Box position="relative" aspectRatio={CARD_RATIOS[index % CARD_RATIOS.length]} bg="gray.800" overflow="hidden">
            <Image
              src={artwork.imageUrl}
              alt={artwork.title}
              w="full"
              h="full"
              objectFit="cover"
              transition="transform 0.35s ease"
              _groupHover={{ transform: 'scale(1.025)' }}
            />
            <Box
              position="absolute"
              inset={0}
              bgGradient="linear(to-t, blackAlpha.800, blackAlpha.100, transparent)"
              opacity={0}
              transition="opacity 0.25s ease"
              _groupHover={{ opacity: 1 }}
            />
            <Badge
              position="absolute"
              top={3}
              left={3}
              bg="blackAlpha.600"
              color="white"
              borderRadius="full"
              px={3}
              py={1}
              textTransform="capitalize"
            >
              {formatMedium(artwork.medium)}
            </Badge>
          </Box>

          <Box p={4}>
            <Heading as="h3" color="white" fontSize="md" fontFamily="heading" lineClamp={1} mb={2}>
              {artwork.title}
            </Heading>
            <HStack gap={3} minW={0}>
              <Box
                w={8}
                h={8}
                borderRadius="full"
                bg="brand.500"
                overflow="hidden"
                display="flex"
                alignItems="center"
                justifyContent="center"
                flexShrink={0}
              >
                {artwork.credit.avatarUrl ? (
                  <Image src={artwork.credit.avatarUrl} alt={artwork.credit.name} w="full" h="full" objectFit="cover" />
                ) : (
                  <Text color="white" fontSize="xs" fontWeight="bold">
                    {artwork.credit.name.charAt(0)}
                  </Text>
                )}
              </Box>
              <Box minW={0}>
                <Text color="whiteAlpha.800" fontSize="sm" fontWeight="semibold" lineClamp={1}>
                  {artwork.credit.name}
                </Text>
                <Text color="whiteAlpha.500" fontSize="xs" lineClamp={1}>
                  {[artwork.location, artwork.year].filter(Boolean).join(' - ') || 'Artwork'}
                </Text>
              </Box>
            </HStack>

            {artwork.genres.length > 0 && (
              <HStack gap={2} flexWrap="wrap" mt={3}>
                {artwork.genres.slice(0, 3).map((genre) => (
                  <Badge
                    key={genre}
                    bg="whiteAlpha.100"
                    color="whiteAlpha.700"
                    px={2}
                    py={0.5}
                    borderRadius="full"
                    fontSize="xs"
                    textTransform="capitalize"
                  >
                    {genre}
                  </Badge>
                ))}
              </HStack>
            )}
          </Box>
        </Box>
      </MotionBox>
    </Link>
  )
}

export default function Artists() {
  const [search, setSearch] = useState('')
  const [selectedMediums, setSelectedMediums] = useState<ArtMedium[]>([])
  const [genreFilter, setGenreFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const { firebaseUser, initialized } = useAuth()

  const {
    data: artists,
    loading: artistsLoading,
    error: artistsError,
  } = useCollection('artists', {
    orderBy: 'createdAt',
    orderDirection: 'desc',
  })
  const {
    data: uploadedArtworks,
    loading: artworksLoading,
    error: artworksError,
  } = useCollection('artworks', {
    orderBy: 'createdAt',
    orderDirection: 'desc',
  })
  const { data: exhibitions } = useCollection('exhibitions', {
    orderBy: 'createdAt',
    orderDirection: 'desc',
  })
  const { data: currentArtist, loading: currentArtistLoading } = useDocument(
    'artists',
    firebaseUser?.uid,
    { skip: !initialized || !firebaseUser?.uid }
  )

  const allArtworks = useMemo<DiscoveryArtwork[]>(() => {
    return buildDiscoveryArtworks({ artists, uploadedArtworks, exhibitions })
  }, [artists, exhibitions, uploadedArtworks])

  const hasFilters =
    search.trim() !== '' ||
    selectedMediums.length > 0 ||
    genreFilter.trim() !== '' ||
    locationFilter.trim() !== '' ||
    dateFilter.trim() !== ''

  const visibleArtworks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    const normalizedGenre = genreFilter.trim().toLowerCase()
    const normalizedLocation = locationFilter.trim().toLowerCase()

    const filtered = allArtworks.filter((artwork) => {
      const searchable = [
        artwork.title,
        artwork.description,
        artwork.credit.name,
        artwork.medium,
        artwork.location,
        ...artwork.genres,
        ...artwork.tags,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = !normalizedSearch || searchable.includes(normalizedSearch)
      const matchesMedium = selectedMediums.length === 0 || selectedMediums.includes(artwork.medium)
      const matchesGenre =
        !normalizedGenre ||
        [...artwork.genres, ...artwork.tags].some((value) => value.toLowerCase().includes(normalizedGenre))
      const matchesLocation =
        !normalizedLocation || (artwork.location || '').toLowerCase().includes(normalizedLocation)
      const matchesDate = !dateFilter || artwork.dateKey === dateFilter

      return matchesSearch && matchesMedium && matchesGenre && matchesLocation && matchesDate
    })

    return [...filtered].sort((a, b) =>
      hasFilters
        ? b.createdAtMs - a.createdAtMs
        : stableScore(a.id, DISCOVERY_SHUFFLE_SEED) - stableScore(b.id, DISCOVERY_SHUFFLE_SEED)
    )
  }, [allArtworks, dateFilter, genreFilter, hasFilters, locationFilter, search, selectedMediums])

  const hasCurrentArtistProfile = !!currentArtist
  const artistProfileHref = hasCurrentArtistProfile && firebaseUser?.uid ? `/artists/${firebaseUser.uid}` : '/artists/create'
  const artistActionLabel = currentArtistLoading
    ? 'Checking Profile'
    : hasCurrentArtistProfile
      ? 'Edit Artist Profile'
      : 'Create Your Profile'

  const toggleMedium = (medium: ArtMedium) => {
    setSelectedMediums((prev) =>
      prev.includes(medium) ? prev.filter((item) => item !== medium) : [...prev, medium]
    )
  }

  const clearFilters = () => {
    setSearch('')
    setSelectedMediums([])
    setGenreFilter('')
    setLocationFilter('')
    setDateFilter('')
  }

  if (artistsLoading || artworksLoading) {
    return (
      <Box bg="gray.950" minH="100vh">
        <Header />
        <Box as="main" pt={32} pb={20}>
          <Container maxW="1440px" px={{ base: 6, md: 12, lg: 16, xl: 20 }}>
            <Flex justify="center" align="center" minH="50vh">
              <Spinner size="xl" color="brand.500" />
            </Flex>
          </Container>
        </Box>
        <Footer />
      </Box>
    )
  }

  if (artistsError || artworksError) {
    return (
      <Box bg="gray.950" minH="100vh">
        <Header />
        <Box as="main" pt={32} pb={20}>
          <Container maxW="1440px" px={{ base: 6, md: 12, lg: 16, xl: 20 }}>
            <Flex direction="column" justify="center" align="center" minH="50vh" gap={4}>
              <Heading as="h2" fontSize="2xl" color="white">
                Error loading artwork
              </Heading>
              <Text color="whiteAlpha.600">{artistsError?.message || artworksError?.message}</Text>
            </Flex>
          </Container>
        </Box>
        <Footer />
      </Box>
    )
  }

  return (
    <Box bg="gray.950" minH="100vh">
      <Header />

      <Box as="main" pt={32} pb={20}>
        <Container maxW="1440px" px={{ base: 5, md: 12, lg: 16, xl: 20 }}>
          <MotionBox
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            mb={10}
          >
            <Flex justify="space-between" align={{ base: 'start', lg: 'end' }} gap={8} direction={{ base: 'column', lg: 'row' }}>
              <Box>
                <Text color="brand.500" fontSize="sm" textTransform="uppercase" letterSpacing="0.2em" mb={4}>
                  Artwork Discovery
                </Text>
                <Heading
                  as="h1"
                  fontSize={{ base: '3rem', md: '4rem', lg: '5rem' }}
                  lineHeight={1}
                  color="white"
                  fontFamily="heading"
                  mb={5}
                >
                  Discover Work
                </Heading>
                <Text color="whiteAlpha.500" fontSize={{ base: 'md', md: 'lg' }} maxW="2xl">
                  Browse artwork from Club BZR artists. Search by artist, art type, genre, location, or date.
                </Text>
              </Box>

              {firebaseUser && (
                <HStack gap={3} flexWrap="wrap" display={{ base: 'none', md: 'flex' }}>
                  {hasCurrentArtistProfile && (
                    <Link to={artistProfileHref}>
                      <Button
                        borderRadius="full"
                        px={5}
                        bg="whiteAlpha.50"
                        color="white"
                        border="1px solid"
                        borderColor="whiteAlpha.200"
                        _hover={{ bg: 'whiteAlpha.100' }}
                      >
                        <Eye size={18} />
                        View Profile
                      </Button>
                    </Link>
                  )}
                  <Link to="/artists/create">
                    <Button
                      borderRadius="full"
                      px={6}
                      bg="brand.500"
                      color="white"
                      _hover={{ bg: 'brand.600' }}
                      disabled={currentArtistLoading}
                    >
                      {hasCurrentArtistProfile ? <Pencil size={18} /> : <UserRound size={18} />}
                      {artistActionLabel}
                    </Button>
                  </Link>
                </HStack>
              )}
            </Flex>
          </MotionBox>

          <MotionBox
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            mb={{ base: 7, md: 10 }}
            p={{ base: 3, md: 5 }}
            bg="gray.900"
            border="1px solid"
            borderColor="whiteAlpha.100"
            borderRadius="2xl"
          >
            <VStack align="stretch" gap={{ base: 3, md: 4 }}>
              <Flex gap={4} direction={{ base: 'column', lg: 'row' }}>
                <Box flex={1} position="relative">
                  <Box position="absolute" left={4} top="50%" transform="translateY(-50%)" color="whiteAlpha.500">
                    <Search size={18} />
                  </Box>
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search artists, artwork titles, tags..."
                    bg="blackAlpha.300"
                    border="1px solid"
                    borderColor="whiteAlpha.200"
                    borderRadius={{ base: 'lg', md: 'xl' }}
                    color="white"
                    h={{ base: '46px', md: '52px' }}
                    pl={11}
                    _placeholder={{ color: 'whiteAlpha.400' }}
                    _focus={{ borderColor: 'brand.500', boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)' }}
                  />
                </Box>
                <Input
                  display={{ base: 'none', lg: 'block' }}
                  value={genreFilter}
                  onChange={(event) => setGenreFilter(event.target.value)}
                  placeholder="Genre or tag"
                  bg="blackAlpha.300"
                  border="1px solid"
                  borderColor="whiteAlpha.200"
                  borderRadius="xl"
                  color="white"
                  h="52px"
                  maxW={{ lg: '220px' }}
                  _placeholder={{ color: 'whiteAlpha.400' }}
                  _focus={{ borderColor: 'brand.500', boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)' }}
                />
                <Input
                  display={{ base: 'none', lg: 'block' }}
                  value={locationFilter}
                  onChange={(event) => setLocationFilter(event.target.value)}
                  placeholder="Location"
                  bg="blackAlpha.300"
                  border="1px solid"
                  borderColor="whiteAlpha.200"
                  borderRadius="xl"
                  color="white"
                  h="52px"
                  maxW={{ lg: '220px' }}
                  _placeholder={{ color: 'whiteAlpha.400' }}
                  _focus={{ borderColor: 'brand.500', boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)' }}
                />
                <Input
                  display={{ base: 'none', lg: 'block' }}
                  type="date"
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value)}
                  bg="blackAlpha.300"
                  border="1px solid"
                  borderColor="whiteAlpha.200"
                  borderRadius="xl"
                  color="white"
                  h="52px"
                  maxW={{ lg: '180px' }}
                  _focus={{ borderColor: 'brand.500', boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)' }}
                />
              </Flex>

              <Flex justify="space-between" align={{ base: 'stretch', xl: 'center' }} gap={{ base: 3, md: 4 }} direction={{ base: 'column', xl: 'row' }}>
                <HStack display={{ base: 'flex', md: 'none' }} gap={2} flexWrap="wrap">
                  {MOBILE_DISCOVERY_MEDIUMS.map((medium) => (
                    <Button
                      key={medium}
                      onClick={() => toggleMedium(medium)}
                      size="sm"
                      px={3}
                      h="34px"
                      bg={selectedMediums.includes(medium) ? 'brand.500' : 'whiteAlpha.50'}
                      color={selectedMediums.includes(medium) ? 'white' : 'whiteAlpha.700'}
                      border="1px solid"
                      borderColor={selectedMediums.includes(medium) ? 'brand.500' : 'whiteAlpha.200'}
                      borderRadius="full"
                      _hover={{
                        bg: selectedMediums.includes(medium) ? 'brand.600' : 'whiteAlpha.100',
                        color: 'white',
                      }}
                    >
                      {formatMedium(medium)}
                    </Button>
                  ))}
                </HStack>

                <HStack display={{ base: 'none', md: 'flex' }} gap={2} flexWrap="wrap">
                  {DISCOVERY_MEDIUMS.map((medium) => (
                    <Button
                      key={medium}
                      onClick={() => toggleMedium(medium)}
                      size="sm"
                      px={4}
                      h="38px"
                      bg={selectedMediums.includes(medium) ? 'brand.500' : 'whiteAlpha.50'}
                      color={selectedMediums.includes(medium) ? 'white' : 'whiteAlpha.700'}
                      border="1px solid"
                      borderColor={selectedMediums.includes(medium) ? 'brand.500' : 'whiteAlpha.200'}
                      borderRadius="full"
                      _hover={{
                        bg: selectedMediums.includes(medium) ? 'brand.600' : 'whiteAlpha.100',
                        color: 'white',
                      }}
                    >
                      {formatMedium(medium)}
                    </Button>
                  ))}
                </HStack>

                <HStack gap={3} justify={{ base: 'space-between', xl: 'flex-start' }}>
                  <HStack color="whiteAlpha.500" fontSize="sm" gap={2}>
                    <SlidersHorizontal size={16} />
                    <Text>
                      {visibleArtworks.length} work{visibleArtworks.length === 1 ? '' : 's'}
                    </Text>
                  </HStack>
                  {hasFilters && (
                    <Button
                      onClick={clearFilters}
                      size="sm"
                      h="38px"
                      px={4}
                      bg="transparent"
                      color="whiteAlpha.700"
                      border="1px solid"
                      borderColor="whiteAlpha.200"
                      borderRadius="full"
                      _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
                    >
                      <X size={16} />
                      Clear
                    </Button>
                  )}
                </HStack>
              </Flex>
            </VStack>
          </MotionBox>

          <Box mb={16}>
            {visibleArtworks.length > 0 ? (
              <SimpleGrid columns={{ base: 1, sm: 2, lg: 3, xl: 4 }} gap={{ base: 5, md: 6 }}>
                {visibleArtworks.map((artwork, index) => (
                  <ArtworkCard key={artwork.id} artwork={artwork} index={index} />
                ))}
              </SimpleGrid>
            ) : (
              <Box textAlign="center" py={16}>
                <Heading as="h2" color="white" fontSize="2xl" mb={3}>
                  No artwork found
                </Heading>
                <Text color="whiteAlpha.500" mb={6}>
                  Try a broader search or clear the filters.
                </Text>
                {hasFilters && (
                  <Button borderRadius="full" bg="brand.500" color="white" _hover={{ bg: 'brand.600' }} onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </Box>
            )}
          </Box>

          <MotionBox
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            textAlign="center"
            py={{ base: 10, md: 14 }}
            px={{ base: 5, md: 8 }}
            borderRadius="2xl"
            bg="gray.900"
            border="1px solid"
            borderColor="whiteAlpha.100"
          >
            <Heading as="h2" fontSize={{ base: 'xl', md: '2xl' }} color="white" fontFamily="heading" mb={4}>
              {hasCurrentArtistProfile ? 'Add More Work' : 'Are You an Artist?'}
            </Heading>
            <Text color="whiteAlpha.500" mb={8} maxW="lg" mx="auto">
              {hasCurrentArtistProfile
                ? 'Upload your latest work so it appears on your profile and in discovery.'
                : 'Create a profile, upload your work, and make it discoverable by the Club BZR community.'}
            </Text>
            <Link to="/artists/create">
              <Button
                bg="brand.500"
                color="white"
                borderRadius="full"
                px={8}
                h="50px"
                _hover={{ bg: 'brand.600' }}
                disabled={currentArtistLoading}
              >
                {hasCurrentArtistProfile ? <Pencil size={18} /> : <UserRound size={18} />}
                {artistActionLabel}
              </Button>
            </Link>
          </MotionBox>
        </Container>
      </Box>

      <Footer />
    </Box>
  )
}
