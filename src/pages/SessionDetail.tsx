'use client'

import { useState, useMemo, type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
import { SessionGallery, SessionPaymentModal } from '@/components/features/sessions'
import { useAuth } from '@/contexts/AuthContext'
import { useDocument, useMutation } from '@/hooks/useFirestore'
import {
  createSessionRegistration,
  getInitialRegistrationState,
  getSessionRegistrationId,
  normalizeSessionRegistrationConfig,
  updateSessionRegistration,
} from '../../lib/sessionRegistrations'
import type { SessionReflection, SessionRegistrationStatus, SessionType } from '../../lib/schema'

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

function PendingRegistrationState({
  title,
  description,
  children,
  busy,
  onCancel,
}: {
  title: string
  description: string
  children?: ReactNode
  busy: boolean
  onCancel: () => void
}) {
  return (
    <VStack gap={3} w="full" align="stretch">
      <Box
        p={4}
        bg="whiteAlpha.50"
        border="1px solid"
        borderColor="whiteAlpha.100"
        borderRadius="xl"
        textAlign="center"
      >
        <Text color="white" fontWeight="semibold">{title}</Text>
        <Text color="whiteAlpha.500" fontSize="sm" mt={1}>{description}</Text>
      </Box>
      {children}
      <Button
        w="full"
        bg="transparent"
        color="red.400"
        border="1px solid"
        borderColor="red.400"
        size="lg"
        borderRadius="xl"
        _hover={{ bg: 'red.500', color: 'white' }}
        onClick={onCancel}
        disabled={busy}
      >
        {busy ? <Spinner size="sm" /> : 'Cancel Signup'}
      </Button>
    </VStack>
  )
}

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, initialized: authInitialized } = useAuth()
  const userId = user?.uid
  const isAuthenticated = Boolean(userId)

  // Fetch session from Firebase
  const { data: session, loading, error, refetch } = useDocument('sessions', id)
  const {
    data: currentRegistration,
    loading: registrationLoading,
    refetch: refetchRegistration,
  } = useDocument(
    'sessionRegistrations',
    id && userId ? getSessionRegistrationId(id, userId) : null,
    { skip: !id || !userId }
  )
  const { update: updateSession, loading: updating } = useMutation('sessions')

  // Local state for reflections
  const [newReflection, setNewReflection] = useState('')
  const [submittingReflection, setSubmittingReflection] = useState(false)
  const [submittingRegistration, setSubmittingRegistration] = useState(false)
  const [registrationError, setRegistrationError] = useState<string | null>(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)

  // Computed values
  const sessionData = useMemo(() => {
    if (!session) return null

    const sessionDate = toDate(session.date as Timestamp)
    const sessionEndDate = session.endDate ? toDate(session.endDate as Timestamp) : null
    const attendeeCount = session.attendees?.length || 0
    const waitlistCount = session.waitlist?.length || 0
    const spotsLeft = Math.max(session.capacity - attendeeCount, 0)
    const progressPercent = session.capacity > 0 ? (attendeeCount / session.capacity) * 100 : 0
    const isPast = sessionDate < new Date()
    const legacyStatus: SessionRegistrationStatus | null =
      userId && session.attendees?.includes(userId)
        ? 'confirmed'
        : userId && session.waitlist?.includes(userId)
          ? 'waitlisted'
          : null
    const effectiveStatus = currentRegistration?.status || legacyStatus
    const isRegistered = effectiveStatus === 'confirmed'
    const isOnWaitlist = effectiveStatus === 'waitlisted'
    const isFull = spotsLeft <= 0
    const config = normalizeSessionRegistrationConfig(session)

    return {
      sessionDate,
      sessionEndDate,
      currentRegistration,
      effectiveStatus,
      config,
      attendeeCount,
      waitlistCount,
      spotsLeft,
      progressPercent,
      isPast,
      isRegistered,
      isOnWaitlist,
      isFull,
    }
  }, [session, currentRegistration, userId])

  // Handle registration
  const handleRegister = async () => {
    if (!userId) {
      navigate('/auth/login')
      return
    }
    if (!session || !id) return

    setRegistrationError(null)
    setSubmittingRegistration(true)

    if (sessionData?.config.accessMode === 'invite_only' && !sessionData.currentRegistration) {
      setRegistrationError('This session is invite-only. Contact Club BZR if you need access.')
      setSubmittingRegistration(false)
      return
    }

    const initialState = getInitialRegistrationState(session, sessionData?.attendeeCount || 0)
    const result = sessionData?.currentRegistration
      ? await updateSessionRegistration(sessionData.currentRegistration.id, {
        status: initialState.status,
        paymentStatus: initialState.paymentStatus,
        requestedAt: Timestamp.now(),
      })
      : await createSessionRegistration(session, user, sessionData?.attendeeCount || 0)

    if (!result.success) {
      setRegistrationError(result.error?.message || 'Unable to register for this session.')
      setSubmittingRegistration(false)
      return
    }

    if (initialState.status === 'confirmed') {
      await updateSession(id, {
        attendees: arrayUnion(userId) as unknown as string[],
      })
      await refetch()
    }

    if (initialState.status === 'waitlisted') {
      await updateSession(id, {
        waitlist: arrayUnion(userId) as unknown as string[],
      })
      await refetch()
    }

    await refetchRegistration()
    setSubmittingRegistration(false)
  }

  // Handle unregistration
  const handleUnregister = async () => {
    if (!userId) {
      navigate('/auth/login')
      return
    }
    if (!session || !id) return

    setRegistrationError(null)
    setSubmittingRegistration(true)

    if (sessionData?.currentRegistration) {
      const previousStatus = sessionData.currentRegistration.status
      const result = await updateSessionRegistration(sessionData.currentRegistration.id, {
        status: 'cancelled',
        cancelledAt: Timestamp.now(),
        cancelledBy: userId,
      })
      if (!result.success) {
        setRegistrationError(result.error?.message || 'Unable to cancel your registration.')
        setSubmittingRegistration(false)
        return
      }

      if (previousStatus === 'confirmed') {
        await updateSession(id, {
          attendees: arrayRemove(userId) as unknown as string[],
        })
      }

      if (previousStatus === 'waitlisted') {
        await updateSession(id, {
          waitlist: arrayRemove(userId) as unknown as string[],
        })
      }

      await refetch()
      await refetchRegistration()
      setSubmittingRegistration(false)
      return
    }

    if (sessionData?.isOnWaitlist) {
      const result = await updateSession(id, {
        waitlist: arrayRemove(userId) as unknown as string[],
      })
      if (!result.success) {
        setRegistrationError(result.error?.message || 'Unable to leave the waitlist.')
        setSubmittingRegistration(false)
        return
      }
    } else {
      const result = await updateSession(id, {
        attendees: arrayRemove(userId) as unknown as string[],
      })
      if (!result.success) {
        setRegistrationError(result.error?.message || 'Unable to cancel your registration.')
        setSubmittingRegistration(false)
        return
      }
    }
    await refetch()
    setSubmittingRegistration(false)
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
  const sessionAbout = session.about?.trim()
  const registrationStatus = sessionData?.effectiveStatus
  const registrationBusy = updating || submittingRegistration || registrationLoading
  const isInviteOnly = sessionData?.config.accessMode === 'invite_only'
  const isPaidSession = sessionData?.config.paymentMode === 'paid'
  const isLencoPayment = isPaidSession && sessionData?.config.paymentProvider === 'lenco'
  const currency = session.currency || 'ZMW'
  const paymentAmount = Number(session.price || 0)
  const hasPendingOnlinePayment =
    isLencoPayment &&
    sessionData?.currentRegistration?.paymentStatus === 'pending' &&
    Boolean(
      sessionData.currentRegistration.paymentTransactionId ||
      sessionData.currentRegistration.paymentReference
    )

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
                {sessionAbout && (
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
                      <Text whiteSpace="pre-line">
                        {sessionAbout}
                      </Text>
                    </VStack>
                  </MotionBox>
                )}

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
                      {!authInitialized ? (
                        <Button
                          w="full"
                          bg="whiteAlpha.100"
                          color="white"
                          size="lg"
                          borderRadius="xl"
                          disabled
                        >
                          <Spinner size="sm" />
                        </Button>
                      ) : !isAuthenticated ? (
                        <Button
                          w="full"
                          bg="brand.500"
                          color="white"
                          size="lg"
                          borderRadius="xl"
                          _hover={{ bg: 'brand.600' }}
                          onClick={() => navigate('/auth/login')}
                        >
                          Sign in to Register
                        </Button>
                      ) : isInviteOnly && !sessionData?.currentRegistration ? (
                        <Box
                          p={4}
                          bg="whiteAlpha.50"
                          border="1px solid"
                          borderColor="whiteAlpha.100"
                          borderRadius="xl"
                          textAlign="center"
                        >
                          <Text color="white" fontWeight="semibold">Invite-only session</Text>
                          <Text color="whiteAlpha.500" fontSize="sm" mt={1}>
                            Club BZR will add invited guests directly.
                          </Text>
                        </Box>
                      ) : sessionData?.isRegistered ? (
                        <VStack gap={2} w="full">
                          <Text color="green.400" fontWeight="medium">
                            You're confirmed!
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
                            disabled={registrationBusy}
                          >
                            {registrationBusy ? <Spinner size="sm" /> : 'Cancel Registration'}
                          </Button>
                        </VStack>
                      ) : registrationStatus === 'requested' ? (
                        <PendingRegistrationState
                          title="Request received"
                          description="An admin will review and confirm your spot."
                          onCancel={handleUnregister}
                          busy={registrationBusy}
                        />
                      ) : registrationStatus === 'pending_payment' ? (
                        <PendingRegistrationState
                          title="Payment pending"
                          description={
                            hasPendingOnlinePayment
                              ? 'Your mobile money payment is still being checked. You can reopen the payment window to continue checking the same payment.'
                              : isLencoPayment
                              ? 'Your signup is saved. Pay with mobile money, then an admin will confirm your spot.'
                              : 'Your signup is saved. Complete payment with Club BZR, then an admin will confirm your spot.'
                          }
                          onCancel={handleUnregister}
                          busy={registrationBusy}
                        >
                          {isLencoPayment && sessionData.currentRegistration && paymentAmount > 0 && (
                            <Button
                              w="full"
                              bg="brand.500"
                              color="white"
                              size="lg"
                              borderRadius="xl"
                              _hover={{ bg: 'brand.600' }}
                              onClick={() => setPaymentModalOpen(true)}
                              disabled={registrationBusy}
                            >
                              {hasPendingOnlinePayment ? 'Check Mobile Money Status' : 'Pay with Mobile Money'}
                            </Button>
                          )}
                        </PendingRegistrationState>
                      ) : registrationStatus === 'paid_pending_confirmation' ? (
                        <PendingRegistrationState
                          title="Payment noted"
                          description="An admin still needs to confirm your final spot."
                          onCancel={handleUnregister}
                          busy={registrationBusy}
                        />
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
                            disabled={registrationBusy}
                          >
                            {registrationBusy ? <Spinner size="sm" /> : 'Leave Waitlist'}
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
                          disabled={registrationBusy}
                        >
                          {registrationBusy ? (
                            <Spinner size="sm" />
                          ) : sessionData?.isFull ? (
                            'Join Waitlist'
                          ) : isPaidSession ? (
                            'Request Spot'
                          ) : (
                            'Register Now'
                          )}
                        </Button>
                      )}
                      {registrationError && (
                        <Text color="red.300" fontSize="sm" textAlign="center" mt={3}>
                          {registrationError}
                        </Text>
                      )}
                    </>
                  )}

                  {/* Price indicator */}
                  {isPaidSession && session.price && (
                    <Box mt={4} p={4} bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.100" borderRadius="xl">
                      <Text color="white" fontSize="sm" fontWeight="semibold">
                        {currency} {session.price.toFixed(2)}
                      </Text>
                      <Text color="whiteAlpha.500" fontSize="sm" mt={1}>
                        Payment is confirmed by Club BZR before your spot is reserved.
                      </Text>
                      {session.paymentInstructions && (
                        <Text color="whiteAlpha.650" fontSize="sm" mt={3} whiteSpace="pre-line">
                          {session.paymentInstructions}
                        </Text>
                      )}
                    </Box>
                  )}
                </MotionBox>
              </Box>
            </Grid>
          </Container>
        </Box>

        {/* Gallery Section */}
        {session.gallery && session.gallery.length > 0 && (
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

      {isPaidSession && sessionData?.currentRegistration && id && paymentAmount > 0 && (
        <SessionPaymentModal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          onSuccess={async () => {
            await refetchRegistration()
            await refetch()
          }}
          sessionId={id}
          registrationId={sessionData.currentRegistration.id}
          sessionTitle={session.title}
          amount={paymentAmount}
          currency={currency}
          existingTransactionId={
            hasPendingOnlinePayment ? sessionData.currentRegistration.paymentTransactionId : undefined
          }
          existingReference={
            hasPendingOnlinePayment ? sessionData.currentRegistration.paymentReference : undefined
          }
        />
      )}

      <Footer />
    </Box>
  )
}
