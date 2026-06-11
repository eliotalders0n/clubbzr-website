'use client'

import { useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import {
  Box,
  Flex,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Input,
  Textarea,
  Badge,
  SimpleGrid,
  Spinner,
} from '@chakra-ui/react'
import { GeoPoint, Timestamp } from 'firebase/firestore'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Coffee,
  Download,
  Edit3,
  Landmark,
  MapPin,
  Palette,
  Plus,
  Search,
  Star,
  Store,
  Trash2,
  Users,
} from 'lucide-react'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useCollection } from '@/hooks'
import { createDocument, deleteDocument, updateDocument } from '../../../lib/firestore'
import type {
  ArtLocation,
  ArtLocationType,
  CreateDocument,
  UpdateDocument,
} from '../../../lib/schema'

const MotionBox = motion.create(Box)

type LocationStatus = 'all' | 'verified' | 'pending' | 'inactive'
type FeedbackType = 'success' | 'error' | 'info'

interface Feedback {
  type: FeedbackType
  message: string
}

interface LocationForm {
  name: string
  type: ArtLocationType
  address: string
  city: string
  country: string
  neighborhood: string
  description: string
  latitude: string
  longitude: string
  website: string
  thumbnailUrl: string
  tags: string
  verified: boolean
  featured: boolean
  isActive: boolean
}

const LOCATION_TYPES: Array<{ id: ArtLocationType | 'all'; label: string; color: string; icon: typeof MapPin }> = [
  { id: 'all', label: 'All Types', color: 'whiteAlpha', icon: MapPin },
  { id: 'gallery', label: 'Gallery', color: 'purple', icon: Building2 },
  { id: 'museum', label: 'Museum', color: 'blue', icon: Landmark },
  { id: 'studio', label: 'Studio', color: 'cyan', icon: Palette },
  { id: 'street_art', label: 'Street Art', color: 'orange', icon: MapPin },
  { id: 'installation', label: 'Installation', color: 'pink', icon: Star },
  { id: 'pop_up', label: 'Pop Up', color: 'brand', icon: Store },
  { id: 'public_art', label: 'Public Art', color: 'green', icon: Landmark },
  { id: 'cafe', label: 'Cafe', color: 'yellow', icon: Coffee },
  { id: 'community_space', label: 'Community Space', color: 'teal', icon: Users },
  { id: 'other', label: 'Other', color: 'gray', icon: MapPin },
]

const STATUS_OPTIONS: Array<{ id: LocationStatus; label: string }> = [
  { id: 'all', label: 'All Status' },
  { id: 'verified', label: 'Verified' },
  { id: 'pending', label: 'Pending' },
  { id: 'inactive', label: 'Inactive' },
]

const selectStyle: CSSProperties = {
  width: '100%',
  height: '44px',
  padding: '0 14px',
  backgroundColor: '#111111',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: '12px',
  color: 'white',
  outline: 'none',
}

const emptyForm: LocationForm = {
  name: '',
  type: 'gallery',
  address: '',
  city: '',
  country: '',
  neighborhood: '',
  description: '',
  latitude: '',
  longitude: '',
  website: '',
  thumbnailUrl: '',
  tags: '',
  verified: false,
  featured: false,
  isActive: true,
}

const splitList = (value: string): string[] =>
  value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)

const toDate = (value: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate()
  }
  return null
}

const toMillis = (value: unknown): number => toDate(value)?.getTime() || 0

const formatDate = (value: unknown): string => {
  const date = toDate(value)
  if (!date) return 'Not recorded'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const getTypeInfo = (type: ArtLocationType) =>
  LOCATION_TYPES.find((item) => item.id === type) || LOCATION_TYPES[0]

const getLocationStatus = (location: ArtLocation): Exclude<LocationStatus, 'all'> => {
  if (!location.isActive) return 'inactive'
  if (location.verified) return 'verified'
  return 'pending'
}

const locationToForm = (location: ArtLocation): LocationForm => ({
  name: location.name,
  type: location.type,
  address: location.address,
  city: location.city,
  country: location.country,
  neighborhood: location.neighborhood || '',
  description: location.description,
  latitude: String(location.coordinates?.latitude ?? ''),
  longitude: String(location.coordinates?.longitude ?? ''),
  website: location.website || '',
  thumbnailUrl: location.thumbnailUrl || '',
  tags: (location.tags || []).join(', '),
  verified: location.verified,
  featured: location.featured,
  isActive: location.isActive,
})

const buildLocationPayload = (
  form: LocationForm,
  currentUserId: string,
  currentUserName: string,
  existing?: ArtLocation
): CreateDocument<ArtLocation> | UpdateDocument<ArtLocation> => {
  const latitude = Number.parseFloat(form.latitude)
  const longitude = Number.parseFloat(form.longitude)
  const verifiedChanged = existing ? form.verified && !existing.verified : form.verified

  return {
    name: form.name.trim(),
    type: form.type,
    coordinates: new GeoPoint(Number.isFinite(latitude) ? latitude : 0, Number.isFinite(longitude) ? longitude : 0),
    address: form.address.trim(),
    city: form.city.trim(),
    country: form.country.trim(),
    neighborhood: form.neighborhood.trim() || undefined,
    description: form.description.trim(),
    images: existing?.images || [],
    thumbnailUrl: form.thumbnailUrl.trim() || undefined,
    website: form.website.trim() || undefined,
    submittedBy: existing?.submittedBy || currentUserId,
    submittedByName: existing?.submittedByName || currentUserName,
    verified: form.verified,
    verifiedBy: form.verified ? existing?.verifiedBy || currentUserId : undefined,
    verifiedAt: verifiedChanged ? Timestamp.now() : existing?.verifiedAt,
    savedBy: existing?.savedBy || [],
    savesCount: existing?.savesCount || 0,
    visitedBy: existing?.visitedBy || [],
    visitsCount: existing?.visitsCount || 0,
    featured: form.featured,
    tags: splitList(form.tags),
    isActive: form.isActive,
  }
}

function FeedbackBanner({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) return null

  const styles = {
    success: { bg: 'green.500/12', borderColor: 'green.400/30', color: 'green.200', icon: <CheckCircle2 size={18} /> },
    error: { bg: 'red.500/12', borderColor: 'red.400/30', color: 'red.200', icon: <AlertTriangle size={18} /> },
    info: { bg: 'blue.500/12', borderColor: 'blue.400/30', color: 'blue.200', icon: <MapPin size={18} /> },
  }[feedback.type]

  return (
    <HStack
      gap={3}
      p={4}
      mb={6}
      borderRadius="xl"
      bg={styles.bg}
      border="1px solid"
      borderColor={styles.borderColor}
      color={styles.color}
    >
      {styles.icon}
      <Text fontSize="sm" fontWeight="medium">{feedback.message}</Text>
    </HStack>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <Box p={5} borderRadius="xl" bg="gray.900" border="1px solid" borderColor="whiteAlpha.100">
      <Text color="whiteAlpha.500" fontSize="sm" mb={2}>{label}</Text>
      <Text color={accent} fontSize="2xl" fontWeight="bold">{value}</Text>
    </Box>
  )
}

function ModalBackdrop({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <Box position="fixed" inset={0} zIndex={100} display="flex" alignItems="center" justifyContent="center" p={4}>
      <Box position="absolute" inset={0} bg="blackAlpha.800" onClick={onClose} />
      <MotionBox
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        position="relative"
        w="full"
        maxW="760px"
        maxH="90vh"
        overflow="auto"
        p={{ base: 5, md: 7 }}
        borderRadius="2xl"
        bg="gray.950"
        border="1px solid"
        borderColor="whiteAlpha.200"
      >
        <Heading as="h2" fontSize="xl" color="white" mb={5}>{title}</Heading>
        {children}
      </MotionBox>
    </Box>
  )
}

function LocationFormFields({
  form,
  setForm,
  onSubmit,
  onCancel,
  submitLabel,
  isSaving,
}: {
  form: LocationForm
  setForm: (form: LocationForm) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
  submitLabel: string
  isSaving: boolean
}) {
  return (
    <form onSubmit={onSubmit}>
      <VStack align="stretch" gap={4}>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
          <Box>
            <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Name</Text>
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Location name"
              bg="gray.900"
              borderColor="whiteAlpha.200"
              color="white"
              required
            />
          </Box>
          <Box>
            <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Type</Text>
            <select
              style={selectStyle}
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value as ArtLocationType })}
            >
              {LOCATION_TYPES.filter((type) => type.id !== 'all').map((type) => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </select>
          </Box>
        </SimpleGrid>

        <Box>
          <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Description</Text>
          <Textarea
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="Describe the location"
            bg="gray.900"
            borderColor="whiteAlpha.200"
            color="white"
            rows={3}
            required
          />
        </Box>

        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
          <Box>
            <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Address</Text>
            <Input
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
              placeholder="Street address"
              bg="gray.900"
              borderColor="whiteAlpha.200"
              color="white"
              required
            />
          </Box>
          <Box>
            <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Neighborhood</Text>
            <Input
              value={form.neighborhood}
              onChange={(event) => setForm({ ...form, neighborhood: event.target.value })}
              placeholder="Optional"
              bg="gray.900"
              borderColor="whiteAlpha.200"
              color="white"
            />
          </Box>
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
          <Box>
            <Text color="whiteAlpha.600" fontSize="sm" mb={2}>City</Text>
            <Input
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
              bg="gray.900"
              borderColor="whiteAlpha.200"
              color="white"
              required
            />
          </Box>
          <Box>
            <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Country</Text>
            <Input
              value={form.country}
              onChange={(event) => setForm({ ...form, country: event.target.value })}
              bg="gray.900"
              borderColor="whiteAlpha.200"
              color="white"
              required
            />
          </Box>
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
          <Box>
            <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Latitude</Text>
            <Input
              type="number"
              step="any"
              value={form.latitude}
              onChange={(event) => setForm({ ...form, latitude: event.target.value })}
              bg="gray.900"
              borderColor="whiteAlpha.200"
              color="white"
              required
            />
          </Box>
          <Box>
            <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Longitude</Text>
            <Input
              type="number"
              step="any"
              value={form.longitude}
              onChange={(event) => setForm({ ...form, longitude: event.target.value })}
              bg="gray.900"
              borderColor="whiteAlpha.200"
              color="white"
              required
            />
          </Box>
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
          <Box>
            <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Website</Text>
            <Input
              value={form.website}
              onChange={(event) => setForm({ ...form, website: event.target.value })}
              placeholder="https://..."
              bg="gray.900"
              borderColor="whiteAlpha.200"
              color="white"
            />
          </Box>
          <Box>
            <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Thumbnail URL</Text>
            <Input
              value={form.thumbnailUrl}
              onChange={(event) => setForm({ ...form, thumbnailUrl: event.target.value })}
              placeholder="https://..."
              bg="gray.900"
              borderColor="whiteAlpha.200"
              color="white"
            />
          </Box>
        </SimpleGrid>

        <Box>
          <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Tags</Text>
          <Input
            value={form.tags}
            onChange={(event) => setForm({ ...form, tags: event.target.value })}
            placeholder="gallery, mural, workshop"
            bg="gray.900"
            borderColor="whiteAlpha.200"
            color="white"
          />
        </Box>

        <SimpleGrid columns={{ base: 1, md: 3 }} gap={3}>
          {[
            { key: 'verified' as const, label: 'Verified' },
            { key: 'featured' as const, label: 'Featured' },
            { key: 'isActive' as const, label: 'Active' },
          ].map((field) => (
            <Button
              key={field.key}
              type="button"
              bg={form[field.key] ? 'brand.500' : 'transparent'}
              color={form[field.key] ? 'white' : 'whiteAlpha.700'}
              border="1px solid"
              borderColor={form[field.key] ? 'brand.500' : 'whiteAlpha.200'}
              onClick={() => setForm({ ...form, [field.key]: !form[field.key] })}
            >
              {field.label}
            </Button>
          ))}
        </SimpleGrid>

        <HStack justify="flex-end" gap={3} pt={3}>
          <Button type="button" bg="transparent" color="whiteAlpha.800" border="1px solid" borderColor="whiteAlpha.200" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" bg="brand.500" color="white" disabled={isSaving}>
            {isSaving ? 'Saving...' : submitLabel}
          </Button>
        </HStack>
      </VStack>
    </form>
  )
}

function LocationCard({
  location,
  onVerify,
  onDeactivate,
  onRestore,
  onEdit,
  onDelete,
  onToggleFeatured,
}: {
  location: ArtLocation
  onVerify: () => void
  onDeactivate: () => void
  onRestore: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleFeatured: () => void
}) {
  const status = getLocationStatus(location)
  const typeInfo = getTypeInfo(location.type)
  const TypeIcon = typeInfo.icon
  const statusStyle = {
    verified: { bg: 'green.500/15', color: 'green.200', borderColor: 'green.400/40' },
    pending: { bg: 'yellow.500/15', color: 'yellow.200', borderColor: 'yellow.400/40' },
    inactive: { bg: 'whiteAlpha.100', color: 'whiteAlpha.700', borderColor: 'whiteAlpha.200' },
  }[status]

  return (
    <MotionBox
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      p={5}
      borderRadius="2xl"
      bg="gray.900"
      border="1px solid"
      borderColor={location.featured ? 'brand.500/70' : 'whiteAlpha.100'}
    >
      <Flex justify="space-between" align="start" gap={3} mb={4}>
        <HStack gap={3} minW={0}>
          <Box
            w="44px"
            h="44px"
            minW="44px"
            borderRadius="xl"
            bg={`${typeInfo.color}.500/15`}
            color={`${typeInfo.color}.200`}
            display="flex"
            alignItems="center"
            justifyContent="center"
            border="1px solid"
            borderColor={`${typeInfo.color}.400/30`}
          >
            <TypeIcon size={20} />
          </Box>
          <Box minW={0}>
            <Text color="white" fontWeight="semibold">{location.name}</Text>
            <Text color="whiteAlpha.500" fontSize="sm">{location.city}, {location.country}</Text>
          </Box>
        </HStack>
        <HStack gap={2}>
          <Badge bg={statusStyle.bg} color={statusStyle.color} border="1px solid" borderColor={statusStyle.borderColor}>
            {status}
          </Badge>
          {location.featured && (
            <Badge bg="brand.500/15" color="brand.200" border="1px solid" borderColor="brand.400/40">Featured</Badge>
          )}
        </HStack>
      </Flex>

      <Text color="whiteAlpha.700" fontSize="sm" mb={3}>{location.description}</Text>
      <VStack align="stretch" gap={1} color="whiteAlpha.500" fontSize="sm" mb={4}>
        <Text>{location.address}</Text>
        <Text>{location.coordinates?.latitude ?? 0}, {location.coordinates?.longitude ?? 0}</Text>
        <Text>Submitted by {location.submittedByName || 'Unknown'} on {formatDate(location.createdAt)}</Text>
      </VStack>

      <HStack gap={2} flexWrap="wrap">
        {status !== 'verified' && (
          <Button size="sm" bg="green.500" color="white" onClick={onVerify}>
            <CheckCircle2 size={15} />
            Verify
          </Button>
        )}
        {status === 'inactive' ? (
          <Button size="sm" bg="whiteAlpha.100" color="white" onClick={onRestore}>Restore</Button>
        ) : (
          <Button size="sm" bg="transparent" color="orange.300" border="1px solid" borderColor="orange.400/40" onClick={onDeactivate}>
            Deactivate
          </Button>
        )}
        <Button size="sm" bg="transparent" color={location.featured ? 'brand.300' : 'whiteAlpha.800'} border="1px solid" borderColor="whiteAlpha.200" onClick={onToggleFeatured}>
          <Star size={15} fill={location.featured ? 'currentColor' : 'none'} />
          {location.featured ? 'Unfeature' : 'Feature'}
        </Button>
        <Button size="sm" bg="transparent" color="whiteAlpha.800" border="1px solid" borderColor="whiteAlpha.200" onClick={onEdit}>
          <Edit3 size={15} />
          Edit
        </Button>
        <Button size="sm" bg="transparent" color="red.300" border="1px solid" borderColor="red.400/40" onClick={onDelete}>
          <Trash2 size={15} />
          Delete
        </Button>
      </HStack>
    </MotionBox>
  )
}

export default function ManageMap() {
  const { user, firebaseUser } = useAuth()
  const locationsQuery = useCollection('artLocations', { orderBy: 'createdAt', orderDirection: 'desc' })
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<LocationStatus>('all')
  const [typeFilter, setTypeFilter] = useState<ArtLocationType | 'all'>('all')
  const [form, setForm] = useState<LocationForm>(emptyForm)
  const [editingLocation, setEditingLocation] = useState<ArtLocation | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const currentUserId = firebaseUser?.uid || user?.uid || 'admin'
  const currentUserName = user?.displayName || firebaseUser?.displayName || 'Admin'

  const locations = useMemo(
    () => [...locationsQuery.data].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)),
    [locationsQuery.data]
  )

  const stats = useMemo(() => ({
    total: locations.length,
    verified: locations.filter((location) => getLocationStatus(location) === 'verified').length,
    pending: locations.filter((location) => getLocationStatus(location) === 'pending').length,
    inactive: locations.filter((location) => getLocationStatus(location) === 'inactive').length,
    featured: locations.filter((location) => location.featured).length,
  }), [locations])

  const topCities = useMemo(() => {
    const counts = locations.reduce<Record<string, number>>((acc, location) => {
      const city = location.city || 'Unknown'
      acc[city] = (acc[city] || 0) + 1
      return acc
    }, {})
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
  }, [locations])

  const filteredLocations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return locations.filter((location) => {
      const status = getLocationStatus(location)
      const matchesStatus = statusFilter === 'all' || status === statusFilter
      const matchesType = typeFilter === 'all' || location.type === typeFilter
      const matchesSearch =
        !query ||
        location.name.toLowerCase().includes(query) ||
        location.description.toLowerCase().includes(query) ||
        location.city.toLowerCase().includes(query) ||
        location.tags.some((tag) => tag.toLowerCase().includes(query))
      return matchesStatus && matchesType && matchesSearch
    })
  }, [locations, searchQuery, statusFilter, typeFilter])

  const showFeedback = (nextFeedback: Feedback) => {
    setFeedback(nextFeedback)
    window.setTimeout(() => setFeedback(null), 4000)
  }

  const closeModals = () => {
    setIsCreateOpen(false)
    setIsEditOpen(false)
    setEditingLocation(null)
    setForm(emptyForm)
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    const result = await createDocument('artLocations', buildLocationPayload(form, currentUserId, currentUserName) as CreateDocument<ArtLocation>)
    setIsSaving(false)

    if (!result.success) {
      showFeedback({ type: 'error', message: result.error?.message || 'Location could not be created.' })
      return
    }

    closeModals()
    await locationsQuery.refetch()
    showFeedback({ type: 'success', message: 'Location created in Firestore.' })
  }

  const handleEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingLocation) return

    setIsSaving(true)
    const result = await updateDocument(
      'artLocations',
      editingLocation.id,
      buildLocationPayload(form, currentUserId, currentUserName, editingLocation) as UpdateDocument<ArtLocation>
    )
    setIsSaving(false)

    if (!result.success) {
      showFeedback({ type: 'error', message: result.error?.message || 'Location could not be updated.' })
      return
    }

    closeModals()
    await locationsQuery.refetch()
    showFeedback({ type: 'success', message: 'Location updated.' })
  }

  const updateLocation = async (location: ArtLocation, data: UpdateDocument<ArtLocation>, successMessage: string) => {
    const result = await updateDocument('artLocations', location.id, data)
    if (!result.success) {
      showFeedback({ type: 'error', message: result.error?.message || 'Location could not be updated.' })
      return
    }

    await locationsQuery.refetch()
    showFeedback({ type: 'success', message: successMessage })
  }

  const verifyLocation = (location: ArtLocation) => {
    updateLocation(location, {
      verified: true,
      isActive: true,
      verifiedBy: currentUserId,
      verifiedAt: Timestamp.now(),
    }, 'Location verified.')
  }

  const deleteLocation = async (location: ArtLocation) => {
    if (!window.confirm(`Delete "${location.name}"? This cannot be undone.`)) return

    const result = await deleteDocument('artLocations', location.id)
    if (!result.success) {
      showFeedback({ type: 'error', message: result.error?.message || 'Location could not be deleted.' })
      return
    }

    await locationsQuery.refetch()
    showFeedback({ type: 'success', message: 'Location deleted.' })
  }

  const exportCsv = () => {
    const rows = [
      ['Name', 'Type', 'Status', 'City', 'Country', 'Address', 'Latitude', 'Longitude', 'Featured', 'Created'],
      ...filteredLocations.map((location) => [
        location.name,
        location.type,
        getLocationStatus(location),
        location.city,
        location.country,
        location.address,
        String(location.coordinates?.latitude ?? ''),
        String(location.coordinates?.longitude ?? ''),
        location.featured ? 'yes' : 'no',
        formatDate(location.createdAt),
      ]),
    ]

    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `art-locations-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    showFeedback({ type: 'info', message: 'Location export downloaded.' })
  }

  const errorMessage = locationsQuery.error?.message

  return (
    <AdminLayout>
      <Box px={{ base: 5, md: 10, xl: 16 }} py={8} maxW="1440px" mx="auto">
        <Flex justify="space-between" align={{ base: 'start', md: 'center' }} gap={4} flexWrap="wrap" mb={6}>
          <Box>
            <Heading as="h1" size="lg" color="white" mb={2}>Art Map</Heading>
            <Text color="whiteAlpha.600">Manage Firestore locations, verification, and featured map entries.</Text>
          </Box>
          <HStack gap={3}>
            <Button bg="transparent" color="whiteAlpha.800" border="1px solid" borderColor="whiteAlpha.200" onClick={exportCsv}>
              <Download size={17} />
              Export
            </Button>
            <Button
              bg="brand.500"
              color="white"
              onClick={() => {
                setForm(emptyForm)
                setIsCreateOpen(true)
              }}
            >
              <Plus size={17} />
              Add Location
            </Button>
          </HStack>
        </Flex>

        <FeedbackBanner feedback={feedback} />

        {errorMessage && (
          <HStack mb={6} p={4} borderRadius="xl" bg="red.500/12" border="1px solid" borderColor="red.400/30" color="red.200">
            <AlertTriangle size={18} />
            <Text fontSize="sm">{errorMessage}</Text>
          </HStack>
        )}

        <SimpleGrid columns={{ base: 2, lg: 5 }} gap={4} mb={6}>
          <StatCard label="Total Locations" value={stats.total} accent="white" />
          <StatCard label="Verified" value={stats.verified} accent="green.300" />
          <StatCard label="Pending" value={stats.pending} accent="yellow.300" />
          <StatCard label="Inactive" value={stats.inactive} accent="whiteAlpha.800" />
          <StatCard label="Featured" value={stats.featured} accent="brand.300" />
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={5} mb={6}>
          <Box p={5} borderRadius="2xl" bg="gray.900" border="1px solid" borderColor="whiteAlpha.100">
            <Text color="white" fontWeight="semibold" mb={4}>Location Coverage</Text>
            {topCities.length === 0 ? (
              <Text color="whiteAlpha.500" fontSize="sm">No city data yet.</Text>
            ) : (
              <VStack align="stretch" gap={3}>
                {topCities.map(([city, count]) => (
                  <Flex key={city} justify="space-between" color="whiteAlpha.700">
                    <Text>{city}</Text>
                    <Text>{count}</Text>
                  </Flex>
                ))}
              </VStack>
            )}
          </Box>

          <Box p={5} borderRadius="2xl" bg="gray.900" border="1px solid" borderColor="whiteAlpha.100">
            <Text color="white" fontWeight="semibold" mb={4}>Type Mix</Text>
            <HStack gap={2} flexWrap="wrap">
              {LOCATION_TYPES.filter((type) => type.id !== 'all').map((type) => {
                const count = locations.filter((location) => location.type === type.id).length
                if (!count) return null
                return (
                  <Badge key={type.id} bg={`${type.color}.500/15`} color={`${type.color}.200`} border="1px solid" borderColor={`${type.color}.400/30`}>
                    {type.label}: {count}
                  </Badge>
                )
              })}
            </HStack>
          </Box>
        </SimpleGrid>

        <Box p={4} borderRadius="2xl" bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" mb={6}>
          <Flex gap={3} align="center" flexWrap="wrap">
            <Box position="relative" flex="1 1 260px">
              <Box position="absolute" left={3} top="50%" transform="translateY(-50%)" color="whiteAlpha.400">
                <Search size={18} />
              </Box>
              <Input
                pl={10}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search locations..."
                bg="blackAlpha.300"
                borderColor="whiteAlpha.200"
                color="white"
              />
            </Box>

            <Box flex="0 1 180px">
              <select
                style={selectStyle}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as LocationStatus)}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status.id} value={status.id}>{status.label}</option>
                ))}
              </select>
            </Box>

            <Box flex="0 1 220px">
              <select
                style={selectStyle}
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as ArtLocationType | 'all')}
              >
                {LOCATION_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </select>
            </Box>
          </Flex>
        </Box>

        {locationsQuery.loading ? (
          <Flex justify="center" align="center" minH="240px">
            <Spinner color="brand.400" size="lg" />
          </Flex>
        ) : filteredLocations.length === 0 ? (
          <Box p={12} textAlign="center" borderRadius="2xl" bg="gray.900" border="1px solid" borderColor="whiteAlpha.100">
            <Text color="whiteAlpha.600">No locations match the current filters.</Text>
          </Box>
        ) : (
          <SimpleGrid columns={{ base: 1, xl: 2 }} gap={5}>
            {filteredLocations.map((location) => (
              <LocationCard
                key={location.id}
                location={location}
                onVerify={() => verifyLocation(location)}
                onDeactivate={() => updateLocation(location, { isActive: false }, 'Location deactivated.')}
                onRestore={() => updateLocation(location, { isActive: true }, 'Location restored.')}
                onToggleFeatured={() => updateLocation(location, { featured: !location.featured }, location.featured ? 'Location removed from featured.' : 'Location featured.')}
                onEdit={() => {
                  setEditingLocation(location)
                  setForm(locationToForm(location))
                  setIsEditOpen(true)
                }}
                onDelete={() => deleteLocation(location)}
              />
            ))}
          </SimpleGrid>
        )}
      </Box>

      <AnimatePresence>
        {isCreateOpen && (
          <ModalBackdrop title="Add Location" onClose={closeModals}>
            <LocationFormFields
              form={form}
              setForm={setForm}
              onSubmit={handleCreate}
              onCancel={closeModals}
              submitLabel="Add Location"
              isSaving={isSaving}
            />
          </ModalBackdrop>
        )}

        {isEditOpen && editingLocation && (
          <ModalBackdrop title="Edit Location" onClose={closeModals}>
            <LocationFormFields
              form={form}
              setForm={setForm}
              onSubmit={handleEdit}
              onCancel={closeModals}
              submitLabel="Save Changes"
              isSaving={isSaving}
            />
          </ModalBackdrop>
        )}
      </AnimatePresence>
    </AdminLayout>
  )
}
