'use client'

import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Box,
  Container,
  Flex,
  Heading,
  Text,
  Button,
  Input,
  HStack,
  SimpleGrid,
  Badge,
  Spinner,
} from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { Eye, Pencil, UserRound } from 'lucide-react'

import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { useAuth } from '@/contexts/AuthContext'
import { useCollection, useDocument } from '@/hooks/useFirestore'
import type { Artist, ArtMedium } from '../../lib/schema'

const MotionBox = motion.create(Box)

const MEDIUMS: ArtMedium[] = [
  'painting',
  'illustration',
  'photography',
  'digital',
  'mixed_media',
  'ceramics',
  'sculpture',
  'video',
]

// Helper to check if artist is available for any collaboration
function isArtistAvailable(artist: Artist): boolean {
  return (
    artist.availability.forCollaborations ||
    artist.availability.forCommissions ||
    artist.availability.forEvents
  )
}

// Format medium for display
function formatMedium(medium: ArtMedium): string {
  return medium.replace(/_/g, ' ')
}

function ArtistCard({ artist, featured = false }: { artist: Artist; featured?: boolean }) {
  const displayName = artist.artistName || artist.name
  const isAvailable = isArtistAvailable(artist)

  return (
    <Link to={`/artists/${artist.id}`}>
      <MotionBox
        whileHover={{ y: -8 }}
        transition={{ duration: 0.3 }}
        p={6}
        borderRadius="2xl"
        bg="gray.900"
        border="1px solid"
        borderColor="whiteAlpha.100"
        role="group"
        cursor="pointer"
        h="full"
        _hover={{ borderColor: 'brand.500' }}
      >
        <Box
          w={featured ? 20 : 16}
          h={featured ? 20 : 16}
          borderRadius="full"
          bg="brand.500"
          mb={4}
          display="flex"
          alignItems="center"
          justifyContent="center"
          overflow="hidden"
        >
          {artist.portfolio[0]?.thumbnailUrl ? (
            <img
              src={artist.portfolio[0].thumbnailUrl}
              alt={displayName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <Text color="white" fontSize={featured ? '2xl' : 'xl'} fontWeight="bold">
              {displayName.charAt(0)}
            </Text>
          )}
        </Box>

        <Heading
          as="h3"
          fontSize={featured ? 'xl' : 'lg'}
          color="white"
          fontFamily="heading"
          mb={2}
          _groupHover={{ color: 'brand.500' }}
          transition="color 0.2s"
        >
          {displayName}
        </Heading>

        <Text color="whiteAlpha.500" fontSize="sm" mb={4} lineClamp={2}>
          {artist.bio}
        </Text>

        <HStack gap={2} flexWrap="wrap" mb={4}>
          {artist.mediums.slice(0, 3).map((medium) => (
            <Badge
              key={medium}
              bg="whiteAlpha.100"
              color="whiteAlpha.700"
              px={2}
              py={0.5}
              borderRadius="full"
              fontSize="xs"
              textTransform="capitalize"
            >
              {formatMedium(medium)}
            </Badge>
          ))}
        </HStack>

        <HStack gap={2}>
          <Badge
            bg={isAvailable ? 'green.500' : 'yellow.500'}
            color="white"
            px={2}
            py={0.5}
            borderRadius="full"
            fontSize="xs"
          >
            {isAvailable ? 'Available' : 'Busy'}
          </Badge>
          {artist.openToCollaboration && (
            <Badge
              bg="purple.500"
              color="white"
              px={2}
              py={0.5}
              borderRadius="full"
              fontSize="xs"
            >
              Open to Collab
            </Badge>
          )}
        </HStack>
      </MotionBox>
    </Link>
  )
}

export default function Artists() {
  const [search, setSearch] = useState('')
  const [selectedMediums, setSelectedMediums] = useState<ArtMedium[]>([])
  const [showAvailableOnly, setShowAvailableOnly] = useState(false)
  const { firebaseUser, initialized } = useAuth()

  // Fetch artists from Firebase
  const { data: artists, loading, error } = useCollection('artists', {
    orderBy: 'createdAt',
    orderDirection: 'desc',
  })
  const { data: currentArtist, loading: currentArtistLoading } = useDocument(
    'artists',
    firebaseUser?.uid,
    { skip: !initialized || !firebaseUser?.uid }
  )

  // Filter artists based on search, mediums, and availability
  const filteredArtists = useMemo(() => {
    return artists.filter((artist) => {
      const displayName = artist.artistName || artist.name
      const matchesSearch =
        displayName.toLowerCase().includes(search.toLowerCase()) ||
        artist.bio.toLowerCase().includes(search.toLowerCase())
      const matchesMedium =
        selectedMediums.length === 0 || artist.mediums.some((m) => selectedMediums.includes(m))
      const matchesAvailability =
        !showAvailableOnly || isArtistAvailable(artist)
      return matchesSearch && matchesMedium && matchesAvailability
    })
  }, [artists, search, selectedMediums, showAvailableOnly])

  const featuredArtists = filteredArtists.filter((a) => a.featured)
  const otherArtists = filteredArtists.filter((a) => !a.featured)
  const hasCurrentArtistProfile = !!currentArtist
  const artistProfileHref = hasCurrentArtistProfile && firebaseUser?.uid ? `/artists/${firebaseUser.uid}` : '/artists/create'
  const artistActionLabel = currentArtistLoading
    ? 'Checking Profile'
    : hasCurrentArtistProfile
      ? 'Edit Artist Profile'
      : 'Create Your Profile'

  const toggleMedium = (medium: ArtMedium) => {
    setSelectedMediums((prev) =>
      prev.includes(medium) ? prev.filter((m) => m !== medium) : [...prev, medium]
    )
  }

  // Show loading state
  if (loading) {
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

  // Show error state
  if (error) {
    return (
      <Box bg="gray.950" minH="100vh">
        <Header />
        <Box as="main" pt={32} pb={20}>
          <Container maxW="1440px" px={{ base: 6, md: 12, lg: 16, xl: 20 }}>
            <Flex direction="column" justify="center" align="center" minH="50vh" gap={4}>
              <Heading as="h2" fontSize="2xl" color="white">
                Error loading artists
              </Heading>
              <Text color="whiteAlpha.600">{error.message}</Text>
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
        <Container maxW="1440px" px={{ base: 6, md: 12, lg: 16, xl: 20 }}>
          {/* Hero */}
          <MotionBox
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            mb={12}
          >
            <Flex justify="space-between" align={{ base: 'start', lg: 'end' }} gap={8} direction={{ base: 'column', lg: 'row' }}>
              <Box>
                <Text
                  color="brand.500"
                  fontSize="sm"
                  textTransform="uppercase"
                  letterSpacing="0.3em"
                  mb={4}
                >
                  Artist Directory
                </Text>

                <Heading
                  as="h1"
                  fontSize={{ base: '3rem', md: '4rem', lg: '5rem' }}
                  lineHeight={1.1}
                  color="white"
                  fontFamily="heading"
                  mb={6}
                >
                  Discover Creators
                </Heading>

                <Text color="whiteAlpha.500" fontSize={{ base: 'md', md: 'lg' }} maxW="2xl">
                  Connect with talented artists across mediums. Find collaborators, discover new work,
                  and build creative relationships.
                </Text>
              </Box>

              {firebaseUser && (
                <HStack gap={3} flexWrap="wrap">
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

          {/* Filters */}
          <MotionBox
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            mb={12}
            pb={8}
            borderBottom="1px solid"
            borderColor="whiteAlpha.100"
          >
            <Flex direction={{ base: 'column', lg: 'row' }} gap={6}>
              <Box flex={1}>
                <Input
                  placeholder="Search artists..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  bg="gray.900"
                  border="1px solid"
                  borderColor="whiteAlpha.200"
                  borderRadius="lg"
                  color="white"
                  _placeholder={{ color: 'whiteAlpha.400' }}
                  _focus={{ borderColor: 'brand.500' }}
                  py={6}
                  px={4}
                />
              </Box>

              <HStack gap={3} flexWrap="wrap">
                {MEDIUMS.map((medium) => (
                  <Button
                    key={medium}
                    onClick={() => toggleMedium(medium)}
                    size="sm"
                    px={5}
                    py={5}
                    bg={selectedMediums.includes(medium) ? 'brand.500' : 'transparent'}
                    color={selectedMediums.includes(medium) ? 'white' : 'whiteAlpha.600'}
                    border="1px solid"
                    borderColor={selectedMediums.includes(medium) ? 'brand.500' : 'whiteAlpha.200'}
                    borderRadius="full"
                    textTransform="capitalize"
                    _hover={{
                      bg: selectedMediums.includes(medium) ? 'brand.600' : 'whiteAlpha.50',
                    }}
                  >
                    {formatMedium(medium)}
                  </Button>
                ))}
              </HStack>
            </Flex>

            {/* Availability Filter */}
            <Flex mt={4} gap={4} align="center">
              <Button
                onClick={() => setShowAvailableOnly(!showAvailableOnly)}
                size="sm"
                px={5}
                py={5}
                bg={showAvailableOnly ? 'green.500' : 'transparent'}
                color={showAvailableOnly ? 'white' : 'whiteAlpha.600'}
                border="1px solid"
                borderColor={showAvailableOnly ? 'green.500' : 'whiteAlpha.200'}
                borderRadius="full"
                _hover={{
                  bg: showAvailableOnly ? 'green.600' : 'whiteAlpha.50',
                }}
              >
                Available for Collaboration
              </Button>
              {(selectedMediums.length > 0 || showAvailableOnly) && (
                <Button
                  onClick={() => {
                    setSelectedMediums([])
                    setShowAvailableOnly(false)
                  }}
                  size="sm"
                  variant="ghost"
                  color="whiteAlpha.600"
                  _hover={{ color: 'white' }}
                >
                  Clear filters
                </Button>
              )}
            </Flex>
          </MotionBox>

          {/* Featured Artists */}
          {featuredArtists.length > 0 && (
            <Box mb={16}>
              <Heading as="h2" fontSize="2xl" color="white" fontFamily="heading" mb={8}>
                Featured Artists
              </Heading>

              <SimpleGrid columns={{ base: 1, md: 2 }} gap={8}>
                {featuredArtists.map((artist, i) => (
                  <MotionBox
                    key={artist.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                  >
                    <ArtistCard artist={artist} featured />
                  </MotionBox>
                ))}
              </SimpleGrid>
            </Box>
          )}

          {/* All Artists */}
          <Box mb={16}>
            <Flex justify="space-between" align="center" mb={8}>
              <Heading as="h2" fontSize="2xl" color="white" fontFamily="heading">
                All Artists
              </Heading>
              <Text color="whiteAlpha.400" fontSize="sm">
                {filteredArtists.length} artist{filteredArtists.length !== 1 ? 's' : ''}
              </Text>
            </Flex>

            {filteredArtists.length > 0 ? (
              <SimpleGrid columns={{ base: 1, sm: 2, lg: 3, xl: 4 }} gap={6}>
                {(featuredArtists.length > 0 ? otherArtists : filteredArtists).map((artist, i) => (
                  <MotionBox
                    key={artist.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 + i * 0.05 }}
                  >
                    <ArtistCard artist={artist} />
                  </MotionBox>
                ))}
              </SimpleGrid>
            ) : (
              <Box textAlign="center" py={12}>
                <Text color="whiteAlpha.500" fontSize="lg">
                  No artists found matching your criteria.
                </Text>
              </Box>
            )}
          </Box>

          {/* CTA */}
          <MotionBox
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            textAlign="center"
            py={16}
            borderRadius="2xl"
            bg="gray.900"
            border="1px solid"
            borderColor="whiteAlpha.100"
          >
            <Heading
              as="h2"
              fontSize={{ base: 'xl', md: '2xl' }}
              color="white"
              fontFamily="heading"
              mb={4}
            >
              {hasCurrentArtistProfile ? 'Keep Your Artist Profile Current' : 'Are You an Artist?'}
            </Heading>

            <Text color="whiteAlpha.500" mb={8} maxW="lg" mx="auto">
              {hasCurrentArtistProfile
                ? 'Update your mediums, links, featured work, and collaboration availability so the community sees your latest work.'
                : 'Join our community and showcase your work. Connect with other artists and find collaboration opportunities.'}
            </Text>

            <Link to="/artists/create">
              <Button
                bg="brand.500"
                color="white"
                borderRadius="full"
                px={8}
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
