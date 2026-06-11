'use client'

import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { doc } from 'firebase/firestore'
import {
  Box,
  Container,
  Flex,
  Grid,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Badge,
  SimpleGrid,
  Spinner,
} from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { Pencil } from 'lucide-react'

import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { PortfolioGallery } from '@/components/features/artists'
import { useAuth } from '@/contexts/AuthContext'
import { useDocument } from '@/hooks/useFirestore'
import { db, executeTransaction, increment, serverTimestamp } from '../../lib/firestore'
import type { Artist, ArtMedium } from '../../lib/schema'

const MotionBox = motion.create(Box)

// Format medium for display
const formatMedium = (medium: ArtMedium): string =>
  medium.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

// Check if artist is available
const isArtistAvailable = (artist: Artist): boolean =>
  artist.availability.forCollaborations ||
  artist.availability.forCommissions ||
  artist.availability.forEvents

// Get availability text
const getAvailabilityText = (artist: Artist): string => {
  const available: string[] = []
  if (artist.availability.forCollaborations) available.push('collaborations')
  if (artist.availability.forCommissions) available.push('commissions')
  if (artist.availability.forEvents) available.push('events')
  return available.length > 0 ? `Available for ${available.join(', ')}` : 'Currently busy'
}

export default function ArtistProfile() {
  const { id } = useParams()
  const { firebaseUser } = useAuth()
  const [showGallery, setShowGallery] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [optimisticFollow, setOptimisticFollow] = useState<{ docId: string; value: boolean } | null>(null)
  const [followLoading, setFollowLoading] = useState(false)

  // Fetch artist from Firebase
  const { data: artist, loading, error, refetch } = useDocument('artists', id)
  const isOwnProfile = !!firebaseUser?.uid && !!artist && (artist.userId === firebaseUser.uid || id === firebaseUser.uid)
  const followDocId = firebaseUser?.uid && id ? `${firebaseUser.uid}_${id}` : undefined
  const {
    data: followRecord,
    loading: followRecordLoading,
    refetch: refetchFollowRecord,
  } = useDocument('artistFollows', followDocId, { skip: !followDocId || isOwnProfile })
  const isFollowing = optimisticFollow?.docId === followDocId ? optimisticFollow.value : !!followRecord

  // Handle follow/unfollow
  const handleFollow = async () => {
    if (!firebaseUser?.uid) {
      window.location.href = '/auth/login'
      return
    }

    if (!id || !followDocId || followLoading || isOwnProfile) return

    const nextFollowing = !isFollowing
    setFollowLoading(true)
    setOptimisticFollow({ docId: followDocId, value: nextFollowing })

    try {
      const result = await executeTransaction(async (transaction) => {
        const artistRef = doc(db, 'artists', id)
        const followRef = doc(db, 'artistFollows', followDocId)
        const followSnapshot = await transaction.get(followRef)

        if (followSnapshot.exists()) {
          transaction.delete(followRef)
          transaction.update(artistRef, {
            followersCount: increment(-1),
            updatedAt: serverTimestamp(),
          })
          return false
        }

        transaction.set(followRef, {
          userId: firebaseUser.uid,
          artistId: id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        transaction.update(artistRef, {
          followersCount: increment(1),
          updatedAt: serverTimestamp(),
        })
        return true
      })

      if (result.success) {
        setOptimisticFollow({ docId: followDocId, value: result.data ?? nextFollowing })
        refetch()
        refetchFollowRecord()
      } else {
        setOptimisticFollow(null)
        console.error('Failed to update follow status:', result.error)
      }
    } catch (err) {
      setOptimisticFollow(null)
      console.error('Failed to update follow status:', err)
    } finally {
      setFollowLoading(false)
    }
  }

  // Loading state
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

  // Error or not found state
  if (error || !artist) {
    return (
      <Box bg="gray.950" minH="100vh">
        <Header />
        <Box as="main" pt={32} pb={20}>
          <Container maxW="1440px" px={{ base: 6, md: 12, lg: 16, xl: 20 }}>
            <Flex direction="column" justify="center" align="center" minH="50vh" gap={4}>
              <Heading as="h2" fontSize="2xl" color="white">
                Artist not found
              </Heading>
              <Text color="whiteAlpha.600">
                {error?.message || 'The artist you are looking for does not exist.'}
              </Text>
              <Link to="/artists">
                <Button
                  mt={4}
                  bg="brand.500"
                  color="white"
                  borderRadius="full"
                  _hover={{ bg: 'brand.600' }}
                >
                  Browse Artists
                </Button>
              </Link>
            </Flex>
          </Container>
        </Box>
        <Footer />
      </Box>
    )
  }

  const displayName = artist.artistName || artist.name
  const isAvailable = isArtistAvailable(artist)
  const availabilityColor = isAvailable ? 'green.400' : 'orange.400'

  return (
    <Box bg="gray.950" minH="100vh">
      <Header />

      <Box as="main" pt={{ base: 24, md: 32 }} pb={{ base: 32, md: 20 }} overflowX="hidden">
        <Container maxW="1440px" px={{ base: 4, md: 12, lg: 16, xl: 20 }}>
          <Grid templateColumns={{ base: '1fr', lg: '1fr 2fr' }} gap={{ base: 6, lg: 12 }}>
            {/* Sidebar - Avatar & Basic Info */}
            <MotionBox
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              position={{ lg: 'sticky' }}
              top={28}
              h="fit-content"
            >
              <Box
                p={{ base: 5, md: 8 }}
                borderRadius="2xl"
                bg="gray.900"
                border="1px solid"
                borderColor="whiteAlpha.100"
                textAlign="center"
                maxW={{ base: '100%', sm: '520px', lg: 'none' }}
                mx={{ base: 'auto', lg: 0 }}
              >
                {/* Avatar */}
                <Box
                  w={{ base: 20, md: 24 }}
                  h={{ base: 20, md: 24 }}
                  borderRadius="full"
                  bg="brand.500"
                  mx="auto"
                  mb={{ base: 5, md: 6 }}
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
                    <Text color="white" fontSize="3xl" fontWeight="bold">
                      {displayName.split(' ').map(n => n[0]).join('')}
                    </Text>
                  )}
                </Box>

                <Heading as="h1" fontSize={{ base: 'xl', md: '2xl' }} color="white" fontFamily="heading" mb={2}>
                  {displayName}
                </Heading>
                {artist.artistName && artist.name !== artist.artistName && (
                  <Text color="whiteAlpha.500" fontSize="sm" mb={2}>
                    {artist.name}
                  </Text>
                )}

                <Text
                  color={availabilityColor}
                  fontSize={{ base: 'xs', md: 'sm' }}
                  textTransform="uppercase"
                  letterSpacing="wider"
                  fontWeight="medium"
                  lineHeight="tall"
                >
                  {getAvailabilityText(artist)}
                </Text>

                {/* Stats */}
                <HStack gap={4} mt={4} justify="center" flexWrap="wrap">
                  <Text color="whiteAlpha.600" fontSize="sm">
                    <Text as="span" color="white" fontWeight="bold">{artist.followersCount}</Text> followers
                  </Text>
                  <Text color="whiteAlpha.600" fontSize="sm">
                    <Text as="span" color="white" fontWeight="bold">{artist.worksCount}</Text> works
                  </Text>
                </HStack>

                {/* Mediums */}
                <HStack gap={2} mt={6} justify="center" flexWrap="wrap">
                  {artist.mediums.map((medium) => (
                    <Badge
                      key={medium}
                      bg="transparent"
                      color="whiteAlpha.700"
                      border="1px solid"
                      borderColor="whiteAlpha.300"
                      px={3}
                      py={1}
                      borderRadius="full"
                      fontSize="xs"
                      textTransform="capitalize"
                    >
                      {formatMedium(medium)}
                    </Badge>
                  ))}
                </HStack>

                {/* Social Links */}
                <HStack gap={4} mt={{ base: 6, md: 8 }} justify="center" flexWrap="wrap">
                  {artist.socialLinks.instagram && (
                    <a
                      href={artist.socialLinks.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Text
                        color="whiteAlpha.500"
                        fontSize="sm"
                        _hover={{ color: 'white' }}
                        transition="color 0.2s"
                      >
                        Instagram
                      </Text>
                    </a>
                  )}
                  {artist.socialLinks.website && (
                    <a
                      href={artist.socialLinks.website}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Text
                        color="whiteAlpha.500"
                        fontSize="sm"
                        _hover={{ color: 'white' }}
                        transition="color 0.2s"
                      >
                        Website
                      </Text>
                    </a>
                  )}
                </HStack>

                {isOwnProfile ? (
                  <Link to="/artists/create">
                    <Button
                      w="full"
                      mt={{ base: 6, md: 8 }}
                      bg="brand.500"
                      color="white"
                      border="2px solid"
                      borderColor="brand.500"
                      borderRadius="full"
                      py={6}
                      _hover={{ bg: 'brand.600' }}
                    >
                      <Pencil size={18} />
                      Edit Artist Profile
                    </Button>
                  </Link>
                ) : (
                  <Button
                    w="full"
                    mt={{ base: 6, md: 8 }}
                    bg={isFollowing ? 'whiteAlpha.50' : 'brand.500'}
                    color={isFollowing ? 'white' : 'white'}
                    border="2px solid"
                    borderColor={isFollowing ? 'whiteAlpha.300' : 'brand.500'}
                    borderRadius="full"
                    py={6}
                    _hover={{
                      bg: isFollowing ? 'red.500/15' : 'brand.600',
                      borderColor: isFollowing ? 'red.400' : 'brand.600',
                      color: isFollowing ? 'red.200' : 'white',
                    }}
                    onClick={handleFollow}
                    disabled={followLoading || followRecordLoading}
                  >
                    {followLoading || followRecordLoading ? 'Updating...' : isFollowing ? 'Unfollow' : 'Follow'}
                  </Button>
                )}
              </Box>
            </MotionBox>

            {/* Main Content */}
            <VStack align="stretch" gap={{ base: 5, md: 8 }} minW={0}>
              {/* About */}
              <MotionBox
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                p={{ base: 5, md: 8 }}
                borderRadius="2xl"
                bg="gray.900"
                border="1px solid"
                borderColor="whiteAlpha.100"
              >
                <Heading as="h2" fontSize={{ base: 'lg', md: 'xl' }} color="white" fontFamily="heading" mb={4}>
                  About
                </Heading>
                <Text color="whiteAlpha.600" fontSize={{ base: 'md', md: 'lg' }} lineHeight="tall">
                  {artist.bio}
                </Text>
              </MotionBox>

              {/* Interests */}
              <MotionBox
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                p={{ base: 5, md: 8 }}
                borderRadius="2xl"
                bg="gray.900"
                border="1px solid"
                borderColor="whiteAlpha.100"
              >
                <Heading as="h2" fontSize={{ base: 'lg', md: 'xl' }} color="white" fontFamily="heading" mb={4}>
                  Interests
                </Heading>
                <HStack gap={2} flexWrap="wrap">
                  {artist.interests.map((interest) => (
                    <Badge
                      key={interest}
                      bg="whiteAlpha.100"
                      color="whiteAlpha.700"
                      px={4}
                      py={2}
                      borderRadius="full"
                      fontSize="sm"
                      textTransform="capitalize"
                    >
                      {interest}
                    </Badge>
                  ))}
                </HStack>
              </MotionBox>

              {/* Collaboration Goals */}
              {artist.collaborationGoals.length > 0 && (
                <MotionBox
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                p={{ base: 5, md: 8 }}
                  borderRadius="2xl"
                  bg="gray.900"
                  border="1px solid"
                  borderColor="whiteAlpha.100"
                >
                  <Heading as="h2" fontSize={{ base: 'lg', md: 'xl' }} color="white" fontFamily="heading" mb={4}>
                    Collaboration Goals
                  </Heading>
                  <HStack gap={2} flexWrap="wrap">
                    {artist.collaborationGoals.map((goal) => (
                      <Badge
                        key={goal}
                        bg="purple.500/20"
                        color="purple.300"
                        px={4}
                        py={2}
                        borderRadius="full"
                        fontSize="sm"
                        textTransform="capitalize"
                      >
                        {goal}
                      </Badge>
                    ))}
                  </HStack>
                </MotionBox>
              )}

              {/* Artist Statement */}
              {artist.statement && (
                <MotionBox
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  p={{ base: 5, md: 8 }}
                  borderRadius="2xl"
                  bg="gray.900"
                  border="1px solid"
                  borderColor="whiteAlpha.100"
                >
                  <Heading as="h2" fontSize={{ base: 'lg', md: 'xl' }} color="white" fontFamily="heading" mb={4}>
                    Artist Statement
                  </Heading>
                  <Text color="whiteAlpha.600" lineHeight="tall" fontStyle="italic">
                    {artist.statement}
                  </Text>
                </MotionBox>
              )}

              {/* Stats */}
              <MotionBox
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <SimpleGrid columns={2} gap={4}>
                  <Box
                    p={6}
                    borderRadius="2xl"
                    bg="gray.900"
                    border="1px solid"
                    borderColor="whiteAlpha.100"
                    textAlign="center"
                  >
                    <Text color="blue.400" fontSize="3xl" fontFamily="heading" fontWeight="bold">
                      {artist.followersCount}
                    </Text>
                    <Text color="whiteAlpha.500" fontSize="sm" mt={1}>
                      Followers
                    </Text>
                  </Box>
                  <Box
                    p={6}
                    borderRadius="2xl"
                    bg="gray.900"
                    border="1px solid"
                    borderColor="whiteAlpha.100"
                    textAlign="center"
                  >
                    <Text color="green.400" fontSize="3xl" fontFamily="heading" fontWeight="bold">
                      {artist.worksCount}
                    </Text>
                    <Text color="whiteAlpha.500" fontSize="sm" mt={1}>
                      Works
                    </Text>
                  </Box>
                </SimpleGrid>
              </MotionBox>
            </VStack>
          </Grid>

          {/* Portfolio Section */}
          {artist.portfolio.length > 0 && (
            <MotionBox
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              mt={16}
            >
              <Heading as="h2" fontSize="2xl" color="white" fontFamily="heading" mb={8}>
                Portfolio
              </Heading>

              <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={6}>
                {artist.portfolio.map((item, i) => (
                  <MotionBox
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    viewport={{ once: true }}
                    whileHover={{ y: -8 }}
                    borderRadius="2xl"
                    overflow="hidden"
                    bg="gray.900"
                    border="1px solid"
                    borderColor="whiteAlpha.100"
                    cursor="pointer"
                    role="group"
                    onClick={() => {
                      setGalleryIndex(i)
                      setShowGallery(true)
                    }}
                  >
                    <Box
                      position="relative"
                      aspectRatio={1}
                      bg="gray.800"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      overflow="hidden"
                    >
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <Text color="whiteAlpha.300">Artwork</Text>
                      )}

                      {/* Hover overlay */}
                      <Box
                        position="absolute"
                        inset={0}
                        bgGradient="linear(to-t, blackAlpha.800, transparent)"
                        opacity={0}
                        _groupHover={{ opacity: 1 }}
                        transition="opacity 0.3s"
                        display="flex"
                        alignItems="flex-end"
                        p={5}
                      >
                        <Box>
                          <Heading as="h3" fontSize="lg" color="white" fontFamily="heading">
                            {item.title}
                          </Heading>
                          <HStack gap={2} mt={1}>
                            <Text color="whiteAlpha.500" fontSize="sm">
                              {formatMedium(item.medium)}
                            </Text>
                            {item.year && (
                              <Text color="whiteAlpha.500" fontSize="sm">
                                {item.year}
                              </Text>
                            )}
                          </HStack>
                        </Box>
                      </Box>
                    </Box>
                  </MotionBox>
                ))}
              </SimpleGrid>
            </MotionBox>
          )}
        </Container>
      </Box>

      <Footer />

      {/* Portfolio Gallery Modal */}
      {showGallery && artist.portfolio.length > 0 && (
        <PortfolioGallery
          items={artist.portfolio}
          artistName={displayName}
          initialIndex={galleryIndex}
          onClose={() => setShowGallery(false)}
        />
      )}
    </Box>
  )
}
