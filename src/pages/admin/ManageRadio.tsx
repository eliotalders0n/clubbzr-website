'use client'

import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
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
  Headphones,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Radio,
  Search,
  Trash2,
} from 'lucide-react'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { useCollection } from '@/hooks/useFirestore'
import { createDocument, deleteDocument, updateDocument } from '../../../lib/firestore'
import type {
  CreateDocument,
  RadioContent,
  RadioContentType,
  TracklistItem,
  UpdateDocument,
} from '../../../lib/schema'

const MotionBox = motion.create(Box)

type RadioFilter = 'all' | 'published' | 'draft'

const RADIO_TYPES: RadioContentType[] = [
  'mix',
  'interview',
  'ambient',
  'podcast',
  'live_session',
  'playlist',
]

const TYPE_LABELS: Record<RadioContentType, string> = {
  mix: 'Mix',
  interview: 'Interview',
  ambient: 'Ambient',
  podcast: 'Podcast',
  live_session: 'Live Session',
  playlist: 'Playlist',
}

type RadioForm = {
  title: string
  type: RadioContentType
  audioUrl: string
  duration: string
  description: string
  artistName: string
  artistPhotoURL: string
  coverImage: string
  publishedAt: string
  featured: boolean
  isPublished: boolean
  tags: string
  tracklist: string
}

const emptyForm: RadioForm = {
  title: '',
  type: 'mix',
  audioUrl: '',
  duration: '0',
  description: '',
  artistName: '',
  artistPhotoURL: '',
  coverImage: '',
  publishedAt: '',
  featured: false,
  isPublished: true,
  tags: '',
  tracklist: '',
}

const fallbackCoverImage = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&q=80'

function toMillis(value: RadioContent['publishedAt'] | undefined): number {
  if (!value) return 0
  if (value instanceof Timestamp) return value.toMillis()
  if (typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis()
  }
  return 0
}

function timestampToInput(value: RadioContent['publishedAt'] | undefined): string {
  const millis = toMillis(value)
  if (!millis) return ''
  const date = new Date(millis)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function formatDate(value: RadioContent['publishedAt'] | undefined): string {
  const millis = toMillis(value)
  if (!millis) return 'Not scheduled'
  return new Date(millis).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDuration(seconds = 0): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function parseTime(value: string): number | undefined {
  const parts = value.split(':').map((part) => Number(part.trim()))
  if (parts.some((part) => Number.isNaN(part))) return undefined
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return undefined
}

function parseTracklist(value: string): TracklistItem[] {
  return value
    .split('\n')
    .map((line, index): TracklistItem | null => {
      const [time, artist, title] = line.split('|').map((part) => part.trim())
      if (!artist || !title) return null
      const timestamp = time ? parseTime(time) : undefined
      return {
        position: index + 1,
        artist,
        title,
        ...(timestamp !== undefined ? { timestamp } : {}),
      }
    })
    .filter((track): track is TracklistItem => Boolean(track))
}

function tracklistToText(tracklist?: TracklistItem[]): string {
  return (tracklist || [])
    .map((track) => `${track.timestamp !== undefined ? formatDuration(track.timestamp) : ''}|${track.artist}|${track.title}`)
    .join('\n')
}

function toForm(content?: RadioContent): RadioForm {
  if (!content) return emptyForm

  return {
    title: content.title || '',
    type: content.type || 'mix',
    audioUrl: content.audioUrl || '',
    duration: String(content.duration || 0),
    description: content.description || '',
    artistName: content.artist?.name || '',
    artistPhotoURL: content.artist?.photoURL || '',
    coverImage: content.coverImage || '',
    publishedAt: timestampToInput(content.publishedAt),
    featured: Boolean(content.featured),
    isPublished: content.isPublished !== false,
    tags: (content.tags || []).join(', '),
    tracklist: tracklistToText(content.tracklist),
  }
}

function buildPayload(form: RadioForm, existing?: RadioContent): CreateDocument<RadioContent> {
  const publishedDate = form.publishedAt ? new Date(form.publishedAt) : new Date()
  const artist = form.artistPhotoURL.trim()
    ? { name: form.artistName.trim() || 'Club BZR Radio', photoURL: form.artistPhotoURL.trim() }
    : { name: form.artistName.trim() || 'Club BZR Radio' }

  return {
    title: form.title.trim(),
    type: form.type,
    audioUrl: form.audioUrl.trim(),
    duration: Number(form.duration) || 0,
    description: form.description.trim(),
    artist,
    coverImage: form.coverImage.trim() || fallbackCoverImage,
    publishedAt: Timestamp.fromDate(publishedDate),
    playCount: existing?.playCount || 0,
    likesCount: existing?.likesCount || 0,
    likedBy: existing?.likedBy || [],
    featured: form.featured,
    isPublished: form.isPublished,
    tags: parseTags(form.tags),
    tracklist: parseTracklist(form.tracklist),
  }
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
        maxW="760px"
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

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <Text color="whiteAlpha.600" fontSize="sm" mb={2}>
      {children}
    </Text>
  )
}

function RadioFormFields({
  form,
  setForm,
}: {
  form: RadioForm
  setForm: React.Dispatch<React.SetStateAction<RadioForm>>
}) {
  return (
    <VStack align="stretch" gap={4}>
      <Grid templateColumns={{ base: '1fr', md: '1.3fr 0.7fr' }} gap={4}>
        <Box>
          <FieldLabel>Title</FieldLabel>
          <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" required />
        </Box>
        <Box>
          <FieldLabel>Type</FieldLabel>
          <select
            value={form.type}
            onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as RadioContentType }))}
            className="h-10 w-full rounded-md border border-white/20 bg-gray-800 px-3 text-white"
          >
            {RADIO_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </Box>
      </Grid>

      <Box>
        <FieldLabel>Description</FieldLabel>
        <Textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" rows={4} required />
      </Box>

      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4}>
        <Box>
          <FieldLabel>Audio URL</FieldLabel>
          <Input value={form.audioUrl} onChange={(e) => setForm((prev) => ({ ...prev, audioUrl: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" required />
        </Box>
        <Box>
          <FieldLabel>Duration in seconds</FieldLabel>
          <Input type="number" min={0} value={form.duration} onChange={(e) => setForm((prev) => ({ ...prev, duration: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" required />
        </Box>
      </Grid>

      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4}>
        <Box>
          <FieldLabel>Artist name</FieldLabel>
          <Input value={form.artistName} onChange={(e) => setForm((prev) => ({ ...prev, artistName: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" required />
        </Box>
        <Box>
          <FieldLabel>Artist photo URL</FieldLabel>
          <Input value={form.artistPhotoURL} onChange={(e) => setForm((prev) => ({ ...prev, artistPhotoURL: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" />
        </Box>
      </Grid>

      <Box>
        <FieldLabel>Cover image URL</FieldLabel>
        <Input value={form.coverImage} onChange={(e) => setForm((prev) => ({ ...prev, coverImage: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" />
      </Box>

      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4}>
        <Box>
          <FieldLabel>Published at</FieldLabel>
          <Input type="datetime-local" value={form.publishedAt} onChange={(e) => setForm((prev) => ({ ...prev, publishedAt: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" />
        </Box>
        <Box>
          <FieldLabel>Tags</FieldLabel>
          <Input value={form.tags} onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))} placeholder="mix, studio, interview" bg="gray.800" color="white" borderColor="whiteAlpha.200" />
        </Box>
      </Grid>

      <Box>
        <FieldLabel>Tracklist lines: time|artist|title</FieldLabel>
        <Textarea value={form.tracklist} onChange={(e) => setForm((prev) => ({ ...prev, tracklist: e.target.value }))} placeholder="0:00|Artist|Track title" bg="gray.800" color="white" borderColor="whiteAlpha.200" rows={4} />
      </Box>

      <HStack gap={3} flexWrap="wrap">
        <Button
          type="button"
          onClick={() => setForm((prev) => ({ ...prev, isPublished: !prev.isPublished }))}
          bg={form.isPublished ? 'green.500' : 'whiteAlpha.100'}
          color="white"
          _hover={{ bg: form.isPublished ? 'green.600' : 'whiteAlpha.200' }}
        >
          {form.isPublished ? 'Published' : 'Draft'}
        </Button>
        <Button
          type="button"
          onClick={() => setForm((prev) => ({ ...prev, featured: !prev.featured }))}
          bg={form.featured ? 'brand.500' : 'whiteAlpha.100'}
          color="white"
          _hover={{ bg: form.featured ? 'brand.600' : 'whiteAlpha.200' }}
        >
          {form.featured ? 'Featured' : 'Not Featured'}
        </Button>
      </HStack>
    </VStack>
  )
}

function RadioCard({
  content,
  onEdit,
  onDelete,
  onPublishToggle,
}: {
  content: RadioContent
  onEdit: (content: RadioContent) => void
  onDelete: (content: RadioContent) => void
  onPublishToggle: (content: RadioContent) => void
}) {
  return (
    <MotionBox
      whileHover={{ y: -4 }}
      bg="gray.900"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="2xl"
      overflow="hidden"
    >
      <Grid templateColumns={{ base: '1fr', sm: '120px minmax(0, 1fr)', md: '150px minmax(0, 1fr)' }}>
        <Image src={content.coverImage || fallbackCoverImage} alt={content.title} w="full" h="full" minH={{ base: '180px', sm: '154px' }} objectFit="cover" />
        <Flex direction="column" p={5} gap={3} minW={0}>
          <HStack gap={2} flexWrap="wrap">
            <Badge bg={content.isPublished !== false ? 'green.500' : 'yellow.500'} color={content.isPublished !== false ? 'white' : 'black'} borderRadius="full">
              {content.isPublished !== false ? 'Published' : 'Draft'}
            </Badge>
            <Badge bg="whiteAlpha.100" color="whiteAlpha.800" borderRadius="full">
              {TYPE_LABELS[content.type]}
            </Badge>
            {content.featured && (
              <Badge bg="brand.500" color="white" borderRadius="full">
                Featured
              </Badge>
            )}
          </HStack>

          <Box minW={0}>
            <Heading as="h3" color="white" fontSize="lg" fontFamily="heading" truncate>
              {content.title}
            </Heading>
            <Text color="whiteAlpha.500" fontSize="sm" truncate>
              {content.artist?.name || 'Club BZR Radio'} • {formatDuration(content.duration)}
            </Text>
          </Box>

          <Text color="whiteAlpha.600" fontSize="sm" lineClamp={2}>
            {content.description}
          </Text>

          <Flex justify="space-between" align={{ base: 'start', md: 'center' }} gap={3} direction={{ base: 'column', md: 'row' }} mt="auto">
            <HStack color="whiteAlpha.500" fontSize="xs" gap={4}>
              <HStack gap={1}>
                <Headphones size={14} />
                <Text>{(content.playCount || 0).toLocaleString()}</Text>
              </HStack>
              <Text>{formatDate(content.publishedAt)}</Text>
            </HStack>
            <HStack gap={2}>
              <Button size="sm" onClick={() => onPublishToggle(content)} bg="whiteAlpha.100" color="white" _hover={{ bg: 'whiteAlpha.200' }}>
                {content.isPublished !== false ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                {content.isPublished !== false ? 'Unpublish' : 'Publish'}
              </Button>
              <Button size="sm" onClick={() => onEdit(content)} bg="whiteAlpha.100" color="white" _hover={{ bg: 'whiteAlpha.200' }}>
                <Pencil size={16} />
              </Button>
              <Button size="sm" onClick={() => onDelete(content)} bg="transparent" color="red.300" border="1px solid" borderColor="red.500/50" _hover={{ bg: 'red.500/10' }}>
                <Trash2 size={16} />
              </Button>
            </HStack>
          </Flex>
        </Flex>
      </Grid>
    </MotionBox>
  )
}

export default function ManageRadio() {
  const { data, loading, error, refetch } = useCollection('radioContent', {
    orderBy: 'publishedAt',
    orderDirection: 'desc',
  })
  const [filter, setFilter] = useState<RadioFilter>('all')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<RadioForm>(emptyForm)
  const [editing, setEditing] = useState<RadioContent | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const radioContent = useMemo(
    () => [...data].sort((a, b) => toMillis(b.publishedAt) - toMillis(a.publishedAt)),
    [data]
  )

  const filteredContent = useMemo(() => {
    const query = search.trim().toLowerCase()
    return radioContent.filter((item) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'published' ? item.isPublished !== false : item.isPublished === false)
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        (item.artist?.name || '').toLowerCase().includes(query)
      return matchesFilter && matchesSearch
    })
  }, [filter, radioContent, search])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, publishedAt: timestampToInput(Timestamp.now()) })
    setModalMode('create')
  }

  const openEdit = (content: RadioContent) => {
    setEditing(content)
    setForm(toForm(content))
    setModalMode('edit')
  }

  const closeModal = () => {
    setModalMode(null)
    setEditing(null)
    setForm(emptyForm)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)

    const payload = buildPayload(form, editing || undefined)
    const result = modalMode === 'edit' && editing
      ? await updateDocument('radioContent', editing.id, payload as UpdateDocument<RadioContent>)
      : await createDocument('radioContent', payload)

    setSubmitting(false)

    if (result.success) {
      closeModal()
      void refetch()
    } else {
      console.error('Failed to save radio content:', result.error)
      alert(result.error?.message || 'Failed to save radio content.')
    }
  }

  const handleDelete = async (content: RadioContent) => {
    if (!window.confirm(`Delete "${content.title}"?`)) return
    const result = await deleteDocument('radioContent', content.id)
    if (result.success) {
      void refetch()
    } else {
      console.error('Failed to delete radio content:', result.error)
      alert(result.error?.message || 'Failed to delete radio content.')
    }
  }

  const handlePublishToggle = async (content: RadioContent) => {
    const result = await updateDocument('radioContent', content.id, {
      isPublished: content.isPublished === false,
      publishedAt: content.isPublished !== false ? content.publishedAt : Timestamp.now(),
    })
    if (result.success) {
      void refetch()
    } else {
      console.error('Failed to update publish state:', result.error)
      alert(result.error?.message || 'Failed to update publish state.')
    }
  }

  const publishedCount = radioContent.filter((item) => item.isPublished !== false).length
  const draftCount = radioContent.length - publishedCount
  const totalPlays = radioContent.reduce((sum, item) => sum + (item.playCount || 0), 0)

  return (
    <AdminLayout>
      <Box px={{ base: 5, md: 10, xl: 16 }} py={8} maxW="1440px" mx="auto">
        <Flex justify="space-between" align={{ base: 'start', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={4} mb={6}>
          <Box>
            <Heading as="h1" size="lg" color="white" mb={2}>
              Radio
            </Heading>
            <Text color="whiteAlpha.600">Manage public BZR Radio content</Text>
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
            Add Radio Content
          </Button>
        </Flex>

        <SimpleGrid columns={{ base: 2, lg: 4 }} gap={4} mb={6}>
          <StatCard label="Total" value={radioContent.length.toString()} />
          <StatCard label="Published" value={publishedCount.toString()} color="green.300" />
          <StatCard label="Drafts" value={draftCount.toString()} color="yellow.300" />
          <StatCard label="Plays" value={totalPlays.toLocaleString()} />
        </SimpleGrid>

        <Box p={{ base: 3, md: 4 }} borderRadius="2xl" bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" mb={6}>
          <Flex direction={{ base: 'column', lg: 'row' }} justify="space-between" align={{ base: 'stretch', lg: 'center' }} gap={3}>
            <Box position="relative" flex={{ base: '0 0 auto', lg: '1 1 320px' }} w="full" maxW={{ lg: '460px' }}>
              <Box position="absolute" left={4} top="50%" transform="translateY(-50%)" color="whiteAlpha.500">
                <Search size={18} />
              </Box>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search radio..." pl={11} h={11} bg="blackAlpha.300" color="white" borderColor="whiteAlpha.200" borderRadius="full" />
            </Box>
            <HStack gap={2} flexWrap="wrap" justify={{ base: 'start', lg: 'end' }}>
              {(['all', 'published', 'draft'] as const).map((item) => (
                <Button key={item} size="sm" onClick={() => setFilter(item)} bg={filter === item ? 'brand.500' : 'whiteAlpha.50'} color={filter === item ? 'white' : 'whiteAlpha.700'} borderRadius="full" textTransform="capitalize" _hover={{ bg: filter === item ? 'brand.600' : 'whiteAlpha.100' }}>
                  {item}
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

        {!loading && filteredContent.length === 0 && (
          <Flex minH="220px" align="center" justify="center" bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="2xl">
            <VStack gap={3}>
              <Radio size={36} color="rgba(255,255,255,0.45)" />
              <Text color="whiteAlpha.600">No radio content found.</Text>
            </VStack>
          </Flex>
        )}

        <VStack align="stretch" gap={4}>
          {filteredContent.map((content) => (
            <RadioCard
              key={content.id}
              content={content}
              onEdit={openEdit}
              onDelete={handleDelete}
              onPublishToggle={handlePublishToggle}
            />
          ))}
        </VStack>
      </Box>

      {modalMode && (
        <Modal title={modalMode === 'edit' ? 'Edit Radio Content' : 'Add Radio Content'} onClose={closeModal}>
          <form onSubmit={handleSubmit}>
            <RadioFormFields form={form} setForm={setForm} />
            <HStack justify="flex-end" gap={3} mt={6}>
              <Button type="button" onClick={closeModal} bg="whiteAlpha.100" color="white" _hover={{ bg: 'whiteAlpha.200' }}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting} bg="brand.500" color="white" _hover={{ bg: 'brand.600' }}>
                {modalMode === 'edit' ? 'Save Changes' : 'Create Content'}
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
