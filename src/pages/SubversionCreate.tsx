'use client'

import { useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
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
import { ArrowLeft, ImagePlus, Trash2, UserRound } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'

import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { useAuth } from '@/contexts/AuthContext'
import { useDocument } from '@/hooks/useFirestore'
import { createDocument, updateDocument } from '../../lib/firestore'
import { STORAGE_PATHS, uploadFileSimple, validateFile, VALIDATION_PRESETS } from '../../lib/storage'
import type { Artist, Artwork, ArtMedium, CreateDocument, UpdateDocument } from '../../lib/schema'

type Feedback = { type: 'error' | 'success'; message: string } | null

interface SubversionForm {
  title: string
  description: string
  medium: ArtMedium
  imageUrl: string
  genres: string
  location: string
  artworkDate: string
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

const defaultForm: SubversionForm = {
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

export default function SubversionCreate() {
  const { user, firebaseUser, initialized, loading: authLoading } = useAuth()
  const artistId = firebaseUser?.uid || null
  const { data: artist, loading: artistLoading } = useDocument('artists', artistId, { skip: !artistId })
  const [form, setForm] = useState<SubversionForm>(defaultForm)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const imageUrl = form.imageUrl.trim()

  const setField = <K extends keyof SubversionForm>(field: K, value: SubversionForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleFile = async (file: File | undefined) => {
    if (!file || !firebaseUser?.uid) return

    setUploadError(null)
    const validation = validateFile(file, VALIDATION_PRESETS.portfolioImage)
    if (!validation.valid) {
      setUploadError(validation.error || 'Choose an image file under 15MB.')
      return
    }

    setUploading(true)
    const result = await uploadFileSimple(file, `${STORAGE_PATHS.PORTFOLIOS}/${firebaseUser.uid}`, {
      compress: true,
      compressionOptions: {
        maxWidth: 1800,
        maxHeight: 1800,
        quality: 0.86,
        format: 'jpeg',
      },
    })
    setUploading(false)

    if (!result.success || !result.url) {
      setUploadError(result.error?.message || 'Could not upload this image.')
      return
    }

    setField('imageUrl', result.url)
  }

  const handleInput = async (event: ChangeEvent<HTMLInputElement>) => {
    await handleFile(event.target.files?.[0])
    event.target.value = ''
  }

  const handlePublish = async () => {
    setFeedback(null)
    setUploadError(null)

    if (!firebaseUser?.uid || !artist) {
      setFeedback({ type: 'error', message: 'Create your artist profile before publishing a Subversion.' })
      return
    }
    if (!form.title.trim()) {
      setFeedback({ type: 'error', message: 'Add a title for this Subversion.' })
      return
    }
    if (!imageUrl) {
      setFeedback({ type: 'error', message: 'Upload an image for this Subversion.' })
      return
    }

    const genres = splitList(form.genres)
    const artworkDate = form.artworkDate
      ? Timestamp.fromDate(new Date(`${form.artworkDate}T00:00:00`))
      : undefined
    const year = artworkDate ? artworkDate.toDate().getFullYear() : undefined
    const artistName = artist.artistName || artist.name || user?.displayName || 'Artist'
    const artistPhotoURL = artist.photoURL || user?.photoURL || firebaseUser.photoURL || ''

    setPublishing(true)
    const payload: CreateDocument<Artwork> = {
      artistId: firebaseUser.uid,
      artistName,
      ...(artistPhotoURL ? { artistPhotoURL } : {}),
      title: form.title.trim(),
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      medium: form.medium,
      imageUrl,
      thumbnailUrl: imageUrl,
      mediaUrls: [imageUrl],
      genres,
      tags: genres,
      ...(form.location.trim() ? { location: form.location.trim() } : {}),
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
        worksCount: (artist.worksCount || 0) + 1,
      } as UpdateDocument<Artist>)
      setForm({ ...defaultForm, medium: artist.mediums?.[0] || 'digital' })
      setFeedback({ type: 'success', message: 'Subversion published.' })
    } else {
      setFeedback({ type: 'error', message: result.error?.message || 'Could not publish this Subversion.' })
    }
    setPublishing(false)
  }

  if (!initialized || authLoading || (artistId && artistLoading)) {
    return (
      <Box bg="gray.950" minH="100vh">
        <Header />
        <Flex minH="70vh" align="center" justify="center">
          <Spinner size="xl" color="brand.500" />
        </Flex>
      </Box>
    )
  }

  if (!firebaseUser) {
    return (
      <Box bg="gray.950" minH="100vh">
        <Header />
        <Box as="main" pt={{ base: '96px', md: '128px' }} pb={20}>
          <Container maxW="640px" px={{ base: 5, md: 8 }}>
            <VStack gap={5} textAlign="center" p={{ base: 6, md: 10 }} bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="2xl">
              <Flex w={14} h={14} borderRadius="full" bg="brand.500" align="center" justify="center">
                <UserRound size={26} color="white" />
              </Flex>
              <Heading as="h1" color="white" fontSize={{ base: '2xl', md: '3xl' }}>
                Sign in to add a Subversion
              </Heading>
              <Text color="whiteAlpha.600">Subversions are published under your Club BZR artist identity.</Text>
              <Link to="/auth/login">
                <Button bg="brand.500" color="white" borderRadius="full" px={7} _hover={{ bg: 'brand.600' }}>
                  Sign In
                </Button>
              </Link>
            </VStack>
          </Container>
        </Box>
      </Box>
    )
  }

  if (!artist) {
    return (
      <Box bg="gray.950" minH="100vh">
        <Header />
        <Box as="main" pt={{ base: '96px', md: '128px' }} pb={20}>
          <Container maxW="640px" px={{ base: 5, md: 8 }}>
            <VStack gap={5} textAlign="center" p={{ base: 6, md: 10 }} bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="2xl">
              <Flex w={14} h={14} borderRadius="full" bg="brand.500" align="center" justify="center">
                <ImagePlus size={26} color="white" />
              </Flex>
              <Heading as="h1" color="white" fontSize={{ base: '2xl', md: '3xl' }}>
                Create your artist profile first
              </Heading>
              <Text color="whiteAlpha.600">Your profile provides the public credit attached to every Subversion.</Text>
              <Link to="/artists/create">
                <Button bg="brand.500" color="white" borderRadius="full" px={7} _hover={{ bg: 'brand.600' }}>
                  Create Artist Profile
                </Button>
              </Link>
            </VStack>
          </Container>
        </Box>
      </Box>
    )
  }

  return (
    <Box bg="gray.950" minH="100vh">
      <Header />
      <Box as="main" pt={{ base: '92px', md: '120px' }} pb={{ base: 28, md: 20 }}>
        <Container maxW="1180px" px={{ base: 4, md: 8 }}>
          <Box mb={{ base: 6, md: 8 }}>
            <Link to="/artists">
              <Button h="40px" px={0} mb={4} gap={2} bg="transparent" color="whiteAlpha.700" _hover={{ color: 'white' }}>
                <ArrowLeft size={16} />
                Artists
              </Button>
            </Link>
            <Text color="brand.500" fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="0.18em" mb={2}>
              New Subversion
            </Text>
            <Heading as="h1" color="white" fontSize={{ base: '3xl', md: '4xl' }} fontFamily="heading" mb={2}>
              Add your art
            </Heading>
            <Text color="whiteAlpha.600" maxW="2xl">
              Publish a work to your artist profile and the Club BZR discovery wall.
            </Text>
          </Box>

          <Box p={{ base: 4, md: 6 }} borderRadius="2xl" bg="gray.900" border="1px solid" borderColor="whiteAlpha.100">
            <Grid templateColumns={{ base: '1fr', lg: '320px minmax(0, 1fr)' }} gap={{ base: 6, lg: 8 }}>
              <Box>
                <Box aspectRatio={1} borderRadius="xl" overflow="hidden" bg="gray.800" border="1px solid" borderColor="whiteAlpha.200" display="flex" alignItems="center" justifyContent="center" mb={4}>
                  {imageUrl ? (
                    <Image src={imageUrl} alt={form.title || 'Subversion preview'} w="full" h="full" objectFit="cover" />
                  ) : (
                    <VStack gap={2} color="whiteAlpha.400">
                      <ImagePlus size={30} />
                      <Text fontSize="sm">Subversion preview</Text>
                    </VStack>
                  )}
                </Box>
                <Input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" display="none" onChange={handleInput} />
                <HStack gap={3} flexWrap="wrap">
                  <Button type="button" h="42px" px={4} bg="whiteAlpha.100" color="white" border="1px solid" borderColor="whiteAlpha.200" borderRadius="full" disabled={uploading} _hover={{ bg: 'whiteAlpha.200' }} onClick={() => inputRef.current?.click()}>
                    {uploading ? <Spinner size="sm" /> : <ImagePlus size={17} />}
                    Upload image
                  </Button>
                  {form.imageUrl && (
                    <Button type="button" h="42px" px={4} bg="transparent" color="whiteAlpha.700" border="1px solid" borderColor="whiteAlpha.200" borderRadius="full" _hover={{ bg: 'red.500/15', color: 'red.200', borderColor: 'red.400' }} onClick={() => setField('imageUrl', '')}>
                      <Trash2 size={16} />
                      Clear
                    </Button>
                  )}
                </HStack>
                {uploadError && <Text color="red.300" fontSize="sm" mt={3}>{uploadError}</Text>}
              </Box>

              <VStack align="stretch" gap={4}>
                <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                  <Field label="Title">
                    <Input value={form.title} onChange={(event) => setField('title', event.target.value)} placeholder="Untitled study" {...fieldStyles} />
                  </Field>
                  <Field label="Art type">
                    <select value={form.medium} onChange={(event) => setField('medium', event.target.value as ArtMedium)} style={selectStyle}>
                      {mediumOptions.map((medium) => <option key={medium.value} value={medium.value}>{medium.label}</option>)}
                    </select>
                  </Field>
                </SimpleGrid>
                <Field label="Description">
                  <Textarea value={form.description} onChange={(event) => setField('description', event.target.value)} placeholder="Short note about this work" rows={4} resize="vertical" {...fieldStyles} />
                </Field>
                <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
                  <Field label="Genres / tags">
                    <Input value={form.genres} onChange={(event) => setField('genres', event.target.value)} placeholder="portrait, surreal" {...fieldStyles} />
                  </Field>
                  <Field label="Location">
                    <Input value={form.location} onChange={(event) => setField('location', event.target.value)} placeholder="Lusaka" {...fieldStyles} />
                  </Field>
                  <Field label="Date">
                    <Input type="date" value={form.artworkDate} onChange={(event) => setField('artworkDate', event.target.value)} {...fieldStyles} />
                  </Field>
                </SimpleGrid>
                {feedback && (
                  <Box p={3} borderRadius="xl" bg={feedback.type === 'success' ? 'green.500/10' : 'red.500/10'} border="1px solid" borderColor={feedback.type === 'success' ? 'green.500/30' : 'red.500/30'}>
                    <Text color={feedback.type === 'success' ? 'green.200' : 'red.200'} fontSize="sm">{feedback.message}</Text>
                  </Box>
                )}
                <Flex justify="flex-end">
                  <Button type="button" h="48px" px={7} bg="brand.500" color="white" borderRadius="full" disabled={publishing || uploading} _hover={{ bg: 'brand.600' }} onClick={handlePublish}>
                    {publishing ? <Spinner size="sm" /> : <ImagePlus size={18} />}
                    Publish Subversion
                  </Button>
                </Flex>
              </VStack>
            </Grid>
          </Box>

        </Container>
      </Box>
      <Footer />
    </Box>
  )
}
