'use client'

import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
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
import { ArrowLeft, Check, Images, ImagePlus, Save, Trash2, UserRound } from 'lucide-react'

import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { useAuth } from '@/contexts/AuthContext'
import { useCollection, useDocument } from '@/hooks/useFirestore'
import { createDocumentWithId, updateDocument } from '../../lib/firestore'
import { upsertPublicProfile } from '../../lib/publicProfiles'
import { STORAGE_PATHS, uploadFileSimple, validateFile, VALIDATION_PRESETS } from '../../lib/storage'
import type { Artist, ArtMedium, CreateDocument, UpdateDocument } from '../../lib/schema'

type Feedback = { type: 'error' | 'success'; message: string } | null

interface ArtistForm {
  name: string
  artistName: string
  photoURL: string
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
  photoURL: '',
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
  minH: '48px',
  px: 4,
  borderRadius: 'xl',
  _placeholder: { color: 'whiteAlpha.400' },
  _hover: { borderColor: 'whiteAlpha.300' },
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
  fallbackName: string,
  fallbackPhotoUrl: string
): ArtistForm => {
  if (!artist) {
    return { ...defaultForm, name: fallbackName, photoURL: fallbackPhotoUrl }
  }

  const featuredWork = artist.portfolio[0]

  return {
    name: artist.name || fallbackName,
    artistName: artist.artistName || '',
    photoURL: artist.photoURL || fallbackPhotoUrl,
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
  const photoURL = normalizeUrl(form.photoURL)
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
    photoURL,
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
    worksCount: existingArtist?.worksCount ?? portfolio.length,
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
      h="40px"
      px={4}
      bg={active ? 'brand.500' : 'whiteAlpha.50'}
      color={active ? 'white' : 'whiteAlpha.700'}
      border="1px solid"
      borderColor={active ? 'brand.500' : 'whiteAlpha.200'}
      flexShrink={0}
      _hover={{ bg: active ? 'brand.600' : 'whiteAlpha.100', color: 'white' }}
    >
      {children}
    </Button>
  )
}

export default function ArtistCreate() {
  const navigate = useNavigate()
  const {
    user,
    firebaseUser,
    initialized,
    loading: authLoading,
    updateProfile: updateAuthProfile,
    refreshUser,
  } = useAuth()
  const artistId = firebaseUser?.uid || null
  const {
    data: existingArtist,
    loading: artistLoading,
    error: artistError,
  } = useDocument('artists', artistId, { skip: !artistId })
  const { data: artistArtworks } = useCollection('artworks', {
    where: artistId ? [{ field: 'artistId', operator: '==', value: artistId }] : [],
    skip: !artistId,
  })
  const [draft, setDraft] = useState<Partial<ArtistForm>>({})
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null)
  const [uploadingFeaturedWork, setUploadingFeaturedWork] = useState(false)
  const [featuredWorkUploadError, setFeaturedWorkUploadError] = useState<string | null>(null)
  const [showArtworkPicker, setShowArtworkPicker] = useState(false)
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const featuredWorkInputRef = useRef<HTMLInputElement | null>(null)

  const fallbackName = user?.displayName || firebaseUser?.displayName || ''
  const fallbackPhotoUrl = user?.photoURL || firebaseUser?.photoURL || ''
  const baseForm = useMemo(
    () => getFormFromArtist(existingArtist, fallbackName, fallbackPhotoUrl),
    [existingArtist, fallbackName, fallbackPhotoUrl]
  )
  const form = useMemo(() => ({ ...baseForm, ...draft }), [baseForm, draft])
  const profilePhotoUrl = form.photoURL.trim() ? normalizeUrl(form.photoURL) : ''
  const featuredWorkImageUrl = form.featuredWorkUrl.trim() ? normalizeUrl(form.featuredWorkUrl) : ''
  const existingWorkChoices = useMemo(() => {
    const choices = [
      ...artistArtworks.map((artwork) => ({
        id: artwork.id,
        title: artwork.title,
        imageUrl: artwork.thumbnailUrl || artwork.imageUrl,
      })),
      ...(existingArtist?.portfolio || []).map((work) => ({
        id: work.id,
        title: work.title,
        imageUrl: work.thumbnailUrl || work.mediaUrls[0] || '',
      })),
    ]

    return choices.filter(
      (choice, index) =>
        !!choice.imageUrl && choices.findIndex((candidate) => candidate.imageUrl === choice.imageUrl) === index
    )
  }, [artistArtworks, existingArtist?.portfolio])

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

  const handlePhotoFile = async (file: File | undefined) => {
    if (!file || !firebaseUser?.uid) return

    setPhotoUploadError(null)

    const validation = validateFile(file, VALIDATION_PRESETS.profileImage)
    if (!validation.valid) {
      setPhotoUploadError(validation.error || 'Choose a JPG, PNG, or WebP image under 5MB.')
      return
    }

    setUploadingPhoto(true)
    const result = await uploadFileSimple(file, `${STORAGE_PATHS.AVATARS}/${firebaseUser.uid}`, {
      compress: true,
      compressionOptions: {
        maxWidth: 900,
        maxHeight: 900,
        quality: 0.82,
        format: 'jpeg',
      },
    })
    setUploadingPhoto(false)

    if (!result.success || !result.url) {
      setPhotoUploadError(result.error?.message || 'Could not upload this profile image.')
      return
    }

    setField('photoURL', result.url)
  }

  const handlePhotoInput = async (event: ChangeEvent<HTMLInputElement>) => {
    await handlePhotoFile(event.target.files?.[0])
    event.target.value = ''
  }

  const handleFeaturedWorkFile = async (file: File | undefined) => {
    if (!file || !firebaseUser?.uid) return

    setFeaturedWorkUploadError(null)
    const validation = validateFile(file, VALIDATION_PRESETS.portfolioImage)
    if (!validation.valid) {
      setFeaturedWorkUploadError(validation.error || 'Choose an image file under 15MB.')
      return
    }

    setUploadingFeaturedWork(true)
    const result = await uploadFileSimple(file, `${STORAGE_PATHS.PORTFOLIOS}/${firebaseUser.uid}`, {
      compress: true,
      compressionOptions: {
        maxWidth: 1800,
        maxHeight: 1800,
        quality: 0.86,
        format: 'jpeg',
      },
    })
    setUploadingFeaturedWork(false)

    if (!result.success || !result.url) {
      setFeaturedWorkUploadError(result.error?.message || 'Could not upload this featured work.')
      return
    }

    setField('featuredWorkUrl', result.url)
    setShowArtworkPicker(false)
  }

  const handleFeaturedWorkInput = async (event: ChangeEvent<HTMLInputElement>) => {
    await handleFeaturedWorkFile(event.target.files?.[0])
    event.target.value = ''
  }

  const selectExistingWork = (title: string, imageUrl: string) => {
    setDraft((current) => ({
      ...current,
      featuredWorkTitle: title,
      featuredWorkUrl: imageUrl,
    }))
    setFeaturedWorkUploadError(null)
    setShowArtworkPicker(false)
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

    const identityResult = await updateAuthProfile({
      displayName: form.name.trim(),
      ...(profilePhotoUrl ? { photoURL: profilePhotoUrl } : {}),
    })

    if (!identityResult.success) {
      console.error('Artist profile saved but identity sync failed:', identityResult.error)
    } else {
      await refreshUser()
    }

    const publicProfileResult = await upsertPublicProfile({
      userId: firebaseUser.uid,
      displayName: form.name.trim(),
      photoURL: profilePhotoUrl || user?.photoURL || firebaseUser.photoURL || null,
      bio: form.bio,
      website: form.website,
      interests: splitList(form.interests),
      mediums: form.mediums,
      hasArtistProfile: true,
      artistName: form.artistName || form.name,
      followersCount: existingArtist?.followersCount || 0,
      worksCount: Math.max(existingArtist?.worksCount || 0, artistArtworks.length),
    })

    if (!publicProfileResult.success) {
      console.error('Artist profile saved but public profile sync failed:', publicProfileResult.error)
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
        <Container maxW="1320px" px={{ base: 5, md: 8, lg: 12 }}>
          <Flex justify="space-between" align={{ base: 'start', md: 'center' }} gap={6} mb={10} flexWrap="wrap">
            <Box>
              <RouterLink to="/artists">
                <Button
                  h="44px"
                  px={0}
                  mb={6}
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
                  h="50px"
                  px={6}
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

          <Grid templateColumns={{ base: '1fr', xl: 'minmax(0, 1fr) 360px' }} gap={{ base: 6, xl: 8 }} alignItems="start">
            <Box
              as="form"
              onSubmit={handleSubmit}
              bg="gray.900"
              border="1px solid"
              borderColor="whiteAlpha.100"
              borderRadius="2xl"
              overflow="hidden"
            >
              <VStack align="stretch" gap={{ base: 8, md: 10 }} p={{ base: 5, md: 10 }}>
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
                  <Heading as="h2" color="white" fontSize="xl" mb={6}>
                    Identity
                  </Heading>
                  <Flex
                    align={{ base: 'stretch', md: 'center' }}
                    direction={{ base: 'column', md: 'row' }}
                    gap={{ base: 5, md: 6 }}
                    mb={6}
                  >
                    <Flex
                      w={{ base: '112px', md: '128px' }}
                      h={{ base: '112px', md: '128px' }}
                      borderRadius="full"
                      bg="brand.500"
                      align="center"
                      justify="center"
                      overflow="hidden"
                      flexShrink={0}
                      border="1px solid"
                      borderColor="whiteAlpha.200"
                    >
                      {profilePhotoUrl ? (
                        <Image src={profilePhotoUrl} alt={displayName} w="full" h="full" objectFit="cover" />
                      ) : (
                        <Text color="white" fontSize="3xl" fontWeight="bold">
                          {displayName
                            .split(' ')
                            .map((part) => part[0])
                            .join('')
                            .slice(0, 2)}
                        </Text>
                      )}
                    </Flex>

                    <Box flex={1} minW={0}>
                      <Text color="white" fontWeight="semibold" mb={1}>
                        Profile picture
                      </Text>
                      <Text color="whiteAlpha.500" fontSize="sm" mb={4}>
                        Upload a square image for your public artist profile.
                      </Text>
                      <Input
                        ref={photoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        display="none"
                        onChange={handlePhotoInput}
                      />
                      <HStack gap={3} flexWrap="wrap">
                        <Button
                          type="button"
                          h="44px"
                          px={5}
                          gap={2}
                          bg="whiteAlpha.100"
                          color="white"
                          border="1px solid"
                          borderColor="whiteAlpha.200"
                          borderRadius="full"
                          disabled={uploadingPhoto}
                          _hover={{ bg: 'whiteAlpha.200' }}
                          onClick={() => photoInputRef.current?.click()}
                        >
                          {uploadingPhoto ? <Spinner size="sm" /> : <ImagePlus size={18} />}
                          Upload image
                        </Button>
                        {form.photoURL && (
                          <Button
                            type="button"
                            h="44px"
                            px={5}
                            gap={2}
                            bg="transparent"
                            color="whiteAlpha.700"
                            border="1px solid"
                            borderColor="whiteAlpha.200"
                            borderRadius="full"
                            _hover={{ bg: 'red.500/15', color: 'red.200', borderColor: 'red.400' }}
                            onClick={() => {
                              setPhotoUploadError(null)
                              setField('photoURL', '')
                            }}
                          >
                            <Trash2 size={17} />
                            Remove
                          </Button>
                        )}
                      </HStack>
                      {photoUploadError && (
                        <Text color="red.300" fontSize="sm" mt={2}>
                          {photoUploadError}
                        </Text>
                      )}
                    </Box>
                  </Flex>
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
                  <Flex align="baseline" justify="space-between" gap={4} mb={3}>
                    <Heading as="h2" color="white" fontSize="xl">
                      Mediums
                    </Heading>
                    <Text color="whiteAlpha.500" fontSize="xs" flexShrink={0}>
                      {form.mediums.length} selected
                    </Text>
                  </Flex>
                  <HStack
                    gap={2}
                    flexWrap="nowrap"
                    overflowX="auto"
                    pb={2}
                    css={{ scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
                  >
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
                  <Text color="whiteAlpha.400" fontSize="xs" mt={1}>
                    Scroll to see every medium. Select all that apply.
                  </Text>
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
                  <Box
                    p={{ base: 4, md: 5 }}
                    mb={5}
                    borderRadius="xl"
                    bg="whiteAlpha.50"
                    border="1px solid"
                    borderColor="whiteAlpha.100"
                  >
                    <Text color="white" fontWeight="semibold" mb={3}>
                      Featured work
                    </Text>
                    <Flex align="center" gap={4}>
                      <Flex
                        w={{ base: '88px', md: '112px' }}
                        aspectRatio={1}
                        flexShrink={0}
                        borderRadius="xl"
                        overflow="hidden"
                        bg="gray.800"
                        border="1px solid"
                        borderColor="whiteAlpha.200"
                        align="center"
                        justify="center"
                      >
                        {featuredWorkImageUrl ? (
                          <Image
                            src={featuredWorkImageUrl}
                            alt={form.featuredWorkTitle || 'Featured work'}
                            w="full"
                            h="full"
                            objectFit="cover"
                          />
                        ) : (
                          <ImagePlus size={28} color="rgba(255,255,255,0.35)" />
                        )}
                      </Flex>
                      <VStack align="stretch" gap={3} flex={1} minW={0}>
                        <Input
                          value={form.featuredWorkTitle}
                          onChange={(event) => setField('featuredWorkTitle', event.target.value)}
                          placeholder="Featured work title"
                          {...fieldStyles}
                        />
                        <Input
                          ref={featuredWorkInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          display="none"
                          onChange={handleFeaturedWorkInput}
                        />
                        <HStack gap={2} flexWrap="wrap">
                          <Button
                            type="button"
                            h="40px"
                            px={4}
                            gap={2}
                            bg="brand.500"
                            color="white"
                            borderRadius="full"
                            disabled={uploadingFeaturedWork}
                            _hover={{ bg: 'brand.600' }}
                            onClick={() => featuredWorkInputRef.current?.click()}
                          >
                            {uploadingFeaturedWork ? <Spinner size="sm" /> : <ImagePlus size={16} />}
                            Upload
                          </Button>
                          <Button
                            type="button"
                            h="40px"
                            px={4}
                            gap={2}
                            bg="whiteAlpha.100"
                            color="white"
                            border="1px solid"
                            borderColor="whiteAlpha.200"
                            borderRadius="full"
                            disabled={existingWorkChoices.length === 0}
                            _hover={{ bg: 'whiteAlpha.200' }}
                            onClick={() => setShowArtworkPicker((current) => !current)}
                          >
                            <Images size={16} />
                            Choose existing
                          </Button>
                          {featuredWorkImageUrl && (
                            <Button
                              type="button"
                              h="40px"
                              px={3}
                              gap={2}
                              bg="transparent"
                              color="whiteAlpha.600"
                              borderRadius="full"
                              _hover={{ bg: 'red.500/15', color: 'red.200' }}
                              onClick={() => {
                                setField('featuredWorkUrl', '')
                                setFeaturedWorkUploadError(null)
                              }}
                            >
                              <Trash2 size={16} />
                              Remove
                            </Button>
                          )}
                        </HStack>
                      </VStack>
                    </Flex>
                    {featuredWorkUploadError && (
                      <Text color="red.300" fontSize="sm" mt={3}>
                        {featuredWorkUploadError}
                      </Text>
                    )}
                    {showArtworkPicker && (
                      <Box mt={4} pt={4} borderTop="1px solid" borderColor="whiteAlpha.100">
                        <Text color="whiteAlpha.600" fontSize="sm" mb={3}>
                          Choose from your published Subversions
                        </Text>
                        <SimpleGrid columns={{ base: 3, md: 5 }} gap={2}>
                          {existingWorkChoices.map((work) => (
                            <Button
                              type="button"
                              key={`${work.id}-${work.imageUrl}`}
                              onClick={() => selectExistingWork(work.title, work.imageUrl)}
                              position="relative"
                              aspectRatio={1}
                              h="auto"
                              minW={0}
                              p={0}
                              overflow="hidden"
                              borderRadius="lg"
                              border="2px solid"
                              borderColor={featuredWorkImageUrl === work.imageUrl ? 'brand.500' : 'transparent'}
                              bg="gray.800"
                              _hover={{ borderColor: 'brand.400' }}
                              aria-label={`Use ${work.title} as featured work`}
                            >
                              <Image src={work.imageUrl} alt={work.title} w="full" h="full" objectFit="cover" />
                            </Button>
                          ))}
                        </SimpleGrid>
                      </Box>
                    )}
                  </Box>
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
                gap={4}
                direction={{ base: 'column', sm: 'row' }}
                p={{ base: 5, md: 7 }}
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
                  h="52px"
                  borderRadius="full"
                  px={8}
                  minW={{ base: 'full', sm: '190px' }}
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
                p={7}
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
                  {profilePhotoUrl ? (
                    <Image
                      src={profilePhotoUrl}
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
