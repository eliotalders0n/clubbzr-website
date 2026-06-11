'use client'

import { useMemo, useState, type FormEvent } from 'react'
import {
  Box,
  Flex,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  SimpleGrid,
  Badge,
  Input,
  Textarea,
  Image,
  Spinner,
} from '@chakra-ui/react'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarDays, MapPin, Pencil, Plus, Search, Trash2, Users } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { useCollection } from '@/hooks'
import { createDocument, deleteDocument, updateDocument } from '../../../lib/firestore'
import type { CreateDocument, Session, SessionStatus, SessionType, UpdateDocument } from '../../../lib/schema'

const MotionBox = motion.create(Box)

type TabFilter = 'upcoming' | 'past'

interface SessionForm {
  title: string
  description: string
  type: SessionType
  status: SessionStatus
  date: string
  time: string
  endTime: string
  location: string
  capacity: string
  facilitator: string
  coverImage: string
  tags: string
}

const emptyForm: SessionForm = {
  title: '',
  description: '',
  type: 'workshop',
  status: 'published',
  date: '',
  time: '18:00',
  endTime: '20:00',
  location: '',
  capacity: '30',
  facilitator: '',
  coverImage: '',
  tags: '',
}

const typeColors: Record<string, { bg: string; color: string }> = {
  workshop: { bg: 'blue.500/20', color: 'blue.200' },
  talk: { bg: 'purple.500/20', color: 'purple.200' },
  exhibition: { bg: 'pink.500/20', color: 'pink.200' },
  open_studio: { bg: 'brand.500/20', color: 'brand.200' },
  critique: { bg: 'orange.500/20', color: 'orange.200' },
  collaboration: { bg: 'green.500/20', color: 'green.200' },
  field_trip: { bg: 'cyan.500/20', color: 'cyan.200' },
  social: { bg: 'whiteAlpha.100', color: 'whiteAlpha.800' },
  online: { bg: 'teal.500/20', color: 'teal.200' },
}

const statusColors: Record<SessionStatus, { bg: string; color: string }> = {
  draft: { bg: 'whiteAlpha.100', color: 'whiteAlpha.700' },
  published: { bg: 'green.500/20', color: 'green.300' },
  cancelled: { bg: 'red.500/20', color: 'red.300' },
  completed: { bg: 'blue.500/20', color: 'blue.300' },
}

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
  if (!date) return 'Not scheduled'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatTime = (value: unknown): string => {
  const date = toDate(value)
  if (!date) return ''
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const toInputDate = (value: unknown): string => {
  const date = toDate(value)
  return date ? date.toISOString().slice(0, 10) : ''
}

const toInputTime = (value: unknown): string => {
  const date = toDate(value)
  return date ? date.toTimeString().slice(0, 5) : ''
}

const toForm = (session: Session): SessionForm => ({
  title: session.title || '',
  description: session.description || '',
  type: session.type || 'workshop',
  status: session.status || 'draft',
  date: toInputDate(session.date),
  time: toInputTime(session.date) || '18:00',
  endTime: toInputTime(session.endDate) || '',
  location: session.location?.name || session.location?.address || '',
  capacity: String(session.capacity || 0),
  facilitator: session.facilitator?.name || '',
  coverImage: session.coverImage || '',
  tags: (session.tags || []).join(', '),
})

const buildDate = (date: string, time: string): Timestamp => {
  const fallback = new Date()
  if (!date) return Timestamp.fromDate(fallback)
  return Timestamp.fromDate(new Date(`${date}T${time || '00:00'}`))
}

const buildPayload = (form: SessionForm, existing?: Session): CreateDocument<Session> | UpdateDocument<Session> => {
  const start = buildDate(form.date, form.time)
  const end = form.endTime ? buildDate(form.date, form.endTime) : undefined
  const isOnline = form.type === 'online' || form.location.toLowerCase().includes('online')
  const coverImage = form.coverImage.trim()
  const duration = end ? Math.max(0, Math.round((end.toMillis() - start.toMillis()) / 60000)) : existing?.duration
  const price = typeof existing?.price === 'number' ? existing.price : undefined

  return {
    title: form.title.trim(),
    description: form.description.trim(),
    shortDescription: form.description.trim().slice(0, 140),
    type: form.type,
    date: start,
    ...(end ? { endDate: end } : {}),
    ...(typeof duration === 'number' ? { duration } : {}),
    location: {
      name: form.location.trim() || (isOnline ? 'Online' : 'TBD'),
      address: form.location.trim(),
    },
    isOnline,
    capacity: Number(form.capacity) || 0,
    attendees: existing?.attendees || [],
    waitlist: existing?.waitlist || [],
    facilitator: {
      userId: existing?.facilitator?.userId || 'admin',
      name: form.facilitator.trim() || 'Club BZR',
    },
    ...(coverImage ? { coverImage } : {}),
    gallery: existing?.gallery || [],
    reflections: existing?.reflections || [],
    status: form.status,
    featured: existing?.featured || false,
    tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    isFree: existing?.isFree ?? true,
    ...(typeof price === 'number' ? { price, currency: existing?.currency || 'USD' } : {}),
  }
}

export default function ManageSessions() {
  const { data, loading, error, refetch } = useCollection('sessions', {
    orderBy: 'date',
    orderDirection: 'desc',
  })
  const [activeTab, setActiveTab] = useState<TabFilter>('upcoming')
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<SessionType | 'all'>('all')
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [detailSession, setDetailSession] = useState<Session | null>(null)
  const [formData, setFormData] = useState<SessionForm>(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  const sessions = useMemo(
    () => [...data].sort((a, b) => toMillis(b.date) - toMillis(a.date)),
    [data]
  )

  const filteredSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return sessions.filter((session) => {
      const isUpcoming = session.status !== 'completed' && session.status !== 'cancelled'
      const matchesTab = activeTab === 'upcoming' ? isUpcoming : !isUpcoming
      const matchesSearch =
        !query ||
        session.title.toLowerCase().includes(query) ||
        session.description.toLowerCase().includes(query) ||
        (session.facilitator?.name || '').toLowerCase().includes(query)
      const matchesType = typeFilter === 'all' || session.type === typeFilter
      return matchesTab && matchesSearch && matchesType
    })
  }, [activeTab, searchQuery, sessions, typeFilter])

  const stats = {
    total: sessions.length,
    published: sessions.filter((session) => session.status === 'published').length,
    draft: sessions.filter((session) => session.status === 'draft').length,
    attendees: sessions.reduce((acc, session) => acc + (session.attendees?.length || 0), 0),
  }

  const openCreate = () => {
    setSelectedSession(null)
    setFormData(emptyForm)
    setModalMode('create')
  }

  const openEdit = (session: Session) => {
    setSelectedSession(session)
    setFormData(toForm(session))
    setModalMode('edit')
  }

  const closeModal = () => {
    setModalMode(null)
    setSelectedSession(null)
    setFormData(emptyForm)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!formData.title.trim()) {
      alert('Session title is required.')
      return
    }

    setSubmitting(true)
    const payload = buildPayload(formData, selectedSession)
    const result = modalMode === 'edit' && selectedSession
      ? await updateDocument('sessions', selectedSession.id, payload as UpdateDocument<Session>)
      : await createDocument('sessions', payload as CreateDocument<Session>)
    setSubmitting(false)

    if (!result.success) {
      alert(result.error?.message || 'Failed to save session.')
      return
    }

    closeModal()
    void refetch()
  }

  const handleDelete = async (session: Session) => {
    if (!window.confirm(`Delete "${session.title}"?`)) return
    const result = await deleteDocument('sessions', session.id)
    if (!result.success) {
      alert(result.error?.message || 'Failed to delete session.')
      return
    }
    void refetch()
  }

  const handleExport = () => {
    const csv = [
      'Title,Type,Status,Date,Facilitator,Capacity,Attendees',
      ...filteredSessions.map((session) => [
        session.title,
        session.type,
        session.status,
        formatDate(session.date),
        session.facilitator?.name || '',
        session.capacity || 0,
        session.attendees?.length || 0,
      ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `club-bzr-sessions-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <AdminLayout>
      <Box px={{ base: 4, md: 8, xl: 12 }} py={{ base: 6, md: 8 }}>
        <Flex direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ base: 'stretch', md: 'center' }} gap={4} mb={8}>
          <Box>
            <Heading as="h1" size="lg" color="white">Sessions</Heading>
            <Text color="whiteAlpha.600" mt={2}>Manage Firestore events, workshops, and gatherings.</Text>
          </Box>
          <HStack gap={3} flexWrap="wrap">
            <Button onClick={handleExport} bg="whiteAlpha.50" color="whiteAlpha.800" border="1px solid" borderColor="whiteAlpha.200" borderRadius="full" _hover={{ bg: 'whiteAlpha.100', color: 'white' }}>
              Export
            </Button>
            <Button onClick={openCreate} bg="brand.500" color="white" borderRadius="full" _hover={{ bg: 'brand.600' }}>
              <Plus size={17} />
              Create Session
            </Button>
          </HStack>
        </Flex>

        <SimpleGrid columns={{ base: 2, md: 4 }} gap={4} mb={8}>
          <Stat label="Total" value={stats.total} />
          <Stat label="Published" value={stats.published} color="green.300" />
          <Stat label="Drafts" value={stats.draft} color="yellow.300" />
          <Stat label="Attendees" value={stats.attendees} color="blue.300" />
        </SimpleGrid>

        <Flex direction={{ base: 'column', lg: 'row' }} gap={4} mb={6} align={{ lg: 'center' }}>
          <Box position="relative" maxW={{ lg: '380px' }} w="full">
            <Box position="absolute" left={4} top="50%" transform="translateY(-50%)" color="whiteAlpha.500">
              <Search size={18} />
            </Box>
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search sessions..." pl={11} bg="gray.900" color="white" borderColor="whiteAlpha.200" borderRadius="full" />
          </Box>
          <HStack gap={2} flexWrap="wrap">
            {(['all', 'workshop', 'talk', 'open_studio', 'critique', 'collaboration', 'field_trip', 'social', 'online'] as const).map((type) => (
              <Button key={type} size="sm" onClick={() => setTypeFilter(type)} bg={typeFilter === type ? 'brand.500' : 'whiteAlpha.50'} color={typeFilter === type ? 'white' : 'whiteAlpha.700'} borderRadius="full" textTransform="capitalize" _hover={{ bg: typeFilter === type ? 'brand.600' : 'whiteAlpha.100' }}>
                {type.replace('_', ' ')}
              </Button>
            ))}
          </HStack>
          <HStack gap={2} ml={{ lg: 'auto' }}>
            {(['upcoming', 'past'] as const).map((tab) => (
              <Button key={tab} size="sm" onClick={() => setActiveTab(tab)} bg={activeTab === tab ? 'brand.500' : 'whiteAlpha.50'} color={activeTab === tab ? 'white' : 'whiteAlpha.700'} borderRadius="full" textTransform="capitalize" _hover={{ bg: activeTab === tab ? 'brand.600' : 'whiteAlpha.100' }}>
                {tab}
              </Button>
            ))}
          </HStack>
        </Flex>

        {loading && (
          <Flex justify="center" py={16}>
            <Spinner color="brand.500" />
          </Flex>
        )}

        {error && (
          <Box p={4} bg="red.500/10" border="1px solid" borderColor="red.500/30" borderRadius="xl" mb={6}>
            <Text color="red.200">{error.message}</Text>
          </Box>
        )}

        {!loading && filteredSessions.length === 0 && (
          <Box bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="2xl" p={12} textAlign="center">
            <CalendarDays size={42} color="rgba(255,255,255,0.35)" />
            <Text color="whiteAlpha.600" mt={4}>No Firestore sessions match these filters.</Text>
            <Button mt={4} onClick={openCreate} bg="brand.500" color="white" borderRadius="full" _hover={{ bg: 'brand.600' }}>Create Session</Button>
          </Box>
        )}

        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap={6}>
          <AnimatePresence mode="popLayout">
            {filteredSessions.map((session, index) => (
              <SessionCard
                key={session.id}
                session={session}
                index={index}
                onView={setDetailSession}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        </SimpleGrid>

        {modalMode && (
          <Modal title={modalMode === 'edit' ? 'Edit Session' : 'Create Session'} onClose={closeModal}>
            <form onSubmit={handleSubmit}>
              <SessionFormFields form={formData} setForm={setFormData} />
              <HStack justify="flex-end" gap={3} mt={6}>
                <Button type="button" onClick={closeModal} bg="whiteAlpha.100" color="white" borderRadius="full" _hover={{ bg: 'whiteAlpha.200' }}>Cancel</Button>
                <Button type="submit" loading={submitting} bg="brand.500" color="white" borderRadius="full" _hover={{ bg: 'brand.600' }}>
                  {modalMode === 'edit' ? 'Save Changes' : 'Create Session'}
                </Button>
              </HStack>
            </form>
          </Modal>
        )}

        {detailSession && (
          <Modal title="Session Details" onClose={() => setDetailSession(null)}>
            <VStack align="stretch" gap={5}>
              {detailSession.coverImage && (
                <Image src={detailSession.coverImage} alt={detailSession.title} borderRadius="xl" maxH="220px" objectFit="cover" />
              )}
              <Box>
                <HStack gap={2} mb={3}>
                  <SessionTypeBadge type={detailSession.type} />
                  <StatusBadge status={detailSession.status} />
                </HStack>
                <Heading as="h2" size="md" color="white">{detailSession.title}</Heading>
                <Text color="whiteAlpha.650" mt={2}>{detailSession.description}</Text>
              </Box>
              <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4}>
                <Info label="Date" value={`${formatDate(detailSession.date)} ${formatTime(detailSession.date)}`} />
                <Info label="Location" value={detailSession.location?.name || 'Not set'} />
                <Info label="Facilitator" value={detailSession.facilitator?.name || 'Not set'} />
                <Info label="Attendance" value={`${detailSession.attendees?.length || 0} / ${detailSession.capacity || 0}`} />
              </SimpleGrid>
              <HStack justify="flex-end" gap={3}>
                <Button onClick={() => setDetailSession(null)} bg="whiteAlpha.100" color="white" borderRadius="full" _hover={{ bg: 'whiteAlpha.200' }}>Close</Button>
                <Button onClick={() => { setDetailSession(null); openEdit(detailSession) }} bg="brand.500" color="white" borderRadius="full" _hover={{ bg: 'brand.600' }}>
                  <Pencil size={16} />
                  Edit
                </Button>
              </HStack>
            </VStack>
          </Modal>
        )}
      </Box>
    </AdminLayout>
  )
}

function Stat({ label, value, color = 'white' }: { label: string; value: number | string; color?: string }) {
  return (
    <Box bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="xl" p={5}>
      <Text color={color} fontSize="2xl" fontWeight="bold">{value}</Text>
      <Text color="whiteAlpha.500" fontSize="xs" mt={1}>{label}</Text>
    </Box>
  )
}

function SessionCard({
  session,
  index,
  onView,
  onEdit,
  onDelete,
}: {
  session: Session
  index: number
  onView: (session: Session) => void
  onEdit: (session: Session) => void
  onDelete: (session: Session) => void
}) {
  return (
    <MotionBox initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ delay: index * 0.04 }} layout>
      <Box bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="2xl" overflow="hidden" role="group" _hover={{ borderColor: 'whiteAlpha.200' }}>
        {session.coverImage ? (
          <Image src={session.coverImage} alt={session.title} w="full" h="160px" objectFit="cover" />
        ) : (
          <Flex h="160px" bg="whiteAlpha.50" align="center" justify="center" color="whiteAlpha.400">
            <CalendarDays size={42} />
          </Flex>
        )}
        <Box p={5}>
          <HStack gap={2} mb={3}>
            <SessionTypeBadge type={session.type} />
            <StatusBadge status={session.status} />
          </HStack>
          <Heading as="h3" size="sm" color="white" lineClamp={1}>{session.title}</Heading>
          <Text color="whiteAlpha.500" fontSize="sm" mt={2} lineClamp={2}>{session.description}</Text>
          <VStack align="stretch" gap={2} mt={4} color="whiteAlpha.600" fontSize="sm">
            <HStack gap={2}><CalendarDays size={15} /><Text>{formatDate(session.date)} {formatTime(session.date)}</Text></HStack>
            <HStack gap={2}><MapPin size={15} /><Text>{session.location?.name || 'Location TBD'}</Text></HStack>
            <HStack gap={2}><Users size={15} /><Text>{session.attendees?.length || 0}/{session.capacity || 0} attendees</Text></HStack>
          </VStack>
          <HStack gap={2} mt={5}>
            <Button flex={1} size="sm" onClick={() => onView(session)} bg="whiteAlpha.50" color="whiteAlpha.800" borderRadius="full" _hover={{ bg: 'whiteAlpha.100', color: 'white' }}>View</Button>
            <Button flex={1} size="sm" onClick={() => onEdit(session)} bg="whiteAlpha.50" color="whiteAlpha.800" borderRadius="full" _hover={{ bg: 'whiteAlpha.100', color: 'white' }}>Edit</Button>
            <Button size="sm" onClick={() => onDelete(session)} bg="red.500/10" color="red.200" borderRadius="full" _hover={{ bg: 'red.500/20' }}>
              <Trash2 size={16} />
            </Button>
          </HStack>
        </Box>
      </Box>
    </MotionBox>
  )
}

function SessionTypeBadge({ type }: { type: SessionType }) {
  const colors = typeColors[type] || { bg: 'whiteAlpha.100', color: 'whiteAlpha.800' }
  return <Badge bg={colors.bg} color={colors.color} borderRadius="full" px={3} py={1} textTransform="capitalize">{type.replace('_', ' ')}</Badge>
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const colors = statusColors[status]
  return <Badge bg={colors.bg} color={colors.color} borderRadius="full" px={3} py={1} textTransform="capitalize">{status}</Badge>
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <Box p={4} bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.100" borderRadius="xl">
      <Text color="whiteAlpha.500" fontSize="xs" textTransform="uppercase" letterSpacing="0.12em">{label}</Text>
      <Text color="white" mt={1}>{value}</Text>
    </Box>
  )
}

function SessionFormFields({ form, setForm }: { form: SessionForm; setForm: React.Dispatch<React.SetStateAction<SessionForm>> }) {
  return (
    <VStack gap={4} align="stretch">
      <Field label="Title"><Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" /></Field>
      <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" rows={4} /></Field>
      <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
        <Field label="Type">
          <select value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as SessionType }))} style={selectStyle}>
            {(['workshop', 'exhibition', 'open_studio', 'critique', 'talk', 'collaboration', 'field_trip', 'social', 'online'] as SessionType[]).map((type) => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as SessionStatus }))} style={selectStyle}>
            {(['draft', 'published', 'completed', 'cancelled'] as SessionStatus[]).map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </Field>
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
        <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" /></Field>
        <Field label="Start"><Input type="time" value={form.time} onChange={(e) => setForm((prev) => ({ ...prev, time: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" /></Field>
        <Field label="End"><Input type="time" value={form.endTime} onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" /></Field>
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
        <Field label="Location"><Input value={form.location} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" /></Field>
        <Field label="Capacity"><Input type="number" value={form.capacity} onChange={(e) => setForm((prev) => ({ ...prev, capacity: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" /></Field>
      </SimpleGrid>
      <Field label="Facilitator"><Input value={form.facilitator} onChange={(e) => setForm((prev) => ({ ...prev, facilitator: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" /></Field>
      <Field label="Cover Image URL"><Input value={form.coverImage} onChange={(e) => setForm((prev) => ({ ...prev, coverImage: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" /></Field>
      <Field label="Tags"><Input value={form.tags} onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" placeholder="workshop, drawing" /></Field>
    </VStack>
  )
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  height: '40px',
  padding: '0 12px',
  backgroundColor: '#1f2937',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: '8px',
  color: 'white',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Text color="whiteAlpha.600" fontSize="sm" mb={2}>{label}</Text>
      {children}
    </Box>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <Flex position="fixed" inset={0} zIndex={80} bg="blackAlpha.700" align="center" justify="center" p={4} onClick={onClose}>
      <MotionBox initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="2xl" maxW="680px" w="full" maxH="calc(100vh - 32px)" overflowY="auto" onClick={(event) => event.stopPropagation()}>
        <Flex justify="space-between" align="center" p={5} borderBottom="1px solid" borderColor="whiteAlpha.100">
          <Heading as="h2" size="sm" color="white">{title}</Heading>
          <Button onClick={onClose} size="sm" bg="whiteAlpha.100" color="white" borderRadius="full" _hover={{ bg: 'whiteAlpha.200' }}>Close</Button>
        </Flex>
        <Box p={5}>{children}</Box>
      </MotionBox>
    </Flex>
  )
}
