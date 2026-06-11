'use client'

import { useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Box,
  Container,
  Flex,
  Grid,
  Heading,
  Text,
  Button,
  Image,
  VStack,
  HStack,
  Badge,
  Spinner,
  Textarea,
} from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { Timestamp, arrayUnion, arrayRemove } from 'firebase/firestore'

import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { SessionGallery } from '@/components/features/sessions'
import { useDocument, useMutation } from '@/hooks/useFirestore'
import type { Session, SessionReflection, SessionType } from '../../lib/schema'

// Fallback image
import eventImgFallback from '@/assets/images/events/IMG_9074.jpeg'

const MotionBox = motion.create(Box)

// Helper to convert Timestamp to Date
const toDate = (timestamp: Timestamp | Date | undefined): Date => {
  if (!timestamp) return new Date()
  return timestamp instanceof Timestamp ? timestamp.toDate() : timestamp
}

// Session type display colors
const typeColors: Record<SessionType, { bg: string; text: string }> = {
  workshop: { bg: 'blue.500', text: 'white' },
  exhibition: { bg: 'purple.500', text: 'white' },
  open_studio: { bg: 'orange.500', text: 'white' },
  critique: { bg: 'amber.500', text: 'black' },
  talk: { bg: 'cyan.500', text: 'black' },
  collaboration: { bg: 'pink.500', text: 'white' },
  field_trip: { bg: 'green.500', text: 'white' },
  social: { bg: 'brand.500', text: 'white' },
  online: { bg: 'teal.500', text: 'white' },
}

// TODO: Replace with actual auth hook
const useAuth = () => ({
  user: { uid: 'demo-user-id', displayName: 'Demo User' },
  isAuthenticated: true,
})

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  // Fetch session from Firebase
  const { data: session, loading, error, refetch } = useDocument('sessions', id)
  const { update: updateSession, loading: updating } = useMutation('sessions')

  // Local state for reflections
  const [newReflection, setNewReflection] = useState('')
  const [submittingReflection, setSubmittingReflection] = useState(false)

  // Computed values
  const sessionData = useMemo(() => {
    if (!session) return null

    const sessionDate = toDate(session.date as Timestamp)
    const sessionEndDate = session.endDate ? toDate(session.endDate as Timestamp) : null
    const attendeeCount = session.attendees?.length || 0
    const waitlistCount = session.waitlist?.length || 0
    const spotsLeft = session.capacity - attendeeCount
    const progressPercent = session.capacity > 0 ? (attendeeCount / session.capacity) * 100 : 0
    const isPast = sessionDate < new Date()
    const isRegistered = session.attendees?.includes(user?.uid || '')
    const isOnWaitlist = session.waitlist?.includes(user?.uid || '')
    const isFull = spotsLeft <= 0

    return {
      sessionDate,
      sessionEndDate,
      attendeeCount,
      waitlistCount,
      spotsLeft,
      progressPercent,
      isPast,
      isRegistered,
      isOnWaitlist,
      isFull,
    }
  }, [session, user?.uid])

  // Handle registration
  const handleRegister = async () => {
    if (!session || !id || !user?.uid) return

    if (sessionData?.isFull) {
      // Add to waitlist
      await updateSession(id, {
        waitlist: arrayUnion(user.uid) as unknown as string[],
      })
    } else {
      // Add to attendees
      await updateSession(id, {
        attendees: arrayUnion(user.uid) as unknown as string[],
      })
    }
    refetch()
  }

  // Handle unregistration
  const handleUnregister = async () => {
    if (!session || !id || !user?.uid) return

    if (sessionData?.isOnWaitlist) {
      await updateSession(id, {
        waitlist: arrayRemove(user.uid) as unknown as string[],
      })
    } else {
      await updateSession(id, {
        attendees: arrayRemove(user.uid) as unknown as string[],
      })
    }
    refetch()
  }

  // Handle reflection submission
  const handleSubmitReflection = async () => {
    if (!session || !id || !user?.uid || !newReflection.trim()) return

    setSubmittingReflection(true)

    const reflection: SessionReflection = {
      id: `${Date.now()}-${user.uid}`,
      userId: user.uid,
      userName: user.displayName || 'Anonymous',
      content: newReflection.trim(),
      createdAt: Timestamp.now(),
    }

    await updateSession(id, {
      reflections: arrayUnion(reflection) as unknown as SessionReflection[],
    })

    setNewReflection('')
    setSubmittingReflection(false)
    refetch()
  }

  // Loading state
  if (loading) {
    return (
      <Box bg="gray.950" minH="100vh">
        <Header />
        <Flex justify="center" align="center" minH="60vh">
          <Spinner size="xl" color="brand.500" borderWidth="3px" />
        </Flex>
        <Footer />
      </Box>
    )
  }

  // Error or not found state
  if (error || !session) {
    return (
      <Box bg="gray.950" minH="100vh">
        <Header />
        <Box as="main" pt={32} pb={20}>
          <Container maxW="1440px" px={{ base: 6, md: 12, lg: 16, xl: 20 }}>
            <Box textAlign="center" py={20}>
              <Heading as="h2" fontSize="2xl" color="white" mb={4}>
                Session not found
              </Heading>
              <Text color="whiteAlpha.600" mb={6}>
                The session you're looking for doesn't exist or has been removed.
              </Text>
              <Button
                onClick={() => navigate('/sessions')}
                bg="brand.500"
                color="white"
                borderRadius="xl"
                _hover={{ bg: 'brand.600' }}
              >
                Browse Sessions
              </Button>
            </Box>
          </Container>
        </Box>
        <Footer />
      </Box>
    )
  }

  const typeStyle = typeColors[session.type] || { bg: 'gray.500', text: 'white' }

  return (
    <Box bg="gray.950" minH="100vh">
      <Header />

      <Box as="main">
        {/* Hero */}
        <Box position="relative" minH={{ base: '50vh', md: '60vh' }} overflow="hidden">
          {/* Background Image */}
          <Box position="absolute" inset={0}>
            <Image
              src={session.coverImage || eventImgFallback}
              alt={session.title}
              objectFit="cover"
              w="full"
              h="full"
              opacity={0.4}
            />
            <Box
              position="absolute"
              inset={0}
              bgGradient="linear(to-b, transparent, gray.950)"
            />
          </Box>

          {/* Content */}
          <Container maxW="1440px" px={{ base: 6, md: 12, lg: 16, xl: 20 }} position="relative" zIndex={10}>
            <Flex direction="column" justify="flex-end" minH={{ base: '50vh', md: '60vh' }} pb={16} pt={32}>
              <MotionBox
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <HStack gap={3} mb={6} flexWrap="wrap">
                  <Badge
                    bg={typeStyle.bg}
                    color={typeStyle.text}
                    px={3}
                    py={1}
                    borderRadius="full"
                    fontSize="sm"
                    textTransform="capitalize"
                  >
                    {session.type.replace(/_/g, ' ')}
                  </Badge>
                  {session.tags?.map((tag) => (
                    <Badge
                      key={tag}
                      bg="transparent"
                      color="whiteAlpha.700"
                      border="1px solid"
                      borderColor="whiteAlpha.300"
                      px={3}
                      py={1}
                      borderRadius="full"
                      fontSize="sm"
                    >
                      {tag}
                    </Badge>
                  ))}
                </HStack>

                <Heading
                  as="h1"
                  fontSize={{ base: '3rem', md: '4rem', lg: '5rem' }}
                  lineHeight={1.1}
                  color="white"
                  fontFamily="heading"
                  mb={6}
                >
                  {session.title}
                </Heading>

                <Text color="whiteAlpha.700" fontSize={{ base: 'lg', md: 'xl' }} maxW="2xl">
                  {session.description}
                </Text>
              </MotionBox>
            </Flex>
          </Container>
        </Box>

        {/* Details Grid */}
        <Box py={{ base: 12, md: 20 }}>
          <Container maxW="1440px" px={{ base: 6, md: 12, lg: 16, xl: 20 }}>
            <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={{ base: 8, lg: 12 }}>
              {/* Main Content */}
              <VStack align="stretch" gap={8}>
                <MotionBox
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  p={8}
                  borderRadius="2xl"
                  bg="gray.900"
                  border="1px solid"
                  borderColor="whiteAlpha.100"
                >
                  <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={4}>
                    About This Session
                  </Heading>
                  <VStack align="stretch" gap={4} color="whiteAlpha.600">
                    <Text>
                      Join us for an immersive workshop exploring the art of portrait drawing.
                      Whether you're picking up a pencil for the first time or looking to refine
                      your existing skills, this session offers something for everyone.
                    </Text>
                    <Text>
                      We'll cover fundamental techniques including proportions, shading, and
                      capturing likeness. All materials will be provided.
                    </Text>
                  </VStack>
                </MotionBox>

                {/* Facilitator */}
                <MotionBox
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  p={8}
                  borderRadius="2xl"
                  bg="gray.900"
                  border="1px solid"
                  borderColor="whiteAlpha.100"
                >
                  <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={6}>
                    Your Facilitator
                  </Heading>
                  <HStack gap={4} align="flex-start">
                    <Box
                      w={14}
                      h={14}
                      borderRadius="full"
                      bg="brand.500"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      flexShrink={0}
                    >
                      <Text color="white" fontSize="xl" fontWeight="bold">
                        {session.facilitator.name.split(' ').map(n => n[0]).join('')}
                      </Text>
                    </Box>
                    <Box>
                      <Text color="white" fontSize="lg" fontWeight="medium">
                        {session.facilitator.name}
                      </Text>
                      <Text color="whiteAlpha.600" mt={1}>
                        {session.facilitator.bio}
                      </Text>
                    </Box>
                  </HStack>
                </MotionBox>
              </VStack>

              {/* Sidebar */}
              <Box>
                <MotionBox
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  p={6}
                  borderRadius="2xl"
                  bg="gray.900"
                  border="1px solid"
                  borderColor="whiteAlpha.100"
                  position={{ lg: 'sticky' }}
                  top={24}
                >
                  {/* Date & Time */}
                  <Box mb={6}>
                    <Text
                      color="brand.500"
                      fontSize="xs"
                      textTransform="uppercase"
                      letterSpacing="wider"
                      mb={2}
                    >
                      Date & Time
                    </Text>
                    <Text color="white" fontSize="lg">
                      {sessionData?.sessionDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </Text>
                    <Text color="whiteAlpha.600">
                      {sessionData?.sessionDate.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}{' '}
                      {sessionData?.sessionEndDate && (
                        <>
                          -{' '}
                          {sessionData.sessionEndDate.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </>
                      )}
                    </Text>
                  </Box>

                  {/* Location */}
                  <Box mb={6}>
                    <Text
                      color="brand.500"
                      fontSize="xs"
                      textTransform="uppercase"
                      letterSpacing="wider"
                      mb={2}
                    >
                      Location
                    </Text>
                    <Text color="white" fontSize="lg">
                      {session.isOnline ? 'Online Event' : session.location.name}
                    </Text>
                    {!session.isOnline && session.location.address && (
                      <Text color="whiteAlpha.600">{session.location.address}</Text>
                    )}
                    {session.isOnline && session.onlineUrl && sessionData?.isRegistered && (
                      <a href={session.onlineUrl} target="_blank" rel="noopener noreferrer">
                        <Button
                          size="sm"
                          mt={2}
                          bg="transparent"
                          color="brand.500"
                          border="1px solid"
                          borderColor="brand.500"
                          borderRadius="lg"
                          _hover={{ bg: 'brand.500', color: 'white' }}
                        >
                          Join Online
                        </Button>
                      </a>
                    )}
                  </Box>

                  {/* Capacity */}
                  <Box mb={6}>
                    <Text
                      color="brand.500"
                      fontSize="xs"
                      textTransform="uppercase"
                      letterSpacing="wider"
                      mb={2}
                    >
                      Availability
                    </Text>
                    <Flex justify="space-between" align="center" mb={2}>
                      <Text color="white">
                        {sessionData?.attendeeCount} / {session.capacity} registered
                      </Text>
                      <Text color={(sessionData?.spotsLeft || 0) > 5 ? 'green.400' : 'orange.400'} fontWeight="medium">
                        {(sessionData?.spotsLeft || 0) > 0 ? `${sessionData?.spotsLeft} left` : 'Full'}
                      </Text>
                    </Flex>
                    <Box h={2} bg="gray.800" borderRadius="full" overflow="hidden">
                      <MotionBox
                        initial={{ width: 0 }}
                        animate={{ width: `${sessionData?.progressPercent || 0}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        h="full"
                        bg="brand.500"
                        borderRadius="full"
                      />
                    </Box>
                    {(sessionData?.waitlistCount || 0) > 0 && (
                      <Text color="whiteAlpha.500" fontSize="sm" mt={2}>
                        {sessionData?.waitlistCount} on waitlist
                      </Text>
                    )}
                  </Box>

                  {/* Registration CTA */}
                  {!sessionData?.isPast && session.status === 'published' && (
                    <>
                      {!isAuthenticated ? (
                        <Button
                          w="full"
                          bg="brand.500"
                          color="white"
                          size="lg"
                          borderRadius="xl"
                          _hover={{ bg: 'brand.600' }}
                          onClick={() => navigate('/login')}
                        >
                          Sign in to Register
                        </Button>
                      ) : sessionData?.isRegistered ? (
                        <VStack gap={2} w="full">
                          <Text color="green.400" fontWeight="medium">
                            You're registered!
                          </Text>
                          <Button
                            w="full"
                            bg="transparent"
                            color="red.400"
                            border="1px solid"
                            borderColor="red.400"
                            size="lg"
                            borderRadius="xl"
                            _hover={{ bg: 'red.500', color: 'white' }}
                            onClick={handleUnregister}
                            disabled={updating}
                          >
                            {updating ? <Spinner size="sm" /> : 'Cancel Registration'}
                          </Button>
                        </VStack>
                      ) : sessionData?.isOnWaitlist ? (
                        <VStack gap={2} w="full">
                          <Text color="orange.400" fontWeight="medium">
                            You're on the waitlist
                          </Text>
                          <Button
                            w="full"
                            bg="transparent"
                            color="red.400"
                            border="1px solid"
                            borderColor="red.400"
                            size="lg"
                            borderRadius="xl"
                            _hover={{ bg: 'red.500', color: 'white' }}
                            onClick={handleUnregister}
                            disabled={updating}
                          >
                            {updating ? <Spinner size="sm" /> : 'Leave Waitlist'}
                          </Button>
                        </VStack>
                      ) : (
                        <Button
                          w="full"
                          bg={sessionData?.isFull ? 'orange.500' : 'brand.500'}
                          color="white"
                          size="lg"
                          borderRadius="xl"
                          _hover={{ bg: sessionData?.isFull ? 'orange.600' : 'brand.600' }}
                          onClick={handleRegister}
                          disabled={updating}
                        >
                          {updating ? (
                            <Spinner size="sm" />
                          ) : sessionData?.isFull ? (
                            'Join Waitlist'
                          ) : (
                            'Register Now'
                          )}
                        </Button>
                      )}
                    </>
                  )}

                  {/* Price indicator */}
                  {!session.isFree && session.price && (
                    <Box mt={4} textAlign="center">
                      <Text color="whiteAlpha.500" fontSize="sm">
                        Price: {session.currency || '$'}{session.price}
                      </Text>
                    </Box>
                  )}
                </MotionBox>
              </Box>
            </Grid>
          </Container>
        </Box>

        {/* Gallery Section - Only show for past events with gallery items */}
        {sessionData?.isPast && session.gallery && session.gallery.length > 0 && (
          <Box py={{ base: 12, md: 20 }} bg="gray.900">
            <Container maxW="1440px" px={{ base: 6, md: 12, lg: 16, xl: 20 }}>
              <MotionBox
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <Heading as="h2" fontSize="2xl" color="white" fontFamily="heading" mb={8}>
                  Event Gallery
                </Heading>
                <SessionGallery items={session.gallery} />
              </MotionBox>
            </Container>
          </Box>
        )}

        {/* Reflections Section - Only show for past events */}
        {sessionData?.isPast && (
          <Box py={{ base: 12, md: 20 }}>
            <Container maxW="1440px" px={{ base: 6, md: 12, lg: 16, xl: 20 }}>
              <MotionBox
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <Heading as="h2" fontSize="2xl" color="white" fontFamily="heading" mb={8}>
                  Reflections
                </Heading>

                {/* Add Reflection Form - Only for registered attendees */}
                {sessionData.isRegistered && isAuthenticated && (
                  <Box
                    bg="gray.900"
                    borderRadius="2xl"
                    border="1px solid"
                    borderColor="whiteAlpha.100"
                    p={6}
                    mb={8}
                  >
                    <Text color="white" fontWeight="medium" mb={4}>
                      Share your experience
                    </Text>
                    <Textarea
                      value={newReflection}
                      onChange={(e) => setNewReflection(e.target.value)}
                      placeholder="What did you learn? How did this session inspire you?"
                      bg="gray.800"
                      border="1px solid"
                      borderColor="whiteAlpha.200"
                      borderRadius="xl"
                      color="white"
                      rows={4}
                      mb={4}
                      _placeholder={{ color: 'whiteAlpha.400' }}
                      _focus={{ borderColor: 'brand.500' }}
                    />
                    <Button
                      bg="brand.500"
                      color="white"
                      borderRadius="xl"
                      _hover={{ bg: 'brand.600' }}
                      onClick={handleSubmitReflection}
                      disabled={submittingReflection || !newReflection.trim()}
                    >
                      {submittingReflection ? <Spinner size="sm" /> : 'Share Reflection'}
                    </Button>
                  </Box>
                )}

                {/* Reflections List */}
                {session.reflections && session.reflections.length > 0 ? (
                  <VStack gap={4} align="stretch">
                    {session.reflections.map((reflection) => (
                      <Box
                        key={reflection.id}
                        bg="gray.900"
                        borderRadius="2xl"
                        border="1px solid"
                        borderColor="whiteAlpha.100"
                        p={6}
                      >
                        <HStack gap={3} mb={3}>
                          <Box
                            w={10}
                            h={10}
                            borderRadius="full"
                            bg="brand.500"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                          >
                            <Text color="white" fontSize="sm" fontWeight="bold">
                              {reflection.userName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </Text>
                          </Box>
                          <Box>
                            <Text color="white" fontWeight="medium">
                              {reflection.userName}
                            </Text>
                            <Text color="whiteAlpha.500" fontSize="sm">
                              {toDate(reflection.createdAt as Timestamp).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </Text>
                          </Box>
                        </HStack>
                        <Text color="whiteAlpha.700">
                          {reflection.content}
                        </Text>
                      </Box>
                    ))}
                  </VStack>
                ) : (
                  <Box
                    bg="gray.900"
                    borderRadius="2xl"
                    border="1px solid"
                    borderColor="whiteAlpha.100"
                    p={8}
                    textAlign="center"
                  >
                    <Text color="whiteAlpha.500">
                      No reflections yet. {sessionData.isRegistered ? 'Be the first to share!' : ''}
                    </Text>
                  </Box>
                )}
              </MotionBox>
            </Container>
          </Box>
        )}
      </Box>

      <Footer />
    </Box>
  )
}
