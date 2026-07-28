'use client'

import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
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
import { CalendarDays, CheckCircle2, CreditCard, ImagePlus, Link as LinkIcon, Mail, MapPin, MessageCircle, Pencil, Plus, Search, Send, Trash2, UserRoundMinus, Users, X } from 'lucide-react'
import { Timestamp, arrayRemove, arrayUnion } from 'firebase/firestore'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useCollection } from '@/hooks'
import { sendSessionConfirmationWhatsApp } from '../../../lib/adminNotifications'
import { createDocument, createDocumentWithId, deleteDocument, updateDocument } from '../../../lib/firestore'
import { getRegistrationCounts, getSessionRegistrationId, getUserWhatsAppPhone, normalizeSessionRegistrationConfig, updateSessionRegistration } from '../../../lib/sessionRegistrations'
import { STORAGE_PATHS, uploadFileSimple, validateFile } from '../../../lib/storage'
import type {
  CreateDocument,
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

const registrationStatuses: SessionRegistrationStatus[] = [
  'requested',
  'pending_payment',
  'paid_pending_confirmation',
  'confirmed',
  'waitlisted',
  'declined',
  'cancelled',
]

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
  waived: 'Waived',
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

const modalFooterButtonProps = {
  h: '44px',
  minW: '112px',
  px: 5,
  borderRadius: 'xl',
  fontSize: 'sm',
  fontWeight: 'semibold',
  lineHeight: '1',
  gap: 2,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  whiteSpace: 'nowrap',
} as const

const registrationActionButtonProps = {
  h: '42px',
  minW: { base: 'full', md: '124px' },
  w: { base: 'full', sm: 'auto' },
  px: 4.5,
  borderRadius: 'full',
  fontSize: 'sm',
  fontWeight: 'semibold',
  lineHeight: '1',
  gap: 2,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
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
      address: form.location.trim(),
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
    error: usersError,
  } = useCollection('users', {
    orderBy: 'displayName',
    orderDirection: 'asc',
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
                {detailSession.about && (
                  <Box mt={4} p={4} borderRadius="xl" bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.100">
                    <Text color="whiteAlpha.500" fontSize="xs" textTransform="uppercase" letterSpacing="wider" mb={2}>About This Session</Text>
                    <Text color="whiteAlpha.700" whiteSpace="pre-line">{detailSession.about}</Text>
                  </Box>
                )}
              </Box>
              <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4}>
                <Info label="Date" value={`${formatDate(detailSession.date)} ${formatTime(detailSession.date)}`} />
                <Info label="Location" value={detailSession.location?.name || 'Not set'} />
                <Info label="Facilitator" value={detailSession.facilitator?.name || 'Not set'} />
                <Info label="Attendance" value={`${getSessionConfirmedCount(detailSession, registrationsBySessionId)} / ${detailSession.capacity || 0}`} />
                <Info label="Waitlist" value={String(getSessionWaitlistCount(detailSession, registrationsBySessionId))} />
                <Info label="Access" value={(detailSession.accessMode || 'open').replace('_', ' ')} />
                <Info label="Payment" value={normalizeSessionRegistrationConfig(detailSession).paymentMode === 'paid' ? `${detailSession.currency || 'ZMW'} ${Number(detailSession.price || 0).toFixed(2)}` : 'Free'} />
                <Info label="Gallery" value={`${detailSession.gallery?.length || 0} images`} />
              </SimpleGrid>
              {detailSession.gallery && detailSession.gallery.length > 0 && (
                <SimpleGrid columns={{ base: 2, sm: 3 }} gap={3}>
                  {detailSession.gallery.slice(0, 6).map((item) => (
                    <Image
                      key={item.id}
                      src={item.thumbnailUrl || item.url}
                      alt={item.caption || 'Session gallery image'}
                      borderRadius="xl"
                      h="108px"
                      w="full"
                      objectFit="cover"
                    />
                  ))}
                </SimpleGrid>
              )}
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
                onWaitlist={handleWaitlistRegistration}
                onDecline={handleDeclineRegistration}
                onRetryWhatsApp={handleRetryWhatsApp}
                resendingWhatsAppId={resendingWhatsAppId}
              />
              {getSessionRegistrations(registrationsBySessionId, detailSession.id).length === 0 && (
                <>
                  <SignupSection
                    title="Legacy Signed Up"
                    emptyLabel="No legacy attendees yet."
                    people={resolveSignupPeople(detailSession.attendees, usersById)}
                    loading={usersLoading}
                    error={usersError?.message}
                  />
                  <SignupSection
                    title="Legacy Waitlist"
                    emptyLabel="No legacy waitlist entries yet."
                    people={resolveSignupPeople(detailSession.waitlist, usersById)}
                    loading={usersLoading}
                    error={usersError?.message}
                  />
                </>
              )}
              <HStack justify="flex-end" gap={3} pt={1} flexWrap="wrap">
                <Button
                  {...modalFooterButtonProps}
                  onClick={() => setDetailSession(null)}
                  bg="whiteAlpha.100"
                  color="white"
                  border="1px solid"
                  borderColor="whiteAlpha.200"
                  _hover={{ bg: 'whiteAlpha.200' }}
                >
                  <X size={16} />
                  Close
                </Button>
                <Button
                  {...modalFooterButtonProps}
                  onClick={() => { setDetailSession(null); openEdit(detailSession) }}
                  bg="brand.500"
                  color="white"
                  _hover={{ bg: 'brand.600' }}
                >
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <Box p={4} bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.100" borderRadius="xl">
      <Text color="whiteAlpha.500" fontSize="xs" textTransform="uppercase" letterSpacing="0.12em">{label}</Text>
      <Text color="white" mt={1}>{value}</Text>
    </Box>
  )
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
  onWaitlist,
  onDecline,
  onRetryWhatsApp,
  resendingWhatsAppId,
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
  onWaitlist: (registration: SessionRegistration) => void
  onDecline: (registration: SessionRegistration) => void
  onRetryWhatsApp: (registration: SessionRegistration) => void
  resendingWhatsAppId: string | null
}) {
  const [selectedUserId, setSelectedUserId] = useState('')
  const [newRegistrationPhone, setNewRegistrationPhone] = useState('')
  const [newRegistrationStatus, setNewRegistrationStatus] = useState<SessionRegistrationStatus>('requested')
  const [addingRegistration, setAddingRegistration] = useState(false)
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

  const addRegistrationForm = (
    <Box p={4} bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.100" borderRadius="xl">
      <Flex justify="space-between" align={{ base: 'flex-start', sm: 'center' }} gap={3} direction={{ base: 'column', sm: 'row' }} mb={3}>
        <Box>
          <Text color="white" fontWeight="semibold">Add guest</Text>
          <Text color="whiteAlpha.500" fontSize="sm">Create a registration for an existing Club BZR account.</Text>
        </Box>
        <Badge bg="brand.500/20" color="brand.200" borderRadius="full" px={3} py={1}>
          {paymentStatusLabels[newPaymentStatus]}
        </Badge>
      </Flex>
      <form onSubmit={handleAddRegistrationSubmit}>
        <SimpleGrid columns={{ base: 1, lg: 4 }} gap={3}>
          <select
            value={selectedUserId}
            onChange={(event) => {
              const userId = event.target.value
              const selectedUser = availableUsers.find((user) => (user.uid || user.id) === userId)
              setSelectedUserId(userId)
              setNewRegistrationPhone(selectedUser?.whatsappPhone || selectedUser?.phone || '')
            }}
            style={filterSelectStyle}
            disabled={usersLoading || addingRegistration}
          >
            <option value="">{usersLoading ? 'Loading users...' : 'Select user'}</option>
            {availableUsers.map((user) => {
              const userId = user.uid || user.id
              return (
                <option key={userId} value={userId}>
                  {user.displayName || user.email || userId} {user.email ? `- ${user.email}` : ''}
                </option>
              )
            })}
          </select>
          <Input
            value={newRegistrationPhone}
            onChange={(event) => setNewRegistrationPhone(event.target.value)}
            placeholder="WhatsApp number"
            h="46px"
            bg="whiteAlpha.50"
            borderColor="whiteAlpha.200"
            color="white"
            disabled={addingRegistration}
          />
          <select
            value={newRegistrationStatus}
            onChange={(event) => setNewRegistrationStatus(event.target.value as SessionRegistrationStatus)}
            style={filterSelectStyle}
            disabled={addingRegistration}
          >
            {adminAddRegistrationStatuses.map((status) => (
              <option key={status} value={status}>
                {registrationStatusLabels[status]}
              </option>
            ))}
          </select>
          <Button
            type="submit"
            h="46px"
            bg="brand.500"
            color="white"
            borderRadius="xl"
            _hover={{ bg: 'brand.600' }}
            disabled={!selectedUserId || !newRegistrationPhone.trim() || addingRegistration || usersLoading}
          >
            {addingRegistration ? <Spinner size="sm" /> : 'Add Registration'}
          </Button>
        </SimpleGrid>
      </form>
      {!usersLoading && availableUsers.length === 0 && (
        <Text color="whiteAlpha.500" fontSize="sm" mt={3}>
          Every existing user already has a registration record for this session.
        </Text>
      )}
    </Box>
  )

  return (
    <VStack align="stretch" gap={4}>
      {addRegistrationForm}

      {loading ? (
        <Flex align="center" gap={2} color="whiteAlpha.600" fontSize="sm">
          <Spinner size="sm" color="brand.500" />
          <Text>Loading registrations...</Text>
        </Flex>
      ) : error ? (
        <Box p={3} bg="red.500/10" border="1px solid" borderColor="red.500/30" borderRadius="xl">
          <Text color="red.200" fontSize="sm">{error}</Text>
        </Box>
      ) : registrations.length === 0 ? (
        <Box p={4} bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.100" borderRadius="xl">
          <Text color="whiteAlpha.500" fontSize="sm">No registration records yet.</Text>
        </Box>
      ) : (
        registrationStatuses.map((status) => {
          const records = registrations.filter((registration) => registration.status === status)
          if (records.length === 0) return null

          return (
            <Box key={status}>
              <Flex justify="space-between" align="center" mb={3}>
                <Text color="white" fontWeight="semibold">{registrationStatusLabels[status]}</Text>
                <Badge bg="whiteAlpha.100" color="whiteAlpha.800" borderRadius="full" px={3} py={1}>
                  {records.length}
                </Badge>
              </Flex>
              <VStack align="stretch" gap={2}>
                {records.map((registration) => (
                  <RegistrationRow
                    key={registration.id}
                    registration={registration}
                    onMarkPaid={onMarkPaid}
                    onConfirm={onConfirm}
                    onWaitlist={onWaitlist}
                    onDecline={onDecline}
                    onRetryWhatsApp={onRetryWhatsApp}
                    isRetryingWhatsApp={resendingWhatsAppId === registration.id}
                  />
                ))}
              </VStack>
            </Box>
          )
        })
      )}
    </VStack>
  )
}

function RegistrationRow({
  registration,
  onMarkPaid,
  onConfirm,
  onWaitlist,
  onDecline,
  onRetryWhatsApp,
  isRetryingWhatsApp,
}: {
  registration: SessionRegistration
  onMarkPaid: (registration: SessionRegistration) => void
  onConfirm: (registration: SessionRegistration, markPaid?: boolean) => void
  onWaitlist: (registration: SessionRegistration) => void
  onDecline: (registration: SessionRegistration) => void
  onRetryWhatsApp: (registration: SessionRegistration) => void
  isRetryingWhatsApp: boolean
}) {
  const isTerminal = registration.status === 'declined' || registration.status === 'cancelled'
  const isConfirmed = registration.status === 'confirmed'
  const needsPayment =
    registration.paymentStatus === 'unpaid' ||
    registration.paymentStatus === 'pending' ||
    registration.paymentStatus === 'failed'
  const canMarkPaid = !isTerminal && !isConfirmed && needsPayment
  const canConfirm = !isTerminal && !isConfirmed
  const canMoveToWaitlist = !isTerminal && registration.status !== 'waitlisted' && !isConfirmed
  const canDecline = !isTerminal && !isConfirmed
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

  return (
    <Box p={{ base: 4, md: 5 }} bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.100" borderRadius="xl">
      <Flex
        gap={{ base: 4, lg: 6 }}
        justify="space-between"
        align={{ base: 'stretch', lg: 'flex-start' }}
        direction={{ base: 'column', lg: 'row' }}
      >
        <HStack gap={3} minW={0} align="flex-start">
          {registration.photoURL ? (
            <Image src={registration.photoURL} alt={registration.displayName} boxSize="40px" borderRadius="full" objectFit="cover" />
          ) : (
            <Flex boxSize="40px" borderRadius="full" bg="brand.500/20" color="brand.200" align="center" justify="center" flexShrink={0}>
              <Users size={18} />
            </Flex>
          )}
          <Box minW={0}>
            <Text color="white" fontWeight="semibold" lineClamp={1}>{registration.displayName}</Text>
            <HStack gap={2} color="whiteAlpha.600" fontSize="sm" minW={0}>
              <Mail size={14} />
              <Text lineClamp={1}>{registration.email || registration.userId}</Text>
            </HStack>
            <Text color="whiteAlpha.400" fontSize="xs" mt={1}>
              Requested {formatDateTime(registration.requestedAt)}
            </Text>
            {registration.whatsappPhone && (
              <HStack gap={2} color="whiteAlpha.500" fontSize="xs" mt={1}>
                <MessageCircle size={13} />
                <Text lineClamp={1}>{registration.whatsappPhone}</Text>
              </HStack>
            )}
          </Box>
        </HStack>

        <VStack
          align={{ base: 'stretch', lg: 'flex-end' }}
          gap={3}
          w={{ base: 'full', lg: 'auto' }}
          minW={{ lg: '408px' }}
          flexShrink={0}
        >
          <Flex gap={3} flexWrap="wrap" justify={{ base: 'flex-start', lg: 'flex-end' }} w="full">
            <Badge bg="whiteAlpha.100" color="whiteAlpha.800" borderRadius="full" px={3} py={1}>
              {paymentStatusLabels[registration.paymentStatus]}
            </Badge>
            {registration.paymentAmount && (
              <Badge bg="brand.500/20" color="brand.200" borderRadius="full" px={3} py={1}>
                {registration.paymentCurrency || 'ZMW'} {registration.paymentAmount.toFixed(2)}
              </Badge>
            )}
            {whatsappState && (
              <Badge bg={whatsappState.bg} color={whatsappState.color} borderRadius="full" px={3} py={1}>
                {whatsappState.label}
              </Badge>
            )}
          </Flex>
          {showWhatsAppIssue && (
            <Box
              w="full"
              maxW={{ lg: '460px' }}
              p={3}
              bg={isWhatsAppError ? 'red.500/10' : 'orange.500/10'}
              border="1px solid"
              borderColor={isWhatsAppError ? 'red.500/25' : 'orange.500/25'}
              borderRadius="lg"
            >
              <Text
                color={isWhatsAppError ? 'red.100' : 'orange.100'}
                fontSize="xs"
                lineHeight="1.45"
                overflowWrap="anywhere"
              >
                {whatsappIssue}
              </Text>
            </Box>
          )}
          <Flex
            gap={3}
            flexWrap="wrap"
            justify={{ base: 'stretch', lg: 'flex-end' }}
            w="full"
          >
            {canRetryWhatsApp && (
              <Button
                {...registrationActionButtonProps}
                bg="whiteAlpha.50"
                color="whiteAlpha.800"
                _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
                onClick={() => onRetryWhatsApp(registration)}
                disabled={isRetryingWhatsApp}
              >
                {isRetryingWhatsApp ? <Spinner size="sm" /> : <Send size={14} />}
                {whatsappActionLabel}
              </Button>
            )}
            {canMarkPaid && (
              <Button {...registrationActionButtonProps} bg="blue.500/15" color="blue.200" _hover={{ bg: 'blue.500/25' }} onClick={() => onMarkPaid(registration)}>
                <CreditCard size={14} />
                Mark Paid
              </Button>
            )}
            {canMarkPaid && (
              <Button {...registrationActionButtonProps} minW={{ base: 'full', sm: '152px' }} bg="green.500/15" color="green.200" _hover={{ bg: 'green.500/25' }} onClick={() => onConfirm(registration, true)}>
                <CheckCircle2 size={14} />
                Paid + Confirm
              </Button>
            )}
            {canConfirm && !needsPayment && (
              <Button {...registrationActionButtonProps} bg="green.500/15" color="green.200" _hover={{ bg: 'green.500/25' }} onClick={() => onConfirm(registration)}>
                <CheckCircle2 size={14} />
                Confirm
              </Button>
            )}
            {canMoveToWaitlist && (
              <Button {...registrationActionButtonProps} bg="orange.500/15" color="orange.200" _hover={{ bg: 'orange.500/25' }} onClick={() => onWaitlist(registration)}>
                <Users size={14} />
                Waitlist
              </Button>
            )}
            {canDecline && (
              <Button {...registrationActionButtonProps} bg="red.500/15" color="red.200" _hover={{ bg: 'red.500/25' }} onClick={() => onDecline(registration)}>
                <UserRoundMinus size={14} />
                Decline
              </Button>
            )}
          </Flex>
        </VStack>
      </Flex>
    </Box>
  )
}

function SignupSection({
  title,
  people,
  emptyLabel,
  loading,
  error,
}: {
  title: string
  people: SignupPerson[]
  emptyLabel: string
  loading: boolean
  error?: string
}) {
  return (
    <Box>
      <Flex justify="space-between" align="center" mb={3}>
        <Text color="white" fontWeight="semibold">{title}</Text>
        <Badge bg="whiteAlpha.100" color="whiteAlpha.800" borderRadius="full" px={3} py={1}>
          {people.length}
        </Badge>
      </Flex>

      {loading && (
        <Flex align="center" gap={2} color="whiteAlpha.600" fontSize="sm">
          <Spinner size="sm" color="brand.500" />
          <Text>Loading user details...</Text>
        </Flex>
      )}

      {!loading && error && (
        <Box p={3} bg="red.500/10" border="1px solid" borderColor="red.500/30" borderRadius="xl">
          <Text color="red.200" fontSize="sm">{error}</Text>
        </Box>
      )}

      {!loading && !error && people.length === 0 && (
        <Box p={4} bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.100" borderRadius="xl">
          <Text color="whiteAlpha.500" fontSize="sm">{emptyLabel}</Text>
        </Box>
      )}

      {!loading && !error && people.length > 0 && (
        <VStack align="stretch" gap={2}>
          {people.map((person) => (
            <Flex
              key={person.id}
              align={{ base: 'flex-start', sm: 'center' }}
              justify="space-between"
              gap={3}
              direction={{ base: 'column', sm: 'row' }}
              p={3}
              bg="whiteAlpha.50"
              border="1px solid"
              borderColor="whiteAlpha.100"
              borderRadius="xl"
            >
              <HStack gap={3} minW={0}>
                {person.photoURL ? (
                  <Image src={person.photoURL} alt={person.displayName} boxSize="36px" borderRadius="full" objectFit="cover" />
                ) : (
                  <Flex boxSize="36px" borderRadius="full" bg="brand.500/20" color="brand.200" align="center" justify="center" flexShrink={0}>
                    <Users size={17} />
                  </Flex>
                )}
                <Box minW={0}>
                  <Text color="white" fontWeight="semibold" lineClamp={1}>{person.displayName}</Text>
                  <Text color="whiteAlpha.500" fontSize="xs" lineClamp={1}>{person.id}</Text>
                </Box>
              </HStack>

              {person.email && (
                <HStack gap={2} color="whiteAlpha.650" fontSize="sm" minW={0}>
                  <Mail size={15} />
                  <Text lineClamp={1}>{person.email}</Text>
                </HStack>
              )}
            </Flex>
          ))}
        </VStack>
      )}
    </Box>
  )
}

function SessionFormFields({ form, setForm }: { form: SessionForm; setForm: React.Dispatch<React.SetStateAction<SessionForm>> }) {
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
    <VStack gap={4} align="stretch">
      <Field label="Title"><Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" /></Field>
      <Field label="Hero Description"><Textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" rows={3} placeholder="Short public summary shown in the hero and session cards." /></Field>
      <Field label="About This Session"><Textarea value={form.about} onChange={(e) => setForm((prev) => ({ ...prev, about: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" rows={5} placeholder="What will happen at the event, format, materials, schedule, or expectations." /></Field>
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
      <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
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
      <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
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
        <Field label="Currency"><Input value={form.currency} onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" /></Field>
      </SimpleGrid>
      {form.paymentMode === 'paid' && (
        <>
          <Field label="Price"><Input type="number" min={0} step="0.01" value={form.price} onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" /></Field>
          <Field label="Payment Instructions"><Textarea value={form.paymentInstructions} onChange={(e) => setForm((prev) => ({ ...prev, paymentInstructions: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" rows={3} placeholder="Bank transfer, cash, mobile money, or confirmation notes shown to users." /></Field>
        </>
      )}
      <Field label="Facilitator"><Input value={form.facilitator} onChange={(e) => setForm((prev) => ({ ...prev, facilitator: e.target.value }))} bg="gray.800" color="white" borderColor="whiteAlpha.200" /></Field>
      <Field label="Cover Image">
        <VStack align="stretch" gap={3}>
          {coverImage && (
            <Box position="relative" overflow="hidden" borderRadius="xl" border="1px solid" borderColor="whiteAlpha.150" bg="whiteAlpha.50">
              <Image src={coverImage} alt="Session cover preview" w="full" h="150px" objectFit="cover" />
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
            p={4}
            bg={isDraggingCover ? 'brand.500/10' : 'whiteAlpha.50'}
            border="1px dashed"
            borderColor={isDraggingCover ? 'brand.500' : 'whiteAlpha.200'}
            borderRadius="xl"
            transition="all 0.2s"
          >
            <Flex align={{ base: 'stretch', sm: 'center' }} direction={{ base: 'column', sm: 'row' }} gap={3}>
              <Flex w="44px" h="44px" align="center" justify="center" borderRadius="full" bg="gray.800" color="brand.300" flexShrink={0}>
                <ImagePlus size={20} />
              </Flex>
              <Box flex={1}>
                <Text color="white" fontWeight="semibold">Upload a cover image</Text>
                <Text color="whiteAlpha.500" fontSize="sm" mt={1}>Drop an image here or choose a JPG, PNG, WebP, or GIF under 10MB.</Text>
              </Box>
              <Input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" display="none" onChange={handleCoverInput} />
              <Button
                type="button"
                {...actionButtonProps}
                h="40px"
                px={4}
                loading={uploadingCover}
                bg="whiteAlpha.100"
                color="white"
                border="1px solid"
                borderColor="whiteAlpha.200"
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
              bg="gray.800"
              color="white"
              borderColor="whiteAlpha.200"
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
                  <Image src={item.thumbnailUrl || item.url} alt={item.caption || 'Session gallery image'} w="full" h="118px" objectFit="cover" />
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
            p={4}
            bg={isDraggingGallery ? 'brand.500/10' : 'whiteAlpha.50'}
            border="1px dashed"
            borderColor={isDraggingGallery ? 'brand.500' : 'whiteAlpha.200'}
            borderRadius="xl"
            transition="all 0.2s"
          >
            <Flex align={{ base: 'stretch', sm: 'center' }} direction={{ base: 'column', sm: 'row' }} gap={3}>
              <Flex w="44px" h="44px" align="center" justify="center" borderRadius="full" bg="gray.800" color="brand.300" flexShrink={0}>
                <ImagePlus size={20} />
              </Flex>
              <Box flex={1}>
                <Text color="white" fontWeight="semibold">Upload gallery images</Text>
                <Text color="whiteAlpha.500" fontSize="sm" mt={1}>Drop images here or choose multiple JPG, PNG, WebP, or GIF files under 10MB each.</Text>
              </Box>
              <Input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple display="none" onChange={handleGalleryInput} />
              <Button
                type="button"
                {...actionButtonProps}
                h="40px"
                px={4}
                loading={uploadingGallery}
                bg="whiteAlpha.100"
                color="white"
                border="1px solid"
                borderColor="whiteAlpha.200"
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
