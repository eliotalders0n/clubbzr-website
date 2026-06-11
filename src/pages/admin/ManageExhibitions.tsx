'use client'

import { useMemo, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react'
import {
  Badge,
  Box,
  Button,
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
import { Timestamp } from 'firebase/firestore'
import { motion } from 'framer-motion'
import {
  Archive,
  Eye,
  ImagePlus,
  Pencil,
  PlayCircle,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useCollection } from '@/hooks/useFirestore'
import { createDocument, deleteDocument, updateDocument } from '../../../lib/firestore'
import type {
  ArtMedium,
  CreateDocument,
  Exhibition,
  ExhibitionArtwork,
  UpdateDocument,
} from '../../../lib/schema'

const MotionBox = motion.create(Box)

type AdminExhibition = Exhibition & { isPublished?: boolean }
type StatusFilter = 'all' | 'draft' | 'upcoming' | 'active' | 'archived'

type ArtworkForm = {
  id: string
  title: string
  artistId: string
  artistName: string
  description: string
  medium: ArtMedium
  year: string
  thumbnailUrl: string
  mediaUrls: string
  curatorNote: string
}

type ExhibitionForm = {
  title: string
  description: string
  curatorStatement: string
  curatorName: string
  curatorUserId: string
  coverImage: string
  startDate: string
  endDate: string
  isOnline: boolean
  virtualTourUrl: string
  tags: string
  featured: boolean
  isPublished: boolean
  artworks: ArtworkForm[]
}

type ExhibitionWrite = CreateDocument<Exhibition> & { isPublished?: boolean }

const ART_MEDIUMS: ArtMedium[] = [
  'painting',
  'sculpture',
  'photography',
  'digital',
  'illustration',
  'mixed_media',
  'installation',
  'performance',
  'video',
  'animation',
  'textile',
  'ceramics',
  'printmaking',
  'collage',
  'street_art',
  'conceptual',
  'other',
]

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'active', label: 'Active' },
  { id: 'archived', label: 'Archived' },
]

const fallbackCoverImage = 'https://images.unsplash.com/photo-1634017839464-5c339bbe3c35?w=1200&q=80'

function dateInput(value?: Exhibition['startDate']): string {
  if (!value) return ''
  if (value instanceof Timestamp) return value.toDate().toISOString().slice(0, 10)
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString().slice(0, 10)
  }
  return ''
}

function dateFromInput(value: string, endOfDay = false): Timestamp {
  const fallback = new Date()
  const date = value ? new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}`) : fallback
  return Timestamp.fromDate(date)
}

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function parseMediaUrls(value: string, fallback: string): string[] {
  const urls = value
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)

  return urls.length > 0 ? urls : [fallback]
}

function displayMedium(value: string): string {
  return value.replace(/_/g, ' ')
}

function getStatus(exhibition: AdminExhibition): Exclude<StatusFilter, 'all'> {
  if (exhibition.isPublished === false) return 'draft'
  const now = Date.now()
  const start = exhibition.startDate instanceof Timestamp ? exhibition.startDate.toMillis() : 0
  const end = exhibition.endDate instanceof Timestamp ? exhibition.endDate.toMillis() : 0
  if (start > now) return 'upcoming'
  if (end && end < now) return 'archived'
  return 'active'
}

function emptyArtwork(): ArtworkForm {
  const id = `artwork-${Date.now()}-${Math.round(Math.random() * 1000)}`
  return {
    id,
    title: '',
    artistId: '',
    artistName: '',
    description: '',
    medium: 'digital',
    year: '',
    thumbnailUrl: '',
    mediaUrls: '',
    curatorNote: '',
  }
}

function emptyForm(userId = '', name = ''): ExhibitionForm {
  return {
    title: '',
    description: '',
    curatorStatement: '',
    curatorName: name,
    curatorUserId: userId,
    coverImage: '',
    startDate: '',
    endDate: '',
    isOnline: true,
    virtualTourUrl: '',
    tags: '',
    featured: false,
    isPublished: true,
    artworks: [],
  }
}

function artworkToForm(artwork: ExhibitionArtwork): ArtworkForm {
  return {
    id: artwork.id,
    title: artwork.title,
    artistId: artwork.artistId,
    artistName: artwork.artistName,
    description: artwork.description || '',
    medium: artwork.medium,
    year: artwork.year ? String(artwork.year) : '',
    thumbnailUrl: artwork.thumbnailUrl || '',
    mediaUrls: (artwork.mediaUrls || []).join(', '),
    curatorNote: artwork.curatorNote || '',
  }
}

function exhibitionToForm(exhibition: AdminExhibition): ExhibitionForm {
  return {
    title: exhibition.title || '',
    description: exhibition.description || '',
    curatorStatement: exhibition.curatorStatement || '',
    curatorName: exhibition.curator?.name || '',
    curatorUserId: exhibition.curator?.userId || '',
    coverImage: exhibition.coverImage || '',
    startDate: dateInput(exhibition.startDate),
    endDate: dateInput(exhibition.endDate),
    isOnline: exhibition.isOnline !== false,
    virtualTourUrl: exhibition.virtualTourUrl || '',
    tags: (exhibition.tags || []).join(', '),
    featured: Boolean(exhibition.featured),
    isPublished: exhibition.isPublished !== false,
    artworks: (exhibition.artworks || []).map(artworkToForm),
  }
}

function buildPayload(form: ExhibitionForm, viewsCount = 0): ExhibitionWrite {
  const coverImage = form.coverImage.trim() || fallbackCoverImage
  const artworks = form.artworks
    .filter((artwork) => artwork.title.trim() && artwork.artistName.trim())
    .map((artwork, index): ExhibitionArtwork => {
      const thumbnailUrl = artwork.thumbnailUrl.trim() || coverImage
      const year = Number(artwork.year)
      return {
        id: artwork.id || `artwork-${index}`,
        artistId: artwork.artistId.trim() || artwork.artistName.trim().toLowerCase().replace(/\s+/g, '-'),
        artistName: artwork.artistName.trim(),
        title: artwork.title.trim(),
        description: artwork.description.trim(),
        medium: artwork.medium,
        ...(Number.isFinite(year) && year > 0 ? { year } : {}),
        mediaUrls: parseMediaUrls(artwork.mediaUrls, thumbnailUrl),
        thumbnailUrl,
        order: index,
        curatorNote: artwork.curatorNote.trim(),
      }
    })

  return {
    title: form.title.trim(),
    description: form.description.trim(),
    curatorStatement: form.curatorStatement.trim(),
    curator: {
      userId: form.curatorUserId.trim(),
      name: form.curatorName.trim() || 'Club BZR Curator',
    },
    artworks,
    startDate: dateFromInput(form.startDate),
    endDate: dateFromInput(form.endDate, true),
    coverImage,
    featured: form.featured,
    isOnline: form.isOnline,
    virtualTourUrl: form.virtualTourUrl.trim(),
    tags: parseTags(form.tags),
    viewsCount,
    isPublished: form.isPublished,
  }
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <Text color="whiteAlpha.600" fontSize="sm" mb={2}>
      {children}
    </Text>
  )
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <Box position="fixed" inset={0} zIndex={100} display="flex" alignItems="center" justifyContent="center" p={4}>
      <Box position="absolute" inset={0} bg="blackAlpha.800" onClick={onClose} />
      <MotionBox
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        position="relative"
        w="full"
        maxW="920px"
        maxH="90vh"
        overflowY="auto"
        p={{ base: 5, md: 7 }}
        borderRadius="2xl"
        bg="gray.900"
        border="1px solid"
        borderColor="whiteAlpha.100"
      >
        <Flex justify="space-between" align="center" mb={6}>
          <Heading as="h2" color="white" fontSize="xl" fontFamily="heading">
            {title}
          </Heading>
          <Button onClick={onClose} variant="ghost" color="whiteAlpha.700" _hover={{ bg: 'whiteAlpha.100', color: 'white' }}>
            Close
          </Button>
        </Flex>
        {children}
      </MotionBox>
    </Box>
  )
}

function ArtworkFields({
  artwork,
  onUpdate,
  onRemove,
}: {
  artwork: ArtworkForm
  onUpdate: (artwork: ArtworkForm) => void
  onRemove: () => void
}) {
  return (
    <Box p={4} bg="gray.800" border="1px solid" borderColor="whiteAlpha.100" borderRadius="xl">
      <Flex justify="space-between" align="center" mb={4}>
        <Text color="white" fontWeight="medium">Artwork</Text>
        <Button type="button" onClick={onRemove} size="sm" bg="transparent" color="red.300" _hover={{ bg: 'red.500/10' }}>
          <Trash2 size={16} />
        </Button>
      </Flex>

      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={3}>
        <Input value={artwork.title} onChange={(e) => onUpdate({ ...artwork, title: e.target.value })} placeholder="Artwork title" bg="gray.900" color="white" borderColor="whiteAlpha.200" />
        <Input value={artwork.artistName} onChange={(e) => onUpdate({ ...artwork, artistName: e.target.value })} placeholder="Artist name" bg="gray.900" color="white" borderColor="whiteAlpha.200" />
        <Input value={artwork.artistId} onChange={(e) => onUpdate({ ...artwork, artistId: e.target.value })} placeholder="Artist ID or slug" bg="gray.900" color="white" borderColor="whiteAlpha.200" />
        <select
          value={artwork.medium}
          onChange={(e) => onUpdate({ ...artwork, medium: e.target.value as ArtMedium })}
          className="h-10 rounded-md border border-white/20 bg-gray-900 px-3 text-white"
        >
          {ART_MEDIUMS.map((medium) => (
            <option key={medium} value={medium}>
              {displayMedium(medium)}
            </option>
          ))}
        </select>
        <Input value={artwork.year} onChange={(e) => onUpdate({ ...artwork, year: e.target.value })} placeholder="Year" type="number" bg="gray.900" color="white" borderColor="whiteAlpha.200" />
        <Input value={artwork.thumbnailUrl} onChange={(e) => onUpdate({ ...artwork, thumbnailUrl: e.target.value })} placeholder="Thumbnail URL" bg="gray.900" color="white" borderColor="whiteAlpha.200" />
      </Grid>

      <Textarea mt={3} value={artwork.mediaUrls} onChange={(e) => onUpdate({ ...artwork, mediaUrls: e.target.value })} placeholder="Media URLs, comma separated" bg="gray.900" color="white" borderColor="whiteAlpha.200" rows={2} />
      <Textarea mt={3} value={artwork.description} onChange={(e) => onUpdate({ ...artwork, description: e.target.value })} placeholder="Artwork description" bg="gray.900" color="white" borderColor="whiteAlpha.200" rows={2} />
      <Textarea mt={3} value={artwork.curatorNote} onChange={(e) => onUpdate({ ...artwork, curatorNote: e.target.value })} placeholder="Curator note" bg="gray.900" color="white" borderColor="whiteAlpha.200" rows={2} />
    </Box>
  )
}

function ExhibitionFormFields({
  form,
  setForm,
}: {
  form: ExhibitionForm
  setForm: Dispatch<SetStateAction<ExhibitionForm>>
}) {
  const updateArtwork = (index: number, artwork: ArtworkForm) => {
    setForm((prev) => ({
      ...prev,
      artworks: prev.artworks.map((item, itemIndex) => (itemIndex === index ? artwork : item)),
    }))
  }

  return (
    <VStack align="stretch" gap={4}>
      <Box>
        <FieldLabel>Title</FieldLabel>
        <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" required />
      </Box>
      <Box>
        <FieldLabel>Description</FieldLabel>
        <Textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" rows={4} required />
      </Box>
      <Box>
        <FieldLabel>Curator statement</FieldLabel>
        <Textarea value={form.curatorStatement} onChange={(e) => setForm((prev) => ({ ...prev, curatorStatement: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" rows={3} />
      </Box>

      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4}>
        <Box>
          <FieldLabel>Curator name</FieldLabel>
          <Input value={form.curatorName} onChange={(e) => setForm((prev) => ({ ...prev, curatorName: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" required />
        </Box>
        <Box>
          <FieldLabel>Curator user ID</FieldLabel>
          <Input value={form.curatorUserId} onChange={(e) => setForm((prev) => ({ ...prev, curatorUserId: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" required />
        </Box>
      </Grid>

      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4}>
        <Box>
          <FieldLabel>Start date</FieldLabel>
          <Input type="date" value={form.startDate} onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" required />
        </Box>
        <Box>
          <FieldLabel>End date</FieldLabel>
          <Input type="date" value={form.endDate} onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" required />
        </Box>
      </Grid>

      <Box>
        <FieldLabel>Cover image URL</FieldLabel>
        <Input value={form.coverImage} onChange={(e) => setForm((prev) => ({ ...prev, coverImage: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" />
      </Box>

      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4}>
        <Box>
          <FieldLabel>Virtual tour URL</FieldLabel>
          <Input value={form.virtualTourUrl} onChange={(e) => setForm((prev) => ({ ...prev, virtualTourUrl: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" />
        </Box>
        <Box>
          <FieldLabel>Tags</FieldLabel>
          <Input value={form.tags} onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))} placeholder="digital, immersive" bg="gray.800" color="white" borderColor="whiteAlpha.200" />
        </Box>
      </Grid>

      <HStack gap={3} flexWrap="wrap">
        <Button type="button" onClick={() => setForm((prev) => ({ ...prev, isPublished: !prev.isPublished }))} bg={form.isPublished ? 'green.500' : 'whiteAlpha.100'} color="white" _hover={{ bg: form.isPublished ? 'green.600' : 'whiteAlpha.200' }}>
          {form.isPublished ? 'Published' : 'Draft'}
        </Button>
        <Button type="button" onClick={() => setForm((prev) => ({ ...prev, featured: !prev.featured }))} bg={form.featured ? 'brand.500' : 'whiteAlpha.100'} color="white" _hover={{ bg: form.featured ? 'brand.600' : 'whiteAlpha.200' }}>
          {form.featured ? 'Featured' : 'Not Featured'}
        </Button>
        <Button type="button" onClick={() => setForm((prev) => ({ ...prev, isOnline: !prev.isOnline }))} bg={form.isOnline ? 'blue.500' : 'whiteAlpha.100'} color="white" _hover={{ bg: form.isOnline ? 'blue.600' : 'whiteAlpha.200' }}>
          {form.isOnline ? 'Online' : 'Physical'}
        </Button>
      </HStack>

      <Box>
        <Flex justify="space-between" align="center" mb={3}>
          <Text color="white" fontWeight="medium">Artworks</Text>
          <Button type="button" size="sm" onClick={() => setForm((prev) => ({ ...prev, artworks: [...prev.artworks, emptyArtwork()] }))} bg="whiteAlpha.100" color="white" _hover={{ bg: 'whiteAlpha.200' }}>
            <ImagePlus size={16} />
            Add Artwork
          </Button>
        </Flex>
        <VStack align="stretch" gap={3}>
          {form.artworks.map((artwork, index) => (
            <ArtworkFields
              key={artwork.id}
              artwork={artwork}
              onUpdate={(updated) => updateArtwork(index, updated)}
              onRemove={() => setForm((prev) => ({ ...prev, artworks: prev.artworks.filter((_, itemIndex) => itemIndex !== index) }))}
            />
          ))}
        </VStack>
      </Box>
    </VStack>
  )
}

function ExhibitionCard({
  exhibition,
  onEdit,
  onDelete,
  onPublishToggle,
  onArchive,
}: {
  exhibition: AdminExhibition
  onEdit: (exhibition: AdminExhibition) => void
  onDelete: (exhibition: AdminExhibition) => void
  onPublishToggle: (exhibition: AdminExhibition) => void
  onArchive: (exhibition: AdminExhibition) => void
}) {
  const status = getStatus(exhibition)
  const statusColor = {
    draft: { bg: 'yellow.500', color: 'black' },
    upcoming: { bg: 'blue.500', color: 'white' },
    active: { bg: 'green.500', color: 'white' },
    archived: { bg: 'gray.500', color: 'white' },
  }[status]

  return (
    <MotionBox whileHover={{ y: -4 }} bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="2xl" overflow="hidden">
      <Box position="relative" h="180px" bg="whiteAlpha.100">
        <Image src={exhibition.coverImage || fallbackCoverImage} alt={exhibition.title} w="full" h="full" objectFit="cover" />
        <Badge position="absolute" top={3} right={3} bg={statusColor.bg} color={statusColor.color} borderRadius="full" px={3}>
          {status}
        </Badge>
      </Box>
      <VStack align="stretch" p={5} gap={4}>
        <Box>
          <Heading as="h3" color="white" fontSize="xl" fontFamily="heading" lineClamp={1}>
            {exhibition.title}
          </Heading>
          <Text color="whiteAlpha.500" fontSize="sm">
            Curated by {exhibition.curator?.name || 'Club BZR'}
          </Text>
        </Box>
        <Text color="whiteAlpha.600" fontSize="sm" lineClamp={2}>
          {exhibition.description}
        </Text>
        <HStack gap={4} color="whiteAlpha.500" fontSize="xs" flexWrap="wrap">
          <HStack gap={1}>
            <Eye size={14} />
            <Text>{(exhibition.viewsCount || 0).toLocaleString()} views</Text>
          </HStack>
          <Text>{exhibition.artworks?.length || 0} artworks</Text>
          {exhibition.featured && <Text color="brand.300">Featured</Text>}
        </HStack>
        <HStack gap={2} flexWrap="wrap">
          <Button size="sm" onClick={() => onPublishToggle(exhibition)} bg="whiteAlpha.100" color="white" _hover={{ bg: 'whiteAlpha.200' }}>
            <PlayCircle size={16} />
            {exhibition.isPublished === false ? 'Publish' : 'Unpublish'}
          </Button>
          <Button size="sm" onClick={() => onEdit(exhibition)} bg="whiteAlpha.100" color="white" _hover={{ bg: 'whiteAlpha.200' }}>
            <Pencil size={16} />
          </Button>
          <Button size="sm" onClick={() => onArchive(exhibition)} bg="whiteAlpha.100" color="white" _hover={{ bg: 'whiteAlpha.200' }}>
            <Archive size={16} />
          </Button>
          <Button size="sm" onClick={() => onDelete(exhibition)} bg="transparent" color="red.300" border="1px solid" borderColor="red.500/50" _hover={{ bg: 'red.500/10' }}>
            <Trash2 size={16} />
          </Button>
        </HStack>
      </VStack>
    </MotionBox>
  )
}

export default function ManageExhibitions() {
  const { user, firebaseUser } = useAuth()
  const { data, loading, error, refetch } = useCollection('exhibitions', {
    orderBy: 'startDate',
    orderDirection: 'desc',
  })
  const currentUserId = firebaseUser?.uid || user?.uid || ''
  const currentUserName = user?.displayName || firebaseUser?.displayName || ''
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<ExhibitionForm>(() => emptyForm(currentUserId, currentUserName))
  const [editing, setEditing] = useState<AdminExhibition | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const exhibitions = useMemo(
    () => (data as AdminExhibition[]).sort((a, b) => {
      const aTime = a.startDate instanceof Timestamp ? a.startDate.toMillis() : 0
      const bTime = b.startDate instanceof Timestamp ? b.startDate.toMillis() : 0
      return bTime - aTime
    }),
    [data]
  )

  const filteredExhibitions = useMemo(() => {
    const query = search.trim().toLowerCase()
    return exhibitions.filter((exhibition) => {
      const status = getStatus(exhibition)
      const matchesFilter = filter === 'all' || status === filter
      const matchesSearch =
        !query ||
        exhibition.title.toLowerCase().includes(query) ||
        exhibition.description.toLowerCase().includes(query) ||
        (exhibition.curator?.name || '').toLowerCase().includes(query)
      return matchesFilter && matchesSearch
    })
  }, [exhibitions, filter, search])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm(currentUserId, currentUserName))
    setModalMode('create')
  }

  const openEdit = (exhibition: AdminExhibition) => {
    setEditing(exhibition)
    setForm(exhibitionToForm(exhibition))
    setModalMode('edit')
  }

  const closeModal = () => {
    setModalMode(null)
    setEditing(null)
    setForm(emptyForm(currentUserId, currentUserName))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)

    const payload = buildPayload(form, editing?.viewsCount || 0)
    const result = modalMode === 'edit' && editing
      ? await updateDocument('exhibitions', editing.id, payload as UpdateDocument<Exhibition>)
      : await createDocument('exhibitions', payload)

    setSubmitting(false)

    if (result.success) {
      closeModal()
      void refetch()
    } else {
      console.error('Failed to save exhibition:', result.error)
      alert(result.error?.message || 'Failed to save exhibition.')
    }
  }

  const handleDelete = async (exhibition: AdminExhibition) => {
    if (!window.confirm(`Delete "${exhibition.title}"?`)) return
    const result = await deleteDocument('exhibitions', exhibition.id)
    if (result.success) {
      void refetch()
    } else {
      console.error('Failed to delete exhibition:', result.error)
      alert(result.error?.message || 'Failed to delete exhibition.')
    }
  }

  const handlePublishToggle = async (exhibition: AdminExhibition) => {
    const result = await updateDocument('exhibitions', exhibition.id, {
      isPublished: exhibition.isPublished === false,
    } as UpdateDocument<Exhibition>)
    if (result.success) {
      void refetch()
    } else {
      console.error('Failed to update exhibition publish state:', result.error)
      alert(result.error?.message || 'Failed to update exhibition.')
    }
  }

  const handleArchive = async (exhibition: AdminExhibition) => {
    const result = await updateDocument('exhibitions', exhibition.id, {
      isPublished: true,
      endDate: Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000)),
    } as UpdateDocument<Exhibition>)
    if (result.success) {
      void refetch()
    } else {
      console.error('Failed to archive exhibition:', result.error)
      alert(result.error?.message || 'Failed to archive exhibition.')
    }
  }

  const publishedCount = exhibitions.filter((exhibition) => exhibition.isPublished !== false).length
  const draftCount = exhibitions.length - publishedCount
  const totalViews = exhibitions.reduce((sum, exhibition) => sum + (exhibition.viewsCount || 0), 0)

  return (
    <AdminLayout>
      <Box px={{ base: 5, md: 10, xl: 16 }} py={8} maxW="1440px" mx="auto">
        <Flex justify="space-between" align={{ base: 'start', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={4} mb={6}>
          <Box>
            <Heading as="h1" size="lg" color="white" mb={2}>
              Exhibitions
            </Heading>
            <Text color="whiteAlpha.600">Manage public exhibitions and draft curations</Text>
          </Box>
          <Button
            onClick={openCreate}
            bg="brand.500"
            color="white"
            borderRadius="full"
            whiteSpace="nowrap"
            w={{ base: 'full', sm: 'auto' }}
            _hover={{ bg: 'brand.600' }}
          >
            <Plus size={18} />
            Create Exhibition
          </Button>
        </Flex>

        <SimpleGrid columns={{ base: 2, lg: 4 }} gap={4} mb={6}>
          <StatCard label="Total" value={exhibitions.length.toString()} />
          <StatCard label="Published" value={publishedCount.toString()} color="green.300" />
          <StatCard label="Drafts" value={draftCount.toString()} color="yellow.300" />
          <StatCard label="Views" value={totalViews.toLocaleString()} />
        </SimpleGrid>

        <Box p={{ base: 3, md: 4 }} borderRadius="2xl" bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" mb={6}>
          <Flex direction={{ base: 'column', lg: 'row' }} justify="space-between" align={{ base: 'stretch', lg: 'center' }} gap={3}>
            <Box position="relative" flex={{ base: '0 0 auto', lg: '1 1 320px' }} w="full" maxW={{ lg: '460px' }}>
              <Box position="absolute" left={4} top="50%" transform="translateY(-50%)" color="whiteAlpha.500">
                <Search size={18} />
              </Box>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search exhibitions..." pl={11} h={11} bg="blackAlpha.300" color="white" borderColor="whiteAlpha.200" borderRadius="full" />
            </Box>
            <HStack gap={2} flexWrap="wrap" justify={{ base: 'start', lg: 'end' }}>
              {STATUS_FILTERS.map((item) => (
                <Button key={item.id} size="sm" onClick={() => setFilter(item.id)} bg={filter === item.id ? 'brand.500' : 'whiteAlpha.50'} color={filter === item.id ? 'white' : 'whiteAlpha.700'} borderRadius="full" _hover={{ bg: filter === item.id ? 'brand.600' : 'whiteAlpha.100' }}>
                  {item.label}
                </Button>
              ))}
            </HStack>
          </Flex>
        </Box>

        {loading && (
          <Flex justify="center" py={16}>
            <Spinner color="brand.500" size="xl" />
          </Flex>
        )}

        {error && (
          <Box p={4} bg="red.500/10" border="1px solid" borderColor="red.500/30" borderRadius="xl" mb={6}>
            <Text color="red.200">{error.message}</Text>
          </Box>
        )}

        {!loading && filteredExhibitions.length === 0 && (
          <Flex minH="220px" align="center" justify="center" bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="2xl">
            <Text color="whiteAlpha.600">No exhibitions found.</Text>
          </Flex>
        )}

        <SimpleGrid columns={{ base: 1, lg: 2, '2xl': 3 }} gap={5}>
          {filteredExhibitions.map((exhibition) => (
            <ExhibitionCard
              key={exhibition.id}
              exhibition={exhibition}
              onEdit={openEdit}
              onDelete={handleDelete}
              onPublishToggle={handlePublishToggle}
              onArchive={handleArchive}
            />
          ))}
        </SimpleGrid>
      </Box>

      {modalMode && (
        <Modal title={modalMode === 'edit' ? 'Edit Exhibition' : 'Create Exhibition'} onClose={closeModal}>
          <form onSubmit={handleSubmit}>
            <ExhibitionFormFields form={form} setForm={setForm} />
            <HStack justify="flex-end" gap={3} mt={6}>
              <Button type="button" onClick={closeModal} bg="whiteAlpha.100" color="white" _hover={{ bg: 'whiteAlpha.200' }}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting} bg="brand.500" color="white" _hover={{ bg: 'brand.600' }}>
                {modalMode === 'edit' ? 'Save Changes' : 'Create Exhibition'}
              </Button>
            </HStack>
          </form>
        </Modal>
      )}
    </AdminLayout>
  )
}

function StatCard({ label, value, color = 'white' }: { label: string; value: string; color?: string }) {
  return (
    <Box p={5} borderRadius="xl" bg="gray.900" border="1px solid" borderColor="whiteAlpha.100">
      <Text color="whiteAlpha.500" fontSize="sm" mb={2}>
        {label}
      </Text>
      <Text color={color} fontSize="2xl" fontWeight="bold">
        {value}
      </Text>
    </Box>
  )
}
