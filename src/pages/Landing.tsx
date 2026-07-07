'use client'

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
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
  Text,
  VStack,
} from '@chakra-ui/react'
import { Timestamp } from 'firebase/firestore'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  CalendarDays,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  UsersRound,
} from 'lucide-react'

import { Footer } from '@/components/layout/Footer'
import { useCollection } from '@/hooks/useFirestore'
import eventImg1 from '@/assets/images/events/IMG_9994.jpeg'
import eventImg2 from '@/assets/images/events/IMG_9812.jpeg'
import eventImg3 from '@/assets/images/events/IMG_9074.jpeg'
import eventImg4 from '@/assets/images/events/IMG_8408.jpeg'
import eventImg5 from '@/assets/images/events/IMG_9814.jpeg'
import eventImg6 from '@/assets/images/events/IMG_7447.jpeg'
import logoWhite from '@/assets/logos/Club BZR logo (WHITE).png'
import type { Quest, Session } from '../../lib/schema'

const MotionBox = motion.create(Box)
const MotionFlex = motion.create(Flex)

const CONTACT_EMAIL = 'clubbzrzm@gmail.com'
const CONTACT_PHONE = '0770891661'

const fallbackPastEvents = [
  {
    id: 'past-1',
    title: 'Portrait Table',
    typeLabel: 'Past event',
    dateLabel: 'Community session',
    location: 'Club BZR table',
    description: 'A relaxed gathering for drawing faces, swapping references, and sharing process.',
    image: eventImg2,
    href: '/sessions',
  },
  {
    id: 'past-2',
    title: 'Cut, Color, Repeat',
    typeLabel: 'Past event',
    dateLabel: 'Mixed media',
    location: 'Lusaka',
    description: 'A hands-on table session built around paper, color blocks, collage, and conversation.',
    image: eventImg3,
    href: '/sessions',
  },
  {
    id: 'past-3',
    title: 'Open Drawing Hang',
    typeLabel: 'Past event',
    dateLabel: 'Art social',
    location: 'Lusaka',
    description: 'Friends, first-timers, pencils, pastels, and a shared excuse to make something.',
    image: eventImg1,
    href: '/sessions',
  },
]

const fallbackQuests = [
  {
    id: 'quest-1',
    title: 'Three-color room scan',
    category: 'experimental',
    difficulty: 'any',
    estimatedTime: '30 mins',
    description: 'Pick three colors from your current space and build a tiny visual story from them.',
    points: 40,
    href: '/quests',
  },
  {
    id: 'quest-2',
    title: 'Portrait without a face',
    category: 'daily prompt',
    difficulty: 'beginner',
    estimatedTime: '45 mins',
    description: 'Show a person through objects, posture, clothing, or the space around them.',
    points: 60,
    href: '/quests',
  },
  {
    id: 'quest-3',
    title: 'Found object remix',
    category: 'exploration',
    difficulty: 'any',
    estimatedTime: '1 hour',
    description: 'Turn one ordinary object into the starting point for an artwork or photo study.',
    points: 50,
    href: '/quests',
  },
]

const testimonials = [
  {
    name: 'Jehu',
    quote: 'Best place in the city to make art with a bunch of cool people. Highly recommend!',
  },
  {
    name: 'Kupa',
    quote: 'Being part of Club BZR has enhanced my view of art and what it means to be an artist.',
  },
  {
    name: 'Jolezya',
    quote: 'Club BZR has helped me meet creatives with their own niche who are always willing to explore.',
  },
]

type EventSummary = {
  id: string
  title: string
  typeLabel: string
  dateLabel: string
  location: string
  description: string
  image: string
  href: string
  spotsLabel?: string
}

type QuestSummary = {
  id: string
  title: string
  category: string
  difficulty: string
  estimatedTime?: string
  description: string
  points: number
  href: string
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (value instanceof Timestamp) return value.toDate()
  if (value && typeof value === 'object' && 'toDate' in value) {
    const possibleTimestamp = value as { toDate?: () => Date }
    return possibleTimestamp.toDate?.() || null
  }
  return null
}

function formatDate(date: Date | null) {
  if (!date) return 'Date dropping soon'

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ')
}

function getSessionLocation(session: Session) {
  if (session.isOnline) return 'Online'
  return session.location?.name || session.location?.city || 'Lusaka'
}

function sessionToEvent(session: Session): EventSummary {
  const date = toDate(session.date)
  const attendeeCount = session.attendees?.length || 0
  const spotsLeft = typeof session.capacity === 'number' ? Math.max(session.capacity - attendeeCount, 0) : null

  return {
    id: session.id,
    title: session.title,
    typeLabel: formatLabel(session.type),
    dateLabel: formatDate(date),
    location: getSessionLocation(session),
    description: session.shortDescription || session.description,
    image: session.coverImage || eventImg3,
    href: `/sessions/${session.id}`,
    spotsLabel: spotsLeft === null ? undefined : spotsLeft > 0 ? `${spotsLeft} spots left` : 'Full',
  }
}

function questToSummary(quest: Quest): QuestSummary {
  return {
    id: quest.id,
    title: quest.title,
    category: formatLabel(quest.category),
    difficulty: quest.difficulty,
    estimatedTime: quest.estimatedTime,
    description: quest.description,
    points: quest.points,
    href: `/quests/${quest.id}`,
  }
}

function LandingNav() {
  const navItems = [
    { label: 'Next event', href: '#next-event' },
    { label: 'Past events', href: '#past-events' },
    { label: 'Side quests', href: '#side-quests' },
    { label: 'About', href: '/about', route: true },
  ]

  return (
    <Box
      as="header"
      position="fixed"
      top={0}
      left={0}
      right={0}
      zIndex={20}
      bg="rgba(10, 10, 10, 0.76)"
      borderBottom="1px solid"
      borderColor="whiteAlpha.100"
      backdropFilter="blur(18px)"
    >
      <Container maxW="1440px" px={{ base: 4, md: 8, lg: 12 }} py={{ base: 3, md: 4 }}>
        <Flex align="center" justify="space-between" gap={4}>
          <Link to="/" aria-label="Club BZR home">
            <Image src={logoWhite} alt="Club BZR" h={{ base: 10, md: 12 }} />
          </Link>

          <HStack as="nav" gap={{ base: 3, md: 6 }} display={{ base: 'none', md: 'flex' }}>
            {navItems.map((item) =>
              item.route ? (
                <Link key={item.href} to={item.href}>
                  <Text color="whiteAlpha.700" fontSize="sm" _hover={{ color: 'white' }}>
                    {item.label}
                  </Text>
                </Link>
              ) : (
                <a key={item.href} href={item.href}>
                  <Text color="whiteAlpha.700" fontSize="sm" _hover={{ color: 'white' }}>
                    {item.label}
                  </Text>
                </a>
              ),
            )}
          </HStack>

          <Button
            asChild
            minH={10}
            px={{ base: 4, md: 5 }}
            bg="brand.500"
            color="white"
            borderRadius="full"
            fontSize="sm"
            fontWeight="semibold"
            _hover={{ bg: 'brand.600' }}
          >
            <Link to="/auth/signup">
              Join
              <ArrowRight size={16} />
            </Link>
          </Button>
        </Flex>
      </Container>
    </Box>
  )
}

function EventMeta({ event }: { event: EventSummary }) {
  return (
    <HStack gap={4} flexWrap="wrap" color="whiteAlpha.700">
      <HStack gap={2}>
        <CalendarDays size={16} />
        <Text fontSize="sm">{event.dateLabel}</Text>
      </HStack>
      <HStack gap={2}>
        <MapPin size={16} />
        <Text fontSize="sm">{event.location}</Text>
      </HStack>
    </HStack>
  )
}

function HeroSection({ nextEvent }: { nextEvent: EventSummary | null }) {
  const featuredEvent =
    nextEvent ||
    ({
      id: 'next-event-fallback',
      title: 'Next Club BZR event',
      typeLabel: 'Next event',
      dateLabel: 'Date dropping soon',
      location: 'Lusaka',
      description:
        'The next gathering lands here first. Expect art materials, open tables, and a shared reason to create together.',
      image: eventImg3,
      href: '/sessions',
    } satisfies EventSummary)

  return (
    <Box as="section" pt={{ base: 28, md: 32 }} pb={{ base: 14, md: 18 }}>
      <Container maxW="1440px" px={{ base: 5, md: 8, lg: 12 }}>
        <Grid templateColumns={{ base: '1fr', lg: '0.92fr 1.08fr' }} gap={{ base: 10, lg: 14 }} alignItems="center">
          <MotionBox
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <Badge
              bg="white"
              color="gray.950"
              borderRadius="full"
              px={4}
              py={1.5}
              mb={6}
              fontSize="xs"
              letterSpacing="0.08em"
              textTransform="uppercase"
            >
              Home base for the next thing
            </Badge>

            <Heading
              as="h1"
              color="white"
              fontFamily="heading"
              fontSize={{ base: '3.6rem', md: '6rem', lg: '7rem' }}
              lineHeight={0.9}
              maxW="720px"
              mb={6}
            >
              Club BZR
            </Heading>

            <Text color="whiteAlpha.700" fontSize={{ base: 'lg', md: 'xl' }} lineHeight="tall" maxW="620px" mb={8}>
              The next event, the latest side quests, and the proof that people have already been making strange,
              beautiful things together.
            </Text>

            <HStack gap={3} flexWrap="wrap">
              <Button
                asChild
                minH={12}
                px={6}
                bg="brand.500"
                color="white"
                borderRadius="full"
                fontWeight="semibold"
                _hover={{ bg: 'brand.600', transform: 'translateY(-2px)' }}
              >
                <Link to={featuredEvent.href}>
                  View next event
                  <ArrowRight size={18} />
                </Link>
              </Button>
              <Button
                asChild
                minH={12}
                px={6}
                bg="whiteAlpha.100"
                color="white"
                border="1px solid"
                borderColor="whiteAlpha.200"
                borderRadius="full"
                _hover={{ bg: 'whiteAlpha.200' }}
              >
                <a href="#side-quests">Current side quests</a>
              </Button>
            </HStack>
          </MotionBox>

          <MotionBox
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12 }}
            position="relative"
          >
            <Box position="relative" minH={{ base: '520px', md: '620px' }}>
              <Image
                src={featuredEvent.image}
                alt={featuredEvent.title}
                position="absolute"
                inset={0}
                w="full"
                h="full"
                objectFit="cover"
                borderRadius="lg"
              />
              <Box position="absolute" inset={0} borderRadius="lg" bg="linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.78))" />
              <Image
                src={eventImg5}
                alt="Club BZR artwork closeup"
                position="absolute"
                top={{ base: 5, md: 8 }}
                right={{ base: 5, md: 8 }}
                w={{ base: '120px', md: '170px' }}
                h={{ base: '150px', md: '210px' }}
                objectFit="cover"
                borderRadius="lg"
                border="1px solid"
                borderColor="whiteAlpha.300"
                transform="rotate(4deg)"
                boxShadow="0 18px 50px rgba(0,0,0,0.35)"
              />
              <Box
                id="next-event"
                position="absolute"
                left={{ base: 5, md: 8 }}
                right={{ base: 5, md: 8 }}
                bottom={{ base: 5, md: 8 }}
                p={{ base: 5, md: 7 }}
                bg="rgba(10, 10, 10, 0.82)"
                border="1px solid"
                borderColor="whiteAlpha.200"
                borderRadius="lg"
                backdropFilter="blur(18px)"
              >
                <HStack gap={3} mb={4} flexWrap="wrap">
                  <Badge bg="brand.500" color="white" borderRadius="full" px={3} py={1} textTransform="capitalize">
                    {featuredEvent.typeLabel}
                  </Badge>
                  {featuredEvent.spotsLabel && (
                    <Badge bg="whiteAlpha.200" color="white" borderRadius="full" px={3} py={1}>
                      {featuredEvent.spotsLabel}
                    </Badge>
                  )}
                </HStack>
                <Heading as="h2" color="white" fontSize={{ base: '2xl', md: '4xl' }} fontFamily="heading" mb={3}>
                  {featuredEvent.title}
                </Heading>
                <Text color="whiteAlpha.700" fontSize={{ base: 'sm', md: 'md' }} lineHeight="tall" mb={5}>
                  {featuredEvent.description}
                </Text>
                <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={5} direction={{ base: 'column', md: 'row' }}>
                  <EventMeta event={featuredEvent} />
                  <Button asChild variant="plain" color="brand.500" px={0} _hover={{ color: 'brand.400' }}>
                    <Link to={featuredEvent.href}>
                      Details
                      <ArrowRight size={17} />
                    </Link>
                  </Button>
                </Flex>
              </Box>
            </Box>
          </MotionBox>
        </Grid>
      </Container>
    </Box>
  )
}

function PastEventsSection({ events }: { events: EventSummary[] }) {
  return (
    <Box id="past-events" as="section" py={{ base: 16, md: 24 }}>
      <Container maxW="1440px" px={{ base: 5, md: 8, lg: 12 }}>
        <SectionIntro
          eyebrow="Past events"
          title="What already happened"
          body="A quick look at previous Club BZR tables, hangs, and making sessions."
          action={{ label: 'See all events', href: '/sessions' }}
        />

        <SimpleGrid columns={{ base: 1, md: 3 }} gap={5}>
          {events.map((event, index) => (
            <MotionBox
              key={event.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              viewport={{ once: true }}
            >
              <Link to={event.href}>
                <Box
                  role="group"
                  h="full"
                  bg="gray.900"
                  border="1px solid"
                  borderColor="whiteAlpha.100"
                  borderRadius="lg"
                  overflow="hidden"
                  _hover={{ borderColor: 'brand.500' }}
                  transition="border-color 0.2s"
                >
                  <Box h={{ base: '260px', md: '320px' }} overflow="hidden">
                    <Image
                      src={event.image}
                      alt={event.title}
                      w="full"
                      h="full"
                      objectFit="cover"
                      transition="transform 0.4s ease"
                      _groupHover={{ transform: 'scale(1.04)' }}
                    />
                  </Box>
                  <Box p={5}>
                    <Text color="brand.500" fontSize="xs" textTransform="uppercase" letterSpacing="0.12em" mb={3}>
                      {event.dateLabel}
                    </Text>
                    <Heading as="h3" color="white" fontSize="xl" fontFamily="heading" mb={3}>
                      {event.title}
                    </Heading>
                    <Text color="whiteAlpha.600" fontSize="sm" lineHeight="tall">
                      {event.description}
                    </Text>
                  </Box>
                </Box>
              </Link>
            </MotionBox>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  )
}

function SideQuestsSection({ quests }: { quests: QuestSummary[] }) {
  return (
    <Box id="side-quests" as="section" py={{ base: 16, md: 24 }} bg="whiteAlpha.50">
      <Container maxW="1440px" px={{ base: 5, md: 8, lg: 12 }}>
        <SectionIntro
          eyebrow="Current side quests"
          title="Make something between events"
          body="Creative prompts for the days when you still want a reason to draw, photograph, collect, remix, or post."
          action={{ label: 'Explore quests', href: '/quests' }}
        />

        <SimpleGrid columns={{ base: 1, md: 3 }} gap={5}>
          {quests.map((quest, index) => (
            <MotionBox
              key={quest.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              viewport={{ once: true }}
            >
              <Link to={quest.href}>
                <Box
                  h="full"
                  p={6}
                  bg="gray.950"
                  border="1px solid"
                  borderColor="whiteAlpha.100"
                  borderRadius="lg"
                  role="group"
                  _hover={{ borderColor: 'green.400', transform: 'translateY(-4px)' }}
                  transition="all 0.2s"
                >
                  <HStack gap={2} mb={5} flexWrap="wrap">
                    <Badge bg="green.500" color="white" borderRadius="full" px={3} py={1} textTransform="capitalize">
                      {quest.category}
                    </Badge>
                    <Badge bg="whiteAlpha.100" color="whiteAlpha.800" borderRadius="full" px={3} py={1} textTransform="capitalize">
                      {quest.difficulty}
                    </Badge>
                  </HStack>
                  <Heading as="h3" color="white" fontSize="xl" fontFamily="heading" mb={3} _groupHover={{ color: 'green.300' }}>
                    {quest.title}
                  </Heading>
                  <Text color="whiteAlpha.600" fontSize="sm" lineHeight="tall" mb={6}>
                    {quest.description}
                  </Text>
                  <Flex justify="space-between" color="whiteAlpha.500" fontSize="xs">
                    <Text>{quest.estimatedTime || 'Open time'}</Text>
                    <Text>{quest.points} pts</Text>
                  </Flex>
                </Box>
              </Link>
            </MotionBox>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  )
}

function CollaboratorsSection() {
  const groups = [
    {
      label: 'Artists',
      title: 'Artists we build with',
      body: 'Fine artists, musicians, illustrators, photographers, writers, designers, and curious makers who bring the table alive.',
    },
    {
      label: 'Brands and spaces',
      title: 'Organizations we can work with',
      body: 'Venues, creative brands, cultural teams, schools, studios, and community groups looking for participatory art moments.',
    },
    {
      label: 'Future collabs',
      title: 'Bring us a weird brief',
      body: 'If the idea needs people in a room making, talking, testing, or documenting something, Club BZR can shape the session.',
    },
  ]

  return (
    <Box as="section" py={{ base: 16, md: 24 }}>
      <Container maxW="1440px" px={{ base: 5, md: 8, lg: 12 }}>
        <Grid templateColumns={{ base: '1fr', lg: '0.78fr 1.22fr' }} gap={{ base: 10, lg: 16 }} alignItems="start">
          <MotionBox
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55 }}
            viewport={{ once: true }}
          >
            <Text color="brand.500" fontSize="sm" textTransform="uppercase" letterSpacing="0.16em" mb={4}>
              Collaborators
            </Text>
            <Heading as="h2" color="white" fontSize={{ base: '3xl', md: '5xl' }} fontFamily="heading" mb={5}>
              Built with artists, brands, and the people who show up.
            </Heading>
            <Text color="whiteAlpha.600" lineHeight="tall" mb={8}>
              Club BZR is open to collaborations that make art feel public, social, and hands-on.
            </Text>
            <Button
              asChild
              minH={12}
              px={6}
              bg="white"
              color="gray.950"
              borderRadius="full"
              fontWeight="semibold"
              _hover={{ bg: 'brand.500', color: 'white' }}
            >
              <a href={`mailto:${CONTACT_EMAIL}?subject=Club%20BZR%20collaboration`}>
                Start a collaboration
                <UsersRound size={18} />
              </a>
            </Button>
          </MotionBox>

          <VStack align="stretch" gap={4}>
            {groups.map((group, index) => (
              <MotionFlex
                key={group.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                viewport={{ once: true }}
                p={{ base: 5, md: 6 }}
                bg="gray.900"
                border="1px solid"
                borderColor="whiteAlpha.100"
                borderRadius="lg"
                gap={5}
                direction={{ base: 'column', md: 'row' }}
              >
                <Text color="brand.500" fontSize="xs" textTransform="uppercase" letterSpacing="0.12em" minW="150px">
                  {group.label}
                </Text>
                <Box>
                  <Heading as="h3" color="white" fontSize="xl" fontFamily="heading" mb={2}>
                    {group.title}
                  </Heading>
                  <Text color="whiteAlpha.600" fontSize="sm" lineHeight="tall">
                    {group.body}
                  </Text>
                </Box>
              </MotionFlex>
            ))}
          </VStack>
        </Grid>
      </Container>
    </Box>
  )
}

function TestimonialsSection() {
  return (
    <Box as="section" py={{ base: 12, md: 18 }}>
      <Container maxW="1440px" px={{ base: 5, md: 8, lg: 12 }}>
        <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
          {testimonials.map((testimonial, index) => (
            <MotionBox
              key={testimonial.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              viewport={{ once: true }}
              p={5}
              borderRadius="lg"
              bg="whiteAlpha.50"
              border="1px solid"
              borderColor="whiteAlpha.100"
            >
              <Text color="whiteAlpha.700" fontSize="sm" lineHeight="tall" mb={5}>
                "{testimonial.quote}"
              </Text>
              <Text color="brand.500" fontSize="sm" fontWeight="semibold">
                {testimonial.name}
              </Text>
            </MotionBox>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  )
}

function QuestionsSection() {
  return (
    <Box as="section" py={{ base: 16, md: 24 }}>
      <Container maxW="1180px" px={{ base: 5, md: 8 }}>
        <MotionBox
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          viewport={{ once: true }}
          position="relative"
          overflow="hidden"
          borderRadius="lg"
          bg="brand.500"
          color="white"
          p={{ base: 7, md: 10 }}
        >
          <Grid templateColumns={{ base: '1fr', lg: '1fr auto' }} gap={8} alignItems="center">
            <Box>
              <HStack gap={2} mb={4}>
                <MessageCircle size={20} />
                <Text fontSize="sm" fontWeight="semibold" textTransform="uppercase" letterSpacing="0.12em">
                  Questions
                </Text>
              </HStack>
              <Heading as="h2" fontSize={{ base: '3xl', md: '5xl' }} fontFamily="heading" mb={4}>
                Still have questions about Club BZR? Leave us a message.
              </Heading>
              <Text maxW="680px" color="whiteAlpha.900" lineHeight="tall">
                Ask about the next event, a collaboration, joining the community, or bringing Club BZR into your space.
              </Text>
            </Box>

            <VStack align={{ base: 'stretch', lg: 'flex-end' }} gap={3}>
              <Button
                asChild
                minH={12}
                px={6}
                bg="gray.950"
                color="white"
                borderRadius="full"
                _hover={{ bg: 'black' }}
              >
                <a href={`mailto:${CONTACT_EMAIL}?subject=Question%20about%20Club%20BZR`}>
                  <Mail size={18} />
                  Leave a message
                </a>
              </Button>
              <HStack color="whiteAlpha.900" fontSize="sm" gap={2}>
                <Phone size={15} />
                <Text>{CONTACT_PHONE}</Text>
              </HStack>
            </VStack>
          </Grid>
        </MotionBox>
      </Container>
    </Box>
  )
}

function SectionIntro({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow: string
  title: string
  body: string
  action: { label: string; href: string }
}) {
  return (
    <Flex justify="space-between" align={{ base: 'flex-start', md: 'flex-end' }} gap={6} mb={8} direction={{ base: 'column', md: 'row' }}>
      <Box maxW="760px">
        <Text color="brand.500" fontSize="sm" textTransform="uppercase" letterSpacing="0.16em" mb={4}>
          {eyebrow}
        </Text>
        <Heading as="h2" color="white" fontSize={{ base: '3xl', md: '5xl' }} fontFamily="heading" mb={4}>
          {title}
        </Heading>
        <Text color="whiteAlpha.600" maxW="640px" lineHeight="tall">
          {body}
        </Text>
      </Box>
      <Button asChild variant="plain" color="white" px={0} _hover={{ color: 'brand.500' }}>
        <Link to={action.href}>
          {action.label}
          <ArrowRight size={17} />
        </Link>
      </Button>
    </Flex>
  )
}

export default function Landing() {
  const { data: sessionDocs, error: sessionsError } = useCollection('sessions', {
    orderBy: 'date',
    orderDirection: 'desc',
    limit: 12,
  })
  const { data: questDocs, error: questsError } = useCollection('quests', {
    orderBy: 'createdAt',
    orderDirection: 'desc',
    limit: 6,
  })

  if (sessionsError) {
    console.error('Landing sessions fetch error:', sessionsError)
  }

  if (questsError) {
    console.error('Landing quests fetch error:', questsError)
  }

  const { nextEvent, pastEvents } = useMemo(() => {
    const now = new Date()
    const publishedSessions = sessionDocs
      .filter((session) => session.status === 'published' || !session.status)
      .map((session) => ({ session, date: toDate(session.date) }))
      .filter((item) => item.date)

    const upcoming = publishedSessions
      .filter((item) => item.date && item.date >= now)
      .sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0))

    const past = publishedSessions
      .filter((item) => item.date && item.date < now)
      .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))

    return {
      nextEvent: upcoming[0] ? sessionToEvent(upcoming[0].session) : null,
      pastEvents: past.slice(0, 3).map((item) => sessionToEvent(item.session)),
    }
  }, [sessionDocs])

  const currentQuests = useMemo(() => {
    const activeQuests = questDocs
      .filter((quest) => quest.isActive !== false)
      .sort((a, b) => Number(b.featured) - Number(a.featured))
      .slice(0, 3)
      .map(questToSummary)

    return activeQuests.length > 0 ? activeQuests : fallbackQuests
  }, [questDocs])

  return (
    <Box bg="gray.950" minH="100vh" overflowX="hidden">
      <LandingNav />

      <Box as="main">
        <HeroSection nextEvent={nextEvent} />
        <PastEventsSection events={pastEvents.length > 0 ? pastEvents : fallbackPastEvents} />
        <SideQuestsSection quests={currentQuests} />
        <CollaboratorsSection />
        <TestimonialsSection />
        <QuestionsSection />
      </Box>

      <Footer />
    </Box>
  )
}
