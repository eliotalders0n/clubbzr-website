'use client'

import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Box,
  Container,
  Flex,
  Grid,
  Heading,
  Text,
  Button,
  Image,
  HStack,
  SimpleGrid,
  AspectRatio,
  Badge,
  Spinner,
} from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { Timestamp } from 'firebase/firestore'

import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { useCollection } from '@/hooks/useFirestore'
import type { Session, SessionType, SessionStatus } from '../../lib/schema'

// Fallback image for sessions without cover
import eventImgFallback from '@/assets/images/events/IMG_9074.jpeg'

const MotionBox = motion.create(Box)

// Helper to convert Timestamp to Date
const toDate = (timestamp: Timestamp | Date): Date => {
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

function SessionCard({ session }: { session: Session }) {
  const attendeeCount = session.attendees?.length || 0
  const spotsLeft = session.capacity - attendeeCount
  const sessionDate = toDate(session.date as Timestamp)

  const isPast = sessionDate < new Date()
  const typeStyle = typeColors[session.type] || { bg: 'gray.500', text: 'white' }

  return (
    <Link to={`/sessions/${session.id}`}>
      <MotionBox
        whileHover={{ y: -8 }}
        transition={{ duration: 0.3 }}
        borderRadius="2xl"
        overflow="hidden"
        bg="gray.900"
        border="1px solid"
        borderColor="whiteAlpha.100"
        role="group"
        cursor="pointer"
      >
        <AspectRatio ratio={16 / 9}>
          <Image
            src={session.coverImage || eventImgFallback}
            alt={session.title}
            objectFit="cover"
            transition="transform 0.5s"
            _groupHover={{ transform: 'scale(1.05)' }}
          />
        </AspectRatio>

        <Box p={6}>
          <HStack gap={3} mb={3}>
            <Badge
              bg={typeStyle.bg}
              color={typeStyle.text}
              px={2}
              py={0.5}
              borderRadius="full"
              fontSize="xs"
              textTransform="uppercase"
            >
              {session.type.replace(/_/g, ' ')}
            </Badge>
            <Text color="whiteAlpha.500" fontSize="xs">
              {sessionDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          </HStack>

          <Heading
            as="h3"
            fontSize="xl"
            color="white"
            fontFamily="heading"
            mb={2}
            _groupHover={{ color: 'brand.500' }}
            transition="color 0.2s"
          >
            {session.title}
          </Heading>

          <Text color="whiteAlpha.500" fontSize="sm" mb={4} lineClamp={2}>
            {session.shortDescription || session.description}
          </Text>

          <Flex justify="space-between" align="center">
            <Text color="whiteAlpha.400" fontSize="sm">
              {session.isOnline ? 'Online' : session.location.name}
            </Text>
            {!isPast && session.status === 'published' && (
              <Text color={spotsLeft > 0 ? 'green.400' : 'orange.400'} fontSize="sm" fontWeight="medium">
                {spotsLeft > 0 ? `${spotsLeft} spots left` : 'Full'}
              </Text>
            )}
          </Flex>
        </Box>
      </MotionBox>
    </Link>
  )
}

export default function Sessions() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')

  // Fetch sessions from Firebase - get all and filter client-side to avoid index requirements
  const { data: allSessions, loading, error } = useCollection('sessions', {
    orderBy: 'date',
    orderDirection: 'desc',
  })

  // Filter to only published sessions client-side
  const sessions = useMemo(() =>
    allSessions.filter(s => s.status === 'published' || !s.status),
    [allSessions]
  )

  // Separate sessions by date
  const { upcomingSessions, pastSessions } = useMemo(() => {
    const now = new Date()
    const upcoming: Session[] = []
    const past: Session[] = []

    sessions.forEach((session) => {
      const sessionDate = toDate(session.date as Timestamp)
      if (sessionDate >= now) {
        upcoming.push(session)
      } else {
        past.push(session)
      }
    })

    // Sort upcoming by date ascending (nearest first)
    upcoming.sort((a, b) => toDate(a.date as Timestamp).getTime() - toDate(b.date as Timestamp).getTime())
    // Sort past by date descending (most recent first)
    past.sort((a, b) => toDate(b.date as Timestamp).getTime() - toDate(a.date as Timestamp).getTime())

    return { upcomingSessions: upcoming, pastSessions: past }
  }, [sessions])

  const featuredSession = upcomingSessions.find((s) => s.featured) || upcomingSessions[0]

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

  // Error state - log the error for debugging
  if (error) {
    console.error('Sessions fetch error:', error)
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
            mb={16}
          >
            <Text
              color="brand.500"
              fontSize="sm"
              textTransform="uppercase"
              letterSpacing="0.3em"
              mb={4}
            >
              Sessions & Events
            </Text>

            <Heading
              as="h1"
              fontSize={{ base: '3rem', md: '4rem', lg: '5rem' }}
              lineHeight={1.1}
              color="white"
              fontFamily="heading"
              mb={6}
            >
              Come Create With Us
            </Heading>

            <Text color="whiteAlpha.500" fontSize={{ base: 'md', md: 'lg' }} maxW="2xl">
              Join workshops, talks, gatherings, and creative adventures. Every session is an
              opportunity to explore, connect, and grow.
            </Text>
          </MotionBox>

          {/* Empty State */}
          {sessions.length === 0 && !loading && (
            <MotionBox
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              textAlign="center"
              py={20}
            >
              <Box
                w={20}
                h={20}
                mx="auto"
                mb={6}
                borderRadius="full"
                bg="whiteAlpha.50"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="rgba(255,255,255,0.3)" />
                  <line x1="16" y1="2" x2="16" y2="6" stroke="rgba(255,255,255,0.3)" />
                  <line x1="8" y1="2" x2="8" y2="6" stroke="rgba(255,255,255,0.3)" />
                  <line x1="3" y1="10" x2="21" y2="10" stroke="rgba(255,255,255,0.3)" />
                </svg>
              </Box>
              <Heading as="h2" fontSize="xl" color="white" mb={2}>
                No sessions yet
              </Heading>
              <Text color="whiteAlpha.500" mb={6}>
                Check back soon for upcoming workshops, talks, and creative gatherings.
              </Text>
            </MotionBox>
          )}

          {/* Featured Session */}
          {featuredSession && (() => {
            const featuredDate = toDate(featuredSession.date as Timestamp)
            const featuredAttendeeCount = featuredSession.attendees?.length || 0
            const featuredSpotsLeft = featuredSession.capacity - featuredAttendeeCount
            const featuredTypeStyle = typeColors[featuredSession.type] || { bg: 'gray.500', text: 'white' }

            return (
              <MotionBox
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                mb={16}
              >
                <Text
                  color="whiteAlpha.400"
                  fontSize="xs"
                  textTransform="uppercase"
                  letterSpacing="wider"
                  mb={4}
                >
                  Featured Event
                </Text>

                <Link to={`/sessions/${featuredSession.id}`}>
                  <Box
                    borderRadius="2xl"
                    overflow="hidden"
                    bg="gray.900"
                    border="1px solid"
                    borderColor="whiteAlpha.100"
                    role="group"
                    cursor="pointer"
                    _hover={{ borderColor: 'brand.500' }}
                    transition="border-color 0.2s"
                  >
                    <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }}>
                      <AspectRatio ratio={16 / 9} minH={{ md: '300px' }}>
                        <Image
                          src={featuredSession.coverImage || eventImgFallback}
                          alt={featuredSession.title}
                          objectFit="cover"
                        />
                      </AspectRatio>

                      <Flex direction="column" justify="center" p={8}>
                        <HStack gap={3} mb={4}>
                          <Badge
                            bg={featuredTypeStyle.bg}
                            color={featuredTypeStyle.text}
                            px={2}
                            py={0.5}
                            borderRadius="full"
                            fontSize="xs"
                            textTransform="uppercase"
                          >
                            {featuredSession.type.replace(/_/g, ' ')}
                          </Badge>
                          <Text color="whiteAlpha.500" fontSize="xs">
                            {featuredDate.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </Text>
                        </HStack>

                        <Heading
                          as="h2"
                          fontSize={{ base: '2xl', md: '3xl' }}
                          color="white"
                          fontFamily="heading"
                          mb={3}
                          _groupHover={{ color: 'brand.500' }}
                          transition="color 0.2s"
                        >
                          {featuredSession.title}
                        </Heading>

                        <Text color="whiteAlpha.500" mb={4}>
                          {featuredSession.shortDescription || featuredSession.description}
                        </Text>

                        <Flex justify="space-between" align="center">
                          <Text color="whiteAlpha.400" fontSize="sm">
                            {featuredSession.isOnline ? 'Online' : featuredSession.location.name}
                          </Text>
                          <Text color={featuredSpotsLeft > 0 ? 'green.400' : 'orange.400'} fontSize="sm" fontWeight="medium">
                            {featuredSpotsLeft > 0 ? `${featuredSpotsLeft} spots left` : 'Full'}
                          </Text>
                        </Flex>
                      </Flex>
                    </Grid>
                  </Box>
                </Link>
              </MotionBox>
            )
          })()}

          {/* Tabs */}
          <MotionBox
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            mb={8}
          >
            <HStack gap={4}>
              <Button
                onClick={() => setActiveTab('upcoming')}
                bg={activeTab === 'upcoming' ? 'brand.500' : 'transparent'}
                color={activeTab === 'upcoming' ? 'white' : 'whiteAlpha.600'}
                border="1px solid"
                borderColor={activeTab === 'upcoming' ? 'brand.500' : 'whiteAlpha.200'}
                borderRadius="full"
                px={6}
                _hover={{
                  bg: activeTab === 'upcoming' ? 'brand.600' : 'whiteAlpha.50',
                }}
              >
                Upcoming ({upcomingSessions.length})
              </Button>
              <Button
                onClick={() => setActiveTab('past')}
                bg={activeTab === 'past' ? 'brand.500' : 'transparent'}
                color={activeTab === 'past' ? 'white' : 'whiteAlpha.600'}
                border="1px solid"
                borderColor={activeTab === 'past' ? 'brand.500' : 'whiteAlpha.200'}
                borderRadius="full"
                px={6}
                _hover={{
                  bg: activeTab === 'past' ? 'brand.600' : 'whiteAlpha.50',
                }}
              >
                Past ({pastSessions.length})
              </Button>
            </HStack>
          </MotionBox>

          {/* Sessions Grid */}
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6} mb={20}>
            {(activeTab === 'upcoming' ? upcomingSessions : pastSessions).map((session, i) => (
              <MotionBox
                key={session.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
              >
                <SessionCard session={session} />
              </MotionBox>
            ))}
          </SimpleGrid>

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
              Want to Lead a Session?
            </Heading>

            <Text color="whiteAlpha.500" mb={8} maxW="lg" mx="auto">
              We're always looking for passionate artists and facilitators to share their skills
              with our community.
            </Text>

            <Button
              asChild
              bg="transparent"
              color="white"
              border="1px solid"
              borderColor="whiteAlpha.300"
              borderRadius="full"
              px={8}
              _hover={{ bg: 'white', color: 'gray.950' }}
            >
              <a href="mailto:hello@clubbzr.com?subject=Session%20Proposal">
                Get in Touch
              </a>
            </Button>
          </MotionBox>
        </Container>
      </Box>

      <Footer />
    </Box>
  )
}
