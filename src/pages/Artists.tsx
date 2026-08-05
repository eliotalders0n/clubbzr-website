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
import { ImagePlus, Search, Shuffle, SlidersHorizontal, UserRound, X } from 'lucide-react'

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

const createDiscoverySeed = () =>
  `${DISCOVERY_SHUFFLE_SEED}:${Date.now()}:${Math.random().toString(36).slice(2)}`

function ArtworkCard({ artwork, index }: { artwork: DiscoveryArtwork; index: number }) {
  return (
    <Link to={artwork.detailHref} aria-label={`View ${artwork.title} by ${artwork.credit.name}`}>
      <MotionBox
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: Math.min(index * 0.025, 0.35) }}
        role="group"
        cursor="pointer"
      >
        <Box display={{ base: 'block', md: 'none' }} bg="gray.950" borderBottom="1px solid" borderColor="whiteAlpha.100">
          <HStack gap={3} minW={0} px={4} py={3}>
            <Box
              w={10}
              h={10}
              borderRadius="lg"
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
                <Text color="white" fontSize="sm" fontWeight="bold">
                  {artwork.credit.name.charAt(0)}
                </Text>
              )}
            </Box>
            <Box minW={0} flex={1}>
              <Heading as="h3" color="white" fontSize="md" fontFamily="heading" lineClamp={1}>
                {artwork.title}
              </Heading>
              <Text color="whiteAlpha.600" fontSize="sm" lineClamp={1}>
                By {artwork.credit.name}
              </Text>
            </Box>
            <Badge
              bg="whiteAlpha.100"
              color="whiteAlpha.800"
              borderRadius="full"
              px={2.5}
              py={1}
              fontSize="2xs"
              textTransform="capitalize"
              flexShrink={0}
            >
              {formatMedium(artwork.medium)}
            </Badge>
          </HStack>
          <Box position="relative" aspectRatio="5 / 4" bg="gray.900" overflow="hidden">
            <Image src={artwork.imageUrl} alt={artwork.title} w="full" h="full" objectFit="cover" />
          </Box>
        </Box>

        <Box
          display={{ base: 'none', md: 'block' }}
          position="relative"
          aspectRatio="4 / 5"
          bg="gray.900"
          border="1px solid"
          borderColor="whiteAlpha.100"
          borderRadius={{ base: 'lg', md: 'xl' }}
          overflow="hidden"
          _hover={{ borderColor: 'whiteAlpha.400', transform: 'translateY(-2px)' }}
          transition="border-color 0.25s ease, transform 0.25s ease"
        >
          <Image
            src={artwork.imageUrl}
            alt={artwork.title}
            w="full"
            h="full"
            objectFit="cover"
            transition="transform 0.45s ease"
            _groupHover={{ transform: 'scale(1.035)' }}
          />
          <Box
            position="absolute"
            inset={0}
            bg="linear-gradient(180deg, rgba(0,0,0,0.04) 42%, rgba(0,0,0,0.88) 100%)"
          />
          <Badge
            position="absolute"
            top={{ base: 2.5, md: 3 }}
            left={{ base: 2.5, md: 3 }}
            bg="rgba(8, 8, 8, 0.68)"
            backdropFilter="blur(8px)"
            color="whiteAlpha.900"
            border="1px solid"
            borderColor="whiteAlpha.200"
            borderRadius="full"
            px={2.5}
            py={1}
            fontSize="xs"
            fontWeight="medium"
            textTransform="capitalize"
          >
            {formatMedium(artwork.medium)}
          </Badge>

          <Box position="absolute" left={0} right={0} bottom={0} p={{ base: 3, md: 4 }}>
            <Heading as="h3" color="white" fontSize={{ base: 'sm', md: 'md' }} fontFamily="heading" lineClamp={1} mb={1}>
              {artwork.title}
            </Heading>
            <HStack gap={2} minW={0}>
              <Box
                w={6}
                h={6}
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
              <Text color="whiteAlpha.800" fontSize="xs" fontWeight="medium" lineClamp={1}>
                {artwork.credit.name}
              </Text>
            </HStack>
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
  const [discoverySeed, setDiscoverySeed] = useState(createDiscoverySeed)
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
      stableScore(a.id, discoverySeed) - stableScore(b.id, discoverySeed) ||
      b.createdAtMs - a.createdAtMs
    )
  }, [allArtworks, dateFilter, discoverySeed, genreFilter, locationFilter, search, selectedMediums])

  const hasCurrentArtistProfile = !!currentArtist
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

      <Box as="main" pt={{ base: '76px', md: '112px' }} pb={20}>
        <Container maxW="1680px" px={{ base: 0, md: 8, lg: 10 }}>
          <MotionBox
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            mb={{ base: 5, md: 6 }}
            display={{ base: 'none', md: 'block' }}
          >
            <Flex justify="space-between" align={{ base: 'start', md: 'center' }} gap={{ base: 4, md: 8 }} direction={{ base: 'column', md: 'row' }}>
              <Box maxW="3xl">
                <Text color="brand.500" fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="0.18em" mb={2}>
                  Artwork Discovery
                </Text>
                <Heading
                  as="h1"
                  fontSize={{ base: '2.35rem', md: '3rem', lg: '3.5rem' }}
                  lineHeight={0.98}
                  color="white"
                  fontFamily="heading"
                  mb={3}
                >
                  Discover Work
                </Heading>
                <Text color="whiteAlpha.500" fontSize={{ base: 'sm', md: 'md' }} maxW="2xl">
                  Browse artwork from Club BZR artists. Search by artist, art type, genre, location, or date.
                </Text>
              </Box>

            </Flex>
          </MotionBox>

          <MotionBox
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            display={{ base: 'block', md: 'none' }}
            mx={4}
            mb={4}
          >
            <HStack
              gap={2}
              overflowX="auto"
              flexWrap="nowrap"
              pb={2}
              css={{ scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
            >
              <Button
                onClick={() => setSelectedMediums([])}
                flexShrink={0}
                h="40px"
                px={4}
                bg={selectedMediums.length === 0 ? 'brand.500' : 'whiteAlpha.50'}
                color={selectedMediums.length === 0 ? 'white' : 'whiteAlpha.800'}
                border="1px solid"
                borderColor={selectedMediums.length === 0 ? 'brand.500' : 'whiteAlpha.200'}
                borderRadius="lg"
                _hover={{ bg: selectedMediums.length === 0 ? 'brand.600' : 'whiteAlpha.100' }}
              >
                All
              </Button>
              {DISCOVERY_MEDIUMS.map((medium) => (
                <Button
                  key={medium}
                  onClick={() => toggleMedium(medium)}
                  flexShrink={0}
                  h="40px"
                  px={4}
                  bg={selectedMediums.includes(medium) ? 'brand.500' : 'whiteAlpha.50'}
                  color={selectedMediums.includes(medium) ? 'white' : 'whiteAlpha.800'}
                  border="1px solid"
                  borderColor={selectedMediums.includes(medium) ? 'brand.500' : 'whiteAlpha.200'}
                  borderRadius="lg"
                  _hover={{ bg: selectedMediums.includes(medium) ? 'brand.600' : 'whiteAlpha.100' }}
                >
                  {formatMedium(medium)}
                </Button>
              ))}
            </HStack>

            <Flex gap={2} mt={1}>
              <Box flex={1} position="relative">
                <Box position="absolute" left={3.5} top="50%" transform="translateY(-50%)" color="whiteAlpha.500" zIndex={1}>
                  <Search size={17} />
                </Box>
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search artwork or artists"
                  bg="gray.900"
                  border="1px solid"
                  borderColor="whiteAlpha.200"
                  borderRadius="lg"
                  color="white"
                  h="42px"
                  pl={10}
                  _placeholder={{ color: 'whiteAlpha.400' }}
                  _focus={{ borderColor: 'brand.500', boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)' }}
                />
              </Box>
              <Button
                onClick={() => setDiscoverySeed(createDiscoverySeed())}
                aria-label="Shuffle artwork"
                h="42px"
                px={3.5}
                bg="gray.900"
                color="whiteAlpha.800"
                border="1px solid"
                borderColor="whiteAlpha.200"
                borderRadius="lg"
                _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
              >
                <Shuffle size={18} />
              </Button>
            </Flex>
          </MotionBox>

          <MotionBox
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            mb={{ base: 5, md: 6 }}
            p={{ base: 3, md: 3.5 }}
            bg="rgba(20, 20, 20, 0.78)"
            border="1px solid"
            borderColor="whiteAlpha.100"
            borderRadius="xl"
            display={{ base: 'none', md: 'block' }}
          >
            <VStack align="stretch" gap={3}>
              <Flex gap={2.5} direction={{ base: 'column', lg: 'row' }}>
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
                    h="44px"
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
                  h="44px"
                  maxW={{ lg: '190px' }}
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
                  h="44px"
                  maxW={{ lg: '180px' }}
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
                  h="44px"
                  maxW={{ lg: '170px' }}
                  _focus={{ borderColor: 'brand.500', boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)' }}
                />
              </Flex>

              <Flex justify="space-between" align={{ base: 'stretch', xl: 'center' }} gap={{ base: 3, md: 4 }} direction={{ base: 'column', xl: 'row' }}>
                <HStack display={{ base: 'none', md: 'flex' }} gap={2} flexWrap="wrap">
                  {DISCOVERY_MEDIUMS.map((medium) => (
                    <Button
                      key={medium}
                      onClick={() => toggleMedium(medium)}
                      size="sm"
                      px={4}
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

                <HStack gap={3} justify={{ base: 'space-between', xl: 'flex-start' }}>
                  <HStack color="whiteAlpha.500" fontSize="sm" gap={2}>
                    <SlidersHorizontal size={16} />
                    <Text>
                      {visibleArtworks.length} work{visibleArtworks.length === 1 ? '' : 's'}
                    </Text>
                  </HStack>
                  <Button
                    onClick={() => setDiscoverySeed(createDiscoverySeed())}
                    size="sm"
                    h="34px"
                    px={4}
                    bg="whiteAlpha.50"
                    color="whiteAlpha.800"
                    border="1px solid"
                    borderColor="whiteAlpha.200"
                    borderRadius="full"
                    _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
                  >
                    <Shuffle size={16} />
                    Shuffle
                  </Button>
                  {hasFilters && (
                    <Button
                      onClick={clearFilters}
                      size="sm"
                      h="34px"
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
              <SimpleGrid columns={{ base: 1, md: 3, lg: 4, xl: 5 }} gap={{ base: 0, md: 4 }}>
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
                ? 'Publish your latest Subversion to your profile and the discovery wall.'
                : 'Create a profile, upload your work, and make it discoverable by the Club BZR community.'}
            </Text>
            <Link to={hasCurrentArtistProfile ? '/subversions/create' : '/artists/create'}>
              <Button
                bg="brand.500"
                color="white"
                borderRadius="full"
                px={8}
                h="50px"
                _hover={{ bg: 'brand.600' }}
                disabled={currentArtistLoading}
              >
                {hasCurrentArtistProfile ? <ImagePlus size={18} /> : <UserRound size={18} />}
                {hasCurrentArtistProfile ? 'Add Subversion' : artistActionLabel}
              </Button>
            </Link>
          </MotionBox>
        </Container>
      </Box>

      <Footer />
    </Box>
  )
}
