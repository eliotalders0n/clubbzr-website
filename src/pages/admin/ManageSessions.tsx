'use client'

import { useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
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
  Menu,
  Portal,
} from '@chakra-ui/react'
import { motion, AnimatePresence } from 'framer-motion'
import { BadgeCheck, CalendarDays, CheckCircle2, CreditCard, ImagePlus, Link as LinkIcon, MapPin, MessageCircle, MoreHorizontal, Pencil, Plus, RotateCcw, Search, Send, Trash2, UserRoundMinus, Users, X } from 'lucide-react'
import { GeoPoint, Timestamp, arrayRemove, arrayUnion } from 'firebase/firestore'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { LocationPicker, type LocationPickerValue } from '@/components/map'
import { useAuth } from '@/contexts/AuthContext'
import { useCollection } from '@/hooks'
import { sendSessionConfirmationWhatsApp } from '../../../lib/adminNotifications'
import { recordPaymentReturn } from '../../../lib/adminPayments'
import { createDocument, createDocumentWithId, deleteDocument, updateDocument } from '../../../lib/firestore'
import { getRegistrationCounts, getSessionRegistrationId, getUserWhatsAppPhone, normalizeSessionRegistrationConfig, updateSessionRegistration } from '../../../lib/sessionRegistrations'
import { STORAGE_PATHS, uploadFileSimple, validateFile } from '../../../lib/storage'
import type {
  CreateDocument,
  ArtLocation,
  GalleryItem,
  Session,
  SessionAccessMode,
  SessionApprovalMode,
  SessionPaymentMode,
  SessionPaymentProvider,
  SessionRegistration,
  SessionRegistrationPaymentStatus,
  SessionRegistrationStatus,
  SessionStatus,
  SessionType,
  UpdateDocument,
  User as FirestoreUser,
} from '../../../lib/schema'

const MotionBox = motion.create(Box)

type TabFilter = 'upcoming' | 'past'
type RegistrationQueueTab = 'all' | 'pending' | 'declined' | 'completed' | 'waitlist'

interface SessionForm {
  title: string
  description: string
  about: string
  type: SessionType
  status: SessionStatus
  date: string
  time: string
  endTime: string
  location: string
  locationAddress: string
  locationCity: string
  locationLatitude: number | null
  locationLongitude: number | null
  locationArtLocationId?: string
  locationSource: 'art_location' | 'custom'
  showOnCommunityMap: boolean
  capacity: string
  accessMode: SessionAccessMode
  paymentMode: SessionPaymentMode
  paymentProvider: SessionPaymentProvider
  approvalMode: SessionApprovalMode
  price: string
  currency: string
  paymentInstructions: string
  facilitator: string
  coverImage: string
  gallery: GalleryItem[]
  tags: string
}

interface SignupPerson {
  id: string
  displayName: string
  email: string
  photoURL?: string | null
  role?: string
}

const emptyForm: SessionForm = {
  title: '',
  description: '',
  about: '',
  type: 'workshop',
  status: 'published',
  date: '',
  time: '18:00',
  endTime: '20:00',
  location: '',
  locationAddress: '',
  locationCity: 'Lusaka',
  locationLatitude: null,
  locationLongitude: null,
  locationArtLocationId: undefined,
  locationSource: 'custom',
  showOnCommunityMap: true,
  capacity: '30',
  accessMode: 'open',
  paymentMode: 'free',
  paymentProvider: 'none',
  approvalMode: 'auto',
  price: '',
  currency: 'ZMW',
  paymentInstructions: '',
  facilitator: '',
  coverImage: '',
  gallery: [],
  tags: '',
}

const registrationStatusLabels: Record<SessionRegistrationStatus, string> = {
  requested: 'Requested',
  pending_payment: 'Pending Payment',
  paid_pending_confirmation: 'Paid, Needs Confirmation',
  confirmed: 'Confirmed',
  waitlisted: 'Waitlist',
  declined: 'Declined',
  cancelled: 'Cancelled',
}

const paymentStatusLabels: Record<SessionRegistrationPaymentStatus, string> = {
  not_required: 'No Payment Required',
  unpaid: 'Unpaid',
  pending: 'Payment Pending',
  paid_online: 'Paid Online',
  paid_external: 'Paid Externally',
  refunded: 'Refunded',
  waived: 'Exempt',
  failed: 'Failed',
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

const sessionTypes: Array<SessionType | 'all'> = [
  'all',
  'workshop',
  'talk',
  'open_studio',
  'critique',
  'collaboration',
  'field_trip',
  'social',
  'online',
]

const actionButtonProps = {
  h: '44px',
  px: 5,
  borderRadius: 'full',
  fontSize: 'sm',
  fontWeight: 'semibold',
  lineHeight: '1',
  whiteSpace: 'nowrap',
} as const

const filterButtonProps = {
  h: '40px',
  px: 4,
  minW: 'max-content',
  borderRadius: 'full',
  fontSize: 'sm',
  fontWeight: 'semibold',
  lineHeight: '1',
  whiteSpace: 'nowrap',
} as const

const filterSelectStyle: React.CSSProperties = {
  width: '100%',
  height: '46px',
  padding: '0 16px',
  backgroundColor: 'rgba(0,0,0,0.22)',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: '12px',
  color: 'white',
  outline: 'none',
}

const getWhatsAppConfirmationState = (registration: SessionRegistration) => {
  if (registration.confirmationWhatsAppDeliveryFailedAt || registration.confirmationWhatsAppFailedAt) {
    return { label: 'WhatsApp failed', bg: 'red.500/15', color: 'red.200' }
  }

  if (registration.confirmationWhatsAppReadAt) {
    return { label: 'WhatsApp read', bg: 'green.500/15', color: 'green.200' }
  }

  if (registration.confirmationWhatsAppDeliveredAt) {
    return { label: 'WhatsApp delivered', bg: 'green.500/15', color: 'green.200' }
  }

  if (registration.confirmationWhatsAppDeliveryStatus === 'sent') {
    return { label: 'WhatsApp sent', bg: 'green.500/15', color: 'green.200' }
  }

  if (registration.confirmationWhatsAppSentAt) {
    return { label: 'WhatsApp accepted', bg: 'blue.500/15', color: 'blue.200' }
  }

  if (registration.confirmationWhatsAppSkippedAt) {
    return { label: 'WhatsApp skipped', bg: 'orange.500/15', color: 'orange.200' }
  }

  if (registration.status === 'confirmed') {
    return { label: 'WhatsApp pending', bg: 'blue.500/15', color: 'blue.200' }
  }

  return null
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

const formatDateTime = (value: unknown): string => {
  const date = toDate(value)
  if (!date) return 'Not recorded'
  return `${formatDate(date)} ${formatTime(date)}`
}

const getClientErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

const toInputDate = (value: unknown): string => {
  const date = toDate(value)
  return date ? date.toISOString().slice(0, 10) : ''
}

const toInputTime = (value: unknown): string => {
  const date = toDate(value)
  return date ? date.toTimeString().slice(0, 5) : ''
}

const buildUserDirectory = (users: FirestoreUser[]): Map<string, FirestoreUser> => {
  const directory = new Map<string, FirestoreUser>()

  users.forEach((user) => {
    if (user.id) directory.set(user.id, user)
    if (user.uid) directory.set(user.uid, user)
  })

  return directory
}

const resolveSignupPeople = (
  ids: string[] | undefined,
  usersById: Map<string, FirestoreUser>
): SignupPerson[] => {
  return (ids || []).map((id) => {
    const user = usersById.get(id)

    return {
      id,
      displayName: user?.displayName || 'Unknown user',
      email: user?.email || '',
      photoURL: user?.photoURL,
      role: user?.role,
    }
  })
}

const formatSignupNames = (ids: string[] | undefined, usersById: Map<string, FirestoreUser>): string => {
  return resolveSignupPeople(ids, usersById)
    .map((person) => person.displayName)
    .join('; ')
}

const formatSignupEmails = (ids: string[] | undefined, usersById: Map<string, FirestoreUser>): string => {
  return resolveSignupPeople(ids, usersById)
    .map((person) => person.email || person.id)
    .join('; ')
}

const getSessionRegistrations = (
  registrationsBySessionId: Map<string, SessionRegistration[]>,
  sessionId: string
): SessionRegistration[] => registrationsBySessionId.get(sessionId) || []

const getSessionConfirmedCount = (
  session: Session,
  registrationsBySessionId: Map<string, SessionRegistration[]>
): number => {
  const registrations = getSessionRegistrations(registrationsBySessionId, session.id)
  return registrations.length > 0
    ? getRegistrationCounts(registrations).confirmed
    : session.attendees?.length || 0
}

const getSessionWaitlistCount = (
  session: Session,
  registrationsBySessionId: Map<string, SessionRegistration[]>
): number => {
  const registrations = getSessionRegistrations(registrationsBySessionId, session.id)
  return registrations.length > 0
    ? getRegistrationCounts(registrations).waitlisted
    : session.waitlist?.length || 0
}

const formatRegistrationPeople = (
  registrations: SessionRegistration[],
  status: SessionRegistrationStatus,
  field: 'displayName' | 'email'
): string => registrations
  .filter((registration) => registration.status === status)
  .map((registration) => registration[field] || registration.userId)
  .join('; ')

const adminAddRegistrationStatuses: SessionRegistrationStatus[] = [
  'requested',
  'pending_payment',
  'paid_pending_confirmation',
  'confirmed',
  'waitlisted',
]

const getAdminAddPaymentStatus = (
  session: Session,
  status: SessionRegistrationStatus
): SessionRegistrationPaymentStatus => {
  const config = normalizeSessionRegistrationConfig(session)
  if (config.paymentMode !== 'paid') return 'not_required'
  if (status === 'paid_pending_confirmation' || status === 'confirmed') return 'paid_external'
  return 'unpaid'
}

const toForm = (session: Session): SessionForm => ({
  title: session.title || '',
  description: session.description || '',
  about: session.about || '',
  type: session.type || 'workshop',
  status: session.status || 'draft',
  date: toInputDate(session.date),
  time: toInputTime(session.date) || '18:00',
  endTime: toInputTime(session.endDate) || '',
  location: session.location?.name || session.location?.address || '',
  locationAddress: session.location?.address || '',
  locationCity: session.location?.city || 'Lusaka',
  locationLatitude: session.location?.coordinates?.latitude ?? null,
  locationLongitude: session.location?.coordinates?.longitude ?? null,
  locationArtLocationId: session.location?.artLocationId,
  locationSource: session.location?.source || (session.location?.artLocationId ? 'art_location' : 'custom'),
  showOnCommunityMap: session.location?.showOnCommunityMap ?? true,
  capacity: String(session.capacity || 0),
  accessMode: session.accessMode || 'open',
  paymentMode: session.paymentMode || (session.isFree === false || (session.price && session.price > 0) ? 'paid' : 'free'),
  paymentProvider: session.paymentProvider || (session.isFree === false || (session.price && session.price > 0) ? 'manual_external' : 'none'),
  approvalMode: session.approvalMode || (session.isFree === false || (session.price && session.price > 0) ? 'manual' : 'auto'),
  price: typeof session.price === 'number' && session.price > 0 ? String(session.price) : '',
  currency: session.currency || 'ZMW',
  paymentInstructions: session.paymentInstructions || '',
  facilitator: session.facilitator?.name || '',
  coverImage: session.coverImage || '',
  gallery: session.gallery || [],
  tags: (session.tags || []).join(', '),
})

const buildDate = (date: string, time: string): Timestamp => {
  const fallback = new Date()
  if (!date) return Timestamp.fromDate(fallback)
  return Timestamp.fromDate(new Date(`${date}T${time || '00:00'}`))
}

const buildPayload = (
  form: SessionForm,
  existing?: Session,
  currentUserId?: string
): CreateDocument<Session> | UpdateDocument<Session> => {
  const start = buildDate(form.date, form.time)
  const end = form.endTime ? buildDate(form.date, form.endTime) : undefined
  const isOnline = form.type === 'online' || form.location.toLowerCase().includes('online')
  const coverImage = form.coverImage.trim()
  const duration = end ? Math.max(0, Math.round((end.toMillis() - start.toMillis()) / 60000)) : existing?.duration
  const price = Number(form.price)
  const isPaid = form.paymentMode === 'paid'
  const currency = form.currency.trim().toUpperCase() || 'ZMW'

  return {
    title: form.title.trim(),
    description: form.description.trim(),
    shortDescription: form.description.trim().slice(0, 140),
    about: form.about.trim(),
    type: form.type,
    date: start,
    ...(end ? { endDate: end } : {}),
    ...(typeof duration === 'number' ? { duration } : {}),
    location: {
      name: form.location.trim() || (isOnline ? 'Online' : 'TBD'),
      address: form.locationAddress.trim() || form.location.trim(),
      city: form.locationCity.trim() || 'Lusaka',
      ...(form.locationLatitude !== null && form.locationLongitude !== null
        ? { coordinates: new GeoPoint(form.locationLatitude, form.locationLongitude) }
        : {}),
      ...(form.locationArtLocationId ? { artLocationId: form.locationArtLocationId } : {}),
      source: form.locationSource,
      showOnCommunityMap: form.showOnCommunityMap,
      visibility: 'public',
    },
    isOnline,
    capacity: Number(form.capacity) || 0,
    accessMode: form.accessMode,
    paymentMode: form.paymentMode,
    paymentProvider: isPaid ? form.paymentProvider : 'none',
    approvalMode: form.approvalMode,
    paymentInstructions: form.paymentInstructions.trim(),
    attendees: existing?.attendees || [],
    waitlist: existing?.waitlist || [],
    facilitator: {
      userId: existing?.facilitator?.userId || currentUserId || 'admin',
      name: form.facilitator.trim() || 'Club BZR',
    },
    coverImage,
    gallery: form.gallery,
    reflections: existing?.reflections || [],
    status: form.status,
    featured: existing?.featured || false,
    tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    isFree: !isPaid,
    price: isPaid && Number.isFinite(price) ? price : 0,
    currency,
  }
}

export default function ManageSessions() {
  const { firebaseUser } = useAuth()
  const { data, loading, error, refetch } = useCollection('sessions', {
    orderBy: 'date',
    orderDirection: 'desc',
  })
  const {
    data: userDocs,
    loading: usersLoading,
  } = useCollection('users', {
    orderBy: 'displayName',
    orderDirection: 'asc',
  })
  const { data: artLocations } = useCollection('artLocations', {
    where: [{ field: 'isActive', operator: '==', value: true }],
  })
  const {
    data: registrations,
    loading: registrationsLoading,
    error: registrationsError,
    refetch: refetchRegistrations,
  } = useCollection('sessionRegistrations', {
    orderBy: 'createdAt',
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
  const [resendingWhatsAppId, setResendingWhatsAppId] = useState<string | null>(null)
  const [reversingRegistrationId, setReversingRegistrationId] = useState<string | null>(null)

  const sessions = useMemo(
    () => [...data].sort((a, b) => toMillis(b.date) - toMillis(a.date)),
    [data]
  )

  const usersById = useMemo(() => buildUserDirectory(userDocs), [userDocs])
  const registrationsBySessionId = useMemo(() => {
    return registrations.reduce<Map<string, SessionRegistration[]>>((map, registration) => {
      const existing = map.get(registration.sessionId) || []
      existing.push(registration)
      map.set(registration.sessionId, existing)
      return map
    }, new Map())
  }, [registrations])

  const filteredSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return sessions.filter((session) => {
      const isUpcoming = session.status !== 'completed' && session.status !== 'cancelled'
      const matchesTab = activeTab === 'upcoming' ? isUpcoming : !isUpcoming
      const matchesSearch =
        !query ||
        session.title.toLowerCase().includes(query) ||
        session.description.toLowerCase().includes(query) ||
        (session.about || '').toLowerCase().includes(query) ||
        (session.facilitator?.name || '').toLowerCase().includes(query)
      const matchesType = typeFilter === 'all' || session.type === typeFilter
      return matchesTab && matchesSearch && matchesType
    })
  }, [activeTab, searchQuery, sessions, typeFilter])

  const stats = {
    total: sessions.length,
    published: sessions.filter((session) => session.status === 'published').length,
    draft: sessions.filter((session) => session.status === 'draft').length,
    attendees: sessions.reduce((acc, session) => acc + getSessionConfirmedCount(session, registrationsBySessionId), 0),
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
    const isInPerson = formData.type !== 'online'
    if (isInPerson && formData.status === 'published' && (
      formData.locationLatitude === null || formData.locationLongitude === null
    )) {
      alert('Place the session on the map before publishing it.')
      return
    }

    setSubmitting(true)
    const payload = buildPayload(formData, selectedSession, firebaseUser?.uid)
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

  const handleRegistrationUpdate = async (
    registration: SessionRegistration,
    patch: UpdateDocument<SessionRegistration>
  ) => {
    const result = await updateSessionRegistration(registration.id, patch)
    if (!result.success) {
      alert(result.error?.message || 'Failed to update registration.')
      return false
    }
    void refetchRegistrations()
    return true
  }

  const handleMarkPaid = (registration: SessionRegistration) => {
    void handleRegistrationUpdate(registration, {
      status: registration.status === 'pending_payment' ? 'paid_pending_confirmation' : registration.status,
      paymentStatus: 'paid_external',
      paymentMethod: registration.paymentMethod || 'bank_transfer',
      paidAt: Timestamp.now(),
    })
  }

  const handleAddRegistration = async (
    session: Session,
    targetUser: FirestoreUser,
    status: SessionRegistrationStatus,
    paymentStatus: SessionRegistrationPaymentStatus,
    whatsappPhone?: string
  ) => {
    const userId = targetUser.uid || targetUser.id

    if (!userId) {
      alert('This user does not have an account ID.')
      return false
    }

    const existingRegistration = registrations.some((registration) =>
      registration.sessionId === session.id && registration.userId === userId
    )

    if (existingRegistration) {
      alert('This user already has a registration for this session.')
      return false
    }

    const savedWhatsAppPhone = whatsappPhone?.trim() || getUserWhatsAppPhone(targetUser)
    if (!savedWhatsAppPhone) {
      alert('Add a WhatsApp number before creating this registration.')
      return false
    }

    const now = Timestamp.now()
    const result = await createDocumentWithId(
      'sessionRegistrations',
      getSessionRegistrationId(session.id, userId),
      {
        sessionId: session.id,
        userId,
        displayName: targetUser.displayName || targetUser.email || 'Club BZR member',
        email: targetUser.email || '',
        whatsappPhone: savedWhatsAppPhone,
        phone: targetUser.phone?.trim() || savedWhatsAppPhone,
        photoURL: targetUser.photoURL || null,
        status,
        paymentStatus,
        ...(paymentStatus === 'paid_external' ? { paymentMethod: 'bank_transfer' as const } : {}),
        requestedAt: now,
        ...(status === 'confirmed' ? { confirmedAt: now, confirmedBy: firebaseUser?.uid || 'admin' } : {}),
        ...(paymentStatus === 'paid_external' ? { paidAt: now } : {}),
        ...(typeof session.price === 'number' && session.price > 0 ? { paymentAmount: session.price } : {}),
        paymentCurrency: session.currency || 'ZMW',
      }
    )

    if (!result.success) {
      alert(result.error?.message || 'Failed to add this registration.')
      return false
    }

    if (status === 'confirmed') {
      await updateDocument('sessions', session.id, {
        attendees: arrayUnion(userId) as unknown as string[],
        waitlist: arrayRemove(userId) as unknown as string[],
      })
    }

    if (status === 'waitlisted') {
      await updateDocument('sessions', session.id, {
        attendees: arrayRemove(userId) as unknown as string[],
        waitlist: arrayUnion(userId) as unknown as string[],
      })
    }

    await refetchRegistrations()
    await refetch()
    return true
  }

  const handleConfirmRegistration = (registration: SessionRegistration, markPaid = false) => {
    void (async () => {
      const success = await handleRegistrationUpdate(registration, {
      status: 'confirmed',
      ...(markPaid ? { paymentStatus: 'paid_external' as const, paidAt: Timestamp.now() } : {}),
      confirmedAt: Timestamp.now(),
      confirmedBy: firebaseUser?.uid || 'admin',
    })
      if (!success) return

      await updateDocument('sessions', registration.sessionId, {
        attendees: arrayUnion(registration.userId) as unknown as string[],
        waitlist: arrayRemove(registration.userId) as unknown as string[],
      })
      void refetch()
    })()
  }

  const handleExemptRegistration = (registration: SessionRegistration) => {
    const reason = window.prompt(
      `Why is ${registration.displayName} exempt from payment? This will be saved in the registration record.`
    )?.trim()

    if (!reason) return

    void (async () => {
      const now = Timestamp.now()
      const success = await handleRegistrationUpdate(registration, {
        status: 'confirmed',
        paymentStatus: 'waived',
        paymentWaivedAt: now,
        paymentWaivedBy: firebaseUser?.uid || 'admin',
        paymentWaiverReason: reason,
        confirmedAt: now,
        confirmedBy: firebaseUser?.uid || 'admin',
      })
      if (!success) return

      await updateDocument('sessions', registration.sessionId, {
        attendees: arrayUnion(registration.userId) as unknown as string[],
        waitlist: arrayRemove(registration.userId) as unknown as string[],
      })
      void refetch()
    })()
  }

  const handleWaitlistRegistration = (registration: SessionRegistration) => {
    void (async () => {
      const success = await handleRegistrationUpdate(registration, {
        status: 'waitlisted',
      })
      if (!success) return

      await updateDocument('sessions', registration.sessionId, {
        attendees: arrayRemove(registration.userId) as unknown as string[],
        waitlist: arrayUnion(registration.userId) as unknown as string[],
      })
      void refetch()
    })()
  }

  const handleDeclineRegistration = (registration: SessionRegistration) => {
    void (async () => {
      const success = await handleRegistrationUpdate(registration, {
        status: 'declined',
        declinedAt: Timestamp.now(),
        declinedBy: firebaseUser?.uid || 'admin',
      })
      if (!success) return

      await updateDocument('sessions', registration.sessionId, {
        attendees: arrayRemove(registration.userId) as unknown as string[],
        waitlist: arrayRemove(registration.userId) as unknown as string[],
      })
      void refetch()
    })()
  }

  const handleReverseRegistrationPayment = (registration: SessionRegistration) => {
    void (async () => {
      const amount = Number(registration.paymentAmount || 0)
      if (!Number.isFinite(amount) || amount <= 0) {
        alert('This registration does not have a valid paid amount to reverse.')
        return
      }

      if (!window.confirm(
        `Create a pending return of ${registration.paymentCurrency || 'ZMW'} ${amount.toFixed(2)} for ${registration.displayName}?`
      )) return

      setReversingRegistrationId(registration.id)
      try {
        const method = registration.paymentMethod === 'cash' ||
          registration.paymentMethod === 'bank_transfer' ||
          registration.paymentMethod === 'mobile_money' ||
          registration.paymentMethod === 'card'
          ? registration.paymentMethod
          : 'other'
        const result = await recordPaymentReturn({
          sessionId: registration.sessionId,
          registrationId: registration.id,
          transactionId: registration.paymentStatus === 'paid_online'
            ? registration.paymentTransactionId
            : undefined,
          reference: registration.paymentStatus === 'paid_online'
            ? registration.paymentReference
            : undefined,
          amount,
          currency: registration.paymentCurrency || 'ZMW',
          method,
          reason: `Payment reversal for ${registrationStatusLabels[registration.status].toLowerCase()} registration`,
          status: 'pending',
          origin: 'cancelled_registration',
          notes: `Created from the ${registrationStatusLabels[registration.status]} registration queue.`,
        })
        await refetchRegistrations()
        alert(result.message || 'Pending return created. Complete it in Payments → Returns after the funds are sent.')
      } catch (returnError) {
        alert(getClientErrorMessage(returnError, 'Failed to create the payment return.'))
      } finally {
        setReversingRegistrationId(null)
      }
    })()
  }

  const handleRetryWhatsApp = (registration: SessionRegistration) => {
    void (async () => {
      setResendingWhatsAppId(registration.id)

      try {
        const result = await sendSessionConfirmationWhatsApp({
          registrationId: registration.id,
          force: true,
        })

        await refetchRegistrations()

        if (result.status === 'sent') {
          alert('WhatsApp confirmation sent.')
          return
        }

        alert(result.reason || 'WhatsApp confirmation was not sent.')
      } catch (error) {
        alert(getClientErrorMessage(error, 'Failed to send WhatsApp confirmation.'))
      } finally {
        setResendingWhatsAppId(null)
      }
    })()
  }

  const handleExport = () => {
    const csv = [
      'Title,Type,Status,Access,Payment Mode,Date,Facilitator,Capacity,Confirmed Count,Confirmed Names,Confirmed Emails,Pending Payment Count,Pending Payment Names,Waitlist Count,Waitlist Names,Waitlist Emails',
      ...filteredSessions.map((session) => {
        const sessionRegistrations = getSessionRegistrations(registrationsBySessionId, session.id)
        const hasRegistrationRecords = sessionRegistrations.length > 0
        const confirmedCount = getSessionConfirmedCount(session, registrationsBySessionId)
        const waitlistCount = getSessionWaitlistCount(session, registrationsBySessionId)
        const pendingPayment = sessionRegistrations.filter((registration) => registration.status === 'pending_payment')

        return [
          session.title,
          session.type,
          session.status,
          session.accessMode || 'open',
          session.paymentMode || (session.isFree ? 'free' : 'paid'),
          formatDate(session.date),
          session.facilitator?.name || '',
          session.capacity || 0,
          confirmedCount,
          hasRegistrationRecords
            ? formatRegistrationPeople(sessionRegistrations, 'confirmed', 'displayName')
            : formatSignupNames(session.attendees, usersById),
          hasRegistrationRecords
            ? formatRegistrationPeople(sessionRegistrations, 'confirmed', 'email')
            : formatSignupEmails(session.attendees, usersById),
          pendingPayment.length,
          pendingPayment.map((registration) => registration.displayName || registration.userId).join('; '),
          waitlistCount,
          hasRegistrationRecords
            ? formatRegistrationPeople(sessionRegistrations, 'waitlisted', 'displayName')
            : formatSignupNames(session.waitlist, usersById),
          hasRegistrationRecords
            ? formatRegistrationPeople(sessionRegistrations, 'waitlisted', 'email')
            : formatSignupEmails(session.waitlist, usersById),
        ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')
      }),
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
          <HStack gap={3} flexWrap="wrap" justify={{ base: 'flex-start', md: 'flex-end' }}>
            <Button {...actionButtonProps} onClick={handleExport} bg="whiteAlpha.50" color="whiteAlpha.800" border="1px solid" borderColor="whiteAlpha.200" _hover={{ bg: 'whiteAlpha.100', color: 'white' }}>
              Export
            </Button>
            <Button {...actionButtonProps} onClick={openCreate} bg="brand.500" color="white" minW="176px" _hover={{ bg: 'brand.600' }}>
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

        <Box p={{ base: 4, md: 5 }} bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="2xl" mb={6}>
          <SimpleGrid columns={{ base: 1, lg: 3 }} gap={4} alignItems="end">
            <Box>
              <Text color="whiteAlpha.500" fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="0.08em" mb={2}>
                Search
              </Text>
              <Box position="relative">
                <Box position="absolute" left={4} top="50%" transform="translateY(-50%)" color="whiteAlpha.500">
                  <Search size={18} />
                </Box>
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search sessions..." h="46px" pl={11} pr={4} bg="blackAlpha.300" color="white" borderColor="whiteAlpha.200" borderRadius="xl" />
              </Box>
            </Box>

            <Box>
              <Text color="whiteAlpha.500" fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="0.08em" mb={2}>
                Type
              </Text>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as SessionType | 'all')}
                style={filterSelectStyle}
              >
                {sessionTypes.map((type) => (
                  <option key={type} value={type}>
                    {type === 'all' ? 'All session types' : type.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </Box>

            <Box>
              <Text color="whiteAlpha.500" fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="0.08em" mb={2}>
                Timing
              </Text>
              <HStack gap={2}>
                {(['upcoming', 'past'] as const).map((tab) => (
                  <Button key={tab} {...filterButtonProps} h="42px" px={5} onClick={() => setActiveTab(tab)} bg={activeTab === tab ? 'brand.500' : 'whiteAlpha.50'} color={activeTab === tab ? 'white' : 'whiteAlpha.700'} border="1px solid" borderColor={activeTab === tab ? 'brand.500' : 'whiteAlpha.100'} textTransform="capitalize" _hover={{ bg: activeTab === tab ? 'brand.600' : 'whiteAlpha.100', color: 'white' }}>
                    {tab}
                  </Button>
                ))}
              </HStack>
            </Box>
          </SimpleGrid>
        </Box>

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
                confirmedCount={getSessionConfirmedCount(session, registrationsBySessionId)}
                waitlistCount={getSessionWaitlistCount(session, registrationsBySessionId)}
                onView={setDetailSession}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        </SimpleGrid>

        {modalMode && (
          <Modal title={modalMode === 'edit' ? 'Edit Session' : 'Create Session'} onClose={closeModal} fullScreen>
            <form onSubmit={handleSubmit}>
              <Box maxW="1080px" mx="auto" px={{ base: 4, md: 7 }} py={{ base: 4, md: 6 }}>
                <Flex justify="space-between" align={{ base: 'flex-start', lg: 'center' }} direction={{ base: 'column', lg: 'row' }} gap={4} mb={5}>
                  <Box>
                    <Text color="brand.300" fontSize="xs" fontWeight="semibold" letterSpacing="0.16em" textTransform="uppercase">
                      Session setup
                    </Text>
                    <Heading as="h2" color="white" fontSize={{ base: '2xl', md: '3xl' }} mt={2}>
                      {modalMode === 'edit' ? formData.title || 'Edit session' : 'Create a session'}
                    </Heading>
                    <Text color="whiteAlpha.500" mt={2} maxW="620px">
                      Manage session details, registration rules, payment settings, and gallery media.
                    </Text>
                  </Box>
                  {modalMode === 'edit' && (
                    <HStack gap={2} flexWrap="wrap">
                      <SessionTypeBadge type={formData.type} />
                      <StatusBadge status={formData.status} />
                    </HStack>
                  )}
                </Flex>
                <Box>
                  <SessionFormFields form={formData} setForm={setFormData} places={artLocations} />
                </Box>
              </Box>
              <Flex
                position="sticky"
                bottom={0}
                zIndex={4}
                justify="flex-end"
                gap={3}
                px={{ base: 4, md: 8 }}
                py={4}
                bg="rgba(17,17,17,0.96)"
                borderTop="1px solid"
                borderColor="rgba(255,255,255,0.07)"
                backdropFilter="blur(12px)"
              >
                <Button type="button" onClick={closeModal} h="44px" px={6} bg="whiteAlpha.70" color="whiteAlpha.800" borderRadius="lg" _hover={{ bg: 'whiteAlpha.120', color: 'white' }}>Cancel</Button>
                <Button type="submit" loading={submitting} h="44px" px={6} bg="brand.500" color="white" borderRadius="lg" _hover={{ bg: 'brand.600' }}>
                  {modalMode === 'edit' ? 'Save changes' : 'Create session'}
                </Button>
              </Flex>
            </form>
          </Modal>
        )}

        {detailSession && (
          <Modal title="Operations Ledger" onClose={() => setDetailSession(null)} fullScreen>
            <VStack align="stretch" gap={0}>
              <Flex
                px={{ base: 4, md: 7 }}
                py={{ base: 5, md: 6 }}
                justify="space-between"
                align={{ base: 'flex-start', lg: 'center' }}
                direction={{ base: 'column', lg: 'row' }}
                gap={5}
                borderBottom="1px solid"
                borderColor="whiteAlpha.100"
              >
                <Box minW={0}>
                  <HStack gap={2} mb={3} flexWrap="wrap">
                    <SessionTypeBadge type={detailSession.type} />
                    <StatusBadge status={detailSession.status} />
                  </HStack>
                  <Heading as="h2" color="white" fontSize={{ base: 'xl', md: '2xl' }} lineClamp={1}>
                    {detailSession.title}
                  </Heading>
                  <Flex mt={2} gap={{ base: 2, md: 5 }} color="whiteAlpha.600" fontSize="sm" flexWrap="wrap">
                    <HStack gap={2}><CalendarDays size={15} /><Text>{formatDate(detailSession.date)} · {formatTime(detailSession.date)}</Text></HStack>
                    <HStack gap={2}><MapPin size={15} /><Text>{detailSession.location?.name || 'Location not set'}</Text></HStack>
                    <HStack gap={2}><Users size={15} /><Text>{getSessionConfirmedCount(detailSession, registrationsBySessionId)} / {detailSession.capacity || 0} confirmed</Text></HStack>
                  </Flex>
                </Box>
                <Button
                  h="42px"
                  px={5}
                  borderRadius="lg"
                  bg="whiteAlpha.50"
                  color="whiteAlpha.800"
                  border={0}
                  _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
                  onClick={() => { setDetailSession(null); openEdit(detailSession) }}
                >
                  <Pencil size={15} />
                  Edit session
                </Button>
              </Flex>
              <RegistrationManager
                session={detailSession}
                users={userDocs}
                registrations={getSessionRegistrations(registrationsBySessionId, detailSession.id)}
                loading={registrationsLoading}
                usersLoading={usersLoading}
                error={registrationsError?.message}
                onAddRegistration={handleAddRegistration}
                onMarkPaid={handleMarkPaid}
                onConfirm={handleConfirmRegistration}
                onExempt={handleExemptRegistration}
                onWaitlist={handleWaitlistRegistration}
                onDecline={handleDeclineRegistration}
                onReversePayment={handleReverseRegistrationPayment}
                onRetryWhatsApp={handleRetryWhatsApp}
                resendingWhatsAppId={resendingWhatsAppId}
                reversingRegistrationId={reversingRegistrationId}
              />
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
  confirmedCount,
  waitlistCount,
  onView,
  onEdit,
  onDelete,
}: {
  session: Session
  index: number
  confirmedCount: number
  waitlistCount: number
  onView: (session: Session) => void
  onEdit: (session: Session) => void
  onDelete: (session: Session) => void
}) {
  const config = normalizeSessionRegistrationConfig(session)

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
            <HStack gap={2}><Users size={15} /><Text>{confirmedCount}/{session.capacity || 0} confirmed</Text></HStack>
            <HStack gap={2}><CreditCard size={15} /><Text>{config.paymentMode === 'paid' ? `${session.currency || 'ZMW'} ${Number(session.price || 0).toFixed(2)}` : 'Free'}</Text></HStack>
            {waitlistCount > 0 && <HStack gap={2}><Users size={15} /><Text>{waitlistCount} waitlisted</Text></HStack>}
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

function RegistrationManager({
  session,
  users,
  registrations,
  loading,
  usersLoading,
  error,
  onAddRegistration,
  onMarkPaid,
  onConfirm,
  onExempt,
  onWaitlist,
  onDecline,
  onReversePayment,
  onRetryWhatsApp,
  resendingWhatsAppId,
  reversingRegistrationId,
}: {
  session: Session
  users: FirestoreUser[]
  registrations: SessionRegistration[]
  loading: boolean
  usersLoading: boolean
  error?: string
  onAddRegistration: (
    session: Session,
    user: FirestoreUser,
    status: SessionRegistrationStatus,
    paymentStatus: SessionRegistrationPaymentStatus,
    whatsappPhone?: string
  ) => Promise<boolean>
  onMarkPaid: (registration: SessionRegistration) => void
  onConfirm: (registration: SessionRegistration, markPaid?: boolean) => void
  onExempt: (registration: SessionRegistration) => void
  onWaitlist: (registration: SessionRegistration) => void
  onDecline: (registration: SessionRegistration) => void
  onReversePayment: (registration: SessionRegistration) => void
  onRetryWhatsApp: (registration: SessionRegistration) => void
  resendingWhatsAppId: string | null
  reversingRegistrationId: string | null
}) {
  const [selectedUserId, setSelectedUserId] = useState('')
  const [newRegistrationPhone, setNewRegistrationPhone] = useState('')
  const [newRegistrationStatus, setNewRegistrationStatus] = useState<SessionRegistrationStatus>('requested')
  const [addingRegistration, setAddingRegistration] = useState(false)
  const [activeQueueTab, setActiveQueueTab] = useState<RegistrationQueueTab>('all')
  const [registrationSearch, setRegistrationSearch] = useState('')
  const [registrationSort, setRegistrationSort] = useState<'newest' | 'oldest' | 'name'>('newest')
  const existingUserIds = useMemo(
    () => new Set(registrations.map((registration) => registration.userId)),
    [registrations]
  )
  const availableUsers = useMemo(
    () => users.filter((user) => {
      const userId = user.uid || user.id
      return userId && !existingUserIds.has(userId)
    }),
    [existingUserIds, users]
  )
  const newPaymentStatus = getAdminAddPaymentStatus(session, newRegistrationStatus)
  const queueTabs: { value: RegistrationQueueTab; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: registrations.length },
    {
      value: 'pending',
      label: 'Pending',
      count: registrations.filter((registration) =>
        ['requested', 'pending_payment', 'paid_pending_confirmation'].includes(registration.status)
      ).length,
    },
    {
      value: 'declined',
      label: 'Declined',
      count: registrations.filter((registration) =>
        registration.status === 'declined' || registration.status === 'cancelled'
      ).length,
    },
    {
      value: 'completed',
      label: 'Completed',
      count: registrations.filter((registration) => registration.status === 'confirmed').length,
    },
    {
      value: 'waitlist',
      label: 'Waitlist',
      count: registrations.filter((registration) => registration.status === 'waitlisted').length,
    },
  ]
  const visibleRegistrations = useMemo(() => {
    const query = registrationSearch.trim().toLowerCase()
    const records = registrations.filter((registration) => {
      const matchesTab = activeQueueTab === 'all' ||
        (activeQueueTab === 'pending' && ['requested', 'pending_payment', 'paid_pending_confirmation'].includes(registration.status)) ||
        (activeQueueTab === 'declined' && (registration.status === 'declined' || registration.status === 'cancelled')) ||
        (activeQueueTab === 'completed' && registration.status === 'confirmed') ||
        (activeQueueTab === 'waitlist' && registration.status === 'waitlisted')
      const matchesSearch = !query || [
        registration.displayName,
        registration.email,
        registration.whatsappPhone,
        registration.userId,
      ].some((value) => String(value || '').toLowerCase().includes(query))
      return matchesTab && matchesSearch
    })

    return [...records].sort((a, b) => {
      if (registrationSort === 'name') return a.displayName.localeCompare(b.displayName)
      const difference = toMillis(a.requestedAt) - toMillis(b.requestedAt)
      return registrationSort === 'oldest' ? difference : -difference
    })
  }, [activeQueueTab, registrationSearch, registrationSort, registrations])

  const handleAddRegistrationSubmit = async (event: FormEvent) => {
    event.preventDefault()

    const targetUser = availableUsers.find((user) => (user.uid || user.id) === selectedUserId)
    if (!targetUser) return

    if (!newRegistrationPhone.trim()) {
      alert('Enter a WhatsApp number before adding this registration.')
      return
    }

    setAddingRegistration(true)
    const success = await onAddRegistration(
      session,
      targetUser,
      newRegistrationStatus,
      newPaymentStatus,
      newRegistrationPhone.trim() || undefined
    )
    setAddingRegistration(false)

    if (success) {
      setSelectedUserId('')
      setNewRegistrationPhone('')
      setNewRegistrationStatus('requested')
    }
  }

  return (
    <VStack align="stretch" gap={0}>
      <Flex
        px={{ base: 4, md: 7 }}
        borderBottom="1px solid"
        borderColor="whiteAlpha.100"
        overflowX="auto"
        gap={{ base: 5, md: 8 }}
        css={{ scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
      >
        {queueTabs.map((tab) => {
          const isActive = activeQueueTab === tab.value
          return (
            <Button
              key={tab.value}
              onClick={() => setActiveQueueTab(tab.value)}
              h="58px"
              px={0}
              flexShrink={0}
              bg="transparent"
              color={isActive ? 'brand.300' : 'whiteAlpha.650'}
              borderRadius={0}
              borderBottom="2px solid"
              borderColor={isActive ? 'brand.400' : 'transparent'}
              _hover={{ color: 'white', bg: 'transparent' }}
            >
              {tab.label}
              <Badge
                ml={2}
                bg={isActive ? 'rgba(239,112,67,0.22)' : 'rgba(255,255,255,0.09)'}
                color={isActive ? '#ffd1bf' : 'rgba(255,255,255,0.78)'}
                borderRadius="full"
                px={2.5}
                fontWeight="semibold"
              >
                {tab.count}
              </Badge>
            </Button>
          )
        })}
      </Flex>

      <Box px={{ base: 4, md: 7 }} py={6}>
        <Box p={{ base: 4, md: 5 }} borderRadius="xl" bg="rgba(255,255,255,0.035)">
          <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={3} mb={4} direction={{ base: 'column', md: 'row' }}>
            <Box>
              <Text color="white" fontWeight="semibold">Add guest</Text>
              <Text color="whiteAlpha.500" fontSize="sm">Create a registration for an existing Club BZR member.</Text>
            </Box>
            <Badge bg="brand.500/15" color="brand.200" borderRadius="md" px={3} py={1.5}>
              {paymentStatusLabels[newPaymentStatus]}
            </Badge>
          </Flex>
          <form onSubmit={handleAddRegistrationSubmit}>
            <SimpleGrid columns={{ base: 1, md: 2, xl: 5 }} gap={4} alignItems="end">
              <Field label="Member">
                <select
                  value={selectedUserId}
                  onChange={(event) => {
                    const userId = event.target.value
                    const selectedUser = availableUsers.find((user) => (user.uid || user.id) === userId)
                    setSelectedUserId(userId)
                    setNewRegistrationPhone(selectedUser?.whatsappPhone || selectedUser?.phone || '')
                  }}
                  style={{ ...filterSelectStyle, border: 'none', backgroundColor: 'rgba(0,0,0,0.24)' }}
                  disabled={usersLoading || addingRegistration}
                >
                  <option value="">{usersLoading ? 'Loading members...' : 'Select member'}</option>
                  {availableUsers.map((user) => {
                    const userId = user.uid || user.id
                    return <option key={userId} value={userId}>{user.displayName || user.email || userId}{user.email ? ` · ${user.email}` : ''}</option>
                  })}
                </select>
              </Field>
              <Field label="WhatsApp number">
                <Input value={newRegistrationPhone} onChange={(event) => setNewRegistrationPhone(event.target.value)} placeholder="e.g. +260 97 123 4567" h="46px" bg="rgba(0,0,0,0.24)" borderColor="rgba(255,255,255,0.1)" color="white" disabled={addingRegistration} />
              </Field>
              <Field label="Signup state">
                <select value={newRegistrationStatus} onChange={(event) => setNewRegistrationStatus(event.target.value as SessionRegistrationStatus)} style={{ ...filterSelectStyle, border: 'none', backgroundColor: 'rgba(0,0,0,0.24)' }} disabled={addingRegistration}>
                  {adminAddRegistrationStatuses.map((status) => <option key={status} value={status}>{registrationStatusLabels[status]}</option>)}
                </select>
              </Field>
              <Field label="Payment state">
                <Flex h="46px" px={4} align="center" bg="rgba(0,0,0,0.24)" borderRadius="12px" color="whiteAlpha.750" fontSize="sm">
                  <CreditCard size={15} />
                  <Text ml={2}>{paymentStatusLabels[newPaymentStatus]}</Text>
                </Flex>
              </Field>
              <Button type="submit" h="46px" bg="brand.500" color="white" borderRadius="lg" _hover={{ bg: 'brand.600' }} disabled={!selectedUserId || !newRegistrationPhone.trim() || addingRegistration || usersLoading}>
                {addingRegistration ? <Spinner size="sm" /> : <><Plus size={16} /> Add guest</>}
              </Button>
            </SimpleGrid>
          </form>
          {!usersLoading && availableUsers.length === 0 && <Text color="whiteAlpha.500" fontSize="sm" mt={3}>Every member already has a registration for this session.</Text>}
        </Box>

        <Flex mt={4} mb={3} gap={3} justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }}>
          <Flex h="44px" flex="1" maxW={{ md: '420px' }} align="center" px={3.5} bg="rgba(255,255,255,0.04)" borderRadius="lg">
            <Search size={17} color="rgba(255,255,255,0.46)" />
            <Input value={registrationSearch} onChange={(event) => setRegistrationSearch(event.target.value)} placeholder={`Search ${activeQueueTab === 'all' ? 'registrations' : activeQueueTab}...`} border={0} bg="transparent" color="white" px={3} h="full" _focus={{ boxShadow: 'none' }} />
          </Flex>
          <select value={registrationSort} onChange={(event) => setRegistrationSort(event.target.value as typeof registrationSort)} style={{ ...filterSelectStyle, width: 'auto', minWidth: '190px', height: '44px', border: 'none', backgroundColor: 'rgba(255,255,255,0.04)' }}>
            <option value="newest">Requested · newest</option>
            <option value="oldest">Requested · oldest</option>
            <option value="name">Guest name · A–Z</option>
          </select>
        </Flex>

        <Box borderRadius="xl" overflow="hidden" bg="rgba(255,255,255,0.025)">
          <Box display={{ base: 'none', lg: 'grid' }} gridTemplateColumns="minmax(205px,1.35fr) minmax(125px,.7fr) minmax(145px,.8fr) minmax(160px,.9fr) minmax(180px,1fr) minmax(120px,.55fr)" gap={4} px={5} py={3.5} borderBottom="1px solid" borderColor="whiteAlpha.120" color="whiteAlpha.450" fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="0.08em">
            <Text>Guest</Text><Text>Requested</Text><Text>Signup status</Text><Text>Payment</Text><Text>WhatsApp</Text><Text textAlign="right">Actions</Text>
          </Box>
          {loading ? (
            <Flex minH="180px" align="center" justify="center" gap={2} color="whiteAlpha.600"><Spinner size="sm" color="brand.500" /><Text>Loading registrations...</Text></Flex>
          ) : error ? (
            <Box m={4} p={4} bg="red.500/10" border="1px solid" borderColor="red.500/25" borderRadius="lg"><Text color="red.200" fontSize="sm">{error}</Text></Box>
          ) : visibleRegistrations.length === 0 ? (
            <Flex minH="180px" align="center" justify="center" direction="column" textAlign="center" px={5}><Users size={24} color="rgba(255,255,255,0.3)" /><Text color="whiteAlpha.650" mt={3}>No registrations found</Text><Text color="whiteAlpha.400" fontSize="sm" mt={1}>Try another status tab or search term.</Text></Flex>
          ) : visibleRegistrations.map((registration) => (
            <RegistrationRow key={registration.id} registration={registration} onMarkPaid={onMarkPaid} onConfirm={onConfirm} onExempt={onExempt} onWaitlist={onWaitlist} onDecline={onDecline} onReversePayment={onReversePayment} onRetryWhatsApp={onRetryWhatsApp} isRetryingWhatsApp={resendingWhatsAppId === registration.id} isReversingPayment={reversingRegistrationId === registration.id} />
          ))}
          {!loading && !error && visibleRegistrations.length > 0 && (
            <Flex px={5} py={3.5} borderTop="1px solid" borderColor="whiteAlpha.100" justify="space-between" color="whiteAlpha.450" fontSize="xs"><Text>Showing {visibleRegistrations.length} of {registrations.length} registrations</Text><Text>{queueTabs.find((tab) => tab.value === activeQueueTab)?.label}</Text></Flex>
          )}
        </Box>
      </Box>
    </VStack>
  )
}

function RegistrationRow({
  registration,
  onMarkPaid,
  onConfirm,
  onExempt,
  onWaitlist,
  onDecline,
  onReversePayment,
  onRetryWhatsApp,
  isRetryingWhatsApp,
  isReversingPayment,
}: {
  registration: SessionRegistration
  onMarkPaid: (registration: SessionRegistration) => void
  onConfirm: (registration: SessionRegistration, markPaid?: boolean) => void
  onExempt: (registration: SessionRegistration) => void
  onWaitlist: (registration: SessionRegistration) => void
  onDecline: (registration: SessionRegistration) => void
  onReversePayment: (registration: SessionRegistration) => void
  onRetryWhatsApp: (registration: SessionRegistration) => void
  isRetryingWhatsApp: boolean
  isReversingPayment: boolean
}) {
  const isTerminal = registration.status === 'declined' || registration.status === 'cancelled'
  const isConfirmed = registration.status === 'confirmed'
  const needsPayment =
    registration.paymentStatus === 'unpaid' ||
    registration.paymentStatus === 'pending' ||
    registration.paymentStatus === 'failed'
  const canMarkPaid = !isTerminal && !isConfirmed && needsPayment
  const canExempt = !isTerminal && !isConfirmed && needsPayment
  const canConfirm = !isTerminal && !isConfirmed
  const canMoveToWaitlist = !isTerminal && registration.status !== 'waitlisted' && !isConfirmed
  const canDecline = !isTerminal && !isConfirmed
  const hasPaidPayment =
    registration.paymentStatus === 'paid_online' ||
    registration.paymentStatus === 'paid_external'
  const canReversePayment =
    isTerminal &&
    hasPaidPayment &&
    Number(registration.paymentAmount || 0) > 0 &&
    registration.returnStatus !== 'pending' &&
    registration.returnStatus !== 'completed'
  const whatsappState = getWhatsAppConfirmationState(registration)
  const whatsappIssue =
    registration.confirmationWhatsAppDeliveryError ||
    registration.confirmationWhatsAppError ||
    registration.confirmationWhatsAppSkipReason ||
    ''
  const isWhatsAppError = Boolean(
    registration.confirmationWhatsAppDeliveryFailedAt ||
    registration.confirmationWhatsAppDeliveryError ||
    registration.confirmationWhatsAppFailedAt ||
    registration.confirmationWhatsAppError
  )
  const showWhatsAppIssue = Boolean(whatsappIssue) && (
    isWhatsAppError || Boolean(registration.confirmationWhatsAppSkippedAt)
  )
  const canRetryWhatsApp = isConfirmed && !isTerminal
  const whatsappActionLabel = registration.confirmationWhatsAppSentAt
    ? 'Resend WhatsApp'
    : registration.confirmationWhatsAppFailedAt
      ? 'Retry WhatsApp'
      : 'Send WhatsApp'
  const paymentAmountText = registration.paymentAmount
    ? `${registration.paymentCurrency || 'ZMW'} ${registration.paymentAmount.toFixed(2)}`
    : 'No amount'
  const whatsappLabel = registration.whatsappPhone || 'No WhatsApp number'

  return (
    <Box px={{ base: 4, md: 5 }} py={{ base: 4, lg: 4.5 }} borderBottom="1px solid" borderColor="whiteAlpha.100" _last={{ borderBottom: 0 }} _hover={{ bg: 'whiteAlpha.25' }} transition="background 160ms ease">
      <Box display={{ base: 'flex', lg: 'grid' }} flexDirection="column" gridTemplateColumns="minmax(205px,1.35fr) minmax(125px,.7fr) minmax(145px,.8fr) minmax(160px,.9fr) minmax(180px,1fr) minmax(120px,.55fr)" gap={{ base: 4, lg: 4 }} alignItems="center">
        <HStack gap={3} minW={0}>
          {registration.photoURL ? (
            <Image src={registration.photoURL} alt={registration.displayName} boxSize="44px" borderRadius="full" objectFit="cover" flexShrink={0} />
          ) : (
            <Flex boxSize="44px" borderRadius="full" bg="brand.500/18" color="brand.200" align="center" justify="center" flexShrink={0}>
              <Users size={18} />
            </Flex>
          )}
          <Box minW={0}>
            <Text color="white" fontWeight="semibold" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{registration.displayName}</Text>
            <Text color="whiteAlpha.500" fontSize="xs" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{registration.email || registration.userId}</Text>
          </Box>
        </HStack>

        <LedgerCell label="Requested">
          <HStack gap={2} color="whiteAlpha.750" fontSize="sm"><CalendarDays size={14} /><Text>{formatDateTime(registration.requestedAt)}</Text></HStack>
        </LedgerCell>

        <LedgerCell label="Signup status">
          <Badge bg={isTerminal ? 'red.500/14' : isConfirmed ? 'green.500/14' : registration.status === 'waitlisted' ? 'blue.500/14' : 'orange.500/14'} color={isTerminal ? 'red.200' : isConfirmed ? 'green.200' : registration.status === 'waitlisted' ? 'blue.200' : 'orange.200'} borderRadius="md" px={2.5} py={1} textTransform="none">
            {registrationStatusLabels[registration.status]}
          </Badge>
        </LedgerCell>

        <LedgerCell label="Payment">
          <Box>
            <Text color="whiteAlpha.800" fontSize="sm">{paymentStatusLabels[registration.paymentStatus]}</Text>
            <Text color={registration.paymentAmount ? 'brand.200' : 'whiteAlpha.400'} fontSize="xs" mt={0.5}>{paymentAmountText}</Text>
            {registration.paymentStatus === 'waived' && registration.paymentWaiverReason && (
              <Text color="blue.200" fontSize="xs" mt={1} lineClamp={2}>{registration.paymentWaiverReason}</Text>
            )}
          </Box>
        </LedgerCell>

        <LedgerCell label="WhatsApp">
          <Box minW={0}>
            <HStack gap={2} color="whiteAlpha.750" fontSize="sm"><MessageCircle size={14} /><Text lineClamp={1}>{whatsappLabel}</Text></HStack>
            {whatsappState && <Text color={whatsappState.color} fontSize="xs" mt={0.5}>{whatsappState.label}</Text>}
            {showWhatsAppIssue && <Text color={isWhatsAppError ? 'red.200' : 'orange.200'} fontSize="xs" mt={1} lineClamp={2}>{whatsappIssue}</Text>}
          </Box>
        </LedgerCell>

        <Flex justify={{ base: 'flex-start', lg: 'flex-end' }} align="center" gap={2} w="full">
          {registration.returnStatus === 'pending' && (
            <Badge bg="orange.500/15" color="orange.200" borderRadius="full" px={3} py={2}>
              Return pending
            </Badge>
          )}
          {registration.returnStatus === 'completed' && (
            <Badge bg="green.500/15" color="green.200" borderRadius="md" px={3} py={2}>
              {registration.returnEffect === 'revenue_correction' ? 'Revenue corrected' : 'Payment returned'}
            </Badge>
          )}
          <Menu.Root positioning={{ placement: 'bottom-end' }}>
            <Menu.Trigger
              aria-label={`Actions for ${registration.displayName}`}
              display="inline-flex"
              alignItems="center"
              justifyContent="center"
              gap={2}
              h="40px"
              px={3.5}
              borderRadius="lg"
              bg="whiteAlpha.70"
              color="whiteAlpha.850"
              fontSize="sm"
              fontWeight="semibold"
              cursor="pointer"
              _hover={{ bg: 'whiteAlpha.120', color: 'white' }}
            >
              <MoreHorizontal size={18} />
              Actions
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner>
                <Menu.Content minW="230px" p={2} bg="rgba(18,18,18,0.99)" border="1px solid" borderColor="whiteAlpha.200" borderRadius="14px" boxShadow="0 18px 48px rgba(0,0,0,.5)" zIndex={2000}>
                  {canRetryWhatsApp && (
                    <RegistrationActionMenuItem value="whatsapp" icon={isRetryingWhatsApp ? <Spinner size="sm" /> : <Send size={15} />} onClick={() => onRetryWhatsApp(registration)} disabled={isRetryingWhatsApp}>
                      {whatsappActionLabel}
                    </RegistrationActionMenuItem>
                  )}
                  {canMarkPaid && (
                    <RegistrationActionMenuItem value="mark-paid" icon={<CreditCard size={15} />} onClick={() => onMarkPaid(registration)} color="blue.200">
                      Mark paid
                    </RegistrationActionMenuItem>
                  )}
                  {canMarkPaid && (
                    <RegistrationActionMenuItem value="paid-confirm" icon={<CheckCircle2 size={15} />} onClick={() => onConfirm(registration, true)} color="green.200">
                      Mark paid + confirm
                    </RegistrationActionMenuItem>
                  )}
                  {canExempt && (
                    <RegistrationActionMenuItem value="exempt-confirm" icon={<BadgeCheck size={15} />} onClick={() => onExempt(registration)} color="cyan.200">
                      Exempt + confirm
                    </RegistrationActionMenuItem>
                  )}
                  {canConfirm && !needsPayment && (
                    <RegistrationActionMenuItem value="confirm" icon={<CheckCircle2 size={15} />} onClick={() => onConfirm(registration)} color="green.200">
                      Confirm
                    </RegistrationActionMenuItem>
                  )}
                  {canMoveToWaitlist && (
                    <RegistrationActionMenuItem value="waitlist" icon={<Users size={15} />} onClick={() => onWaitlist(registration)} color="orange.200">
                      Move to waitlist
                    </RegistrationActionMenuItem>
                  )}
                  {canDecline && (
                    <RegistrationActionMenuItem value="decline" icon={<UserRoundMinus size={15} />} onClick={() => onDecline(registration)} color="red.200">
                      Decline
                    </RegistrationActionMenuItem>
                  )}
                  {canReversePayment && (
                    <RegistrationActionMenuItem value="reverse-payment" icon={isReversingPayment ? <Spinner size="sm" /> : <RotateCcw size={15} />} onClick={() => onReversePayment(registration)} disabled={isReversingPayment} color="brand.200">
                      Reverse payment
                    </RegistrationActionMenuItem>
                  )}
                  {!canRetryWhatsApp && !canMarkPaid && !canExempt && !(canConfirm && !needsPayment) && !canMoveToWaitlist && !canDecline && !canReversePayment && (
                    <Menu.Item value="no-actions" disabled px={3} py={2.5} color="whiteAlpha.400" fontSize="sm">
                      No actions available
                    </Menu.Item>
                  )}
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
        </Flex>
      </Box>
    </Box>
  )
}

function LedgerCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box minW={0}>
      <Text display={{ base: 'block', lg: 'none' }} color="whiteAlpha.400" fontSize="2xs" textTransform="uppercase" letterSpacing="0.08em" mb={1}>{label}</Text>
      {children}
    </Box>
  )
}

function RegistrationActionMenuItem({
  value,
  icon,
  children,
  onClick,
  color = 'whiteAlpha.800',
  disabled = false,
}: {
  value: string
  icon: ReactNode
  children: ReactNode
  onClick: () => void
  color?: string
  disabled?: boolean
}) {
  return (
    <Menu.Item
      value={value}
      onClick={onClick}
      disabled={disabled}
      display="flex"
      alignItems="center"
      gap={3}
      minH="42px"
      px={3}
      py={2}
      borderRadius="10px"
      bg="transparent"
      color={color}
      fontSize="sm"
      fontWeight="medium"
      cursor={disabled ? 'not-allowed' : 'pointer'}
      _hover={{ bg: 'whiteAlpha.100' }}
    >
      {icon}
      <Text as="span">{children}</Text>
    </Menu.Item>
  )
}

function SessionFormFields({
  form,
  setForm,
  places,
}: {
  form: SessionForm
  setForm: React.Dispatch<React.SetStateAction<SessionForm>>
  places: ArtLocation[]
}) {
  const { firebaseUser } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [isDraggingCover, setIsDraggingCover] = useState(false)
  const [isDraggingGallery, setIsDraggingGallery] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingGallery, setUploadingGallery] = useState(false)
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null)
  const [galleryUploadError, setGalleryUploadError] = useState<string | null>(null)
  const coverImage = form.coverImage.trim()
  const galleryItems = form.gallery || []

  const handleCoverFile = async (file: File | null | undefined) => {
    if (!file || uploadingCover) return

    if (!firebaseUser?.uid) {
      setCoverUploadError('Sign in again before uploading a cover image.')
      return
    }

    const validation = validateFile(file, {
      maxSizeMB: 10,
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    })

    if (!validation.valid) {
      setCoverUploadError(validation.error || 'Choose a JPG, PNG, WebP, or GIF image under 10MB.')
      return
    }

    setCoverUploadError(null)
    setUploadingCover(true)

    const result = await uploadFileSimple(file, `${STORAGE_PATHS.SESSIONS}/covers/${firebaseUser.uid}`)

    setUploadingCover(false)

    if (!result.success || !result.url) {
      setCoverUploadError(result.error?.message || 'Could not upload this image.')
      return
    }

    setForm((prev) => ({ ...prev, coverImage: result.url || '' }))
  }

  const handleCoverInput = async (event: ChangeEvent<HTMLInputElement>) => {
    await handleCoverFile(event.target.files?.[0])
    event.target.value = ''
  }

  const handleCoverDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDraggingCover(false)
    void handleCoverFile(event.dataTransfer.files?.[0])
  }

  const handleGalleryFiles = async (fileList: FileList | File[] | null | undefined) => {
    const files = Array.from(fileList || [])
    if (files.length === 0 || uploadingGallery) return

    if (!firebaseUser?.uid) {
      setGalleryUploadError('Sign in again before uploading gallery images.')
      return
    }

    const invalidFile = files.find((file) => {
      const validation = validateFile(file, {
        maxSizeMB: 10,
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      })
      return !validation.valid
    })

    if (invalidFile) {
      setGalleryUploadError(`${invalidFile.name} must be a JPG, PNG, WebP, or GIF under 10MB.`)
      return
    }

    setGalleryUploadError(null)
    setUploadingGallery(true)

    const uploadedItems: GalleryItem[] = []

    for (const [index, file] of files.entries()) {
      const result = await uploadFileSimple(file, `${STORAGE_PATHS.SESSIONS}/gallery/${firebaseUser.uid}`)

      if (!result.success || !result.url) {
        setGalleryUploadError(result.error?.message || `Could not upload ${file.name}.`)
        setUploadingGallery(false)
        return
      }

      uploadedItems.push({
        id: `${Date.now()}-${index}-${file.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`,
        url: result.url,
        thumbnailUrl: result.url,
        uploadedBy: firebaseUser.uid,
        uploadedAt: Timestamp.now(),
      })
    }

    setForm((prev) => ({
      ...prev,
      gallery: [...(prev.gallery || []), ...uploadedItems],
    }))
    setUploadingGallery(false)
  }

  const handleGalleryInput = async (event: ChangeEvent<HTMLInputElement>) => {
    await handleGalleryFiles(event.target.files)
    event.target.value = ''
  }

  const handleGalleryDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDraggingGallery(false)
    void handleGalleryFiles(event.dataTransfer.files)
  }

  return (
    <VStack gap={5} align="stretch">
      <FormSection title="Session details" description="Public information shown across the website and session cards.">
        <Box maxW="620px">
          <Field label="Title"><Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} {...sessionInputProps} /></Field>
        </Box>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4} maxW="620px">
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
        <Field label="Hero Description"><Textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} {...sessionInputProps} minH="88px" resize="vertical" lineHeight="1.5" placeholder="Short public summary shown in the hero and session cards." /></Field>
        <Field label="About This Session"><Textarea value={form.about} onChange={(e) => setForm((prev) => ({ ...prev, about: e.target.value }))} {...sessionInputProps} minH="128px" resize="vertical" lineHeight="1.5" placeholder="What will happen at the event, format, materials, schedule, or expectations." /></Field>
      </FormSection>

      <FormSection title="Schedule & venue" description="When the session happens, where it takes place, and available capacity.">
        <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} {...sessionInputProps} /></Field>
          <Field label="Start"><Input type="time" value={form.time} onChange={(e) => setForm((prev) => ({ ...prev, time: e.target.value }))} {...sessionInputProps} /></Field>
          <Field label="End"><Input type="time" value={form.endTime} onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))} {...sessionInputProps} /></Field>
        </SimpleGrid>
        <Box maxW="320px">
          <Field label="Capacity"><Input type="number" value={form.capacity} onChange={(e) => setForm((prev) => ({ ...prev, capacity: e.target.value }))} {...sessionInputProps} /></Field>
        </Box>
        {form.type !== 'online' ? (
          <>
            <LocationPicker
              places={places}
              value={{
                name: form.location,
                address: form.locationAddress,
                city: form.locationCity,
                latitude: form.locationLatitude,
                longitude: form.locationLongitude,
                artLocationId: form.locationArtLocationId,
                source: form.locationSource,
              }}
              onChange={(location: LocationPickerValue) => setForm((prev) => ({
                ...prev,
                location: location.name,
                locationAddress: location.address,
                locationCity: location.city,
                locationLatitude: location.latitude,
                locationLongitude: location.longitude,
                locationArtLocationId: location.artLocationId,
                locationSource: location.source,
              }))}
            />
            <Flex as="label" align="center" gap={3} cursor="pointer" w="fit-content">
              <input
                type="checkbox"
                checked={form.showOnCommunityMap}
                onChange={(event) => setForm((prev) => ({ ...prev, showOnCommunityMap: event.target.checked }))}
                style={{ width: 18, height: 18, accentColor: '#ff6b35' }}
              />
              <Box>
                <Text color="whiteAlpha.800" fontSize="sm" fontWeight="medium">Show this session on the Community Map</Text>
                <Text color="whiteAlpha.400" fontSize="xs" mt={0.5}>Published upcoming sessions appear in the Sessions map layer.</Text>
              </Box>
            </Flex>
          </>
        ) : (
          <Box maxW="620px">
            <Field label="Online location label"><Input value={form.location} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))} {...sessionInputProps} placeholder="Online" /></Field>
          </Box>
        )}
      </FormSection>

      <FormSection title="Registration" description="Control who can join and how registrations are approved.">
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4} maxW="720px">
          <Field label="Access">
            <select value={form.accessMode} onChange={(e) => setForm((prev) => ({ ...prev, accessMode: e.target.value as SessionAccessMode }))} style={selectStyle}>
              <option value="open">Open</option>
              <option value="invite_only">Invite only</option>
            </select>
          </Field>
          <Field label="Approval">
            <select value={form.approvalMode} onChange={(e) => setForm((prev) => ({ ...prev, approvalMode: e.target.value as SessionApprovalMode }))} style={selectStyle}>
              <option value="auto">Auto confirm</option>
              <option value="manual">Manual approval</option>
            </select>
          </Field>
        </SimpleGrid>
      </FormSection>

      <FormSection title="Payment" description="Configure the charge, provider, currency, and payment guidance.">
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={4}>
          <Field label="Payment">
            <select
              value={form.paymentMode}
              onChange={(e) => {
                const paymentMode = e.target.value as SessionPaymentMode
                setForm((prev) => ({
                  ...prev,
                  paymentMode,
                  paymentProvider: paymentMode === 'paid' && prev.paymentProvider === 'none' ? 'lenco' : paymentMode === 'free' ? 'none' : prev.paymentProvider,
                }))
              }}
              style={selectStyle}
            >
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </Field>
          <Field label="Provider">
            <select
              value={form.paymentProvider}
              onChange={(e) => {
                const paymentProvider = e.target.value as SessionPaymentProvider
                setForm((prev) => ({
                  ...prev,
                  paymentProvider,
                  approvalMode: paymentProvider === 'manual_external' && prev.approvalMode === 'auto' ? 'manual' : prev.approvalMode,
                }))
              }}
              style={selectStyle}
              disabled={form.paymentMode === 'free'}
            >
              <option value="none">None</option>
              <option value="manual_external">Manual external</option>
              <option value="lenco">Lenco</option>
            </select>
          </Field>
          <Field label="Currency"><Input value={form.currency} onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))} {...sessionInputProps} /></Field>
          {form.paymentMode === 'paid' && (
            <Field label="Price"><Input type="number" min={0} step="0.01" value={form.price} onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))} {...sessionInputProps} /></Field>
          )}
        </SimpleGrid>
        {form.paymentMode === 'paid' && (
          <Field label="Payment Instructions"><Textarea value={form.paymentInstructions} onChange={(e) => setForm((prev) => ({ ...prev, paymentInstructions: e.target.value }))} {...sessionInputProps} minH="88px" resize="vertical" placeholder="Bank transfer, cash, mobile money, or confirmation notes shown to users." /></Field>
        )}
      </FormSection>

      <FormSection title="Host & discovery" description="Identify the facilitator and add searchable session tags.">
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
          <Field label="Facilitator"><Input value={form.facilitator} onChange={(e) => setForm((prev) => ({ ...prev, facilitator: e.target.value }))} {...sessionInputProps} /></Field>
          <Field label="Tags"><Input value={form.tags} onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))} {...sessionInputProps} placeholder="workshop, drawing" /></Field>
        </SimpleGrid>
      </FormSection>

      <FormSection title="Media" description="Manage the cover image and supporting gallery photographs.">
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={5} alignItems="start">
        <Field label="Cover Image">
        <VStack align="stretch" gap={3}>
          {coverImage && (
            <Box position="relative" overflow="hidden" borderRadius="xl" border="1px solid" borderColor="whiteAlpha.150" bg="whiteAlpha.50">
              <Image src={coverImage} alt="Session cover preview" w="full" h="112px" objectFit="cover" />
              <Button
                type="button"
                position="absolute"
                top={3}
                right={3}
                size="sm"
                h="34px"
                px={3}
                bg="blackAlpha.700"
                color="white"
                borderRadius="full"
                _hover={{ bg: 'blackAlpha.800' }}
                onClick={() => setForm((prev) => ({ ...prev, coverImage: '' }))}
              >
                <X size={15} />
                Remove
              </Button>
            </Box>
          )}

          <Box
            onDragOver={(event) => {
              event.preventDefault()
              setIsDraggingCover(true)
            }}
            onDragLeave={() => setIsDraggingCover(false)}
            onDrop={handleCoverDrop}
            p={3}
            bg={isDraggingCover ? 'brand.500/10' : 'whiteAlpha.50'}
            border="1px dashed"
            borderColor={isDraggingCover ? 'brand.500' : 'whiteAlpha.200'}
            borderRadius="xl"
            transition="all 0.2s"
          >
            <Flex align={{ base: 'stretch', sm: 'center' }} direction={{ base: 'column', sm: 'row' }} gap={3}>
              <Flex w="38px" h="38px" align="center" justify="center" borderRadius="full" bg="gray.800" color="brand.300" flexShrink={0}>
                <ImagePlus size={18} />
              </Flex>
              <Box flex={1}>
                <Text color="white" fontWeight="semibold">Upload a cover image</Text>
                <Text color="whiteAlpha.500" fontSize="xs" mt={1}>Drop an image here or choose a file under 10MB.</Text>
              </Box>
              <Input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" display="none" onChange={handleCoverInput} />
              <Button
                type="button"
                {...actionButtonProps}
                h="36px"
                px={4}
                loading={uploadingCover}
                bg="whiteAlpha.100"
                color="white"
                border={0}
                _hover={{ bg: 'whiteAlpha.200' }}
                onClick={() => fileInputRef.current?.click()}
              >
                Choose Image
              </Button>
            </Flex>
          </Box>

          {coverUploadError && (
            <Text color="red.300" fontSize="sm">{coverUploadError}</Text>
          )}

          <Box position="relative">
            <Box position="absolute" left={3} top="50%" transform="translateY(-50%)" color="whiteAlpha.500" pointerEvents="none">
              <LinkIcon size={16} />
            </Box>
            <Input
              value={form.coverImage}
              onChange={(e) => setForm((prev) => ({ ...prev, coverImage: e.target.value }))}
              placeholder="Or paste an image URL"
              pl={10}
              {...sessionInputProps}
            />
          </Box>
        </VStack>
        </Field>
        <Field label="Gallery Images">
        <VStack align="stretch" gap={3}>
          {galleryItems.length > 0 && (
            <SimpleGrid columns={{ base: 2, md: 3 }} gap={3}>
              {galleryItems.map((item) => (
                <Box key={item.id} position="relative" overflow="hidden" borderRadius="xl" border="1px solid" borderColor="whiteAlpha.150" bg="whiteAlpha.50">
                  <Image src={item.thumbnailUrl || item.url} alt={item.caption || 'Session gallery image'} w="full" h="92px" objectFit="cover" />
                  <Button
                    type="button"
                    position="absolute"
                    top={2}
                    right={2}
                    size="xs"
                    h="30px"
                    px={3}
                    bg="blackAlpha.700"
                    color="white"
                    borderRadius="full"
                    _hover={{ bg: 'blackAlpha.800' }}
                    onClick={() => setForm((prev) => ({
                      ...prev,
                      gallery: (prev.gallery || []).filter((galleryItem) => galleryItem.id !== item.id),
                    }))}
                  >
                    <X size={14} />
                  </Button>
                </Box>
              ))}
            </SimpleGrid>
          )}

          <Box
            onDragOver={(event) => {
              event.preventDefault()
              setIsDraggingGallery(true)
            }}
            onDragLeave={() => setIsDraggingGallery(false)}
            onDrop={handleGalleryDrop}
            p={3}
            bg={isDraggingGallery ? 'brand.500/10' : 'whiteAlpha.50'}
            border="1px dashed"
            borderColor={isDraggingGallery ? 'brand.500' : 'whiteAlpha.200'}
            borderRadius="xl"
            transition="all 0.2s"
          >
            <Flex align={{ base: 'stretch', sm: 'center' }} direction={{ base: 'column', sm: 'row' }} gap={3}>
              <Flex w="38px" h="38px" align="center" justify="center" borderRadius="full" bg="gray.800" color="brand.300" flexShrink={0}>
                <ImagePlus size={18} />
              </Flex>
              <Box flex={1}>
                <Text color="white" fontWeight="semibold">Upload gallery images</Text>
                <Text color="whiteAlpha.500" fontSize="xs" mt={1}>Drop images here or choose files under 10MB each.</Text>
              </Box>
              <Input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple display="none" onChange={handleGalleryInput} />
              <Button
                type="button"
                {...actionButtonProps}
                h="36px"
                px={4}
                loading={uploadingGallery}
                bg="whiteAlpha.100"
                color="white"
                border={0}
                _hover={{ bg: 'whiteAlpha.200' }}
                onClick={() => galleryInputRef.current?.click()}
              >
                Choose Images
              </Button>
            </Flex>
          </Box>

          {galleryUploadError && (
            <Text color="red.300" fontSize="sm">{galleryUploadError}</Text>
          )}
        </VStack>
        </Field>
        </SimpleGrid>
      </FormSection>
    </VStack>
  )
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  height: '40px',
  padding: '0 14px',
  backgroundColor: 'rgba(255,255,255,0.045)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
  color: 'white',
}

const sessionInputProps = {
  minH: '40px',
  bg: 'rgba(255,255,255,0.045)',
  color: 'white',
  borderColor: 'rgba(255,255,255,0.08)',
  borderRadius: 'xl',
  _placeholder: { color: 'whiteAlpha.400' },
  _hover: { borderColor: 'rgba(255,255,255,0.14)' },
  _focusVisible: { borderColor: 'brand.400', boxShadow: '0 0 0 1px var(--chakra-colors-brand-400)' },
} as const

function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Box bg="rgba(255,255,255,0.025)" borderRadius="xl" p={{ base: 4, md: 5 }}>
      <Box mb={4}>
        <Heading as="h3" color="white" fontSize="md" fontWeight="semibold">{title}</Heading>
        <Text color="whiteAlpha.450" fontSize="sm" mt={1}>{description}</Text>
      </Box>
      <VStack align="stretch" gap={4}>{children}</VStack>
    </Box>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Text color="whiteAlpha.550" fontSize="sm" fontWeight="medium" mb={2}>{label}</Text>
      {children}
    </Box>
  )
}

function Modal({
  title,
  children,
  onClose,
  fullScreen = false,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
  fullScreen?: boolean
}) {
  return (
    <Flex
      position="fixed"
      inset={0}
      zIndex={80}
      bg="blackAlpha.700"
      align={fullScreen ? 'stretch' : 'center'}
      justify="center"
      p={fullScreen ? 0 : 4}
      onClick={onClose}
    >
      <MotionBox
        initial={fullScreen ? { opacity: 0, y: 18 } : { opacity: 0, scale: 0.96 }}
        animate={fullScreen ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1 }}
        exit={fullScreen ? { opacity: 0, y: 18 } : { opacity: 0, scale: 0.96 }}
        bg="#111111"
        border={fullScreen ? 0 : '1px solid'}
        borderColor="whiteAlpha.100"
        borderRadius={fullScreen ? 0 : '2xl'}
        maxW={fullScreen ? 'none' : '680px'}
        w="full"
        h={fullScreen ? '100dvh' : 'auto'}
        maxH={fullScreen ? '100dvh' : 'calc(100vh - 32px)'}
        overflowY="auto"
        onClick={(event) => event.stopPropagation()}
      >
        <Flex
          justify="space-between"
          align="center"
          px={{ base: 4, md: 7 }}
          py={4}
          borderBottom="1px solid"
          borderColor="whiteAlpha.100"
          position={fullScreen ? 'sticky' : 'static'}
          top={0}
          zIndex={5}
          bg="#111111"
        >
          <Heading as="h2" fontSize={{ base: 'md', md: 'lg' }} color="white">{title}</Heading>
          <Button onClick={onClose} h="44px" px={5} bg="whiteAlpha.50" color="whiteAlpha.800" border={0} borderRadius="lg" _hover={{ bg: 'whiteAlpha.100', color: 'white' }}>
            <X size={15} />
            Close
          </Button>
        </Flex>
        <Box p={fullScreen ? 0 : 5}>{children}</Box>
      </MotionBox>
    </Flex>
  )
}
