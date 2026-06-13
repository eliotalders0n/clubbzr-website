'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AspectRatio,
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
import { Timestamp } from 'firebase/firestore'
import { CalendarDays, Eye, Images, Monitor, UsersRound } from 'lucide-react'

import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { useAuth } from '@/contexts/AuthContext'
import { useCollection } from '@/hooks/useFirestore'
import type { Exhibition as FirebaseExhibition } from '../../lib/schema'

const MotionBox = motion.create(Box)

type PublishedExhibition = FirebaseExhibition & { isPublished?: boolean }

interface Exhibition {
  id: string
  title: string
  description: string
  curatorName: string
  curatorAvatar?: string
  artistCount: number
  startDate: Date
  endDate?: Date
  status: 'active' | 'upcoming' | 'archived'
  coverImage: string
  artworkCount: number
  viewCount: number
  featured: boolean
  tags: string[]
  isOnline: boolean
}

type StatusFilter = 'all' | Exhibition['status']
type FormatFilter = 'all' | 'online' | 'physical'

const toDate = (timestamp: unknown): Date | undefined => {
  if (!timestamp) return undefined
  if (timestamp instanceof Date) return timestamp
  if (timestamp instanceof Timestamp) return timestamp.toDate()
  if (typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate()
  }
  return undefined
}

const getExhibitionStatus = (
  startDate: Date,
  endDate?: Date
): Exhibition['status'] => {
  const now = new Date()
  if (startDate > now) return 'upcoming'
  if (endDate && endDate < now) return 'archived'
  return 'active'
}

const formatDate = (date: Date) =>
  date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

const fallbackCoverImage = 'https://images.unsplash.com/photo-1634017839464-5c339bbe3c35?w=1200&q=80'

const transformExhibition = (doc: FirebaseExhibition): Exhibition => {
  const startDate = toDate(doc.startDate as Timestamp) || new Date()
  const endDate = toDate(doc.endDate as Timestamp)
  const artworks = Array.isArray(doc.artworks) ? doc.artworks : []

  return {
    id: doc.id,
    title: doc.title || 'Untitled Exhibition',
    description: doc.description || 'A Club BZR exhibition.',
    curatorName: doc.curator?.name || 'Club BZR Curator',
    curatorAvatar: doc.curator?.photoURL,
    artistCount: new Set(artworks.map((artwork) => artwork.artistId).filter(Boolean)).size,
    startDate,
    endDate,
    status: getExhibitionStatus(startDate, endDate),
    coverImage: doc.coverImage || fallbackCoverImage,
    artworkCount: artworks.length,
    viewCount: doc.viewsCount || 0,
    featured: Boolean(doc.featured),
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    isOnline: doc.isOnline !== false,
  }
}

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Now Showing' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'archived', label: 'Archive' },
]

const formatFilters: { value: FormatFilter; label: string }[] = [
  { value: 'all', label: 'All Formats' },
  { value: 'online', label: 'Online' },
  { value: 'physical', label: 'Physical' },
]

const statusStyles: Record<Exhibition['status'], { label: string; bg: string; color: string }> = {
  active: { label: 'Now Showing', bg: 'green.500', color: 'black' },
  upcoming: { label: 'Coming Soon', bg: 'blue.500', color: 'white' },
  archived: { label: 'Archived', bg: 'whiteAlpha.200', color: 'whiteAlpha.800' },
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: string
  onClick: () => void
}) {
  return (
    <Button
      onClick={onClick}
      size="sm"
      borderRadius="full"
      px={5}
      bg={active ? 'brand.500' : 'whiteAlpha.50'}
      color={active ? 'white' : 'whiteAlpha.700'}
      border="1px solid"
      borderColor={active ? 'brand.500' : 'whiteAlpha.200'}
      _hover={{ bg: active ? 'brand.600' : 'whiteAlpha.100', color: 'white' }}
    >
      {children}
    </Button>
  )
}

function ExhibitionCard({ exhibition, index }: { exhibition: Exhibition; index: number }) {
  const status = statusStyles[exhibition.status]

  return (
    <Link to={`/exhibitions/${exhibition.id}`}>
      <MotionBox
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: Math.min(index * 0.08, 0.32) }}
        h="full"
        bg="gray.900"
        border="1px solid"
        borderColor="whiteAlpha.100"
        borderRadius="2xl"
        overflow="hidden"
        role="group"
        cursor="pointer"
        _hover={{ borderColor: 'brand.500' }}
      >
        <AspectRatio ratio={16 / 10}>
          <Box overflow="hidden">
            <Image
              src={exhibition.coverImage}
              alt={exhibition.title}
              w="full"
              h="full"
              objectFit="cover"
              transition="transform 0.5s"
              _groupHover={{ transform: 'scale(1.05)' }}
            />
            <Box
              position="absolute"
              inset={0}
              bgGradient="linear(to-t, blackAlpha.800, blackAlpha.200, transparent)"
            />
            <HStack position="absolute" top={4} left={4} gap={2} flexWrap="wrap">
              <Badge bg={status.bg} color={status.color} borderRadius="full" px={3} py={1}>
                {status.label}
              </Badge>
              <Badge bg="blackAlpha.600" color="white" borderRadius="full" px={3} py={1}>
                {exhibition.isOnline ? 'Online' : 'Physical'}
              </Badge>
            </HStack>
          </Box>
        </AspectRatio>

        <VStack align="stretch" gap={4} p={{ base: 5, md: 6 }}>
          <Box>
            <Heading
              as="h3"
              fontSize={{ base: 'xl', md: '2xl' }}
              color="white"
              fontFamily="heading"
              mb={2}
              _groupHover={{ color: 'brand.500' }}
              transition="color 0.2s"
            >
              {exhibition.title}
            </Heading>
            <Text color="whiteAlpha.600" fontSize="sm" lineClamp={2}>
              {exhibition.description}
            </Text>
          </Box>

          <HStack gap={2} flexWrap="wrap">
            {exhibition.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                bg="whiteAlpha.100"
                color="whiteAlpha.700"
                borderRadius="full"
                px={2}
                py={0.5}
                fontSize="xs"
                textTransform="capitalize"
              >
                {tag}
              </Badge>
            ))}
          </HStack>

          <Flex
            justify="space-between"
            align={{ base: 'start', sm: 'center' }}
            gap={3}
            pt={4}
            borderTop="1px solid"
            borderColor="whiteAlpha.100"
            direction={{ base: 'column', sm: 'row' }}
          >
            <HStack color="whiteAlpha.500" fontSize="sm" gap={4}>
              <HStack gap={1.5}>
                <Images size={16} />
                <Text>{exhibition.artworkCount} works</Text>
              </HStack>
              <HStack gap={1.5}>
                <Eye size={16} />
                <Text>{exhibition.viewCount.toLocaleString()}</Text>
              </HStack>
            </HStack>
            <Text color="whiteAlpha.500" fontSize="sm">
              {exhibition.curatorName}
            </Text>
          </Flex>
        </VStack>
      </MotionBox>
    </Link>
  )
}

function FeaturedExhibition({ exhibition }: { exhibition: Exhibition }) {
  const previewImages = Array.from({ length: 5 }, (_, index) => ({
    id: `${exhibition.id}-${index}`,
    src: `https://picsum.photos/seed/exhibition-${exhibition.id}-${index}/180/180`,
  }))
  const remainingWorks = Math.max(exhibition.artworkCount - previewImages.length, 0)

  return (
    <MotionBox
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      mb={{ base: 14, md: 16 }}
    >
      <Grid
        templateColumns={{ base: '1fr', lg: 'minmax(0, 1.05fr) minmax(360px, 0.95fr)' }}
        bg="gray.900"
        border="1px solid"
        borderColor="whiteAlpha.100"
        borderRadius={{ base: '2xl', md: '3xl' }}
        overflow="hidden"
        minH={{ lg: '560px' }}
      >
        <Flex direction="column" justify="center" p={{ base: 6, md: 10, lg: 12 }} gap={7}>
          <Box>
            <Text
              color="brand.500"
              fontSize="sm"
              textTransform="uppercase"
              letterSpacing="0.28em"
              mb={4}
            >
              Exhibitions
            </Text>
            <Badge
              bg="green.500"
              color="black"
              borderRadius="full"
              px={3}
              py={1}
              fontSize="xs"
              mb={5}
            >
              Now Showing
            </Badge>
            <Heading
              as="h1"
              color="white"
              fontFamily="heading"
              fontSize={{ base: '3rem', md: '4rem', lg: '4.8rem' }}
              lineHeight={1}
              mb={5}
            >
              {exhibition.title}
            </Heading>
            <Text color="whiteAlpha.700" fontSize={{ base: 'md', md: 'lg' }} maxW="2xl">
              {exhibition.description}
            </Text>
          </Box>

          <HStack gap={0} flexWrap="wrap" rowGap={3}>
            {previewImages.map((image, index) => (
              <Box
                key={image.id}
                w={{ base: 14, md: 16 }}
                h={{ base: 14, md: 16 }}
                ml={index === 0 ? 0 : -3}
                borderRadius="lg"
                overflow="hidden"
                border="2px solid"
                borderColor="gray.900"
                bg="gray.800"
              >
                <Image src={image.src} alt="" w="full" h="full" objectFit="cover" />
              </Box>
            ))}
            {remainingWorks > 0 && (
              <Text ml={4} color="whiteAlpha.600" fontSize="sm">
                +{remainingWorks} more works
              </Text>
            )}
          </HStack>

          <HStack gap={3} flexWrap="wrap">
            <Button
              asChild
              bg="brand.500"
              color="white"
              borderRadius="full"
              px={7}
              h={12}
              _hover={{ bg: 'brand.600' }}
            >
              <Link to={`/exhibitions/${exhibition.id}`}>Enter Exhibition</Link>
            </Button>
            <Button
              asChild
              bg="whiteAlpha.100"
              color="white"
              border="1px solid"
              borderColor="whiteAlpha.200"
              borderRadius="full"
              px={7}
              h={12}
              _hover={{ bg: 'whiteAlpha.200' }}
            >
              <Link to="/artists">View Artists</Link>
            </Button>
          </HStack>

          <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
            <InfoStat
              icon={<UsersRound size={18} />}
              label="Artists"
              value={`${exhibition.artistCount} participating`}
            />
            <InfoStat
              icon={<CalendarDays size={18} />}
              label="Duration"
              value={`${formatDate(exhibition.startDate)} - ${
                exhibition.endDate ? formatDate(exhibition.endDate) : 'Ongoing'
              }`}
            />
            <InfoStat
              icon={<Monitor size={18} />}
              label="Format"
              value={exhibition.isOnline ? 'Online Exhibition' : 'Physical Venue'}
            />
            <InfoStat
              icon={<Images size={18} />}
              label="Works"
              value={`${exhibition.artworkCount} pieces`}
            />
          </SimpleGrid>
        </Flex>

        <Box position="relative" minH={{ base: '320px', md: '420px', lg: 'auto' }}>
          <Image
            src={exhibition.coverImage}
            alt={exhibition.title}
            position="absolute"
            inset={0}
            w="full"
            h="full"
            objectFit="cover"
          />
          <Box
            position="absolute"
            inset={0}
            bgGradient={{
              base: 'linear(to-t, gray.950, transparent)',
              lg: 'linear(to-r, gray.900, blackAlpha.100, transparent)',
            }}
          />
        </Box>
      </Grid>
    </MotionBox>
  )
}

function InfoStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Box
      bg="blackAlpha.300"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="xl"
      p={4}
      minH="104px"
    >
      <HStack color="whiteAlpha.500" mb={3} gap={2}>
        {icon}
        <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide">
          {label}
        </Text>
      </HStack>
      <Text color="white" fontSize="sm" fontWeight="medium">
        {value}
      </Text>
    </Box>
  )
}

export default function Exhibitions() {
  const { hasRole } = useAuth()
  const [activeStatus, setActiveStatus] = useState<StatusFilter>('all')
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all')

  const { data: firebaseExhibitions, loading, error } = useCollection('exhibitions', {
    orderBy: 'startDate',
    orderDirection: 'desc',
  })

  const exhibitions = useMemo(() => {
    return (firebaseExhibitions as PublishedExhibition[])
      .filter((exhibition) => exhibition.isPublished !== false)
      .map(transformExhibition)
  }, [firebaseExhibitions])

  const hiddenDraftCount = useMemo(
    () => (firebaseExhibitions as PublishedExhibition[]).filter((exhibition) => exhibition.isPublished === false).length,
    [firebaseExhibitions]
  )
  const canSeeAdminHint = hasRole(['admin', 'curator'])

  const featuredExhibition =
    exhibitions.find((exhibition) => exhibition.featured && exhibition.status === 'active') ||
    exhibitions.find((exhibition) => exhibition.status === 'active') ||
    exhibitions[0]

  const filteredExhibitions = useMemo(() => {
    return exhibitions.filter((exhibition) => {
      const matchesStatus = activeStatus === 'all' || exhibition.status === activeStatus
      const matchesFormat =
        formatFilter === 'all' ||
        (formatFilter === 'online' ? exhibition.isOnline : !exhibition.isOnline)

      return matchesStatus && matchesFormat
    })
  }, [activeStatus, exhibitions, formatFilter])

  if (loading && firebaseExhibitions.length === 0) {
    return (
      <Box bg="gray.950" minH="100vh">
        <Header />
        <Flex justify="center" align="center" minH="70vh">
          <Spinner size="xl" color="brand.500" borderWidth="3px" />
        </Flex>
        <Footer />
      </Box>
    )
  }

  if (error) {
    console.error('Exhibitions fetch error:', error)
  }

  return (
    <Box bg="gray.950" minH="100vh">
      <Header />

      <Box as="main" pt={{ base: 28, md: 32 }} pb={{ base: 16, md: 20 }}>
        <Container maxW="1440px" px={{ base: 4, sm: 6, md: 12, lg: 16, xl: 20 }}>
          {featuredExhibition && <FeaturedExhibition exhibition={featuredExhibition} />}

          <MotionBox
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.15 }}
            mb={8}
          >
            <Flex
              justify="space-between"
              align={{ base: 'start', lg: 'end' }}
              gap={6}
              direction={{ base: 'column', lg: 'row' }}
              mb={7}
            >
              <Box>
                <Heading
                  as="h2"
                  color="white"
                  fontFamily="heading"
                  fontSize={{ base: '2xl', md: '3xl' }}
                  mb={3}
                >
                  Browse Exhibitions
                </Heading>
                <Text color="whiteAlpha.600" maxW="2xl">
                  Explore curated digital shows, artist-led collections, and community exhibition
                  rooms built for Club BZR.
                </Text>
              </Box>

              <HStack color="whiteAlpha.500" fontSize="sm" gap={5}>
                <HStack gap={2}>
                  <Images size={16} />
                  <Text>{exhibitions.length} shows</Text>
                </HStack>
                <HStack gap={2}>
                  <UsersRound size={16} />
                  <Text>
                    {exhibitions.reduce((total, exhibition) => total + exhibition.artistCount, 0)} artists
                  </Text>
                </HStack>
              </HStack>
            </Flex>

            <VStack align="stretch" gap={4}>
              <HStack gap={3} flexWrap="wrap">
                {statusFilters.map((filter) => (
                  <FilterButton
                    key={filter.value}
                    active={activeStatus === filter.value}
                    onClick={() => setActiveStatus(filter.value)}
                  >
                    {filter.label}
                  </FilterButton>
                ))}
              </HStack>

              <HStack gap={3} flexWrap="wrap">
                {formatFilters.map((filter) => (
                  <FilterButton
                    key={filter.value}
                    active={formatFilter === filter.value}
                    onClick={() => setFormatFilter(filter.value)}
                  >
                    {filter.label}
                  </FilterButton>
                ))}
              </HStack>
            </VStack>
          </MotionBox>

          {error && (
            <Box
              mb={8}
              p={4}
              bg="red.500/10"
              border="1px solid"
              borderColor="red.500/30"
              borderRadius="xl"
            >
              <Text color="red.200" fontSize="sm">
                Live exhibitions could not be loaded. Check Firestore rules or network access.
              </Text>
            </Box>
          )}

          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap={{ base: 5, md: 6 }} mb={16}>
            {filteredExhibitions.map((exhibition, index) => (
              <ExhibitionCard key={exhibition.id} exhibition={exhibition} index={index} />
            ))}
          </SimpleGrid>

          {filteredExhibitions.length === 0 && (
            <Box
              textAlign="center"
              py={16}
              px={6}
              border="1px solid"
              borderColor="whiteAlpha.100"
              bg="gray.900"
              borderRadius="2xl"
              mb={16}
            >
              <Heading as="h3" color="white" fontSize="xl" mb={2}>
                No exhibitions found
              </Heading>
              <Text color="whiteAlpha.600">
                {canSeeAdminHint && hiddenDraftCount > 0
                  ? `${hiddenDraftCount} exhibition${hiddenDraftCount === 1 ? ' is' : 's are'} still in draft. Publish from Admin > Exhibitions to show publicly.`
                  : 'Try a different status or format filter to see more exhibitions.'}
              </Text>
            </Box>
          )}

          <MotionBox
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            textAlign="center"
            py={{ base: 12, md: 16 }}
            px={6}
            bg="gray.900"
            border="1px solid"
            borderColor="whiteAlpha.100"
            borderRadius="2xl"
          >
            <Heading as="h2" color="white" fontFamily="heading" fontSize={{ base: 'xl', md: '2xl' }} mb={4}>
              Want to Curate?
            </Heading>
            <Text color="whiteAlpha.600" maxW="xl" mx="auto" mb={8}>
              Propose a digital exhibition and bring emerging artists from the Club BZR community
              into one focused show.
            </Text>
            <Button
              asChild
              bg="brand.500"
              color="white"
              borderRadius="full"
              px={8}
              h={12}
              _hover={{ bg: 'brand.600' }}
            >
              <a href="mailto:hello@clubbzr.com?subject=Curator%20Application">
                Apply as Curator
              </a>
            </Button>
          </MotionBox>
        </Container>
      </Box>

      <Footer />
    </Box>
  )
}
