'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
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
  Input,
  SimpleGrid,
  Spinner,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react'
import { ArrowLeft, Check, Save, UserRound } from 'lucide-react'

import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { useAuth } from '@/contexts/AuthContext'
import { useDocument } from '@/hooks/useFirestore'
import { createDocumentWithId, updateDocument } from '../../lib/firestore'
import type { Artist, ArtMedium, CreateDocument, UpdateDocument } from '../../lib/schema'

type Feedback = { type: 'error' | 'success'; message: string } | null

interface ArtistForm {
  name: string
  artistName: string
  bio: string
  statement: string
  mediums: ArtMedium[]
  styles: string
  interests: string
  collaborationGoals: string
  website: string
  portfolioUrl: string
  instagram: string
  youtube: string
  tiktok: string
  featuredWorkTitle: string
  featuredWorkUrl: string
  forCommissions: boolean
  forCollaborations: boolean
  forEvents: boolean
  availabilityNotes: string
}

const mediumOptions: { value: ArtMedium; label: string }[] = [
  { value: 'painting', label: 'Painting' },
  { value: 'illustration', label: 'Illustration' },
  { value: 'photography', label: 'Photography' },
  { value: 'digital', label: 'Digital' },
  { value: 'mixed_media', label: 'Mixed media' },
  { value: 'collage', label: 'Collage' },
  { value: 'sculpture', label: 'Sculpture' },
  { value: 'installation', label: 'Installation' },
  { value: 'performance', label: 'Performance' },
  { value: 'video', label: 'Video' },
  { value: 'animation', label: 'Animation' },
  { value: 'textile', label: 'Textile' },
  { value: 'ceramics', label: 'Ceramics' },
  { value: 'printmaking', label: 'Printmaking' },
  { value: 'street_art', label: 'Street art' },
  { value: 'conceptual', label: 'Conceptual' },
  { value: 'other', label: 'Other' },
]

const defaultForm: ArtistForm = {
  name: '',
  artistName: '',
  bio: '',
  statement: '',
  mediums: [],
  styles: '',
  interests: '',
  collaborationGoals: '',
  website: '',
  portfolioUrl: '',
  instagram: '',
  youtube: '',
  tiktok: '',
  featuredWorkTitle: '',
  featuredWorkUrl: '',
  forCommissions: false,
  forCollaborations: true,
  forEvents: false,
  availabilityNotes: '',
}

const fieldStyles = {
  bg: 'gray.900',
  border: '1px solid',
  borderColor: 'whiteAlpha.200',
  color: 'white',
  borderRadius: 'lg',
  _placeholder: { color: 'whiteAlpha.400' },
  _focus: { borderColor: 'brand.500', boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)' },
}

const splitList = (value: string) =>
  value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)

const normalizeUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

const normalizeHandleUrl = (value: string, baseUrl: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const separator = baseUrl.endsWith('@') ? '' : '/'
  return `${baseUrl}${separator}${trimmed.replace(/^@/, '')}`
}

const getFormFromArtist = (
  artist: Artist | null,
  fallbackName: string
): ArtistForm => {
  if (!artist) {
    return { ...defaultForm, name: fallbackName }
  }

  const featuredWork = artist.portfolio[0]

  return {
    name: artist.name || fallbackName,
    artistName: artist.artistName || '',
    bio: artist.bio || '',
    statement: artist.statement || '',
    mediums: artist.mediums || [],
    styles: (artist.styles || []).join(', '),
    interests: (artist.interests || []).join(', '),
    collaborationGoals: (artist.collaborationGoals || []).join(', '),
    website: artist.socialLinks?.website || '',
    portfolioUrl: artist.portfolioUrl || '',
    instagram: artist.socialLinks?.instagram || '',
    youtube: artist.socialLinks?.youtube || '',
    tiktok: artist.socialLinks?.tiktok || '',
    featuredWorkTitle: featuredWork?.title || '',
    featuredWorkUrl: featuredWork?.thumbnailUrl || '',
    forCommissions: !!artist.availability?.forCommissions,
    forCollaborations: !!artist.availability?.forCollaborations,
    forEvents: !!artist.availability?.forEvents,
    availabilityNotes: artist.availability?.notes || '',
  }
}

const buildArtistPayload = (
  form: ArtistForm,
  userId: string,
  existingArtist: Artist | null
): CreateDocument<Artist> | UpdateDocument<Artist> => {
  const portfolioUrl = normalizeUrl(form.portfolioUrl)
  const featuredWorkUrl = normalizeUrl(form.featuredWorkUrl)
  const primaryMedium = form.mediums[0] || 'other'
  const portfolio = featuredWorkUrl
    ? [
        {
          id: existingArtist?.portfolio[0]?.id || 'featured-work',
          title: form.featuredWorkTitle.trim() || 'Featured work',
          medium: primaryMedium,
          mediaUrls: [featuredWorkUrl],
          thumbnailUrl: featuredWorkUrl,
          externalUrl: portfolioUrl || featuredWorkUrl,
          featured: true,
          order: 0,
        },
      ]
    : []

  const socialLinks = {
    ...(form.website.trim() ? { website: normalizeUrl(form.website) } : {}),
    ...(form.instagram.trim()
      ? { instagram: normalizeHandleUrl(form.instagram, 'https://instagram.com') }
      : {}),
    ...(form.youtube.trim() ? { youtube: normalizeHandleUrl(form.youtube, 'https://youtube.com') } : {}),
    ...(form.tiktok.trim() ? { tiktok: normalizeHandleUrl(form.tiktok, 'https://www.tiktok.com/@') } : {}),
  }

  return {
    userId,
    name: form.name.trim(),
    ...(form.artistName.trim() ? { artistName: form.artistName.trim() } : {}),
    bio: form.bio.trim(),
    ...(form.statement.trim() ? { statement: form.statement.trim() } : {}),
    mediums: form.mediums,
    styles: splitList(form.styles),
    influences: [],
    portfolio,
    ...(portfolio[0] ? { featuredWork: portfolio[0] } : {}),
    interests: splitList(form.interests),
    collaborationGoals: splitList(form.collaborationGoals),
    openToCollaboration: form.forCollaborations || form.forCommissions || form.forEvents,
    availability: {
      forCommissions: form.forCommissions,
      forCollaborations: form.forCollaborations,
      forEvents: form.forEvents,
      ...(form.availabilityNotes.trim() ? { notes: form.availabilityNotes.trim() } : {}),
    },
    socialLinks,
    ...(portfolioUrl ? { portfolioUrl } : {}),
    featured: false,
    verified: false,
    followersCount: existingArtist?.followersCount || 0,
    worksCount: portfolio.length,
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Text color="whiteAlpha.600" fontSize="sm" mb={2}>
        {label}
      </Text>
      {children}
    </Box>
  )
}

function ToggleButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      size="sm"
      borderRadius="full"
      px={4}
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

export default function ArtistCreate() {
  const navigate = useNavigate()
  const { user, firebaseUser, initialized, loading: authLoading } = useAuth()
  const artistId = firebaseUser?.uid || null
  const {
    data: existingArtist,
    loading: artistLoading,
    error: artistError,
  } = useDocument('artists', artistId, { skip: !artistId })
  const [draft, setDraft] = useState<Partial<ArtistForm>>({})
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [saving, setSaving] = useState(false)

  const fallbackName = user?.displayName || firebaseUser?.displayName || ''
  const baseForm = useMemo(
    () => getFormFromArtist(existingArtist, fallbackName),
    [existingArtist, fallbackName]
  )
  const form = useMemo(() => ({ ...baseForm, ...draft }), [baseForm, draft])

  const setField = <K extends keyof ArtistForm>(field: K, value: ArtistForm[K]) => {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  const toggleMedium = (medium: ArtMedium) => {
    setField(
      'mediums',
      form.mediums.includes(medium)
        ? form.mediums.filter((item) => item !== medium)
        : [...form.mediums, medium]
    )
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFeedback(null)

    if (!firebaseUser?.uid) {
      setFeedback({ type: 'error', message: 'Sign in before creating an artist profile.' })
      return
    }

    if (!form.name.trim()) {
      setFeedback({ type: 'error', message: 'Add your name before saving.' })
      return
    }

    if (!form.bio.trim()) {
      setFeedback({ type: 'error', message: 'Add a short bio before saving.' })
      return
    }

    if (form.mediums.length === 0) {
      setFeedback({ type: 'error', message: 'Select at least one medium.' })
      return
    }

    setSaving(true)
    const payload = buildArtistPayload(form, firebaseUser.uid, existingArtist)
    const result = existingArtist
      ? await updateDocument('artists', firebaseUser.uid, payload as UpdateDocument<Artist>)
      : await createDocumentWithId('artists', firebaseUser.uid, payload as CreateDocument<Artist>)

    setSaving(false)

    if (!result.success) {
      setFeedback({
        type: 'error',
        message: result.error?.message || 'Could not save your artist profile.',
      })
      return
    }

    setFeedback({ type: 'success', message: 'Artist profile saved.' })
    navigate(`/artists/${firebaseUser.uid}`)
  }

  if (!initialized || authLoading || (artistId && artistLoading)) {
    return (
      <Box bg="gray.950" minH="100vh">
        <Header />
        <Flex minH="70vh" align="center" justify="center">
          <Spinner size="xl" color="brand.500" />
        </Flex>
        <Footer />
      </Box>
    )
  }

  if (!firebaseUser) {
    return (
      <Box bg="gray.950" minH="100vh">
        <Header />
        <Box as="main" pt={32} pb={20}>
          <Container maxW="720px" px={{ base: 5, md: 8 }}>
            <VStack
              gap={6}
              textAlign="center"
              p={{ base: 6, md: 10 }}
              bg="gray.900"
              border="1px solid"
              borderColor="whiteAlpha.100"
              borderRadius="2xl"
            >
              <Flex w={14} h={14} borderRadius="full" bg="brand.500" align="center" justify="center">
                <UserRound size={28} color="white" />
              </Flex>
              <Box>
                <Heading as="h1" color="white" fontSize={{ base: '2xl', md: '3xl' }} mb={3}>
                  Create Your Artist Profile
                </Heading>
                <Text color="whiteAlpha.600">
                  Sign in to create a profile connected to your Club BZR account.
                </Text>
              </Box>
              <HStack gap={3} flexWrap="wrap" justify="center">
                <RouterLink to="/auth/signup">
                  <Button bg="brand.500" color="white" borderRadius="full" _hover={{ bg: 'brand.600' }}>
                    Join Club BZR
                  </Button>
                </RouterLink>
                <RouterLink to="/auth/login">
                  <Button
                    bg="whiteAlpha.50"
                    color="white"
                    border="1px solid"
                    borderColor="whiteAlpha.200"
                    borderRadius="full"
                    _hover={{ bg: 'whiteAlpha.100' }}
                  >
                    Sign In
                  </Button>
                </RouterLink>
              </HStack>
            </VStack>
          </Container>
        </Box>
        <Footer />
      </Box>
    )
  }

  const displayName = form.artistName.trim() || form.name.trim() || 'Artist'
  const fatalArtistError = artistError && artistError.code !== 'not-found'

  return (
    <Box bg="gray.950" minH="100vh">
      <Header />

      <Box as="main" pt={{ base: 28, md: 32 }} pb={20}>
        <Container maxW="1240px" px={{ base: 5, md: 8, lg: 12 }}>
          <Flex justify="space-between" align={{ base: 'start', md: 'center' }} gap={5} mb={8} flexWrap="wrap">
            <Box>
              <RouterLink to="/artists">
                <Button
                  size="sm"
                  mb={5}
                  gap={2}
                  bg="transparent"
                  color="whiteAlpha.700"
                  _hover={{ color: 'white', bg: 'whiteAlpha.50' }}
                >
                  <ArrowLeft size={16} />
                  Artists
                </Button>
              </RouterLink>
              <Heading as="h1" color="white" fontSize={{ base: '3xl', md: '4xl' }} fontFamily="heading" mb={3}>
                {existingArtist ? 'Update Artist Profile' : 'Create Artist Profile'}
              </Heading>
              <Text color="whiteAlpha.600" maxW="2xl">
                Build a public profile for discovery, collaborations, sessions, and exhibitions.
              </Text>
            </Box>
            {existingArtist && (
              <RouterLink to={`/artists/${firebaseUser.uid}`}>
                <Button
                  bg="whiteAlpha.50"
                  color="white"
                  border="1px solid"
                  borderColor="whiteAlpha.200"
                  borderRadius="full"
                  _hover={{ bg: 'whiteAlpha.100' }}
                >
                  View Profile
                </Button>
              </RouterLink>
            )}
          </Flex>

          <Grid templateColumns={{ base: '1fr', xl: 'minmax(0, 1fr) 340px' }} gap={6} alignItems="start">
            <Box
              as="form"
              onSubmit={handleSubmit}
              bg="gray.900"
              border="1px solid"
              borderColor="whiteAlpha.100"
              borderRadius="2xl"
              overflow="hidden"
            >
              <VStack align="stretch" gap={8} p={{ base: 5, md: 8 }}>
                {fatalArtistError && (
                  <Box p={4} borderRadius="xl" bg="red.500/10" border="1px solid" borderColor="red.500/30">
                    <Text color="red.200">{artistError.message}</Text>
                  </Box>
                )}

                {feedback && (
                  <Box
                    p={4}
                    borderRadius="xl"
                    bg={feedback.type === 'success' ? 'green.500/10' : 'red.500/10'}
                    border="1px solid"
                    borderColor={feedback.type === 'success' ? 'green.500/30' : 'red.500/30'}
                  >
                    <HStack gap={2}>
                      {feedback.type === 'success' && <Check size={18} color="#68D391" />}
                      <Text color={feedback.type === 'success' ? 'green.200' : 'red.200'}>
                        {feedback.message}
                      </Text>
                    </HStack>
                  </Box>
                )}

                <Box>
                  <Heading as="h2" color="white" fontSize="xl" mb={5}>
                    Identity
                  </Heading>
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap={5}>
                    <Field label="Name">
                      <Input
                        value={form.name}
                        onChange={(event) => setField('name', event.target.value)}
                        placeholder="Your full name"
                        {...fieldStyles}
                      />
                    </Field>
                    <Field label="Artist name">
                      <Input
                        value={form.artistName}
                        onChange={(event) => setField('artistName', event.target.value)}
                        placeholder="Studio name or alias"
                        {...fieldStyles}
                      />
                    </Field>
                  </SimpleGrid>
                  <Box mt={5}>
                    <Field label="Bio">
                      <Textarea
                        value={form.bio}
                        onChange={(event) => setField('bio', event.target.value)}
                        placeholder="Short public bio"
                        rows={4}
                        resize="vertical"
                        {...fieldStyles}
                      />
                    </Field>
                  </Box>
                  <Box mt={5}>
                    <Field label="Artist statement">
                      <Textarea
                        value={form.statement}
                        onChange={(event) => setField('statement', event.target.value)}
                        placeholder="Optional statement about your work"
                        rows={5}
                        resize="vertical"
                        {...fieldStyles}
                      />
                    </Field>
                  </Box>
                </Box>

                <Box>
                  <Heading as="h2" color="white" fontSize="xl" mb={5}>
                    Mediums
                  </Heading>
                  <HStack gap={2} flexWrap="wrap">
                    {mediumOptions.map((medium) => (
                      <ToggleButton
                        key={medium.value}
                        active={form.mediums.includes(medium.value)}
                        onClick={() => toggleMedium(medium.value)}
                      >
                        {medium.label}
                      </ToggleButton>
                    ))}
                  </HStack>
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap={5} mt={5}>
                    <Field label="Styles">
                      <Input
                        value={form.styles}
                        onChange={(event) => setField('styles', event.target.value)}
                        placeholder="abstract, documentary, figurative"
                        {...fieldStyles}
                      />
                    </Field>
                    <Field label="Interests">
                      <Input
                        value={form.interests}
                        onChange={(event) => setField('interests', event.target.value)}
                        placeholder="community, identity, sound"
                        {...fieldStyles}
                      />
                    </Field>
                  </SimpleGrid>
                </Box>

                <Box>
                  <Heading as="h2" color="white" fontSize="xl" mb={5}>
                    Availability
                  </Heading>
                  <HStack gap={2} flexWrap="wrap" mb={5}>
                    <ToggleButton
                      active={form.forCollaborations}
                      onClick={() => setField('forCollaborations', !form.forCollaborations)}
                    >
                      Collaborations
                    </ToggleButton>
                    <ToggleButton
                      active={form.forCommissions}
                      onClick={() => setField('forCommissions', !form.forCommissions)}
                    >
                      Commissions
                    </ToggleButton>
                    <ToggleButton active={form.forEvents} onClick={() => setField('forEvents', !form.forEvents)}>
                      Events
                    </ToggleButton>
                  </HStack>
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap={5}>
                    <Field label="Collaboration goals">
                      <Textarea
                        value={form.collaborationGoals}
                        onChange={(event) => setField('collaborationGoals', event.target.value)}
                        placeholder="murals, exhibitions, workshops"
                        rows={3}
                        resize="vertical"
                        {...fieldStyles}
                      />
                    </Field>
                    <Field label="Availability notes">
                      <Textarea
                        value={form.availabilityNotes}
                        onChange={(event) => setField('availabilityNotes', event.target.value)}
                        placeholder="Timing, constraints, or preferred projects"
                        rows={3}
                        resize="vertical"
                        {...fieldStyles}
                      />
                    </Field>
                  </SimpleGrid>
                </Box>

                <Box>
                  <Heading as="h2" color="white" fontSize="xl" mb={5}>
                    Work & Links
                  </Heading>
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap={5}>
                    <Field label="Portfolio URL">
                      <Input
                        value={form.portfolioUrl}
                        onChange={(event) => setField('portfolioUrl', event.target.value)}
                        placeholder="portfolio.example.com"
                        {...fieldStyles}
                      />
                    </Field>
                    <Field label="Website">
                      <Input
                        value={form.website}
                        onChange={(event) => setField('website', event.target.value)}
                        placeholder="your-site.com"
                        {...fieldStyles}
                      />
                    </Field>
                    <Field label="Featured work title">
                      <Input
                        value={form.featuredWorkTitle}
                        onChange={(event) => setField('featuredWorkTitle', event.target.value)}
                        placeholder="Work title"
                        {...fieldStyles}
                      />
                    </Field>
                    <Field label="Featured work image URL">
                      <Input
                        value={form.featuredWorkUrl}
                        onChange={(event) => setField('featuredWorkUrl', event.target.value)}
                        placeholder="Image URL"
                        {...fieldStyles}
                      />
                    </Field>
                    <Field label="Instagram">
                      <Input
                        value={form.instagram}
                        onChange={(event) => setField('instagram', event.target.value)}
                        placeholder="@handle"
                        {...fieldStyles}
                      />
                    </Field>
                    <Field label="YouTube">
                      <Input
                        value={form.youtube}
                        onChange={(event) => setField('youtube', event.target.value)}
                        placeholder="@channel"
                        {...fieldStyles}
                      />
                    </Field>
                    <Field label="TikTok">
                      <Input
                        value={form.tiktok}
                        onChange={(event) => setField('tiktok', event.target.value)}
                        placeholder="@handle"
                        {...fieldStyles}
                      />
                    </Field>
                  </SimpleGrid>
                </Box>
              </VStack>

              <Flex
                justify="space-between"
                align={{ base: 'stretch', sm: 'center' }}
                gap={3}
                direction={{ base: 'column', sm: 'row' }}
                p={{ base: 5, md: 6 }}
                borderTop="1px solid"
                borderColor="whiteAlpha.100"
                bg="blackAlpha.200"
              >
                <Text color="whiteAlpha.500" fontSize="sm">
                  Profiles are public after saving.
                </Text>
                <Button
                  type="submit"
                  bg="brand.500"
                  color="white"
                  borderRadius="full"
                  px={7}
                  gap={2}
                  disabled={saving}
                  _hover={{ bg: 'brand.600' }}
                >
                  {saving ? <Spinner size="sm" /> : <Save size={18} />}
                  {existingArtist ? 'Update Profile' : 'Create Profile'}
                </Button>
              </Flex>
            </Box>

            <VStack align="stretch" gap={5} position={{ xl: 'sticky' }} top={{ xl: 28 }}>
              <Box
                p={6}
                bg="gray.900"
                border="1px solid"
                borderColor="whiteAlpha.100"
                borderRadius="2xl"
              >
                <Flex
                  w={20}
                  h={20}
                  borderRadius="full"
                  bg="brand.500"
                  align="center"
                  justify="center"
                  overflow="hidden"
                  mb={5}
                >
                  {form.featuredWorkUrl.trim() ? (
                    <Image
                      src={normalizeUrl(form.featuredWorkUrl)}
                      alt={displayName}
                      w="full"
                      h="full"
                      objectFit="cover"
                    />
                  ) : (
                    <Text color="white" fontSize="2xl" fontWeight="bold">
                      {displayName
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)}
                    </Text>
                  )}
                </Flex>
                <Heading as="h2" color="white" fontSize="xl" mb={2}>
                  {displayName}
                </Heading>
                <Text color="whiteAlpha.600" fontSize="sm" lineClamp={4} mb={4}>
                  {form.bio || 'Your bio will appear here.'}
                </Text>
                <HStack gap={2} flexWrap="wrap">
                  {form.mediums.slice(0, 5).map((medium) => (
                    <Badge key={medium} bg="whiteAlpha.100" color="whiteAlpha.700" borderRadius="full" px={3}>
                      {medium.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </HStack>
              </Box>
            </VStack>
          </Grid>
        </Container>
      </Box>

      <Footer />
    </Box>
  )
}
