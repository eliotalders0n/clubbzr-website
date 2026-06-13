'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  Box,
  Flex,
  Heading,
  Text,
  Button,
  Input,
  VStack,
  HStack,
  Badge,
  Table,
  Checkbox,
  Image,
  SimpleGrid,
  Grid,
  GridItem,
} from '@chakra-ui/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  Eye,
  Mail,
  Pencil,
  Search,
  Send,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { useCollection } from '@/hooks'
import { createDocumentWithId, deleteDocument, updateDocument } from '../../../lib/firestore'
import type {
  CreateDocument,
  CreativePassport,
  QuestSubmission,
  UpdateDocument,
  User as FirestoreUser,
  UserRole,
} from '../../../lib/schema'

const MotionBox = motion.create(Box)
const MotionFlex = motion.create(Flex)

type UserStatus = 'active' | 'suspended' | 'pending'
type FeedbackType = 'success' | 'error' | 'info' | 'warning'

interface ManagedUser {
  id: string
  uid: string
  displayName: string
  email: string
  username: string
  avatar?: string
  role: UserRole
  status: UserStatus
  createdAt: unknown
  lastActive: unknown
  sessionsAttended: number
  questsCompleted: number
  submissions: number
  isActive: boolean
  isOnboarded: boolean
}

interface Feedback {
  type: FeedbackType
  title: string
  description?: string
}

interface EditForm {
  displayName: string
  email: string
  username: string
  role: UserRole
  status: UserStatus
}

interface InviteForm {
  displayName: string
  email: string
  username: string
  role: UserRole
}

const ITEMS_PER_PAGE = 6

const roleFilters: Array<{ label: string; value: UserRole | 'all' }> = [
  { label: 'All Roles', value: 'all' },
  { label: 'Member', value: 'user' },
  { label: 'Artist', value: 'artist' },
  { label: 'Facilitator', value: 'facilitator' },
  { label: 'Curator', value: 'curator' },
  { label: 'Admin', value: 'admin' },
]

const statusFilters: Array<{ label: string; value: UserStatus | 'all' }> = [
  { label: 'All Status', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Pending', value: 'pending' },
  { label: 'Suspended', value: 'suspended' },
]

const roleStyles: Record<UserRole, { bg: string; color: string; borderColor: string }> = {
  user: { bg: 'whiteAlpha.100', color: 'whiteAlpha.800', borderColor: 'whiteAlpha.200' },
  artist: { bg: 'blue.500/20', color: 'blue.200', borderColor: 'blue.400/40' },
  facilitator: { bg: 'cyan.500/20', color: 'cyan.200', borderColor: 'cyan.400/40' },
  curator: { bg: 'purple.500/20', color: 'purple.200', borderColor: 'purple.400/40' },
  admin: { bg: 'brand.500/20', color: 'brand.200', borderColor: 'brand.500/50' },
}

const statusStyles: Record<UserStatus, { bg: string; color: string; borderColor: string }> = {
  active: { bg: 'green.500/18', color: 'green.200', borderColor: 'green.400/40' },
  pending: { bg: 'yellow.500/16', color: 'yellow.200', borderColor: 'yellow.400/40' },
  suspended: { bg: 'orange.500/18', color: 'orange.200', borderColor: 'orange.400/40' },
}

const feedbackStyles: Record<FeedbackType, { bg: string; borderColor: string; color: string; icon: ReactNode }> = {
  success: {
    bg: 'green.500/12',
    borderColor: 'green.400/30',
    color: 'green.200',
    icon: <CheckCircle2 size={18} />,
  },
  error: {
    bg: 'red.500/12',
    borderColor: 'red.400/30',
    color: 'red.200',
    icon: <AlertTriangle size={18} />,
  },
  info: {
    bg: 'blue.500/12',
    borderColor: 'blue.400/30',
    color: 'blue.200',
    icon: <Mail size={18} />,
  },
  warning: {
    bg: 'orange.500/12',
    borderColor: 'orange.400/30',
    color: 'orange.200',
    icon: <Ban size={18} />,
  },
}

const selectStyle: CSSProperties = {
  width: '100%',
  height: '48px',
  padding: '0 16px',
  backgroundColor: '#111111',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: '12px',
  color: 'white',
  outline: 'none',
}

const filterSelectStyle: CSSProperties = {
  ...selectStyle,
  backgroundColor: 'rgba(0,0,0,0.24)',
}

const emptyInviteForm: InviteForm = {
  displayName: '',
  email: '',
  username: '',
  role: 'user',
}

const toEditForm = (user: ManagedUser): EditForm => ({
  displayName: user.displayName,
  email: user.email,
  username: user.username,
  role: user.role,
  status: user.status,
})

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

const formatDate = (value: unknown) => {
  const date = toDate(value)
  if (!date) return 'Not recorded'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const formatLongDate = (value: unknown) => {
  const date = toDate(value)
  if (!date) return 'Not recorded'
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

const csvEscape = (value: string | number | unknown) => {
  const stringValue = String(value)
  return `"${stringValue.replace(/"/g, '""')}"`
}

const roleLabel = (role: UserRole): string => {
  if (role === 'user') return 'Member'
  return role.replace('_', ' ')
}

const statusToProfileFields = (status: UserStatus): Pick<FirestoreUser, 'isActive' | 'isOnboarded'> => ({
  isActive: status !== 'suspended',
  isOnboarded: status === 'active',
})

const deriveStatus = (user: FirestoreUser): UserStatus => {
  if (user.isActive === false) return 'suspended'
  if (!user.isOnboarded) return 'pending'
  return 'active'
}

const getUsername = (user: FirestoreUser): string => {
  const explicitUsername = (user as FirestoreUser & { username?: string }).username
  if (explicitUsername) return explicitUsername
  const emailName = user.email?.split('@')[0]
  if (emailName) return emailName
  return user.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

const buildManagedUsers = (
  users: FirestoreUser[],
  passports: CreativePassport[],
  submissions: QuestSubmission[]
): ManagedUser[] => {
  const passportsByUser = new Map(passports.map((passport) => [passport.userId, passport]))
  const submissionsByUser = submissions.reduce<Record<string, number>>((acc, submission) => {
    acc[submission.userId] = (acc[submission.userId] || 0) + 1
    return acc
  }, {})

  return users
    .map((user) => {
      const passport = passportsByUser.get(user.uid || user.id)
      return {
        id: user.id,
        uid: user.uid || user.id,
        displayName: user.displayName || 'Unnamed user',
        email: user.email || '',
        username: getUsername(user),
        avatar: user.photoURL || undefined,
        role: user.role || 'user',
        status: deriveStatus(user),
        createdAt: user.createdAt,
        lastActive: user.lastActiveAt || user.updatedAt || user.createdAt,
        sessionsAttended: passport?.eventsAttended?.length || 0,
        questsCompleted: passport?.questsCompleted?.length || 0,
        submissions: submissionsByUser[user.uid || user.id] || 0,
        isActive: user.isActive !== false,
        isOnboarded: Boolean(user.isOnboarded),
      }
    })
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
}

export default function ManageUsers() {
  const {
    data: userDocs,
    loading: usersLoading,
    error: usersError,
    refetch: refetchUsers,
  } = useCollection('users', {
    orderBy: 'createdAt',
    orderDirection: 'desc',
  })
  const { data: passports } = useCollection('creativePassports')
  const { data: submissions } = useCollection('questSubmissions')
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [inviteForm, setInviteForm] = useState<InviteForm>(emptyInviteForm)
  const [bulkRole, setBulkRole] = useState<UserRole>('user')
  const [modal, setModal] = useState<'view' | 'edit' | 'delete' | 'invite' | 'bulkRole' | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const notify = useCallback((type: FeedbackType, title: string, description?: string) => {
    setFeedback({ type, title, description })
  }, [])

  useEffect(() => {
    if (!feedback) return
    const timeout = window.setTimeout(() => setFeedback(null), 3600)
    return () => window.clearTimeout(timeout)
  }, [feedback])

  const users = useMemo(
    () => buildManagedUsers(userDocs, passports, submissions),
    [passports, submissions, userDocs]
  )

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return users.filter((user) => {
      const matchesSearch =
        !query ||
        user.displayName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query)
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, searchQuery, roleFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE))
  const effectivePage = Math.min(currentPage, totalPages)

  const paginatedUsers = useMemo(() => {
    const startIndex = (effectivePage - 1) * ITEMS_PER_PAGE
    return filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [filteredUsers, effectivePage])

  const selectedRecords = useMemo(
    () => users.filter((user) => selectedUsers.includes(user.id)),
    [selectedUsers, users]
  )

  const activeCount = users.filter((user) => user.status === 'active').length
  const pendingCount = users.filter((user) => user.status === 'pending').length
  const suspendedCount = users.filter((user) => user.status === 'suspended').length
  const adminCount = users.filter((user) => user.role === 'admin').length
  const pageStart = filteredUsers.length === 0 ? 0 : (effectivePage - 1) * ITEMS_PER_PAGE + 1
  const pageEnd = Math.min(effectivePage * ITEMS_PER_PAGE, filteredUsers.length)
  const allPageSelected =
    paginatedUsers.length > 0 && paginatedUsers.every((user) => selectedUsers.includes(user.id))

  const toggleSelectUser = (userId: string) => {
    setSelectedUsers((previous) =>
      previous.includes(userId) ? previous.filter((id) => id !== userId) : [...previous, userId]
    )
  }

  const toggleSelectAll = () => {
    const pageIds = paginatedUsers.map((user) => user.id)
    setSelectedUsers((previous) => {
      if (allPageSelected) {
        return previous.filter((id) => !pageIds.includes(id))
      }

      return Array.from(new Set([...previous, ...pageIds]))
    })
  }

  const openView = (user: ManagedUser) => {
    setSelectedUser(user)
    setModal('view')
  }

  const openEdit = (user: ManagedUser) => {
    setSelectedUser(user)
    setEditForm(toEditForm(user))
    setModal('edit')
  }

  const openDelete = (user: ManagedUser) => {
    setSelectedUser(user)
    setModal('delete')
  }

  const closeModal = () => {
    setModal(null)
    setSelectedUser(null)
    setEditForm(null)
    setInviteForm(emptyInviteForm)
  }

  const handleSaveEdit = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedUser || !editForm) return

    const displayName = editForm.displayName.trim()
    const email = editForm.email.trim()
    const username = editForm.username.trim().replace(/^@/, '')

    if (!displayName || !email || !username) {
      notify('error', 'Missing user details', 'Name, email, and username are required.')
      return
    }

    const payload = {
      displayName,
      email,
      role: editForm.role,
      ...statusToProfileFields(editForm.status),
      username,
    } as UpdateDocument<FirestoreUser> & { username: string }

    const result = await updateDocument('users', selectedUser.id, payload)
    if (!result.success) {
      notify('error', 'User update failed', result.error?.message || 'Could not update the Firestore user profile.')
      return
    }

    await refetchUsers()
    notify('success', 'User updated', `${displayName}'s Firestore profile changes were saved.`)
    closeModal()
  }

  const handleInviteUser = async (event: FormEvent) => {
    event.preventDefault()

    const displayName = inviteForm.displayName.trim()
    const email = inviteForm.email.trim()
    const username =
      inviteForm.username.trim().replace(/^@/, '') ||
      email.split('@')[0]?.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() ||
      'newuser'

    if (!displayName || !email) {
      notify('error', 'Invite needs a name and email', 'Add the user details before sending an invite.')
      return
    }

    if (users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
      notify('warning', 'User already exists', `${email} is already in the user list.`)
      return
    }

    const invitedUserId = `invited-${Date.now()}`
    const invitedUser = {
      uid: invitedUserId,
      displayName,
      email,
      photoURL: null,
      role: inviteForm.role,
      isOnboarded: false,
      isActive: true,
      username,
    } as CreateDocument<FirestoreUser> & { username: string }

    const result = await createDocumentWithId('users', invitedUserId, invitedUser)
    if (!result.success) {
      notify('error', 'Invite was not created', result.error?.message || 'Could not create the pending Firestore user profile.')
      return
    }

    await refetchUsers()
    setCurrentPage(1)
    notify('success', 'Invite profile created', `${displayName} was added as a pending ${roleLabel(inviteForm.role)}.`)
    closeModal()
  }

  const handleExport = () => {
    const rows = filteredUsers.map((user) => [
      user.displayName,
      user.email,
      user.username,
      roleLabel(user.role),
      user.status,
      formatDate(user.createdAt),
      formatDate(user.lastActive),
      user.sessionsAttended,
      user.questsCompleted,
      user.submissions,
    ])
    const csv = [
      'Name,Email,Username,Role,Status,Joined,Last Active,Sessions,Quests,Submissions',
      ...rows.map((row) => row.map(csvEscape).join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `club-bzr-users-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    notify('success', 'Export ready', `${filteredUsers.length} user${filteredUsers.length === 1 ? '' : 's'} exported to CSV.`)
  }

  const handleToggleStatus = async (user: ManagedUser) => {
    const nextStatus: UserStatus = user.status === 'suspended' ? 'active' : 'suspended'
    const result = await updateDocument('users', user.id, statusToProfileFields(nextStatus))
    if (!result.success) {
      notify('error', 'Status update failed', result.error?.message || 'Could not update this Firestore user profile.')
      return
    }
    await refetchUsers()
    notify(
      nextStatus === 'suspended' ? 'warning' : 'success',
      nextStatus === 'suspended' ? 'User suspended' : 'User reactivated',
      `${user.displayName} is now ${nextStatus}.`
    )
  }

  const handleDeleteUser = async () => {
    if (!selectedUser) return
    const result = await deleteDocument('users', selectedUser.id)
    if (!result.success) {
      notify('error', 'Delete failed', result.error?.message || 'Could not delete this Firestore user profile.')
      return
    }
    await refetchUsers()
    setSelectedUsers((previous) => previous.filter((id) => id !== selectedUser.id))
    notify('warning', 'User removed', `${selectedUser.displayName} was removed from Firestore users.`)
    closeModal()
  }

  const handleBulkSuspend = async () => {
    if (selectedUsers.length === 0) return
    const results = await Promise.all(
      selectedUsers.map((id) => updateDocument('users', id, statusToProfileFields('suspended')))
    )
    const failed = results.filter((result) => !result.success)
    if (failed.length > 0) {
      notify('error', 'Some users were not suspended', failed[0].error?.message || 'One or more Firestore updates failed.')
      return
    }
    await refetchUsers()
    notify('warning', 'Users suspended', `${selectedUsers.length} selected user${selectedUsers.length === 1 ? '' : 's'} suspended.`)
    setSelectedUsers([])
  }

  const handleBulkDelete = async () => {
    if (selectedUsers.length === 0) return
    const count = selectedUsers.length
    const results = await Promise.all(selectedUsers.map((id) => deleteDocument('users', id)))
    const failed = results.filter((result) => !result.success)
    if (failed.length > 0) {
      notify('error', 'Some users were not deleted', failed[0].error?.message || 'One or more Firestore deletes failed.')
      return
    }
    await refetchUsers()
    notify('warning', 'Users removed', `${count} selected user${count === 1 ? '' : 's'} removed.`)
    setSelectedUsers([])
  }

  const handleBulkRoleChange = async () => {
    if (selectedUsers.length === 0) return
    const count = selectedUsers.length
    const results = await Promise.all(
      selectedUsers.map((id) => updateDocument('users', id, { role: bulkRole }))
    )
    const failed = results.filter((result) => !result.success)
    if (failed.length > 0) {
      notify('error', 'Some roles were not updated', failed[0].error?.message || 'One or more Firestore updates failed.')
      return
    }
    await refetchUsers()
    notify('success', 'Roles updated', `${count} selected user${count === 1 ? '' : 's'} moved to ${roleLabel(bulkRole)}.`)
    setSelectedUsers([])
    setModal(null)
  }

  const handleCopyProfileLink = async (user: ManagedUser) => {
    const url = `${window.location.origin}/passport?user=${user.id}`
    try {
      await navigator.clipboard.writeText(url)
      notify('success', 'Profile link copied', `${user.displayName}'s profile link is on your clipboard.`)
    } catch {
      notify('info', 'Profile link', url)
    }
  }

  return (
    <AdminLayout>
      <Box px={{ base: 4, md: 8, xl: 12 }} py={{ base: 6, md: 8 }}>
        <AnimatePresence>
          {feedback && <FeedbackToast feedback={feedback} onClose={() => setFeedback(null)} />}
        </AnimatePresence>

        <MotionBox initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
          <VStack gap={6} align="stretch">
            <Flex
              direction={{ base: 'column', md: 'row' }}
              justify="space-between"
              align={{ base: 'stretch', md: 'flex-start' }}
              gap={4}
            >
              <Box>
                <Text color="brand.400" fontSize="xs" letterSpacing="0.24em" textTransform="uppercase" mb={2}>
                  Admin
                </Text>
                <Heading as="h1" size="lg" color="white" lineHeight={1}>
                  Users
                </Heading>
                <Text color="whiteAlpha.600" mt={3}>
                  {filteredUsers.length} of {users.length} users shown
                </Text>
              </Box>
              <HStack gap={3} justify={{ base: 'stretch', md: 'flex-end' }} flexWrap="wrap">
                <Button
                  onClick={handleExport}
                  bg="whiteAlpha.80"
                  color="white"
                  border="1px solid"
                  borderColor="whiteAlpha.200"
                  borderRadius="full"
                  px={5}
                  _hover={{ bg: 'whiteAlpha.100', borderColor: 'whiteAlpha.300' }}
                >
                  <Download size={17} />
                  Export
                </Button>
                <Button
                  onClick={() => setModal('invite')}
                  bg="brand.500"
                  color="white"
                  borderRadius="full"
                  px={5}
                  _hover={{ bg: 'brand.600' }}
                >
                  <UserPlus size={17} />
                  Invite User
                </Button>
              </HStack>
            </Flex>

            <SimpleGrid columns={{ base: 2, xl: 4 }} gap={4}>
              <StatCard icon={<UsersRound size={18} />} label="Total Users" value={users.length.toString()} />
              <StatCard icon={<UserCheck size={18} />} label="Active" value={activeCount.toString()} color="green.200" />
              <StatCard icon={<Clock3 size={18} />} label="Pending" value={pendingCount.toString()} color="yellow.200" />
              <StatCard icon={<Shield size={18} />} label="Admins" value={adminCount.toString()} helper={`${suspendedCount} suspended`} />
            </SimpleGrid>

            <Box
              bg="rgba(17,17,17,0.92)"
              border="1px solid"
              borderColor="whiteAlpha.100"
              borderRadius="2xl"
              p={{ base: 4, md: 5 }}
            >
              <Grid templateColumns={{ base: '1fr', lg: 'minmax(280px, 1.6fr) minmax(180px, 1fr) minmax(180px, 1fr)' }} gap={4} alignItems="end">
                <GridItem>
                  <Text color="whiteAlpha.500" fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="0.08em" mb={2}>
                    Search
                  </Text>
                  <Box position="relative">
                    <Box position="absolute" left={4} top="50%" transform="translateY(-50%)" color="whiteAlpha.500">
                      <Search size={18} />
                    </Box>
                    <Input
                      value={searchQuery}
                      onChange={(event) => {
                        setSearchQuery(event.target.value)
                        setCurrentPage(1)
                      }}
                      placeholder="Search name, email, or username"
                      bg="blackAlpha.400"
                      color="white"
                      borderColor="whiteAlpha.200"
                      borderRadius="xl"
                      h={12}
                      pl={11}
                      _placeholder={{ color: 'whiteAlpha.400' }}
                      _focus={{ borderColor: 'brand.500', boxShadow: '0 0 0 1px rgba(255, 107, 53, 0.35)' }}
                    />
                  </Box>
                </GridItem>
                <GridItem>
                  <Text color="whiteAlpha.500" fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="0.08em" mb={2}>
                    Role
                  </Text>
                  <select
                    value={roleFilter}
                    onChange={(event) => {
                      setRoleFilter(event.target.value as UserRole | 'all')
                      setCurrentPage(1)
                    }}
                    style={filterSelectStyle}
                  >
                    {roleFilters.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </GridItem>
                <GridItem>
                  <Text color="whiteAlpha.500" fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="0.08em" mb={2}>
                    Status
                  </Text>
                  <select
                    value={statusFilter}
                    onChange={(event) => {
                      setStatusFilter(event.target.value as UserStatus | 'all')
                      setCurrentPage(1)
                    }}
                    style={filterSelectStyle}
                  >
                    {statusFilters.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </GridItem>
              </Grid>
            </Box>

            {usersError && (
              <Box p={4} bg="red.500/10" border="1px solid" borderColor="red.500/30" borderRadius="xl">
                <Text color="red.200" fontSize="sm">
                  {usersError.message}
                </Text>
              </Box>
            )}

            <AnimatePresence>
              {selectedUsers.length > 0 && (
                <MotionFlex
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  bg="brand.500/12"
                  border="1px solid"
                  borderColor="brand.500/30"
                  borderRadius="2xl"
                  p={{ base: 4, md: 5 }}
                  align={{ base: 'stretch', md: 'center' }}
                  justify="space-between"
                  gap={4}
                  direction={{ base: 'column', md: 'row' }}
                >
                  <Box>
                    <Text color="white" fontWeight="semibold">
                      {selectedUsers.length} selected
                    </Text>
                    <Text color="whiteAlpha.600" fontSize="sm">
                      {selectedRecords.map((user) => user.displayName).slice(0, 3).join(', ')}
                      {selectedRecords.length > 3 ? ` and ${selectedRecords.length - 3} more` : ''}
                    </Text>
                  </Box>
                  <HStack gap={2} flexWrap="wrap">
                    <Button size="sm" onClick={() => setSelectedUsers([])} bg="whiteAlpha.50" color="whiteAlpha.700" borderRadius="full" _hover={{ bg: 'whiteAlpha.100', color: 'white' }}>
                      Clear
                    </Button>
                    <Button size="sm" onClick={() => setModal('bulkRole')} bg="whiteAlpha.100" color="white" borderRadius="full" _hover={{ bg: 'whiteAlpha.200' }}>
                      Change Role
                    </Button>
                    <Button size="sm" onClick={handleBulkSuspend} bg="orange.500/18" color="orange.200" borderRadius="full" _hover={{ bg: 'orange.500/25' }}>
                      Suspend
                    </Button>
                    <Button size="sm" onClick={handleBulkDelete} bg="red.500/16" color="red.200" borderRadius="full" _hover={{ bg: 'red.500/25' }}>
                      Delete
                    </Button>
                  </HStack>
                </MotionFlex>
              )}
            </AnimatePresence>

            <Box
              bg="rgba(17,17,17,0.94)"
              border="1px solid"
              borderColor="whiteAlpha.100"
              borderRadius="2xl"
              overflow="hidden"
            >
              <Box overflowX="auto">
                <Table.Root size="md" minW="980px">
                  <Table.Header>
                    <Table.Row bg="whiteAlpha.50" borderBottom="1px solid" borderColor="whiteAlpha.100">
                      <Table.ColumnHeader w="52px" px={5}>
                        <Checkbox.Root checked={allPageSelected} onCheckedChange={toggleSelectAll}>
                          <Checkbox.HiddenInput />
                          <Checkbox.Control
                            borderColor="whiteAlpha.300"
                            bg="blackAlpha.300"
                            _checked={{ bg: 'brand.500', borderColor: 'brand.500' }}
                          />
                        </Checkbox.Root>
                      </Table.ColumnHeader>
                      <Table.ColumnHeader color="whiteAlpha.600" fontWeight="semibold" fontSize="xs" letterSpacing="0.08em" textTransform="uppercase">
                        User
                      </Table.ColumnHeader>
                      <Table.ColumnHeader color="whiteAlpha.600" fontWeight="semibold" fontSize="xs" letterSpacing="0.08em" textTransform="uppercase">
                        Email
                      </Table.ColumnHeader>
                      <Table.ColumnHeader color="whiteAlpha.600" fontWeight="semibold" fontSize="xs" letterSpacing="0.08em" textTransform="uppercase">
                        Role
                      </Table.ColumnHeader>
                      <Table.ColumnHeader color="whiteAlpha.600" fontWeight="semibold" fontSize="xs" letterSpacing="0.08em" textTransform="uppercase">
                        Status
                      </Table.ColumnHeader>
                      <Table.ColumnHeader color="whiteAlpha.600" fontWeight="semibold" fontSize="xs" letterSpacing="0.08em" textTransform="uppercase">
                        Activity
                      </Table.ColumnHeader>
                      <Table.ColumnHeader color="whiteAlpha.600" fontWeight="semibold" fontSize="xs" letterSpacing="0.08em" textTransform="uppercase">
                        Joined
                      </Table.ColumnHeader>
                      <Table.ColumnHeader color="whiteAlpha.600" fontWeight="semibold" fontSize="xs" letterSpacing="0.08em" textTransform="uppercase" textAlign="right">
                        Actions
                      </Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {paginatedUsers.map((user) => (
                      <Table.Row
                        key={user.id}
                        borderBottom="1px solid"
                        borderColor="whiteAlpha.100"
                        _hover={{ bg: 'whiteAlpha.50' }}
                        transition="background 0.2s"
                      >
                        <Table.Cell px={5}>
                          <Checkbox.Root checked={selectedUsers.includes(user.id)} onCheckedChange={() => toggleSelectUser(user.id)}>
                            <Checkbox.HiddenInput />
                            <Checkbox.Control
                              borderColor="whiteAlpha.300"
                              bg="blackAlpha.300"
                              _checked={{ bg: 'brand.500', borderColor: 'brand.500' }}
                            />
                          </Checkbox.Root>
                        </Table.Cell>
                        <Table.Cell py={4}>
                          <HStack gap={3}>
                            <Avatar user={user} />
                            <Box minW={0}>
                              <Text color="white" fontWeight="semibold" lineHeight={1.2}>
                                {user.displayName}
                              </Text>
                              <Text color="whiteAlpha.500" fontSize="sm">
                                @{user.username}
                              </Text>
                            </Box>
                          </HStack>
                        </Table.Cell>
                        <Table.Cell>
                          <Text color="whiteAlpha.700" fontSize="sm">
                            {user.email}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <RoleBadge role={user.role} />
                        </Table.Cell>
                        <Table.Cell>
                          <StatusBadge status={user.status} />
                        </Table.Cell>
                        <Table.Cell>
                          <HStack gap={3} color="whiteAlpha.600" fontSize="sm">
                            <Text>{user.sessionsAttended} sessions</Text>
                            <Text color="whiteAlpha.300">/</Text>
                            <Text>{user.questsCompleted} quests</Text>
                          </HStack>
                        </Table.Cell>
                        <Table.Cell>
                          <Text color="whiteAlpha.600" fontSize="sm">
                            {formatDate(user.createdAt)}
                          </Text>
                        </Table.Cell>
                        <Table.Cell textAlign="right">
                          <HStack gap={1} justify="flex-end">
                            <ActionButton label="View" onClick={() => openView(user)} icon={<Eye size={16} />} />
                            <ActionButton label="Edit" onClick={() => openEdit(user)} icon={<Pencil size={16} />} />
                            <ActionButton
                              label={user.status === 'suspended' ? 'Activate' : 'Suspend'}
                              onClick={() => handleToggleStatus(user)}
                              icon={user.status === 'suspended' ? <CheckCircle2 size={16} /> : <Ban size={16} />}
                              tone={user.status === 'suspended' ? 'success' : 'warning'}
                            />
                            <ActionButton label="Delete" onClick={() => openDelete(user)} icon={<Trash2 size={16} />} tone="danger" />
                          </HStack>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Box>

              {usersLoading && (
                <Box py={14} textAlign="center">
                  <Text color="whiteAlpha.600" fontSize="sm">Loading Firestore users...</Text>
                </Box>
              )}

              {!usersLoading && filteredUsers.length === 0 && (
                <Box py={14} textAlign="center">
                  <Text color="white" fontWeight="semibold">No users found</Text>
                  <Text color="whiteAlpha.500" fontSize="sm" mt={1}>
                    Adjust the search or filters to broaden the list.
                  </Text>
                </Box>
              )}

              <Flex
                p={{ base: 4, md: 5 }}
                borderTop="1px solid"
                borderColor="whiteAlpha.100"
                align={{ base: 'stretch', md: 'center' }}
                justify="space-between"
                gap={4}
                direction={{ base: 'column', md: 'row' }}
              >
                <Text color="whiteAlpha.500" fontSize="sm">
                  Showing {pageStart} to {pageEnd} of {filteredUsers.length} users
                </Text>
                <HStack gap={2} justify={{ base: 'space-between', md: 'flex-end' }}>
                  <Button
                    size="sm"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={effectivePage === 1}
                    bg="transparent"
                    color="whiteAlpha.600"
                    borderRadius="full"
                    _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
                  >
                    Previous
                  </Button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <Button
                      key={page}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      bg={effectivePage === page ? 'brand.500' : 'transparent'}
                      color={effectivePage === page ? 'white' : 'whiteAlpha.600'}
                      minW={10}
                      borderRadius="full"
                      _hover={{ bg: effectivePage === page ? 'brand.600' : 'whiteAlpha.100', color: 'white' }}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={effectivePage === totalPages}
                    bg="transparent"
                    color="whiteAlpha.600"
                    borderRadius="full"
                    _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
                  >
                    Next
                  </Button>
                </HStack>
              </Flex>
            </Box>
          </VStack>
        </MotionBox>

        <AnimatePresence>
          {modal === 'view' && selectedUser && (
            <ModalShell title="User Details" onClose={closeModal}>
              <Flex gap={5} direction={{ base: 'column', sm: 'row' }} mb={6}>
                <Avatar user={selectedUser} size={76} />
                <Box flex={1}>
                  <Heading as="h2" color="white" size="md">
                    {selectedUser.displayName}
                  </Heading>
                  <Text color="whiteAlpha.500">@{selectedUser.username}</Text>
                  <Text color="whiteAlpha.600" fontSize="sm" mt={1}>
                    {selectedUser.email}
                  </Text>
                  <HStack gap={2} mt={3}>
                    <RoleBadge role={selectedUser.role} />
                    <StatusBadge status={selectedUser.status} />
                  </HStack>
                </Box>
              </Flex>

              <SimpleGrid columns={3} gap={3} mb={6}>
                <MiniStat label="Sessions" value={selectedUser.sessionsAttended.toString()} />
                <MiniStat label="Quests" value={selectedUser.questsCompleted.toString()} />
                <MiniStat label="Submissions" value={selectedUser.submissions.toString()} />
              </SimpleGrid>

              <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4}>
                <InfoBlock label="Member Since" value={formatLongDate(selectedUser.createdAt)} />
                <InfoBlock label="Last Active" value={formatLongDate(selectedUser.lastActive)} />
              </SimpleGrid>

              <HStack justify="flex-end" gap={3} mt={7}>
                <Button onClick={() => handleCopyProfileLink(selectedUser)} bg="whiteAlpha.100" color="white" borderRadius="full" _hover={{ bg: 'whiteAlpha.200' }}>
                  <Copy size={16} />
                  Copy Link
                </Button>
                <Button onClick={() => openEdit(selectedUser)} bg="brand.500" color="white" borderRadius="full" _hover={{ bg: 'brand.600' }}>
                  <Pencil size={16} />
                  Edit User
                </Button>
              </HStack>
            </ModalShell>
          )}

          {modal === 'edit' && selectedUser && editForm && (
            <ModalShell title="Edit User" onClose={closeModal}>
              <form id="edit-user-form" onSubmit={handleSaveEdit}>
                <VStack gap={4} align="stretch">
                  <HStack gap={4} mb={2}>
                    <Avatar user={selectedUser} size={56} />
                    <Box>
                      <Text color="white" fontWeight="semibold">{selectedUser.displayName}</Text>
                      <Text color="whiteAlpha.500" fontSize="sm">{selectedUser.email}</Text>
                    </Box>
                  </HStack>

                  <LabeledInput
                    label="Display Name"
                    value={editForm.displayName}
                    onChange={(value) => setEditForm((form) => form ? { ...form, displayName: value } : form)}
                  />
                  <LabeledInput
                    label="Email"
                    type="email"
                    value={editForm.email}
                    onChange={(value) => setEditForm((form) => form ? { ...form, email: value } : form)}
                  />
                  <LabeledInput
                    label="Username"
                    value={editForm.username}
                    onChange={(value) => setEditForm((form) => form ? { ...form, username: value } : form)}
                  />

                  <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4}>
                    <Box>
                      <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Role</Text>
                      <select
                        value={editForm.role}
                        onChange={(event) => setEditForm((form) => form ? { ...form, role: event.target.value as UserRole } : form)}
                        style={selectStyle}
                      >
                        <option value="user">Member</option>
                        <option value="artist">Artist</option>
                        <option value="facilitator">Facilitator</option>
                        <option value="curator">Curator</option>
                        <option value="admin">Admin</option>
                      </select>
                    </Box>
                    <Box>
                      <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Status</Text>
                      <select
                        value={editForm.status}
                        onChange={(event) => setEditForm((form) => form ? { ...form, status: event.target.value as UserStatus } : form)}
                        style={selectStyle}
                      >
                        <option value="active">Active</option>
                        <option value="pending">Pending</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </Box>
                  </SimpleGrid>

                  <HStack justify="flex-end" gap={3} pt={3}>
                    <Button type="button" onClick={closeModal} bg="whiteAlpha.100" color="white" borderRadius="full" _hover={{ bg: 'whiteAlpha.200' }}>
                      Cancel
                    </Button>
                    <Button type="submit" bg="brand.500" color="white" borderRadius="full" _hover={{ bg: 'brand.600' }}>
                      Save Changes
                    </Button>
                  </HStack>
                </VStack>
              </form>
            </ModalShell>
          )}

          {modal === 'invite' && (
            <ModalShell title="Invite User" onClose={closeModal}>
              <form id="invite-user-form" onSubmit={handleInviteUser}>
                <VStack gap={4} align="stretch">
                  <Box p={4} bg="brand.500/10" border="1px solid" borderColor="brand.500/25" borderRadius="xl">
                    <HStack gap={3} align="flex-start">
                      <Send size={18} color="#ff8a5f" />
                      <Text color="whiteAlpha.700" fontSize="sm">
                        Creates a pending user record in this admin list and gives staff an auditable invite state.
                      </Text>
                    </HStack>
                  </Box>
                  <LabeledInput
                    label="Display Name"
                    value={inviteForm.displayName}
                    onChange={(value) => setInviteForm((form) => ({ ...form, displayName: value }))}
                  />
                  <LabeledInput
                    label="Email"
                    type="email"
                    value={inviteForm.email}
                    onChange={(value) => setInviteForm((form) => ({ ...form, email: value }))}
                  />
                  <LabeledInput
                    label="Username"
                    value={inviteForm.username}
                    placeholder="Auto-generated if left blank"
                    onChange={(value) => setInviteForm((form) => ({ ...form, username: value }))}
                  />
                  <Box>
                    <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Role</Text>
                    <select
                      value={inviteForm.role}
                      onChange={(event) => setInviteForm((form) => ({ ...form, role: event.target.value as UserRole }))}
                      style={selectStyle}
                    >
                      <option value="user">Member</option>
                      <option value="artist">Artist</option>
                      <option value="facilitator">Facilitator</option>
                      <option value="curator">Curator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </Box>
                  <HStack justify="flex-end" gap={3} pt={3}>
                    <Button type="button" onClick={closeModal} bg="whiteAlpha.100" color="white" borderRadius="full" _hover={{ bg: 'whiteAlpha.200' }}>
                      Cancel
                    </Button>
                    <Button type="submit" bg="brand.500" color="white" borderRadius="full" _hover={{ bg: 'brand.600' }}>
                      <Send size={16} />
                      Send Invite
                    </Button>
                  </HStack>
                </VStack>
              </form>
            </ModalShell>
          )}

          {modal === 'delete' && selectedUser && (
            <ModalShell title="Delete User" onClose={closeModal}>
              <Box p={4} bg="red.500/10" border="1px solid" borderColor="red.500/30" borderRadius="xl" mb={5}>
                <HStack gap={3} align="flex-start">
                  <AlertTriangle size={19} color="#fca5a5" />
                  <Text color="red.100" fontSize="sm">
                    This removes {selectedUser.displayName} from the admin list in this session.
                  </Text>
                </HStack>
              </Box>
              <Text color="whiteAlpha.700">
                Delete <Text as="span" color="white" fontWeight="semibold">{selectedUser.displayName}</Text>?
              </Text>
              <HStack justify="flex-end" gap={3} mt={7}>
                <Button onClick={closeModal} bg="whiteAlpha.100" color="white" borderRadius="full" _hover={{ bg: 'whiteAlpha.200' }}>
                  Cancel
                </Button>
                <Button onClick={handleDeleteUser} bg="red.500" color="white" borderRadius="full" _hover={{ bg: 'red.600' }}>
                  <Trash2 size={16} />
                  Delete User
                </Button>
              </HStack>
            </ModalShell>
          )}

          {modal === 'bulkRole' && (
            <ModalShell title="Change Role" onClose={closeModal}>
              <Text color="whiteAlpha.700" mb={4}>
                Update the role for {selectedUsers.length} selected user{selectedUsers.length === 1 ? '' : 's'}.
              </Text>
              <select value={bulkRole} onChange={(event) => setBulkRole(event.target.value as UserRole)} style={selectStyle}>
                <option value="user">Member</option>
                <option value="artist">Artist</option>
                <option value="facilitator">Facilitator</option>
                <option value="curator">Curator</option>
                <option value="admin">Admin</option>
              </select>
              <HStack justify="flex-end" gap={3} mt={7}>
                <Button onClick={closeModal} bg="whiteAlpha.100" color="white" borderRadius="full" _hover={{ bg: 'whiteAlpha.200' }}>
                  Cancel
                </Button>
                <Button onClick={handleBulkRoleChange} bg="brand.500" color="white" borderRadius="full" _hover={{ bg: 'brand.600' }}>
                  Apply Role
                </Button>
              </HStack>
            </ModalShell>
          )}
        </AnimatePresence>
      </Box>
    </AdminLayout>
  )
}

function StatCard({
  icon,
  label,
  value,
  helper,
  color = 'white',
}: {
  icon: ReactNode
  label: string
  value: string
  helper?: string
  color?: string
}) {
  return (
    <Box p={4} bg="rgba(17,17,17,0.92)" border="1px solid" borderColor="whiteAlpha.100" borderRadius="2xl">
      <HStack justify="space-between" align="start">
        <Box>
          <Text color="whiteAlpha.500" fontSize="xs" letterSpacing="0.12em" textTransform="uppercase">
            {label}
          </Text>
          <Text color={color} fontSize="2xl" fontWeight="bold" mt={2} lineHeight={1}>
            {value}
          </Text>
          {helper && (
            <Text color="whiteAlpha.400" fontSize="xs" mt={2}>
              {helper}
            </Text>
          )}
        </Box>
        <Flex w={9} h={9} borderRadius="full" bg="whiteAlpha.80" align="center" justify="center" color="whiteAlpha.700">
          {icon}
        </Flex>
      </HStack>
    </Box>
  )
}

function Avatar({ user, size = 44 }: { user: ManagedUser; size?: number }) {
  return (
    <Box
      w={`${size}px`}
      h={`${size}px`}
      minW={`${size}px`}
      borderRadius="full"
      overflow="hidden"
      bg="whiteAlpha.100"
      border="1px solid"
      borderColor="whiteAlpha.100"
    >
      {user.avatar ? (
        <Image src={user.avatar} alt={user.displayName} w="full" h="full" objectFit="cover" />
      ) : (
        <Flex w="full" h="full" align="center" justify="center" color="whiteAlpha.700" fontWeight="bold">
          {user.displayName.charAt(0)}
        </Flex>
      )}
    </Box>
  )
}

function RoleBadge({ role }: { role: UserRole }) {
  const style = roleStyles[role]
  return (
    <Badge bg={style.bg} color={style.color} border="1px solid" borderColor={style.borderColor} borderRadius="full" px={3} py={1} textTransform="capitalize">
      {roleLabel(role)}
    </Badge>
  )
}

function StatusBadge({ status }: { status: UserStatus }) {
  const style = statusStyles[status]
  return (
    <Badge bg={style.bg} color={style.color} border="1px solid" borderColor={style.borderColor} borderRadius="full" px={3} py={1} textTransform="capitalize">
      {status}
    </Badge>
  )
}

function ActionButton({
  label,
  icon,
  onClick,
  tone = 'default',
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  tone?: 'default' | 'warning' | 'danger' | 'success'
}) {
  const colors = {
    default: { color: 'whiteAlpha.600', hoverBg: 'whiteAlpha.100', hoverColor: 'white' },
    warning: { color: 'orange.300', hoverBg: 'orange.500/12', hoverColor: 'orange.100' },
    danger: { color: 'red.300', hoverBg: 'red.500/12', hoverColor: 'red.100' },
    success: { color: 'green.300', hoverBg: 'green.500/12', hoverColor: 'green.100' },
  }[tone]

  return (
    <Button
      aria-label={label}
      title={label}
      onClick={onClick}
      size="sm"
      minW={9}
      w={9}
      h={9}
      p={0}
      bg="transparent"
      color={colors.color}
      borderRadius="full"
      _hover={{ bg: colors.hoverBg, color: colors.hoverColor }}
    >
      {icon}
    </Button>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <Box>
      <Text color="whiteAlpha.600" fontSize="sm" mb={2}>
        {label}
      </Text>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        bg="#111111"
        borderColor="whiteAlpha.200"
        color="white"
        borderRadius="xl"
        h={11}
        _placeholder={{ color: 'whiteAlpha.400' }}
        _focus={{ borderColor: 'brand.500', boxShadow: '0 0 0 1px rgba(255, 107, 53, 0.35)' }}
      />
    </Box>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Box p={4} bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.100" borderRadius="xl" textAlign="center">
      <Text color="white" fontSize="xl" fontWeight="bold">
        {value}
      </Text>
      <Text color="whiteAlpha.500" fontSize="xs">
        {label}
      </Text>
    </Box>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text color="whiteAlpha.500" fontSize="xs" letterSpacing="0.12em" textTransform="uppercase" mb={1}>
        {label}
      </Text>
      <Text color="whiteAlpha.850">{value}</Text>
    </Box>
  )
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <Flex
      position="fixed"
      inset={0}
      bg="blackAlpha.700"
      zIndex={70}
      align="center"
      justify="center"
      p={4}
      onClick={onClose}
    >
      <MotionBox
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18 }}
        bg="#111111"
        border="1px solid"
        borderColor="whiteAlpha.150"
        borderRadius="2xl"
        maxW="560px"
        w="full"
        maxH="calc(100vh - 32px)"
        overflowY="auto"
        boxShadow="0 24px 80px rgba(0,0,0,0.45)"
        onClick={(event) => event.stopPropagation()}
      >
        <Flex px={6} py={5} borderBottom="1px solid" borderColor="whiteAlpha.100" align="center" justify="space-between">
          <Heading as="h2" size="sm" color="white">
            {title}
          </Heading>
          <Button aria-label="Close" onClick={onClose} size="sm" w={9} h={9} p={0} minW={9} bg="whiteAlpha.50" color="whiteAlpha.700" borderRadius="full" _hover={{ bg: 'whiteAlpha.100', color: 'white' }}>
            <X size={17} />
          </Button>
        </Flex>
        <Box p={6}>{children}</Box>
      </MotionBox>
    </Flex>
  )
}

function FeedbackToast({ feedback, onClose }: { feedback: Feedback; onClose: () => void }) {
  const style = feedbackStyles[feedback.type]

  return (
    <MotionBox
      initial={{ opacity: 0, y: -14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -14, scale: 0.98 }}
      position="fixed"
      top={{ base: 20, lg: 6 }}
      right={{ base: 4, md: 6 }}
      zIndex={90}
      maxW={{ base: 'calc(100vw - 32px)', md: '380px' }}
      bg={style.bg}
      border="1px solid"
      borderColor={style.borderColor}
      borderRadius="2xl"
      px={4}
      py={3}
      backdropFilter="blur(16px)"
      boxShadow="0 18px 60px rgba(0,0,0,0.35)"
    >
      <HStack gap={3} align="flex-start">
        <Box color={style.color} mt={0.5}>{style.icon}</Box>
        <Box flex={1} minW={0}>
          <Text color="white" fontWeight="semibold" fontSize="sm">
            {feedback.title}
          </Text>
          {feedback.description && (
            <Text color="whiteAlpha.650" fontSize="sm" mt={0.5}>
              {feedback.description}
            </Text>
          )}
        </Box>
        <Button aria-label="Dismiss" onClick={onClose} size="xs" minW={7} w={7} h={7} p={0} bg="transparent" color="whiteAlpha.500" borderRadius="full" _hover={{ bg: 'whiteAlpha.100', color: 'white' }}>
          <X size={14} />
        </Button>
      </HStack>
    </MotionBox>
  )
}
