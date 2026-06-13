'use client'

import { useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent } from 'react'
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
import { ArrowLeft, Check, ImagePlus, Save, Trash2, UserRound } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'

import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { useAuth } from '@/contexts/AuthContext'
import { useCollection, useDocument } from '@/hooks/useFirestore'
import { createDocument, createDocumentWithId, updateDocument } from '../../lib/firestore'
import { STORAGE_PATHS, uploadFileSimple, validateFile, VALIDATION_PRESETS } from '../../lib/storage'
import type { Artist, Artwork, ArtMedium, CreateDocument, UpdateDocument } from '../../lib/schema'

type Feedback = { type: 'error' | 'success'; message: string } | null

interface ArtworkForm {
  title: string
  description: string
  medium: ArtMedium
  imageUrl: string
  genres: string
  location: string
  artworkDate: string
}

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

const defaultArtworkForm: ArtworkForm = {
  title: '',
  description: '',
  medium: 'digital',
  imageUrl: '',
  genres: '',
  location: '',
  artworkDate: '',
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

const selectStyle: CSSProperties = {
  width: '100%',
  minHeight: '48px',
  padding: '0 16px',
  backgroundColor: 'var(--chakra-colors-gray-900)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: '12px',
  color: 'white',
  outline: 'none',
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

const getTimestampMs = (value: unknown) =>
  value && typeof (value as { toMillis?: unknown }).toMillis === 'function'
    ? (value as { toMillis: () => number }).toMillis()
    : 0

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
  const {
    data: artistArtworks,
    refetch: refetchArtworks,
  } = useCollection('artworks', {
    where: artistId ? [{ field: 'artistId', operator: '==', value: artistId }] : [],
    skip: !artistId,
  })
  const [draft, setDraft] = useState<Partial<ArtistForm>>({})
  const [artworkForm, setArtworkForm] = useState<ArtworkForm>(defaultArtworkForm)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [artworkFeedback, setArtworkFeedback] = useState<Feedback>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingArtwork, setUploadingArtwork] = useState(false)
  const [savingArtwork, setSavingArtwork] = useState(false)
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null)
  const [artworkUploadError, setArtworkUploadError] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const artworkInputRef = useRef<HTMLInputElement | null>(null)

  const fallbackName = user?.displayName || firebaseUser?.displayName || ''
  const fallbackPhotoUrl = user?.photoURL || firebaseUser?.photoURL || ''
  const baseForm = useMemo(
    () => getFormFromArtist(existingArtist, fallbackName, fallbackPhotoUrl),
    [existingArtist, fallbackName, fallbackPhotoUrl]
  )
  const form = useMemo(() => ({ ...baseForm, ...draft }), [baseForm, draft])
  const sortedArtistArtworks = useMemo(
    () => [...artistArtworks].sort((a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt)),
    [artistArtworks]
  )
  const profilePhotoUrl = form.photoURL.trim() ? normalizeUrl(form.photoURL) : ''
  const artworkImageUrl = artworkForm.imageUrl.trim() ? normalizeUrl(artworkForm.imageUrl) : ''

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

  const setArtworkField = <K extends keyof ArtworkForm>(field: K, value: ArtworkForm[K]) => {
    setArtworkForm((current) => ({ ...current, [field]: value }))
  }

  const handleArtworkFile = async (file: File | undefined) => {
    if (!file || !firebaseUser?.uid) return

    setArtworkUploadError(null)

    const validation = validateFile(file, VALIDATION_PRESETS.portfolioImage)
    if (!validation.valid) {
      setArtworkUploadError(validation.error || 'Choose an image file under 15MB.')
      return
    }

    setUploadingArtwork(true)
    const result = await uploadFileSimple(file, `${STORAGE_PATHS.PORTFOLIOS}/${firebaseUser.uid}`, {
      compress: true,
      compressionOptions: {
        maxWidth: 1800,
        maxHeight: 1800,
        quality: 0.86,
        format: 'jpeg',
      },
    })
    setUploadingArtwork(false)

    if (!result.success || !result.url) {
      setArtworkUploadError(result.error?.message || 'Could not upload this artwork image.')
      return
    }

    setArtworkField('imageUrl', result.url)
  }

  const handleArtworkInput = async (event: ChangeEvent<HTMLInputElement>) => {
    await handleArtworkFile(event.target.files?.[0])
    event.target.value = ''
  }

  const handleArtworkSubmit = async () => {
    setArtworkFeedback(null)
    setArtworkUploadError(null)

    if (!firebaseUser?.uid || !existingArtist) {
      setArtworkFeedback({ type: 'error', message: 'Save your artist profile before uploading work.' })
      return
    }

    if (!artworkForm.title.trim()) {
      setArtworkFeedback({ type: 'error', message: 'Add a title for this work.' })
      return
    }

    if (!artworkImageUrl) {
      setArtworkFeedback({ type: 'error', message: 'Upload an image or paste an artwork image URL.' })
      return
    }

    const genres = splitList(artworkForm.genres)
    const artworkDate = artworkForm.artworkDate
      ? Timestamp.fromDate(new Date(`${artworkForm.artworkDate}T00:00:00`))
      : undefined
    const year = artworkDate ? artworkDate.toDate().getFullYear() : undefined
    const artistName = form.artistName.trim() || form.name.trim() || existingArtist.artistName || existingArtist.name

    setSavingArtwork(true)
    const payload: CreateDocument<Artwork> = {
      artistId: firebaseUser.uid,
      artistName,
      ...(profilePhotoUrl ? { artistPhotoURL: profilePhotoUrl } : {}),
      title: artworkForm.title.trim(),
      ...(artworkForm.description.trim() ? { description: artworkForm.description.trim() } : {}),
      medium: artworkForm.medium,
      imageUrl: artworkImageUrl,
      thumbnailUrl: artworkImageUrl,
      mediaUrls: [artworkImageUrl],
      genres,
      tags: genres,
      ...(artworkForm.location.trim() ? { location: artworkForm.location.trim() } : {}),
      ...(artworkDate ? { artworkDate } : {}),
      ...(year ? { year } : {}),
      featured: false,
      visibility: 'public',
      likesCount: 0,
      savesCount: 0,
    }

    const result = await createDocument('artworks', payload)

    if (result.success) {
      await updateDocument('artists', firebaseUser.uid, {
        worksCount: artistArtworks.length + 1,
      } as UpdateDocument<Artist>)
      setArtworkForm({
        ...defaultArtworkForm,
        medium: form.mediums[0] || 'digital',
      })
      await refetchArtworks()
      setArtworkFeedback({ type: 'success', message: 'Artwork added to your profile.' })
    } else {
      setArtworkFeedback({
        type: 'error',
        message: result.error?.message || 'Could not save this artwork.',
      })
    }

    setSavingArtwork(false)
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
                        Upload a square image or paste an image URL. This appears on your public artist profile.
                      </Text>
                      <Input
                        ref={photoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        display="none"
                        onChange={handlePhotoInput}
                      />
                      <HStack gap={3} flexWrap="wrap" mb={4}>
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
                      <Field label="Profile image URL">
                        <Input
                          value={form.photoURL}
                          onChange={(event) => {
                            setPhotoUploadError(null)
                            setField('photoURL', event.target.value)
                          }}
                          placeholder="https://example.com/profile.jpg"
                          {...fieldStyles}
                        />
                      </Field>
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

                <Box>
                  <Flex justify="space-between" align={{ base: 'start', md: 'center' }} gap={4} mb={5} direction={{ base: 'column', md: 'row' }}>
                    <Box>
                      <Heading as="h2" color="white" fontSize="xl" mb={2}>
                        Upload Work
                      </Heading>
                      <Text color="whiteAlpha.500" fontSize="sm">
                        Add work to your public artist profile and the global artwork discovery wall.
                      </Text>
                    </Box>
                    <Badge bg="whiteAlpha.100" color="whiteAlpha.700" borderRadius="full" px={3} py={1}>
                      {sortedArtistArtworks.length} work{sortedArtistArtworks.length === 1 ? '' : 's'}
                    </Badge>
                  </Flex>

                  {!existingArtist ? (
                    <Box p={5} borderRadius="xl" bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.100">
                      <Text color="whiteAlpha.600" fontSize="sm">
                        Save your artist profile first, then come back here to upload your work.
                      </Text>
                    </Box>
                  ) : (
                    <Box p={{ base: 4, md: 5 }} borderRadius="2xl" bg="blackAlpha.200" border="1px solid" borderColor="whiteAlpha.100">
                      <Grid templateColumns={{ base: '1fr', lg: '260px minmax(0, 1fr)' }} gap={5}>
                        <Box>
                          <Box
                            aspectRatio={1}
                            borderRadius="xl"
                            overflow="hidden"
                            bg="gray.800"
                            border="1px solid"
                            borderColor="whiteAlpha.200"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            mb={4}
                          >
                            {artworkImageUrl ? (
                              <Image src={artworkImageUrl} alt={artworkForm.title || 'Artwork preview'} w="full" h="full" objectFit="cover" />
                            ) : (
                              <VStack gap={2} color="whiteAlpha.400">
                                <ImagePlus size={28} />
                                <Text fontSize="sm">Artwork preview</Text>
                              </VStack>
                            )}
                          </Box>
                          <Input
                            ref={artworkInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            display="none"
                            onChange={handleArtworkInput}
                          />
                          <HStack gap={3} flexWrap="wrap">
                            <Button
                              type="button"
                              h="42px"
                              px={4}
                              gap={2}
                              bg="whiteAlpha.100"
                              color="white"
                              border="1px solid"
                              borderColor="whiteAlpha.200"
                              borderRadius="full"
                              disabled={uploadingArtwork}
                              _hover={{ bg: 'whiteAlpha.200' }}
                              onClick={() => artworkInputRef.current?.click()}
                            >
                              {uploadingArtwork ? <Spinner size="sm" /> : <ImagePlus size={17} />}
                              Upload
                            </Button>
                            {artworkForm.imageUrl && (
                              <Button
                                type="button"
                                h="42px"
                                px={4}
                                gap={2}
                                bg="transparent"
                                color="whiteAlpha.700"
                                border="1px solid"
                                borderColor="whiteAlpha.200"
                                borderRadius="full"
                                _hover={{ bg: 'red.500/15', color: 'red.200', borderColor: 'red.400' }}
                                onClick={() => setArtworkField('imageUrl', '')}
                              >
                                <Trash2 size={16} />
                                Clear
                              </Button>
                            )}
                          </HStack>
                          {artworkUploadError && (
                            <Text color="red.300" fontSize="sm" mt={3}>
                              {artworkUploadError}
                            </Text>
                          )}
                        </Box>

                        <VStack align="stretch" gap={4}>
                          <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                            <Field label="Artwork title">
                              <Input
                                value={artworkForm.title}
                                onChange={(event) => setArtworkField('title', event.target.value)}
                                placeholder="Untitled study"
                                {...fieldStyles}
                              />
                            </Field>
                            <Field label="Art type">
                              <select
                                value={artworkForm.medium}
                                onChange={(event) => setArtworkField('medium', event.target.value as ArtMedium)}
                                style={selectStyle}
                              >
                                {mediumOptions.map((medium) => (
                                  <option key={medium.value} value={medium.value}>
                                    {medium.label}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          </SimpleGrid>
                          <Field label="Artwork image URL">
                            <Input
                              value={artworkForm.imageUrl}
                              onChange={(event) => {
                                setArtworkUploadError(null)
                                setArtworkField('imageUrl', event.target.value)
                              }}
                              placeholder="https://example.com/work.jpg"
                              {...fieldStyles}
                            />
                          </Field>
                          <Field label="Description">
                            <Textarea
                              value={artworkForm.description}
                              onChange={(event) => setArtworkField('description', event.target.value)}
                              placeholder="Short note about this work"
                              rows={3}
                              resize="vertical"
                              {...fieldStyles}
                            />
                          </Field>
                          <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
                            <Field label="Genres / tags">
                              <Input
                                value={artworkForm.genres}
                                onChange={(event) => setArtworkField('genres', event.target.value)}
                                placeholder="portrait, surreal, ink"
                                {...fieldStyles}
                              />
                            </Field>
                            <Field label="Location">
                              <Input
                                value={artworkForm.location}
                                onChange={(event) => setArtworkField('location', event.target.value)}
                                placeholder="Lusaka"
                                {...fieldStyles}
                              />
                            </Field>
                            <Field label="Date">
                              <Input
                                type="date"
                                value={artworkForm.artworkDate}
                                onChange={(event) => setArtworkField('artworkDate', event.target.value)}
                                {...fieldStyles}
                              />
                            </Field>
                          </SimpleGrid>
                          {artworkFeedback && (
                            <Box
                              p={3}
                              borderRadius="xl"
                              bg={artworkFeedback.type === 'success' ? 'green.500/10' : 'red.500/10'}
                              border="1px solid"
                              borderColor={artworkFeedback.type === 'success' ? 'green.500/30' : 'red.500/30'}
                            >
                              <Text color={artworkFeedback.type === 'success' ? 'green.200' : 'red.200'} fontSize="sm">
                                {artworkFeedback.message}
                              </Text>
                            </Box>
                          )}
                          <Flex justify="flex-end">
                            <Button
                              type="button"
                              h="48px"
                              px={6}
                              bg="brand.500"
                              color="white"
                              borderRadius="full"
                              disabled={savingArtwork || uploadingArtwork}
                              _hover={{ bg: 'brand.600' }}
                              onClick={handleArtworkSubmit}
                            >
                              {savingArtwork ? <Spinner size="sm" /> : <ImagePlus size={18} />}
                              Add Work
                            </Button>
                          </Flex>
                        </VStack>
                      </Grid>
                    </Box>
                  )}

                  {sortedArtistArtworks.length > 0 && (
                    <SimpleGrid columns={{ base: 2, md: 4 }} gap={3} mt={5}>
                      {sortedArtistArtworks.slice(0, 8).map((artwork) => (
                        <Box key={artwork.id} borderRadius="xl" overflow="hidden" bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.100">
                          <Box aspectRatio={1} bg="gray.800">
                            <Image src={artwork.imageUrl} alt={artwork.title} w="full" h="full" objectFit="cover" />
                          </Box>
                          <Box p={3}>
                            <Text color="white" fontSize="sm" fontWeight="semibold" lineClamp={1}>{artwork.title}</Text>
                            <Text color="whiteAlpha.500" fontSize="xs" textTransform="capitalize">{artwork.medium.replace(/_/g, ' ')}</Text>
                          </Box>
                        </Box>
                      ))}
                    </SimpleGrid>
                  )}
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
