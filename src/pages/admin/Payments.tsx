'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Input,
  SimpleGrid,
  Spinner,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  X,
} from 'lucide-react'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { useCollection } from '@/hooks'
import {
  collectSessionPayment,
  createPaymentWithdrawal,
  getAdminPaymentsDashboard,
  recordPaymentReturn,
  syncPaymentCollection,
  syncPaymentWithdrawal,
  type AdminPaymentDashboard,
} from '../../../lib/adminPayments'
import type { MobileMoneyOperator } from '../../../lib/lenco'
import type { Session, SessionRegistration, User as FirestoreUser } from '../../../lib/schema'

type PaymentsTab = 'overview' | 'collections' | 'reconciliation' | 'withdrawals' | 'returns'
type PaymentActionModal = 'collection' | 'withdrawal' | 'return' | null

interface ReconciliationListItem {
  id: string
  title: string
  subtitle: string
  tone: 'orange' | 'red'
  issue: Record<string, unknown>
}

interface CollectionForm {
  sessionId: string
  registrationId: string
  phone: string
  operator: MobileMoneyOperator
  amount: string
  currency: string
  note: string
}

interface WithdrawalForm {
  recipientUserId: string
  phone: string
  operator: MobileMoneyOperator
  amount: string
  currency: string
  reason: string
  note: string
}

interface ReturnForm {
  transactionKey: string
  sessionId: string
  amount: string
  currency: string
  method: 'cash' | 'bank_transfer' | 'mobile_money' | 'card' | 'other'
  status: 'pending' | 'completed' | 'cancelled'
  reason: string
  externalReference: string
  notes: string
}

const selectStyle: CSSProperties = {
  width: '100%',
  height: '46px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.06)',
  color: '#fff',
  padding: '0 14px',
  outline: 'none',
}

const compactSelectStyle: CSSProperties = {
  ...selectStyle,
  width: 'auto',
  height: '42px',
  minWidth: '108px',
}

const tabs: { value: PaymentsTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'collections', label: 'Collections' },
  { value: 'reconciliation', label: 'Reconciliation' },
  { value: 'withdrawals', label: 'Withdrawals' },
  { value: 'returns', label: 'Returns' },
]

const DASHBOARD_LOAD_TIMEOUT_MS = 18000
const PAGE_SIZE_OPTIONS = [10, 25, 50]
const initialTabText: Record<PaymentsTab, string> = {
  overview: '',
  collections: '',
  reconciliation: '',
  withdrawals: '',
  returns: '',
}
const initialTabPage: Record<PaymentsTab, number> = {
  overview: 1,
  collections: 1,
  reconciliation: 1,
  withdrawals: 1,
  returns: 1,
}

const emptyCollectionForm: CollectionForm = {
  sessionId: '',
  registrationId: '',
  phone: '',
  operator: 'airtel',
  amount: '',
  currency: 'ZMW',
  note: '',
}

const emptyWithdrawalForm: WithdrawalForm = {
  recipientUserId: '',
  phone: '',
  operator: 'airtel',
  amount: '',
  currency: 'ZMW',
  reason: 'Admin withdrawal',
  note: '',
}

const emptyReturnForm: ReturnForm = {
  transactionKey: '',
  sessionId: '',
  amount: '',
  currency: 'ZMW',
  method: 'mobile_money',
  status: 'pending',
  reason: '',
  externalReference: '',
  notes: '',
}

const asString = (value: unknown): string => (typeof value === 'string' ? value : '')
const asNumber = (value: unknown): number => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const getUserPaymentPhone = (user: FirestoreUser): string =>
  asString(user.whatsappPhone) || asString(user.phone)
const getUserPaymentLabel = (user: FirestoreUser): string => {
  const name = asString(user.displayName) || asString(user.email) || user.uid || user.id
  const phone = getUserPaymentPhone(user)
  return phone ? `${name} - ${phone}` : name
}

const formatMoney = (amount: unknown, currency = 'ZMW'): string =>
  `${currency} ${asNumber(amount).toFixed(2)}`

const formatCount = (value: unknown): string =>
  new Intl.NumberFormat('en-ZM').format(asNumber(value))

const normalizeSearch = (value: string): string =>
  value.trim().toLowerCase()

const flattenSearchValue = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map((entry) => flattenSearchValue(entry)).join(' ')
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).map((entry) => flattenSearchValue(entry)).join(' ')
  }
  return ''
}

const recordMatchesSearch = (
  record: Record<string, unknown>,
  query: string,
  fields?: string[]
): boolean => {
  const normalizedQuery = normalizeSearch(query)
  if (!normalizedQuery) return true

  const haystack = fields?.length
    ? fields.map((field) => flattenSearchValue(record[field])).join(' ')
    : flattenSearchValue(record)

  return haystack.toLowerCase().includes(normalizedQuery)
}

const pageItems = <T,>(items: T[], page: number, pageSize: number): T[] => {
  const start = (Math.max(page, 1) - 1) * pageSize
  return items.slice(start, start + pageSize)
}

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> =>
  new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(message))
    }, timeoutMs)

    promise.then(
      (value) => {
        window.clearTimeout(timeoutId)
        resolve(value)
      },
      (reason) => {
        window.clearTimeout(timeoutId)
        reject(reason)
      }
    )
  })

const formatDate = (value: unknown): string => {
  if (!value) return 'Not recorded'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return date.toLocaleString('en-ZM', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const recordLabel = (record: Record<string, unknown>, fields: string[]): string => {
  for (const field of fields) {
    const value = asString(record[field])
    if (value) return value
  }
  return 'Not recorded'
}

const statusTone = (status: unknown): { bg: string; color: string } => {
  const normalized = String(status ?? '').toLowerCase()
  if (['completed', 'successful', 'success', 'paid_online', 'paid_external'].includes(normalized)) {
    return { bg: 'green.500/18', color: 'green.200' }
  }
  if (['failed', 'cancelled', 'declined'].includes(normalized)) {
    return { bg: 'red.500/18', color: 'red.200' }
  }
  if (['pending', 'processing', 'request_started'].includes(normalized)) {
    return { bg: 'orange.500/18', color: 'orange.200' }
  }
  return { bg: 'whiteAlpha.100', color: 'whiteAlpha.700' }
}

function StatusBadge({ status }: { status: unknown }) {
  const tone = statusTone(status)
  return (
    <Badge bg={tone.bg} color={tone.color} borderRadius="full" px={3} py={1} textTransform="capitalize">
      {String(status || 'unknown').replace(/_/g, ' ')}
    </Badge>
  )
}

function AmountCell({
  label,
  value,
  tone = 'white',
}: {
  label: string
  value: string
  tone?: string
}) {
  return (
    <Box minW={0}>
      <Text color="whiteAlpha.500" fontSize="xs" textTransform="uppercase" letterSpacing="0.08em">
        {label}
      </Text>
      <Text color={tone} fontSize="sm" fontWeight="semibold" mt={1} overflowWrap="anywhere">
        {value}
      </Text>
    </Box>
  )
}

function getReconciliationItems(dashboard: AdminPaymentDashboard): ReconciliationListItem[] {
  return [
    ...dashboard.reconciliation.transactionStatusIssues.map((issue, index) => ({
      id: `transaction-${index}`,
      title: 'Paid transaction needs signup update',
      subtitle: asString(issue.reference),
      tone: 'orange' as const,
      issue,
    })),
    ...dashboard.reconciliation.registrationPaymentIssues.map((issue, index) => ({
      id: `registration-${index}`,
      title: 'Paid signup missing completed transaction',
      subtitle: asString(issue.reference) || 'No payment reference',
      tone: 'red' as const,
      issue,
    })),
    ...dashboard.reconciliation.returnIssues.map((issue, index) => ({
      id: `return-${index}`,
      title: 'Return needs transaction review',
      subtitle: asString(issue.reference) || 'No payment reference',
      tone: 'red' as const,
      issue,
    })),
  ]
}

function Panel({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Box bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.100" borderRadius="xl" overflow="hidden">
      <Flex px={5} py={4} justify="space-between" gap={3} align="center" borderBottom="1px solid" borderColor="whiteAlpha.100">
        <Heading as="h2" size="sm" color="white">
          {title}
        </Heading>
        {action}
      </Flex>
      <Box p={5}>{children}</Box>
    </Box>
  )
}

function TabActionHeader({
  title,
  description,
  actionLabel,
  icon,
  onAction,
}: {
  title: string
  description: string
  actionLabel?: string
  icon?: React.ReactNode
  onAction?: () => void
}) {
  return (
    <Flex
      justify="space-between"
      align={{ base: 'stretch', md: 'center' }}
      gap={4}
      direction={{ base: 'column', md: 'row' }}
    >
      <Box minW={0}>
        <Heading as="h2" size="md" color="white">
          {title}
        </Heading>
        <Text color="whiteAlpha.600" mt={1}>
          {description}
        </Text>
      </Box>
      {actionLabel && onAction && (
        <Button
          h="42px"
          px={5}
          borderRadius="full"
          bg="brand.500"
          color="white"
          _hover={{ bg: 'brand.600' }}
          onClick={onAction}
          flexShrink={0}
        >
          {icon || <Plus size={16} />}
          {actionLabel}
        </Button>
      )}
    </Flex>
  )
}

function ListControls({
  searchValue,
  onSearchChange,
  pageSize,
  onPageSizeChange,
  total,
  placeholder,
}: {
  searchValue: string
  onSearchChange: (value: string) => void
  pageSize: number
  onPageSizeChange: (value: number) => void
  total: number
  placeholder: string
}) {
  return (
    <Flex
      justify="space-between"
      align={{ base: 'stretch', md: 'center' }}
      gap={3}
      direction={{ base: 'column', md: 'row' }}
      mb={4}
    >
      <Box position="relative" flex="1" maxW={{ md: '520px' }}>
        <Box position="absolute" left="14px" top="50%" transform="translateY(-50%)" color="whiteAlpha.500" pointerEvents="none">
          <Search size={16} />
        </Box>
        <Input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          h="42px"
          pl="42px"
          bg="whiteAlpha.50"
          borderColor="whiteAlpha.200"
          color="white"
        />
      </Box>
      <HStack gap={3} justify={{ base: 'space-between', md: 'flex-end' }}>
        <Text color="whiteAlpha.500" fontSize="sm" whiteSpace="nowrap">
          {formatCount(total)} records
        </Text>
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          style={compactSelectStyle}
        >
          {PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option} / page
            </option>
          ))}
        </select>
      </HStack>
    </Flex>
  )
}

function PaginationFooter({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}) {
  const totalPages = Math.max(Math.ceil(total / pageSize), 1)
  const currentPage = Math.min(Math.max(page, 1), totalPages)
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, total)

  return (
    <Flex
      justify="space-between"
      align={{ base: 'stretch', md: 'center' }}
      gap={3}
      direction={{ base: 'column', md: 'row' }}
      pt={4}
      mt={4}
      borderTop="1px solid"
      borderColor="whiteAlpha.100"
    >
      <Text color="whiteAlpha.500" fontSize="sm">
        Showing {formatCount(start)}-{formatCount(end)} of {formatCount(total)}
      </Text>
      <HStack gap={2} justify={{ base: 'space-between', md: 'flex-end' }}>
        <Button
          h="36px"
          px={3}
          borderRadius="full"
          bg="whiteAlpha.100"
          color="white"
          _hover={{ bg: 'whiteAlpha.200' }}
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft size={16} />
          Previous
        </Button>
        <Text color="whiteAlpha.600" fontSize="sm" minW="78px" textAlign="center">
          {currentPage} / {totalPages}
        </Text>
        <Button
          h="36px"
          px={3}
          borderRadius="full"
          bg="whiteAlpha.100"
          color="white"
          _hover={{ bg: 'whiteAlpha.200' }}
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
          <ChevronRight size={16} />
        </Button>
      </HStack>
    </Flex>
  )
}

function PaymentModal({
  title,
  description,
  onClose,
  children,
}: {
  title: string
  description?: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <Box
      position="fixed"
      inset={0}
      zIndex={1000}
      bg="blackAlpha.700"
      backdropFilter="blur(10px)"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
      onClick={onClose}
    >
      <Box
        width="100%"
        maxW="820px"
        maxH="calc(100vh - 48px)"
        overflowY="auto"
        bg="#151515"
        border="1px solid"
        borderColor="whiteAlpha.200"
        borderRadius="xl"
        boxShadow="0 24px 80px rgba(0,0,0,0.45)"
        onClick={(event) => event.stopPropagation()}
      >
        <Flex px={5} py={4} justify="space-between" gap={4} align="flex-start" borderBottom="1px solid" borderColor="whiteAlpha.100">
          <Box minW={0}>
            <Heading as="h2" size="md" color="white">
              {title}
            </Heading>
            {description && (
              <Text color="whiteAlpha.600" fontSize="sm" mt={1}>
                {description}
              </Text>
            )}
          </Box>
          <Button
            aria-label="Close modal"
            boxSize="36px"
            minW="36px"
            p={0}
            borderRadius="full"
            bg="whiteAlpha.100"
            color="white"
            _hover={{ bg: 'whiteAlpha.200' }}
            onClick={onClose}
          >
            <X size={18} />
          </Button>
        </Flex>
        <Box p={5}>{children}</Box>
      </Box>
    </Box>
  )
}

function PaymentRow({
  record,
  onSync,
  syncing,
}: {
  record: Record<string, unknown>
  onSync: (record: Record<string, unknown>) => void
  syncing: boolean
}) {
  const reference = recordLabel(record, ['reference', 'transactionId'])
  const status = record.status || record.gatewayStatus
  const currency = asString(record.currency) || 'ZMW'

  return (
    <Flex
      gap={4}
      justify="space-between"
      align={{ base: 'stretch', lg: 'center' }}
      direction={{ base: 'column', lg: 'row' }}
      py={4}
      borderBottom="1px solid"
      borderColor="whiteAlpha.100"
    >
      <Box minW={0}>
        <HStack gap={2} flexWrap="wrap">
          <Text color="white" fontWeight="semibold" lineClamp={1}>
            {recordLabel(record, ['displayName', 'email', 'phone'])}
          </Text>
          <StatusBadge status={status} />
        </HStack>
        <Text color="whiteAlpha.500" fontSize="sm" mt={1} lineClamp={1}>
          {reference}
        </Text>
        <Text color="whiteAlpha.400" fontSize="xs" mt={1}>
          {formatDate(record.createdAt || record.updatedAt)}
        </Text>
      </Box>
      <HStack gap={3} justify={{ base: 'space-between', lg: 'flex-end' }} flexWrap="wrap">
        <Text color="brand.200" fontWeight="bold">
          {formatMoney(record.amount, currency)}
        </Text>
        <Button
          h="38px"
          minW="112px"
          px={4}
          borderRadius="full"
          bg="whiteAlpha.100"
          color="white"
          _hover={{ bg: 'whiteAlpha.200' }}
          onClick={() => onSync(record)}
          disabled={syncing || !reference}
        >
          {syncing ? <Spinner size="sm" /> : <RefreshCw size={14} />}
          Sync
        </Button>
      </HStack>
    </Flex>
  )
}

export default function Payments() {
  const { data: sessionDocs, loading: sessionsLoading } = useCollection('sessions', {
    orderBy: 'date',
    orderDirection: 'desc',
  })
  const { data: registrations } = useCollection('sessionRegistrations', {
    orderBy: 'createdAt',
    orderDirection: 'desc',
  })
  const { data: userDocs, loading: usersLoading } = useCollection('users', {
    orderBy: 'displayName',
    orderDirection: 'asc',
  })

  const [activeTab, setActiveTab] = useState<PaymentsTab>('overview')
  const [sessionFilter, setSessionFilter] = useState('all')
  const [dashboard, setDashboard] = useState<AdminPaymentDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [syncingKey, setSyncingKey] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionModal, setActionModal] = useState<PaymentActionModal>(null)
  const [searchByTab, setSearchByTab] = useState<Record<PaymentsTab, string>>(initialTabText)
  const [pageByTab, setPageByTab] = useState<Record<PaymentsTab, number>>(initialTabPage)
  const [pageSize, setPageSize] = useState(10)
  const [collectionForm, setCollectionForm] = useState<CollectionForm>(emptyCollectionForm)
  const [withdrawalForm, setWithdrawalForm] = useState<WithdrawalForm>(emptyWithdrawalForm)
  const [returnForm, setReturnForm] = useState<ReturnForm>(emptyReturnForm)

  const sessions = useMemo(
    () => [...sessionDocs].sort((a, b) => asNumber(b.price) - asNumber(a.price)),
    [sessionDocs]
  )
  const selectedCollectionSession = sessions.find((session) => session.id === collectionForm.sessionId)
  const filteredRegistrations = registrations.filter((registration) => registration.sessionId === collectionForm.sessionId)
  const adminRecipients = useMemo(
    () => userDocs
      .filter((user: FirestoreUser) => user.role === 'admin' && getUserPaymentPhone(user))
      .sort((a: FirestoreUser, b: FirestoreUser) => getUserPaymentLabel(a).localeCompare(getUserPaymentLabel(b))),
    [userDocs]
  )
  const completedTransactions = (dashboard?.localTransactions || []).filter((transaction) =>
    String(transaction.status || '').toLowerCase() === 'completed'
  )
  const activeSearch = searchByTab[activeTab]
  const activePage = pageByTab[activeTab]
  const reconciliationItems = useMemo(
    () => dashboard ? getReconciliationItems(dashboard) : [],
    [dashboard]
  )
  const filteredOverviewSessions = useMemo(
    () => (dashboard?.sessions || []).filter((session) =>
      recordMatchesSearch(session as unknown as Record<string, unknown>, searchByTab.overview, ['title', 'sessionId', 'currency'])
    ),
    [dashboard?.sessions, searchByTab.overview]
  )
  const filteredCollections = useMemo(
    () => (dashboard?.localTransactions || []).filter((record) =>
      recordMatchesSearch(record, searchByTab.collections, [
        'displayName',
        'email',
        'phone',
        'reference',
        'transactionId',
        'status',
        'gatewayStatus',
        'failureReason',
      ])
    ),
    [dashboard?.localTransactions, searchByTab.collections]
  )
  const filteredReconciliation = useMemo(
    () => reconciliationItems.filter((item) => {
      const query = normalizeSearch(searchByTab.reconciliation)
      if (!query) return true
      return `${item.title} ${item.subtitle} ${flattenSearchValue(item.issue)}`.toLowerCase().includes(query)
    }),
    [reconciliationItems, searchByTab.reconciliation]
  )
  const filteredWithdrawals = useMemo(
    () => (dashboard?.withdrawals || []).filter((record) =>
      recordMatchesSearch(record, searchByTab.withdrawals, [
        'recipientDisplayName',
        'recipientEmail',
        'phone',
        'operator',
        'reference',
        'lencoReference',
        'transferId',
        'withdrawalId',
        'status',
        'failureReason',
        'transferRequestError',
        'message',
      ])
    ),
    [dashboard?.withdrawals, searchByTab.withdrawals]
  )
  const filteredReturns = useMemo(
    () => (dashboard?.returns || []).filter((record) =>
      recordMatchesSearch(record, searchByTab.returns, [
        'reason',
        'reference',
        'transactionId',
        'externalReference',
        'status',
        'method',
        'notes',
      ])
    ),
    [dashboard?.returns, searchByTab.returns]
  )

  const setActiveSearch = (value: string) => {
    setSearchByTab((previous) => ({ ...previous, [activeTab]: value }))
    setPageByTab((previous) => ({ ...previous, [activeTab]: 1 }))
  }

  const setActivePage = (page: number) => {
    setPageByTab((previous) => ({ ...previous, [activeTab]: Math.max(page, 1) }))
  }

  const handlePageSizeChange = (value: number) => {
    setPageSize(value)
    setPageByTab(initialTabPage)
  }

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await withTimeout(
        getAdminPaymentsDashboard({
          sessionId: sessionFilter === 'all' ? undefined : sessionFilter,
          limit: 1000,
        }),
        DASHBOARD_LOAD_TIMEOUT_MS,
        'Payments dashboard is taking too long to respond. Try refresh again after the functions deploy finishes.'
      )
      setDashboard(data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load payments.')
    } finally {
      setLoading(false)
    }
  }, [sessionFilter])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadDashboard()
    }, 0)

    return () => window.clearTimeout(timerId)
  }, [loadDashboard])

  const handleCollectionSessionChange = (sessionId: string) => {
    const session = sessions.find((entry) => entry.id === sessionId)
    setCollectionForm((previous) => ({
      ...previous,
      sessionId,
      registrationId: '',
      amount: session?.price ? String(session.price) : previous.amount,
      currency: session?.currency || 'ZMW',
    }))
  }

  const handleCollectionRegistrationChange = (registrationId: string) => {
    const registration = registrations.find((entry) => entry.id === registrationId)
    setCollectionForm((previous) => ({
      ...previous,
      registrationId,
      amount: registration?.paymentAmount ? String(registration.paymentAmount) : previous.amount,
      currency: registration?.paymentCurrency || previous.currency,
    }))
  }

  const handleWithdrawalRecipientChange = (recipientUserId: string) => {
    const recipient = adminRecipients.find((entry) => entry.id === recipientUserId)
    setWithdrawalForm((previous) => ({
      ...previous,
      recipientUserId,
      phone: recipient ? getUserPaymentPhone(recipient) : previous.phone,
    }))
  }

  const handleCollect = async (event: FormEvent) => {
    event.preventDefault()
    setMessage(null)
    setError(null)

    const registration = registrations.find((entry) => entry.id === collectionForm.registrationId)
    const amount = Number(collectionForm.amount)
    if (!collectionForm.sessionId || !collectionForm.phone || !Number.isFinite(amount) || amount <= 0) {
      setError('Session, phone, and amount are required.')
      return
    }

    setBusy(true)
    try {
      const result = await collectSessionPayment({
        sessionId: collectionForm.sessionId,
        registrationId: collectionForm.registrationId || undefined,
        phone: collectionForm.phone,
        operator: collectionForm.operator,
        amount,
        currency: collectionForm.currency,
        displayName: registration?.displayName,
        email: registration?.email,
        note: collectionForm.note,
      })
      setMessage(result.message || `Collection ${result.status || 'started'}.`)
      setCollectionForm((previous) => ({
        ...emptyCollectionForm,
        sessionId: previous.sessionId,
        amount: previous.amount,
        currency: previous.currency,
      }))
      await loadDashboard()
      setActionModal(null)
    } catch (collectError) {
      setError(collectError instanceof Error ? collectError.message : 'Unable to start collection.')
    } finally {
      setBusy(false)
    }
  }

  const handleWithdraw = async (event: FormEvent) => {
    event.preventDefault()
    setMessage(null)
    setError(null)

    const amount = Number(withdrawalForm.amount)
    if (!withdrawalForm.phone || !Number.isFinite(amount) || amount <= 0) {
      setError('Admin mobile money number and amount are required.')
      return
    }

    setBusy(true)
    try {
      const result = await createPaymentWithdrawal({
        recipientUserId: withdrawalForm.recipientUserId || undefined,
        phone: withdrawalForm.phone,
        operator: withdrawalForm.operator,
        amount,
        currency: withdrawalForm.currency,
        reason: withdrawalForm.reason || undefined,
        note: withdrawalForm.note || undefined,
      })
      setMessage(result.message || `Withdrawal ${result.status || 'started'}.`)
      setWithdrawalForm(emptyWithdrawalForm)
      await loadDashboard()
      setActionModal(null)
    } catch (withdrawError) {
      setError(withdrawError instanceof Error ? withdrawError.message : 'Unable to start withdrawal.')
    } finally {
      setBusy(false)
    }
  }

  const handleSync = async (record: Record<string, unknown>) => {
    const reference = asString(record.reference)
    const transactionId = asString(record.transactionId)
    const key = reference || transactionId
    if (!key) return

    setSyncingKey(key)
    setMessage(null)
    setError(null)
    try {
      const result = await syncPaymentCollection({ reference, transactionId })
      setMessage(result.message || `Payment ${result.status || 'synced'}.`)
      await loadDashboard()
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Unable to sync payment.')
    } finally {
      setSyncingKey('')
    }
  }

  const handleWithdrawalSync = async (record: Record<string, unknown>) => {
    const reference = asString(record.reference)
    const transferId = asString(record.transferId) || asString(record.withdrawalId)
    const withdrawalId = asString(record.id)
    const key = `withdrawal-${reference || transferId || withdrawalId}`
    if (!reference && !transferId && !withdrawalId) return

    setSyncingKey(key)
    setMessage(null)
    setError(null)
    try {
      const result = await syncPaymentWithdrawal({ reference, transferId, withdrawalId })
      setMessage(result.message || `Withdrawal ${result.status || 'synced'}.`)
      await loadDashboard()
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Unable to sync withdrawal.')
    } finally {
      setSyncingKey('')
    }
  }

  const handleReturnTransactionChange = (transactionKey: string) => {
    const transaction = completedTransactions.find((entry) =>
      asString(entry.reference) === transactionKey || asString(entry.transactionId) === transactionKey
    )

    setReturnForm((previous) => ({
      ...previous,
      transactionKey,
      sessionId: asString(transaction?.sessionId) || previous.sessionId,
      amount: transaction?.amount ? String(transaction.amount) : previous.amount,
      currency: asString(transaction?.currency) || previous.currency,
    }))
  }

  const handleRecordReturn = async (event: FormEvent) => {
    event.preventDefault()
    setMessage(null)
    setError(null)

    const amount = Number(returnForm.amount)
    if (!returnForm.sessionId || !returnForm.reason.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError('Session, amount, and reason are required.')
      return
    }

    const transaction = completedTransactions.find((entry) =>
      asString(entry.reference) === returnForm.transactionKey ||
      asString(entry.transactionId) === returnForm.transactionKey
    )

    setBusy(true)
    try {
      const result = await recordPaymentReturn({
        sessionId: returnForm.sessionId,
        registrationId: asString(transaction?.registrationId) || undefined,
        transactionId: asString(transaction?.transactionId) || undefined,
        reference: asString(transaction?.reference) || undefined,
        amount,
        currency: returnForm.currency,
        method: returnForm.method,
        status: returnForm.status,
        reason: returnForm.reason,
        externalReference: returnForm.externalReference || undefined,
        notes: returnForm.notes || undefined,
      })
      setMessage(result.returnId ? `Return recorded: ${result.returnId}` : 'Return recorded.')
      setReturnForm(emptyReturnForm)
      await loadDashboard()
      setActionModal(null)
    } catch (returnError) {
      setError(returnError instanceof Error ? returnError.message : 'Unable to record return.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminLayout>
      <Box p={{ base: 4, md: 8 }}>
        <Flex justify="space-between" align={{ base: 'stretch', lg: 'flex-start' }} gap={5} direction={{ base: 'column', lg: 'row' }} mb={6}>
          <Box>
            <Heading as="h1" color="white" fontSize={{ base: '2xl', md: '3xl' }}>
              Payments
            </Heading>
            <Text color="whiteAlpha.600" mt={1}>
              Firestore ledger for collections, reconciliation, withdrawals, and returns.
            </Text>
          </Box>
          <Flex
            direction={{ base: 'column', sm: 'row', lg: 'column' }}
            gap={3}
            align={{ base: 'stretch', sm: 'center', lg: 'flex-end' }}
            width={{ base: '100%', lg: '420px' }}
            marginLeft={{ lg: 'auto' }}
          >
            <select value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value)} style={selectStyle}>
              <option value="all">All sessions</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title}
                </option>
              ))}
            </select>
            <Button h="46px" px={5} borderRadius="xl" bg="brand.500" color="white" _hover={{ bg: 'brand.600' }} onClick={() => void loadDashboard()} disabled={loading} alignSelf={{ base: 'stretch', sm: 'auto', lg: 'flex-end' }}>
              {loading ? <Spinner size="sm" /> : <RefreshCw size={16} />}
              Refresh
            </Button>
          </Flex>
        </Flex>

        {(message || error) && (
          <Box mb={5} p={4} borderRadius="xl" border="1px solid" borderColor={error ? 'red.400/50' : 'green.400/40'} bg={error ? 'red.500/10' : 'green.500/10'}>
            <Text color={error ? 'red.200' : 'green.200'}>{error || message}</Text>
          </Box>
        )}

        <HStack gap={2} flexWrap="wrap" mb={6}>
          {tabs.map((tab) => (
            <Button
              key={tab.value}
              h="40px"
              px={4}
              borderRadius="full"
              bg={activeTab === tab.value ? 'brand.500' : 'whiteAlpha.80'}
              color="white"
              _hover={{ bg: activeTab === tab.value ? 'brand.600' : 'whiteAlpha.150' }}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </HStack>

        {loading && !dashboard ? (
          <Flex minH="280px" align="center" justify="center">
            <Spinner size="lg" color="brand.500" />
          </Flex>
        ) : (
          <VStack align="stretch" gap={5}>
            {!dashboard && (
              <Panel title="Dashboard unavailable">
                <Text color="whiteAlpha.600">
                  The payments dashboard did not finish loading. Refresh after the latest functions deploy completes.
                </Text>
              </Panel>
            )}

            {dashboard && activeTab === 'overview' && (
              <>
                <Panel title="Revenue Over Time">
                  <VStack align="stretch" gap={0}>
                    {(dashboard.revenueTimeline || []).map((period) => (
                      <Flex
                        key={period.periodKey}
                        py={4}
                        gap={5}
                        justify="space-between"
                        align={{ base: 'stretch', xl: 'center' }}
                        direction={{ base: 'column', xl: 'row' }}
                        borderBottom="1px solid"
                        borderColor="whiteAlpha.100"
                      >
                        <Box minW={0}>
                          <Text color="white" fontWeight="semibold">{period.label}</Text>
                          <Text color="whiteAlpha.500" fontSize="sm" mt={1}>
                            {period.transactionCount + period.registrationCount} paid records
                          </Text>
                        </Box>
                        <SimpleGrid columns={{ base: 2, md: 3, xl: 5 }} gap={4} flex="1" maxW={{ xl: '920px' }}>
                          <AmountCell label="Total revenue" value={formatMoney(period.grossCollected, period.currency)} tone="green.200" />
                          <AmountCell label="Current net" value={formatMoney(period.netCollected, period.currency)} />
                          <AmountCell label="Pending" value={formatMoney(period.pending, period.currency)} tone="orange.200" />
                          <AmountCell label="Returns" value={formatMoney(period.returned, period.currency)} tone="red.200" />
                          <AmountCell label="Withdrawals" value={formatMoney(period.withdrawn, period.currency)} tone="brand.200" />
                        </SimpleGrid>
                      </Flex>
                    ))}
                    {(dashboard.revenueTimeline || []).length === 0 && (
                      <Text color="whiteAlpha.500">No revenue history in the loaded ledger window.</Text>
                    )}
                  </VStack>
                </Panel>

                <Panel title="Session Totals">
                  <ListControls
                    searchValue={activeSearch}
                    onSearchChange={setActiveSearch}
                    pageSize={pageSize}
                    onPageSizeChange={handlePageSizeChange}
                    total={filteredOverviewSessions.length}
                    placeholder="Search sessions"
                  />
                  <VStack align="stretch" gap={0}>
                    {pageItems(filteredOverviewSessions, activePage, pageSize).map((session) => (
                      <Flex key={session.sessionId} py={4} gap={4} justify="space-between" align={{ base: 'stretch', lg: 'center' }} direction={{ base: 'column', lg: 'row' }} borderBottom="1px solid" borderColor="whiteAlpha.100">
                        <Box minW={0}>
                          <HStack gap={2} minW={0}>
                            <Text color="white" fontWeight="semibold" lineClamp={1}>{session.title}</Text>
                            {session.isDeleted && (
                              <Badge bg="orange.500/15" color="orange.200" borderRadius="full" px={2} py={0.5}>
                                Deleted
                              </Badge>
                            )}
                          </HStack>
                          <Text color="whiteAlpha.500" fontSize="sm">{session.registrationCount} registrations · {session.transactionCount} collections</Text>
                        </Box>
                        <HStack gap={4} flexWrap="wrap" justify={{ base: 'space-between', lg: 'flex-end' }}>
                          <Text color="green.200">{formatMoney(session.grossCollected, session.currency)}</Text>
                          <Text color="orange.200">{formatMoney(session.pending, session.currency)} pending</Text>
                          <Text color="white">{formatMoney(session.netCollected, session.currency)} net</Text>
                        </HStack>
                      </Flex>
                    ))}
                    {filteredOverviewSessions.length === 0 && <Text color="whiteAlpha.500">No session payment records found.</Text>}
                  </VStack>
                  <PaginationFooter
                    page={activePage}
                    pageSize={pageSize}
                    total={filteredOverviewSessions.length}
                    onPageChange={setActivePage}
                  />
                </Panel>

                <Panel title="Ledger Source">
                  <Text color="whiteAlpha.600">
                    These totals are built from Firestore records only. Lenco is contacted only when collecting, withdrawing, or manually syncing a specific payment.
                  </Text>
                </Panel>
              </>
            )}

            {dashboard && activeTab === 'collections' && (
              <>
                <TabActionHeader
                  title="Collections"
                  description="Request mobile-money payments from attendees and sync local collection records."
                  actionLabel="New Collection"
                  icon={<Send size={16} />}
                  onAction={() => setActionModal('collection')}
                />

                <Panel title="Local Collections">
                  <ListControls
                    searchValue={activeSearch}
                    onSearchChange={setActiveSearch}
                    pageSize={pageSize}
                    onPageSizeChange={handlePageSizeChange}
                    total={filteredCollections.length}
                    placeholder="Search collections"
                  />
                  <VStack align="stretch" gap={0}>
                    {pageItems(filteredCollections, activePage, pageSize).map((record) => {
                      const key = asString(record.reference) || asString(record.transactionId) || asString(record.id)
                      return <PaymentRow key={key} record={record} onSync={handleSync} syncing={syncingKey === key} />
                    })}
                    {filteredCollections.length === 0 && <Text color="whiteAlpha.500">No local collections found.</Text>}
                  </VStack>
                  <PaginationFooter
                    page={activePage}
                    pageSize={pageSize}
                    total={filteredCollections.length}
                    onPageChange={setActivePage}
                  />
                </Panel>
              </>
            )}

            {dashboard && activeTab === 'reconciliation' && (
              <Panel title={`Reconciliation Issues (${dashboard?.reconciliation.issueCount || 0})`}>
                <ListControls
                  searchValue={activeSearch}
                  onSearchChange={setActiveSearch}
                  pageSize={pageSize}
                  onPageSizeChange={handlePageSizeChange}
                  total={filteredReconciliation.length}
                  placeholder="Search reconciliation issues"
                />
                <VStack align="stretch" gap={4}>
                  {pageItems(filteredReconciliation, activePage, pageSize).map((item) => (
                    <Box
                      key={item.id}
                      p={4}
                      bg={item.tone === 'orange' ? 'orange.500/10' : 'red.500/10'}
                      border="1px solid"
                      borderColor={item.tone === 'orange' ? 'orange.400/30' : 'red.400/30'}
                      borderRadius="xl"
                    >
                      <HStack gap={2}>
                        <AlertTriangle size={16} color={item.tone === 'orange' ? '#fed7aa' : '#fca5a5'} />
                        <Text color={item.tone === 'orange' ? 'orange.100' : 'red.100'} fontWeight="semibold">
                          {item.title}
                        </Text>
                      </HStack>
                      <Text color="whiteAlpha.600" fontSize="sm" mt={1}>{item.subtitle}</Text>
                    </Box>
                  ))}
                  {filteredReconciliation.length === 0 && <Text color="whiteAlpha.500">No reconciliation issues found.</Text>}
                </VStack>
                <PaginationFooter
                  page={activePage}
                  pageSize={pageSize}
                  total={filteredReconciliation.length}
                  onPageChange={setActivePage}
                />
              </Panel>
            )}

            {dashboard && activeTab === 'withdrawals' && (
              <>
                <TabActionHeader
                  title="Withdrawals"
                  description="Send money from the Lenco balance to an admin mobile-money wallet and review transfer records."
                  actionLabel="New Withdrawal"
                  icon={<Send size={16} />}
                  onAction={() => setActionModal('withdrawal')}
                />

                <Panel title="Withdrawal Records">
                  <ListControls
                    searchValue={activeSearch}
                    onSearchChange={setActiveSearch}
                    pageSize={pageSize}
                    onPageSizeChange={handlePageSizeChange}
                    total={filteredWithdrawals.length}
                    placeholder="Search withdrawals"
                  />
                  <VStack align="stretch" gap={3}>
                    {pageItems(filteredWithdrawals, activePage, pageSize).map((record) => {
                      const key = asString(record.reference) || asString(record.transferId) || asString(record.withdrawalId) || asString(record.id)
                      const providerTransfer = asRecord(record.providerTransfer)
                      const failureDetail =
                        asString(record.failureReason) ||
                        asString(record.transferRequestError) ||
                        asString(providerTransfer.reasonForFailure) ||
                        asString(providerTransfer.failureReason) ||
                        asString(providerTransfer.reason) ||
                        asString(providerTransfer.statusMessage) ||
                        asString(providerTransfer.message)
                      const statusMessage = asString(record.message)
                      const providerReference = asString(record.lencoReference) || asString(record.reference)
                      return (
                        <Flex key={asString(record.id) || key} justify="space-between" align={{ base: 'stretch', lg: 'center' }} direction={{ base: 'column', lg: 'row' }} gap={4} p={4} bg="blackAlpha.200" borderRadius="xl">
                          <Box minW={0}>
                            <HStack gap={2} flexWrap="wrap">
                              <Text color="white" fontWeight="semibold">{recordLabel(record, ['recipientDisplayName', 'reason', 'reference', 'id'])}</Text>
                              <StatusBadge status={record.status} />
                            </HStack>
                            <Text color="whiteAlpha.500" fontSize="sm" mt={1}>
                              {asString(record.phone) || 'No phone'} · {asString(record.operator) || 'No operator'} · {formatDate(record.createdAt || record.updatedAt)}
                            </Text>
                            {(failureDetail || statusMessage || providerReference) && (
                              <VStack align="stretch" gap={1} mt={2}>
                                {failureDetail && (
                                  <Text color="red.200" fontSize="sm" overflowWrap="anywhere">
                                    {failureDetail}
                                  </Text>
                                )}
                                {!failureDetail && statusMessage && (
                                  <Text color="whiteAlpha.500" fontSize="sm" overflowWrap="anywhere">
                                    {statusMessage}
                                  </Text>
                                )}
                                {providerReference && (
                                  <Text color="whiteAlpha.400" fontSize="xs" overflowWrap="anywhere">
                                    Ref: {providerReference}
                                  </Text>
                                )}
                              </VStack>
                            )}
                          </Box>
                          <HStack gap={3} justify={{ base: 'space-between', lg: 'flex-end' }} flexWrap="wrap">
                            <Text color="orange.200" fontWeight="bold">{formatMoney(record.amount, asString(record.currency) || 'ZMW')}</Text>
                            <Button
                              h="38px"
                              minW="112px"
                              px={4}
                              borderRadius="full"
                              bg="whiteAlpha.100"
                              color="white"
                              _hover={{ bg: 'whiteAlpha.200' }}
                              onClick={() => void handleWithdrawalSync(record)}
                              disabled={syncingKey === `withdrawal-${key}` || !key}
                            >
                              {syncingKey === `withdrawal-${key}` ? <Spinner size="sm" /> : <RefreshCw size={14} />}
                              Sync
                            </Button>
                          </HStack>
                        </Flex>
                      )
                    })}
                    {filteredWithdrawals.length === 0 && <Text color="whiteAlpha.500">No withdrawal records found.</Text>}
                  </VStack>
                  <PaginationFooter
                    page={activePage}
                    pageSize={pageSize}
                    total={filteredWithdrawals.length}
                    onPageChange={setActivePage}
                  />
                </Panel>
              </>
            )}

            {dashboard && activeTab === 'returns' && (
              <>
                <TabActionHeader
                  title="Returns"
                  description="Record refunds, cash returns, and manual corrections against completed payment records."
                  actionLabel="New Return"
                  icon={<RotateCcw size={16} />}
                  onAction={() => setActionModal('return')}
                />

                <Panel title="Return Records">
                  <ListControls
                    searchValue={activeSearch}
                    onSearchChange={setActiveSearch}
                    pageSize={pageSize}
                    onPageSizeChange={handlePageSizeChange}
                    total={filteredReturns.length}
                    placeholder="Search returns"
                  />
                  <VStack align="stretch" gap={3}>
                    {pageItems(filteredReturns, activePage, pageSize).map((record) => (
                      <Flex key={asString(record.id)} justify="space-between" gap={4} p={4} bg="blackAlpha.200" borderRadius="xl">
                        <Box minW={0}>
                          <HStack gap={2} flexWrap="wrap">
                            <Text color="white" fontWeight="semibold">{recordLabel(record, ['reason', 'reference'])}</Text>
                            <StatusBadge status={record.status} />
                          </HStack>
                          <Text color="whiteAlpha.500" fontSize="sm" mt={1}>{formatDate(record.createdAt)}</Text>
                        </Box>
                        <Text color="red.200" fontWeight="bold">{formatMoney(record.amount, asString(record.currency) || 'ZMW')}</Text>
                      </Flex>
                    ))}
                    {filteredReturns.length === 0 && <Text color="whiteAlpha.500">No return records found.</Text>}
                  </VStack>
                  <PaginationFooter
                    page={activePage}
                    pageSize={pageSize}
                    total={filteredReturns.length}
                    onPageChange={setActivePage}
                  />
                </Panel>
              </>
            )}
          </VStack>
        )}
      </Box>

      {actionModal === 'collection' && (
        <PaymentModal
          title="Charge Attendee Mobile Money"
          description="The attendee must approve the mobile-money prompt before the collection becomes paid."
          onClose={() => {
            if (!busy) setActionModal(null)
          }}
        >
          <form onSubmit={handleCollect}>
            <SimpleGrid columns={{ base: 1, lg: 3 }} gap={3}>
              <select value={collectionForm.sessionId} onChange={(event) => handleCollectionSessionChange(event.target.value)} style={selectStyle} disabled={sessionsLoading || busy}>
                <option value="">{sessionsLoading ? 'Loading sessions...' : 'Select session'}</option>
                {sessions.map((session: Session) => (
                  <option key={session.id} value={session.id}>{session.title}</option>
                ))}
              </select>
              <select value={collectionForm.registrationId} onChange={(event) => handleCollectionRegistrationChange(event.target.value)} style={selectStyle} disabled={!collectionForm.sessionId || busy}>
                <option value="">No linked registration</option>
                {filteredRegistrations.map((registration: SessionRegistration) => (
                  <option key={registration.id} value={registration.id}>
                    {registration.displayName || registration.email || registration.userId}
                  </option>
                ))}
              </select>
              <select value={collectionForm.operator} onChange={(event) => setCollectionForm((previous) => ({ ...previous, operator: event.target.value as MobileMoneyOperator }))} style={selectStyle} disabled={busy}>
                <option value="airtel">Airtel Money</option>
                <option value="mtn">MTN MoMo</option>
                <option value="zamtel">Zamtel</option>
              </select>
              <Input value={collectionForm.phone} onChange={(event) => setCollectionForm((previous) => ({ ...previous, phone: event.target.value }))} placeholder="Mobile money number" h="46px" bg="whiteAlpha.50" borderColor="whiteAlpha.200" color="white" disabled={busy} />
              <Input value={collectionForm.amount} onChange={(event) => setCollectionForm((previous) => ({ ...previous, amount: event.target.value }))} placeholder={selectedCollectionSession?.price ? String(selectedCollectionSession.price) : 'Amount'} h="46px" bg="whiteAlpha.50" borderColor="whiteAlpha.200" color="white" disabled={busy} />
              <Input value={collectionForm.currency} onChange={(event) => setCollectionForm((previous) => ({ ...previous, currency: event.target.value.toUpperCase() }))} placeholder="Currency" h="46px" bg="whiteAlpha.50" borderColor="whiteAlpha.200" color="white" disabled={busy} />
            </SimpleGrid>
            <Textarea value={collectionForm.note} onChange={(event) => setCollectionForm((previous) => ({ ...previous, note: event.target.value }))} placeholder="Admin note" mt={3} bg="whiteAlpha.50" borderColor="whiteAlpha.200" color="white" disabled={busy} />
            <HStack justify="flex-end" gap={3} mt={5} flexWrap="wrap">
              <Button type="button" h="42px" px={5} borderRadius="full" bg="whiteAlpha.100" color="white" _hover={{ bg: 'whiteAlpha.200' }} onClick={() => setActionModal(null)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" h="42px" px={5} borderRadius="full" bg="brand.500" color="white" _hover={{ bg: 'brand.600' }} disabled={busy}>
                {busy ? <Spinner size="sm" /> : <Send size={16} />}
                Send Payment Prompt
              </Button>
            </HStack>
          </form>
        </PaymentModal>
      )}

      {actionModal === 'withdrawal' && (
        <PaymentModal
          title="Withdraw to Admin"
          description="Send money from the Lenco balance to an admin mobile-money wallet."
          onClose={() => {
            if (!busy) setActionModal(null)
          }}
        >
          <form onSubmit={handleWithdraw}>
            <SimpleGrid columns={{ base: 1, lg: 3 }} gap={3}>
              <select value={withdrawalForm.recipientUserId} onChange={(event) => handleWithdrawalRecipientChange(event.target.value)} style={selectStyle} disabled={usersLoading || busy}>
                <option value="">{usersLoading ? 'Loading admins...' : 'Manual number'}</option>
                {adminRecipients.map((user: FirestoreUser) => (
                  <option key={user.id} value={user.id}>{getUserPaymentLabel(user)}</option>
                ))}
              </select>
              <select value={withdrawalForm.operator} onChange={(event) => setWithdrawalForm((previous) => ({ ...previous, operator: event.target.value as MobileMoneyOperator }))} style={selectStyle} disabled={busy}>
                <option value="airtel">Airtel Money</option>
                <option value="mtn">MTN MoMo</option>
                <option value="zamtel">Zamtel</option>
              </select>
              <Input value={withdrawalForm.phone} onChange={(event) => setWithdrawalForm((previous) => ({ ...previous, phone: event.target.value }))} placeholder="Admin mobile money number" h="46px" bg="whiteAlpha.50" borderColor="whiteAlpha.200" color="white" disabled={busy} />
              <Input value={withdrawalForm.amount} onChange={(event) => setWithdrawalForm((previous) => ({ ...previous, amount: event.target.value }))} placeholder="Amount" h="46px" bg="whiteAlpha.50" borderColor="whiteAlpha.200" color="white" disabled={busy} />
              <Input value={withdrawalForm.currency} onChange={(event) => setWithdrawalForm((previous) => ({ ...previous, currency: event.target.value.toUpperCase() }))} placeholder="Currency" h="46px" bg="whiteAlpha.50" borderColor="whiteAlpha.200" color="white" disabled={busy} />
              <Input value={withdrawalForm.reason} onChange={(event) => setWithdrawalForm((previous) => ({ ...previous, reason: event.target.value }))} placeholder="Reason" h="46px" bg="whiteAlpha.50" borderColor="whiteAlpha.200" color="white" disabled={busy} />
            </SimpleGrid>
            <Textarea value={withdrawalForm.note} onChange={(event) => setWithdrawalForm((previous) => ({ ...previous, note: event.target.value }))} placeholder="Admin note" mt={3} bg="whiteAlpha.50" borderColor="whiteAlpha.200" color="white" disabled={busy} />
            {adminRecipients.length === 0 && !usersLoading && (
              <Text color="orange.200" fontSize="sm" mt={3}>
                No admin accounts with saved phone numbers were found. Use a manual number or update an admin profile first.
              </Text>
            )}
            <HStack justify="flex-end" gap={3} mt={5} flexWrap="wrap">
              <Button type="button" h="42px" px={5} borderRadius="full" bg="whiteAlpha.100" color="white" _hover={{ bg: 'whiteAlpha.200' }} onClick={() => setActionModal(null)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" h="42px" px={5} borderRadius="full" bg="brand.500" color="white" _hover={{ bg: 'brand.600' }} disabled={busy}>
                {busy ? <Spinner size="sm" /> : <Send size={16} />}
                Send Withdrawal
              </Button>
            </HStack>
          </form>
        </PaymentModal>
      )}

      {actionModal === 'return' && (
        <PaymentModal
          title="Record Return"
          description="Record a refund, correction, or manual return against the Firestore ledger."
          onClose={() => {
            if (!busy) setActionModal(null)
          }}
        >
          <form onSubmit={handleRecordReturn}>
            <SimpleGrid columns={{ base: 1, lg: 3 }} gap={3}>
              <select value={returnForm.transactionKey} onChange={(event) => handleReturnTransactionChange(event.target.value)} style={selectStyle} disabled={busy}>
                <option value="">No linked transaction</option>
                {completedTransactions.map((transaction) => {
                  const key = asString(transaction.reference) || asString(transaction.transactionId)
                  return (
                    <option key={key} value={key}>
                      {recordLabel(transaction, ['displayName', 'email', 'reference'])} - {formatMoney(transaction.amount, asString(transaction.currency) || 'ZMW')}
                    </option>
                  )
                })}
              </select>
              <select value={returnForm.sessionId} onChange={(event) => setReturnForm((previous) => ({ ...previous, sessionId: event.target.value }))} style={selectStyle} disabled={busy}>
                <option value="">Select session</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>{session.title}</option>
                ))}
              </select>
              <select value={returnForm.status} onChange={(event) => setReturnForm((previous) => ({ ...previous, status: event.target.value as ReturnForm['status'] }))} style={selectStyle} disabled={busy}>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <Input value={returnForm.amount} onChange={(event) => setReturnForm((previous) => ({ ...previous, amount: event.target.value }))} placeholder="Amount" h="46px" bg="whiteAlpha.50" borderColor="whiteAlpha.200" color="white" disabled={busy} />
              <Input value={returnForm.currency} onChange={(event) => setReturnForm((previous) => ({ ...previous, currency: event.target.value.toUpperCase() }))} placeholder="Currency" h="46px" bg="whiteAlpha.50" borderColor="whiteAlpha.200" color="white" disabled={busy} />
              <select value={returnForm.method} onChange={(event) => setReturnForm((previous) => ({ ...previous, method: event.target.value as ReturnForm['method'] }))} style={selectStyle} disabled={busy}>
                <option value="mobile_money">Mobile money</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </SimpleGrid>
            <Input value={returnForm.reason} onChange={(event) => setReturnForm((previous) => ({ ...previous, reason: event.target.value }))} placeholder="Reason" mt={3} h="46px" bg="whiteAlpha.50" borderColor="whiteAlpha.200" color="white" disabled={busy} />
            <Input value={returnForm.externalReference} onChange={(event) => setReturnForm((previous) => ({ ...previous, externalReference: event.target.value }))} placeholder="External return reference" mt={3} h="46px" bg="whiteAlpha.50" borderColor="whiteAlpha.200" color="white" disabled={busy} />
            <Textarea value={returnForm.notes} onChange={(event) => setReturnForm((previous) => ({ ...previous, notes: event.target.value }))} placeholder="Return notes" mt={3} bg="whiteAlpha.50" borderColor="whiteAlpha.200" color="white" disabled={busy} />
            <HStack justify="flex-end" gap={3} mt={5} flexWrap="wrap">
              <Button type="button" h="42px" px={5} borderRadius="full" bg="whiteAlpha.100" color="white" _hover={{ bg: 'whiteAlpha.200' }} onClick={() => setActionModal(null)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" h="42px" px={5} borderRadius="full" bg="brand.500" color="white" _hover={{ bg: 'brand.600' }} disabled={busy}>
                {busy ? <Spinner size="sm" /> : <RotateCcw size={16} />}
                Record Return
              </Button>
            </HStack>
          </form>
        </PaymentModal>
      )}
    </AdminLayout>
  )
}
