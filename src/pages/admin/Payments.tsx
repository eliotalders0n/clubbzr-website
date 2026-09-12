'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
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
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FileText,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  WalletCards,
  X,
} from 'lucide-react'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { useCollection } from '@/hooks'
import {
  collectSessionPayment,
  classifyExternalPayment,
  createPaymentWithdrawal,
  getAdminPaymentsDashboard,
  recordExternalFundOutflow,
  recordExternalPayment,
  recordPaymentReturn,
  resolvePaymentReconciliationIssue,
  syncPaymentCollection,
  syncPaymentWithdrawal,
  updatePaymentReturn,
  type AdminPaymentDashboard,
} from '../../../lib/adminPayments'
import type { MobileMoneyOperator } from '../../../lib/lenco'
import type { Session, SessionRegistration, User as FirestoreUser } from '../../../lib/schema'

type PaymentsTab = 'overview' | 'transactions' | 'collections' | 'external' | 'reconciliation' | 'withdrawals' | 'returns'
type PaymentActionModal = 'collection' | 'external' | 'classify' | 'outflow' | 'withdrawal' | 'return' | null

interface ReconciliationListItem {
  id: string
  title: string
  subtitle: string
  tone: 'orange' | 'red'
  action: 'update_signup' | 'review'
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

interface ExternalPaymentForm {
  sessionId: string
  registrationId: string
  method: 'cash' | 'bank_transfer' | 'card' | 'other'
  amount: string
  currency: string
  reference: string
  receivedAt: string
  note: string
}

interface ClassifyExternalPaymentForm {
  sessionId: string
  registrationId: string
  method: 'cash' | 'bank_transfer' | 'card' | 'other'
  note: string
}

interface ExternalFundOutflowForm {
  sessionId: string
  source: 'cash' | 'bank_transfer' | 'card' | 'other'
  amount: string
  currency: string
  reason: string
  reference: string
  spentAt: string
  note: string
}

interface ReturnForm {
  transactionKey: string
  sessionId: string
  amount: string
  currency: string
  method: 'cash' | 'bank_transfer' | 'mobile_money' | 'card' | 'other'
  status: 'pending' | 'completed' | 'cancelled'
  effect: 'customer_refund' | 'revenue_correction'
  reason: string
  externalReference: string
  notes: string
}

interface ReturnSource {
  key: string
  type: 'transaction' | 'registration'
  record: Record<string, unknown>
  label: string
}

const selectStyle: CSSProperties = {
  width: '100%',
  height: '46px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: '#1f1f1f',
  color: '#faf9f6',
  colorScheme: 'dark',
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
  { value: 'overview', label: 'Accounts' },
  { value: 'transactions', label: 'Wallet Activity' },
  { value: 'collections', label: 'Payment Requests' },
  { value: 'external', label: 'Cash & External' },
  { value: 'reconciliation', label: 'Reconciliation' },
  { value: 'withdrawals', label: 'Withdrawals' },
  { value: 'returns', label: 'Returns' },
]

const DASHBOARD_LOAD_TIMEOUT_MS = 18000
const PAGE_SIZE_OPTIONS = [10, 25, 50]
const initialTabText: Record<PaymentsTab, string> = {
  overview: '',
  transactions: '',
  collections: '',
  external: '',
  reconciliation: '',
  withdrawals: '',
  returns: '',
}
const initialTabPage: Record<PaymentsTab, number> = {
  overview: 1,
  transactions: 1,
  collections: 1,
  external: 1,
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

const emptyExternalPaymentForm: ExternalPaymentForm = {
  sessionId: '',
  registrationId: '',
  method: 'cash',
  amount: '',
  currency: 'ZMW',
  reference: '',
  receivedAt: new Date().toISOString().slice(0, 16),
  note: '',
}

const emptyClassifyExternalPaymentForm: ClassifyExternalPaymentForm = {
  sessionId: '',
  registrationId: '',
  method: 'cash',
  note: '',
}

const emptyExternalFundOutflowForm: ExternalFundOutflowForm = {
  sessionId: '',
  source: 'cash',
  amount: '',
  currency: 'ZMW',
  reason: '',
  reference: '',
  spentAt: new Date().toISOString().slice(0, 16),
  note: '',
}

const emptyReturnForm: ReturnForm = {
  transactionKey: '',
  sessionId: '',
  amount: '',
  currency: 'ZMW',
  method: 'mobile_money',
  status: 'pending',
  effect: 'customer_refund',
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

const formatMoney = (amount: unknown, currency = 'ZMW'): string => {
  const formatted = asNumber(amount).toLocaleString('en-ZM', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return currency.toUpperCase() === 'ZMW' ? `K${formatted}` : `${currency} ${formatted}`
}

const csvCell = (value: unknown): string => {
  const text = value === null || value === undefined
    ? ''
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

const downloadCsv = (
  filename: string,
  records: Record<string, unknown>[],
  preferredColumns: string[] = []
) => {
  const discoveredColumns = Array.from(new Set(records.flatMap((record) => Object.keys(record))))
  const columns = [
    ...preferredColumns.filter((column) => discoveredColumns.includes(column)),
    ...discoveredColumns.filter((column) => !preferredColumns.includes(column)),
  ]
  const csv = [
    columns.map(csvCell).join(','),
    ...records.map((record) => columns.map((column) => csvCell(record[column])).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(href)
}

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
    return { bg: 'rgba(63,175,82,0.14)', color: '#71d681' }
  }
  if (['failed', 'cancelled', 'declined'].includes(normalized)) {
    return { bg: 'rgba(223,80,101,0.14)', color: '#ff7b8e' }
  }
  if (['pending', 'processing', 'request_started'].includes(normalized)) {
    return { bg: 'rgba(255,107,53,0.14)', color: '#ff9a70' }
  }
  return { bg: '#262626', color: '#a3a3a3' }
}

const providerTransactionStatus = (record: Record<string, unknown>): string => {
  const status = asString(record.status).toLowerCase()
  if (!status || ['successful', 'success'].includes(status)) return 'completed'
  return status
}

function StatusBadge({ status }: { status: unknown }) {
  const tone = statusTone(status)
  return (
    <Badge
      display="inline-flex"
      alignSelf="flex-start"
      width="fit-content"
      maxW="100%"
      bg={tone.bg}
      color={tone.color}
      borderRadius="full"
      px={3}
      py={1}
      textTransform="capitalize"
      whiteSpace="nowrap"
    >
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
      <Text color="#a3a3a3" fontSize="xs" textTransform="uppercase" letterSpacing="0.08em">
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
    ...(dashboard.reconciliation.unmatchedProviderInflows || []).map((issue, index) => ({
      id: `provider-inflow-${index}`,
      title: 'Lenco settlement has no matching Club BZR collection',
      subtitle: asString(issue.reference) || 'Provider reference unavailable',
      tone: 'red' as const,
      action: 'review' as const,
      issue,
    })),
    ...(dashboard.reconciliation.unmatchedLocalCollections || []).map((issue, index) => ({
      id: `local-collection-${index}`,
      title: 'Club BZR collection has no matching Lenco settlement',
      subtitle: asString(issue.reference) || 'Local reference unavailable',
      tone: 'red' as const,
      action: 'review' as const,
      issue,
    })),
    ...(dashboard.reconciliation.pendingProviderSettlements || []).map((issue, index) => ({
      id: `pending-settlement-${index}`,
      title: 'Collection is waiting for Lenco settlement',
      subtitle: asString(issue.reference) || 'Provider reference unavailable',
      tone: 'orange' as const,
      action: 'review' as const,
      issue,
    })),
    ...(dashboard.reconciliation.settlementAmountIssues || []).map((issue, index) => ({
      id: `settlement-amount-${index}`,
      title: 'Collection amount differs from Lenco',
      subtitle: `${formatMoney(issue.localAmount)} local · ${formatMoney(issue.providerAmount)} Lenco`,
      tone: 'red' as const,
      action: 'review' as const,
      issue,
    })),
    ...dashboard.reconciliation.transactionStatusIssues.map((issue, index) => ({
      id: `transaction-${index}`,
      title: 'Paid transaction needs signup update',
      subtitle: asString(issue.reference),
      tone: 'orange' as const,
      action: 'update_signup' as const,
      issue,
    })),
    ...dashboard.reconciliation.registrationPaymentIssues.map((issue, index) => ({
      id: `registration-${index}`,
      title: 'Paid signup missing completed transaction',
      subtitle: asString(issue.reference) || 'No payment reference',
      tone: 'red' as const,
      action: 'review' as const,
      issue,
    })),
    ...dashboard.reconciliation.returnIssues.map((issue, index) => ({
      id: `return-${index}`,
      title: 'Return needs transaction review',
      subtitle: asString(issue.reference) || 'No payment reference',
      tone: 'red' as const,
      action: 'review' as const,
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
    <Box bg="#171717" border="1px solid" borderColor="rgba(255,255,255,0.10)" borderRadius="18px" overflow="hidden" boxShadow="0 10px 32px rgba(0,0,0,0.28)">
      <Flex px={{ base: 4, md: 5 }} py={4} justify="space-between" gap={3} align="center" borderBottom="1px solid" borderColor="rgba(255,255,255,0.08)">
        <Heading as="h2" size="sm" color="#faf9f6">
          {title}
        </Heading>
        {action}
      </Flex>
      <Box p={5}>{children}</Box>
    </Box>
  )
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = '#FF6B35',
}: {
  label: string
  value: string
  detail: string
  icon: React.ReactNode
  tone?: string
}) {
  return (
    <Box bg="#171717" border="1px solid" borderColor="rgba(255,255,255,0.10)" borderRadius="18px" p={5} boxShadow="0 10px 32px rgba(0,0,0,0.28)">
      <Flex align="center" justify="space-between" gap={3}>
        <Text color="#a3a3a3" fontSize="sm" fontWeight="medium">{label}</Text>
        <Flex boxSize="38px" borderRadius="12px" bg={`${tone}12`} color={tone} align="center" justify="center">
          {icon}
        </Flex>
      </Flex>
      <Text color="#faf9f6" fontSize={{ base: '2xl', md: '3xl' }} fontWeight="700" letterSpacing="-0.04em" mt={4}>
        {value}
      </Text>
      <Text color="#8a8a8a" fontSize="xs" mt={2}>{detail}</Text>
    </Box>
  )
}

function ProviderTransactionRow({ record }: { record: Record<string, unknown> }) {
  const type = asString(record.type).toLowerCase()
  const isCredit = type === 'credit'
  const status = providerTransactionStatus(record)
  const details = asRecord(record.details)
  const counterparty = asString(details.accountName) || asString(record.narration) || 'Clubbzr Wallet transaction'
  const currency = asString(record.currency) || 'ZMW'
  const date = record.completedAt || record.initiatedAt || record.datetime

  return (
    <Flex
      display={{ base: 'flex', lg: 'grid' }}
      direction={{ base: 'column', lg: 'row' }}
      gridTemplateColumns={{ lg: 'minmax(220px,1.4fr) minmax(120px,.6fr) minmax(130px,.6fr) minmax(110px,.5fr)' }}
      gap={{ base: 3, lg: 5 }}
      align={{ base: 'stretch', lg: 'center' }}
      px={{ base: 0, lg: 1 }}
      py={4}
      borderBottom="1px solid"
      borderColor="rgba(255,255,255,0.08)"
    >
      <Box minW={0}>
        <Text color="#faf9f6" fontWeight="semibold" lineClamp={1}>{counterparty}</Text>
        <Text color="#a3a3a3" fontSize="xs" mt={1}>{formatDate(date)}</Text>
      </Box>
      <HStack gap={2} color={isCredit ? '#3faf52' : '#df5065'}>
        {isCredit ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
        <Text color="#d4d4d4" fontSize="sm" fontWeight="medium">{isCredit ? 'Inflow' : 'Payout'}</Text>
      </HStack>
      <Text color={status === 'failed' || status === 'declined' ? '#737373' : isCredit ? '#3faf52' : '#faf9f6'} fontWeight="semibold" textDecoration={status === 'failed' || status === 'declined' ? 'line-through' : 'none'}>
        {isCredit ? '+' : '-'}{formatMoney(record.amount, currency)}
      </Text>
      <StatusBadge status={status} />
    </Flex>
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
        <Heading as="h2" size="md" color="#faf9f6">
          {title}
        </Heading>
        <Text color="#a3a3a3" mt={1}>
          {description}
        </Text>
      </Box>
      {actionLabel && onAction && (
        <Button
          h="42px"
          px={5}
          borderRadius="full"
          bg="#FF6B35"
          color="#faf9f6"
          _hover={{ bg: '#e55a2a' }}
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

function DataScopeBanner({
  source,
  title,
  description,
  icon,
  tone,
}: {
  source: string
  title: string
  description: string
  icon: React.ReactNode
  tone: string
}) {
  return (
    <Flex
      align={{ base: 'flex-start', md: 'center' }}
      gap={3}
      direction={{ base: 'column', md: 'row' }}
      p={4}
      borderRadius="14px"
      border="1px solid"
      borderColor={`${tone}3d`}
      bg={`${tone}12`}
    >
      <Flex boxSize="38px" flexShrink={0} align="center" justify="center" borderRadius="12px" bg={`${tone}1f`} color={tone}>
        {icon}
      </Flex>
      <Box minW={0} flex="1">
        <HStack gap={2} flexWrap="wrap">
          <Text color="#faf9f6" fontWeight="semibold">{title}</Text>
          <Badge bg="#262626" color="#d4d4d4" borderRadius="full" px={2.5} py={0.5}>
            Source · {source}
          </Badge>
        </HStack>
        <Text color="#a3a3a3" fontSize="sm" mt={1}>{description}</Text>
      </Box>
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
        <Box position="absolute" left="14px" top="50%" transform="translateY(-50%)" color="#a3a3a3" pointerEvents="none">
          <Search size={16} />
        </Box>
        <Input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          h="42px"
          pl="42px"
          bg="#1f1f1f"
          borderColor="rgba(255,255,255,0.12)"
          color="#faf9f6"
        />
      </Box>
      <HStack gap={3} justify={{ base: 'space-between', md: 'flex-end' }}>
        <Text color="#a3a3a3" fontSize="sm" whiteSpace="nowrap">
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
      borderColor="rgba(255,255,255,0.08)"
    >
      <Text color="#a3a3a3" fontSize="sm">
        Showing {formatCount(start)}-{formatCount(end)} of {formatCount(total)}
      </Text>
      <HStack gap={2} justify={{ base: 'space-between', md: 'flex-end' }}>
        <Button
          h="36px"
          px={3}
          borderRadius="full"
          bg="#262626"
          color="#faf9f6"
          _hover={{ bg: '#333333' }}
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft size={16} />
          Previous
        </Button>
        <Text color="#a3a3a3" fontSize="sm" minW="78px" textAlign="center">
          {currentPage} / {totalPages}
        </Text>
        <Button
          h="36px"
          px={3}
          borderRadius="full"
          bg="#262626"
          color="#faf9f6"
          _hover={{ bg: '#333333' }}
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
        bg="#171717"
        border="1px solid"
        borderColor="rgba(255,255,255,0.12)"
        borderRadius="xl"
        boxShadow="0 24px 80px rgba(0,0,0,0.45)"
        onClick={(event) => event.stopPropagation()}
      >
        <Flex px={5} py={4} justify="space-between" gap={4} align="flex-start" borderBottom="1px solid" borderColor="rgba(255,255,255,0.08)">
          <Box minW={0}>
            <Heading as="h2" size="md" color="#faf9f6">
              {title}
            </Heading>
            {description && (
              <Text color="#a3a3a3" fontSize="sm" mt={1}>
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
            bg="#262626"
            color="#faf9f6"
            _hover={{ bg: '#333333' }}
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
      borderColor="rgba(255,255,255,0.08)"
    >
      <Box minW={0}>
        <HStack gap={2} flexWrap="wrap">
          <Text color="#faf9f6" fontWeight="semibold" lineClamp={1}>
            {recordLabel(record, ['displayName', 'email', 'phone'])}
          </Text>
          <StatusBadge status={status} />
        </HStack>
        <Text color="#a3a3a3" fontSize="sm" mt={1} lineClamp={1}>
          {reference}
        </Text>
        <Text color="#737373" fontSize="xs" mt={1}>
          {formatDate(record.createdAt || record.updatedAt)}
        </Text>
      </Box>
      <HStack gap={3} justify={{ base: 'space-between', lg: 'flex-end' }} flexWrap="wrap">
        <Text color="#FF6B35" fontWeight="bold">
          {formatMoney(record.amount, currency)}
        </Text>
        <Button
          h="38px"
          minW="112px"
          px={4}
          borderRadius="full"
          bg="#262626"
          color="#faf9f6"
          _hover={{ bg: '#333333' }}
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
  const location = useLocation()
  const routedExternalPayment = (location.state as {
    recordExternal?: {
      registrationId?: string
      sessionId?: string
      amount?: number
      currency?: string
    }
  } | null)?.recordExternal
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

  const [activeTab, setActiveTab] = useState<PaymentsTab>(routedExternalPayment ? 'external' : 'overview')
  const [sessionFilter, setSessionFilter] = useState('all')
  const [dashboard, setDashboard] = useState<AdminPaymentDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [syncingKey, setSyncingKey] = useState('')
  const [resolvingIssueKey, setResolvingIssueKey] = useState('')
  const [updatingReturnId, setUpdatingReturnId] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionModal, setActionModal] = useState<PaymentActionModal>(routedExternalPayment ? 'external' : null)
  const [searchByTab, setSearchByTab] = useState<Record<PaymentsTab, string>>(initialTabText)
  const [pageByTab, setPageByTab] = useState<Record<PaymentsTab, number>>(initialTabPage)
  const [pageSize, setPageSize] = useState(10)
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [transactionType, setTransactionType] = useState<'all' | 'credit' | 'debit'>('all')
  const [transactionStatus, setTransactionStatus] = useState('all')
  const [collectionForm, setCollectionForm] = useState<CollectionForm>(emptyCollectionForm)
  const [externalPaymentForm, setExternalPaymentForm] = useState<ExternalPaymentForm>(() => ({
    ...emptyExternalPaymentForm,
    sessionId: routedExternalPayment?.sessionId || '',
    registrationId: routedExternalPayment?.registrationId || '',
    amount: routedExternalPayment?.amount ? String(routedExternalPayment.amount) : '',
    currency: routedExternalPayment?.currency || 'ZMW',
  }))
  const [classifyExternalPaymentForm, setClassifyExternalPaymentForm] = useState<ClassifyExternalPaymentForm>(emptyClassifyExternalPaymentForm)
  const [externalFundOutflowForm, setExternalFundOutflowForm] = useState<ExternalFundOutflowForm>(emptyExternalFundOutflowForm)
  const [withdrawalForm, setWithdrawalForm] = useState<WithdrawalForm>(emptyWithdrawalForm)
  const [returnForm, setReturnForm] = useState<ReturnForm>(emptyReturnForm)

  const sessions = useMemo(
    () => [...sessionDocs].sort((a, b) => asNumber(b.price) - asNumber(a.price)),
    [sessionDocs]
  )
  const selectedCollectionSession = sessions.find((session) => session.id === collectionForm.sessionId)
  const filteredRegistrations = registrations.filter((registration) => registration.sessionId === collectionForm.sessionId)
  const externalRegistrations = registrations.filter((registration) =>
    registration.sessionId === externalPaymentForm.sessionId &&
    !['paid_online', 'paid_external', 'refunded'].includes(registration.paymentStatus)
  )

  const adminRecipients = useMemo(
    () => userDocs
      .filter((user: FirestoreUser) => user.role === 'admin' && getUserPaymentPhone(user))
      .sort((a: FirestoreUser, b: FirestoreUser) => getUserPaymentLabel(a).localeCompare(getUserPaymentLabel(b))),
    [userDocs]
  )
  const completedTransactions = useMemo(
    () => (dashboard?.localTransactions || []).filter((transaction) => {
      const isCompleted = String(transaction.status || '').toLowerCase() === 'completed'
      const hasPendingReturn = String(transaction.returnStatus || '').toLowerCase() === 'pending'
      const remainingAmount =
        asNumber(transaction.amount) -
        asNumber(transaction.returnedAmount) -
        asNumber(transaction.correctedAmount)
      return isCompleted && !hasPendingReturn && remainingAmount > 0
    }),
    [dashboard?.localTransactions]
  )
  const returnSources = useMemo<ReturnSource[]>(() => {
    const transactionSources = completedTransactions.flatMap((transaction) => {
      const transactionKey =
        asString(transaction.reference) ||
        asString(transaction.transactionId) ||
        asString(transaction.id)
      if (!transactionKey) return []

      return [{
        key: `transaction:${transactionKey}`,
        type: 'transaction' as const,
        record: transaction,
        label: `Paid transaction · ${recordLabel(transaction, ['displayName', 'email', 'reference'])} - ${formatMoney(transaction.amount, asString(transaction.currency) || 'ZMW')}`,
      }]
    })
    const registrationSources = registrations.flatMap((registration) => {
      const isTerminal = registration.status === 'declined' || registration.status === 'cancelled'
      const isPaid =
        registration.paymentStatus === 'paid_external' ||
        registration.paymentStatus === 'paid_online'
      const hasActiveReturn =
        registration.returnStatus === 'pending' ||
        registration.returnStatus === 'completed'
      if (
        !isTerminal ||
        !isPaid ||
        hasActiveReturn ||
        asNumber(registration.paymentAmount) <= 0
      ) {
        return []
      }

      const record = registration as unknown as Record<string, unknown>
      const stateLabel = registration.status === 'declined' ? 'Declined' : 'Cancelled'
      return [{
        key: `registration:${registration.id}`,
        type: 'registration' as const,
        record,
        label: `${stateLabel} · ${registration.email || registration.displayName || registration.userId} - ${formatMoney(registration.paymentAmount, registration.paymentCurrency || 'ZMW')}`,
      }]
    })
    const terminalRegistrationIds = new Set(
      registrationSources.map((source) => asString(source.record.id)).filter(Boolean)
    )
    const unlinkedTransactionSources = transactionSources.filter(
      (source) => !terminalRegistrationIds.has(asString(source.record.registrationId))
    )

    return [...registrationSources, ...unlinkedTransactionSources]
  }, [completedTransactions, registrations])
  const selectedReturnSource = returnSources.find((source) => source.key === returnForm.transactionKey)
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
  const filteredProviderTransactions = useMemo(
    () => (dashboard?.provider?.transactions || []).filter((record) => {
      const typeMatches = transactionType === 'all' || asString(record.type).toLowerCase() === transactionType
      const statusMatches = transactionStatus === 'all' || providerTransactionStatus(record) === transactionStatus
      return typeMatches && statusMatches && recordMatchesSearch(record, searchByTab.transactions, [
        'narration',
        'type',
        'status',
        'clientReference',
        'transactionReference',
        'details',
      ])
    }),
    [dashboard?.provider?.transactions, searchByTab.transactions, transactionStatus, transactionType]
  )
  const externalPaymentRecords = useMemo(() => {
    const explicitReceiptRegistrationIds = new Set(
      (dashboard?.externalReceipts || []).map((receipt) => asString(receipt.registrationId)).filter(Boolean)
    )
    const legacyRecords = (dashboard?.registrations || [])
      .filter((registration) => asString(registration.paymentStatus) === 'paid_external')
      .filter((registration) => !explicitReceiptRegistrationIds.has(asString(registration.id)))
      .map((registration) => ({
        ...registration,
        id: `legacy-${asString(registration.id)}`,
        registrationId: asString(registration.id),
        amount: registration.paymentAmount,
        currency: registration.paymentCurrency,
        method: 'unclassified',
        status: 'legacy',
        receivedAt: registration.paidAt,
        legacy: true,
      }))
    return [...(dashboard?.externalReceipts || []), ...legacyRecords]
  }, [dashboard?.externalReceipts, dashboard?.registrations])
  const filteredExternalPayments = useMemo(
    () => externalPaymentRecords.filter((record) => recordMatchesSearch(record, searchByTab.external, [
      'displayName', 'email', 'reference', 'method', 'status', 'sessionId',
    ])),
    [externalPaymentRecords, searchByTab.external]
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
        'effect',
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

  const handleExternalSessionChange = (sessionId: string) => {
    const session = sessions.find((entry) => entry.id === sessionId)
    setExternalPaymentForm((previous) => ({
      ...previous,
      sessionId,
      registrationId: '',
      amount: session?.price ? String(session.price) : '',
      currency: session?.currency || 'ZMW',
    }))
  }

  const handleExternalRegistrationChange = (registrationId: string) => {
    const registration = registrations.find((entry) => entry.id === registrationId)
    setExternalPaymentForm((previous) => ({
      ...previous,
      registrationId,
      amount: registration?.paymentAmount
        ? String(registration.paymentAmount)
        : previous.amount,
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

  const handleRecordExternalPayment = async (event: FormEvent) => {
    event.preventDefault()
    setMessage(null)
    setError(null)
    const amount = Number(externalPaymentForm.amount)
    if (
      !externalPaymentForm.sessionId ||
      !externalPaymentForm.registrationId ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError('Session, registration, and amount are required.')
      return
    }

    setBusy(true)
    try {
      const result = await recordExternalPayment({
        sessionId: externalPaymentForm.sessionId,
        registrationId: externalPaymentForm.registrationId,
        method: externalPaymentForm.method,
        amount,
        currency: externalPaymentForm.currency,
        reference: externalPaymentForm.reference || undefined,
        receivedAt: externalPaymentForm.receivedAt
          ? new Date(externalPaymentForm.receivedAt).toISOString()
          : undefined,
        note: externalPaymentForm.note || undefined,
      })
      setMessage(result.message || 'External payment recorded.')
      setExternalPaymentForm(emptyExternalPaymentForm)
      await loadDashboard()
      setActionModal(null)
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'Unable to record payment.')
    } finally {
      setBusy(false)
    }
  }

  const openExternalPaymentClassification = (record: Record<string, unknown>) => {
    setClassifyExternalPaymentForm({
      sessionId: asString(record.sessionId),
      registrationId: asString(record.registrationId),
      method: 'cash',
      note: '',
    })
    setMessage(null)
    setError(null)
    setActionModal('classify')
  }

  const handleClassifyExternalPayment = async (event: FormEvent) => {
    event.preventDefault()
    setMessage(null)
    setError(null)
    if (!classifyExternalPaymentForm.sessionId || !classifyExternalPaymentForm.registrationId) {
      setError('This legacy receipt is missing its session or registration link.')
      return
    }

    setBusy(true)
    try {
      const result = await classifyExternalPayment({
        sessionId: classifyExternalPaymentForm.sessionId,
        registrationId: classifyExternalPaymentForm.registrationId,
        method: classifyExternalPaymentForm.method,
        note: classifyExternalPaymentForm.note || undefined,
      })
      setMessage(result.message || 'Receipt classified.')
      setClassifyExternalPaymentForm(emptyClassifyExternalPaymentForm)
      await loadDashboard()
      setActionModal(null)
    } catch (classificationError) {
      setError(classificationError instanceof Error ? classificationError.message : 'Unable to classify receipt.')
    } finally {
      setBusy(false)
    }
  }

  const handleRecordExternalFundOutflow = async (event: FormEvent) => {
    event.preventDefault()
    setMessage(null)
    setError(null)
    const amount = Number(externalFundOutflowForm.amount)
    if (!externalFundOutflowForm.reason.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError('Amount and purpose are required.')
      return
    }

    setBusy(true)
    try {
      const result = await recordExternalFundOutflow({
        sessionId: externalFundOutflowForm.sessionId || undefined,
        source: externalFundOutflowForm.source,
        amount,
        currency: externalFundOutflowForm.currency,
        reason: externalFundOutflowForm.reason.trim(),
        reference: externalFundOutflowForm.reference || undefined,
        spentAt: externalFundOutflowForm.spentAt
          ? new Date(externalFundOutflowForm.spentAt).toISOString()
          : undefined,
        note: externalFundOutflowForm.note || undefined,
      })
      setMessage(result.message || 'Money out recorded.')
      setExternalFundOutflowForm(emptyExternalFundOutflowForm)
      await loadDashboard()
      setActionModal(null)
    } catch (outflowError) {
      setError(outflowError instanceof Error ? outflowError.message : 'Unable to record money out.')
    } finally {
      setBusy(false)
    }
  }

  const handleExport = () => {
    const timestamp = new Date().toISOString().slice(0, 10)
    if (activeTab === 'transactions') {
      downloadCsv(`clubbzr-wallet-transactions-${timestamp}.csv`, filteredProviderTransactions, [
        'completedAt', 'initiatedAt', 'type', 'status', 'amount', 'fee', 'currency',
        'narration', 'clientReference', 'transactionReference', 'accountId',
      ])
    } else if (activeTab === 'collections') {
      downloadCsv(`clubbzr-collections-${timestamp}.csv`, filteredCollections, [
        'createdAt', 'completedAt', 'displayName', 'amount', 'currency', 'status',
        'reference', 'transactionId', 'sessionId', 'registrationId',
      ])
    } else if (activeTab === 'external') {
      const externalLedger = [
        ...filteredExternalPayments.map((record) => ({ ...record, recordType: 'receipt' })),
        ...(dashboard?.externalFundMovements || []).map((record) => ({ ...record, recordType: 'money_out' })),
      ]
      downloadCsv(`clubbzr-cash-external-${timestamp}.csv`, externalLedger, [
        'recordType', 'receivedAt', 'spentAt', 'displayName', 'reason', 'amount',
        'currency', 'method', 'source', 'status', 'reference', 'sessionId',
        'registrationId', 'recordedBy',
      ])
    } else if (activeTab === 'withdrawals') {
      downloadCsv(`clubbzr-withdrawals-${timestamp}.csv`, filteredWithdrawals)
    } else if (activeTab === 'returns') {
      downloadCsv(`clubbzr-returns-${timestamp}.csv`, filteredReturns)
    } else if (activeTab === 'reconciliation') {
      downloadCsv(
        `clubbzr-reconciliation-${timestamp}.csv`,
        filteredReconciliation.map((item) => ({
          issue: item.title,
          reference: item.subtitle,
          action: item.action,
          details: item.issue,
        }))
      )
    } else {
      downloadCsv(
        `clubbzr-revenue-report-${timestamp}.csv`,
        (dashboard?.sessions || []).map((session) => ({
          ...session,
          recognizedRevenue: session.grossCollected - session.returned - session.corrections,
          cashAfterWithdrawals: session.grossCollected - session.returned - session.corrections - session.withdrawn,
        })) as unknown as Record<string, unknown>[]
      )
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

  const handleResolveReconciliationIssue = async (item: ReconciliationListItem) => {
    if (item.action !== 'update_signup') return

    const transaction = asRecord(item.issue.transaction)
    const reference = asString(item.issue.reference) || asString(transaction.reference)
    const transactionId = asString(transaction.transactionId) || asString(transaction.id)
    const registrationId = asString(transaction.registrationId)
    const key = item.id

    if (!reference && !transactionId) {
      setError('This issue is missing its payment reference.')
      return
    }

    setResolvingIssueKey(key)
    setMessage(null)
    setError(null)
    try {
      const result = await resolvePaymentReconciliationIssue({
        issueType: 'transaction_signup_status',
        reference: reference || undefined,
        transactionId: transactionId || undefined,
        registrationId: registrationId || undefined,
      })
      setMessage(result.message || 'Signup payment status updated.')
      await loadDashboard()
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : 'Unable to resolve issue.')
    } finally {
      setResolvingIssueKey('')
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
    const source = returnSources.find((entry) => entry.key === transactionKey)
    const record = source?.record
    const isCancelledRegistration = source?.type === 'registration'
    const paymentMethod = asString(record?.paymentMethod)
    const method = ['cash', 'bank_transfer', 'mobile_money', 'card', 'other'].includes(paymentMethod)
      ? paymentMethod as ReturnForm['method']
      : undefined

    setReturnForm((previous) => ({
      ...previous,
      transactionKey,
      sessionId: asString(record?.sessionId) || previous.sessionId,
      amount: record
        ? String(record.amount ?? record.paymentAmount ?? previous.amount)
        : previous.amount,
      currency:
        asString(record?.currency) ||
        asString(record?.paymentCurrency) ||
        previous.currency,
      method: method || previous.method,
      status: isCancelledRegistration ? 'pending' : previous.status,
      reason: isCancelledRegistration
        ? `Payment reversal for ${asString(record?.status) || 'cancelled'} registration`
        : previous.reason,
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

    const source = returnSources.find((entry) => entry.key === returnForm.transactionKey)
    const sourceRecord = source?.record
    const isCancelledRegistration = source?.type === 'registration'

    setBusy(true)
    try {
      const result = await recordPaymentReturn({
        sessionId: returnForm.sessionId,
        registrationId: isCancelledRegistration
          ? asString(sourceRecord?.id) || undefined
          : asString(sourceRecord?.registrationId) || undefined,
        transactionId: source?.type === 'transaction'
          ? asString(sourceRecord?.transactionId) || undefined
          : asString(sourceRecord?.paymentStatus) === 'paid_online'
            ? asString(sourceRecord?.paymentTransactionId) || undefined
            : undefined,
        reference: source?.type === 'transaction'
          ? asString(sourceRecord?.reference) || undefined
          : asString(sourceRecord?.paymentStatus) === 'paid_online'
            ? asString(sourceRecord?.paymentReference) || undefined
            : undefined,
        amount,
        currency: returnForm.currency,
        method: returnForm.method,
        status: isCancelledRegistration ? 'pending' : returnForm.status,
        reason: returnForm.reason,
        externalReference: returnForm.externalReference || undefined,
        notes: returnForm.notes || undefined,
        origin: isCancelledRegistration ? 'cancelled_registration' : 'manual',
        effect: returnForm.effect,
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

  const handleUpdateReturn = async (
    record: Record<string, unknown>,
    status: 'completed' | 'cancelled' | 'reversed'
  ) => {
    const returnId = asString(record.id)
    if (!returnId) return

    let externalReference = asString(record.externalReference)
    const effect = asString(record.effect) || 'customer_refund'
    if (status === 'completed') {
      if (effect === 'customer_refund') {
        const enteredReference = window.prompt(
          'Refund or transfer reference (optional)',
          externalReference
        )
        if (enteredReference === null) return
        externalReference = enteredReference.trim()
        if (!window.confirm('Confirm that the funds have been returned to the client?')) return
      } else if (!window.confirm(
        'Complete this revenue correction? Gross revenue and current net will be reduced, but no customer refund will be recorded.'
      )) return
    } else if (
      status === 'cancelled' &&
      !window.confirm('Cancel this pending return? No funds will be recorded as returned.')
    ) {
      return
    } else if (
      status === 'reversed' &&
      !window.confirm('Undo this completed ledger entry? Totals will be restored. This does not move money.')
    ) {
      return
    }

    setUpdatingReturnId(returnId)
    setMessage(null)
    setError(null)
    try {
      const result = await updatePaymentReturn({
        returnId,
        status,
        externalReference: externalReference || undefined,
      })
      setMessage(result.message || `Return ${status}.`)
      await loadDashboard()
    } catch (returnError) {
      setError(returnError instanceof Error ? returnError.message : `Unable to mark return ${status}.`)
    } finally {
      setUpdatingReturnId('')
    }
  }

  const providerAccount = dashboard?.provider?.account
  const providerTotals = dashboard?.provider?.totals
  const providerConnected = dashboard?.provider?.status === 'connected' && Boolean(providerAccount)
  const providerBalanceAuthoritative = providerConnected &&
    dashboard?.provider?.balanceAuthoritative === true &&
    providerAccount?.currentBalance !== null &&
    providerAccount?.currentBalance !== undefined
  const providerFeesAvailable = Boolean(
    providerTotals && providerTotals.feeDataAvailable !== false
  )
  const providerCurrency = providerAccount?.currency || 'ZMW'
  const providerPeriod = dashboard?.provider?.reportingPeriod
  const providerPeriodLabel = providerPeriod
    ? `${providerPeriod.from}–${providerPeriod.to}`
    : 'Last 30 days'
  const formatProviderMoney = (amount: unknown): string => providerTotals
    ? formatMoney(amount, providerCurrency)
    : 'Unavailable'
  const completedExternalRefunds = (dashboard?.returns || [])
    .filter((record) => asString(record.status) === 'completed')
    .filter((record) => asString(record.effect || 'customer_refund') === 'customer_refund')
    .filter((record) => ['cash', 'bank_transfer', 'card', 'other'].includes(asString(record.method)))
  const refundedBySource = completedExternalRefunds.reduce<{
    cash: number
    bankTransfer: number
    other: number
  }>((summary, record) => {
    const method = asString(record.method)
    const amount = asNumber(record.amount)
    if (method === 'cash') summary.cash += amount
    else if (method === 'bank_transfer') summary.bankTransfer += amount
    else summary.other += amount
    return summary
  }, { cash: 0, bankTransfer: 0, other: 0 })
  const recordedCashPosition =
    asNumber(dashboard?.totals.cashCollected) -
    refundedBySource.cash -
    asNumber(dashboard?.totals.cashSpent)
  const recordedBankPosition =
    asNumber(dashboard?.totals.bankTransferCollected) -
    refundedBySource.bankTransfer -
    asNumber(dashboard?.totals.bankTransferSpent)
  const recordedOtherPosition =
    asNumber(dashboard?.totals.otherExternalCollected) -
    refundedBySource.other -
    asNumber(dashboard?.totals.otherExternalSpent)
  const externalFunds = recordedCashPosition + recordedBankPosition + recordedOtherPosition
  const recognizedSessionRevenue =
    asNumber(dashboard?.totals.grossCollected) -
    asNumber(dashboard?.totals.returned) -
    asNumber(dashboard?.totals.corrections)

  return (
    <AdminLayout>
      <Box p={{ base: 4, md: 8 }} bg="#0a0a0a" minH="100vh">
        <Flex justify="space-between" align={{ base: 'stretch', lg: 'flex-start' }} gap={5} direction={{ base: 'column', lg: 'row' }} mb={6}>
          <Box>
            <Heading as="h1" color="#faf9f6" fontSize={{ base: '2xl', md: '3xl' }}>
              Accounts & payments
            </Heading>
            <Text color="#a3a3a3" mt={1}>
              Clubbzr Wallet balances, cash records, revenue, and reconciliation in one place.
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
            <HStack gap={2} w="full" justify="flex-end">
              <Button h="46px" px={4} borderRadius="12px" bg="#171717" color="#d4d4d4" border="1px solid rgba(255,255,255,0.12)" _hover={{ bg: '#262626' }} onClick={handleExport}>
                <Download size={16} />
                Export
              </Button>
              <Button h="46px" px={5} borderRadius="12px" bg="#FF6B35" color="white" _hover={{ bg: '#e55a2a' }} onClick={() => void loadDashboard()} disabled={loading}>
                {loading ? <Spinner size="sm" /> : <RefreshCw size={16} />}
                Refresh
              </Button>
            </HStack>
          </Flex>
        </Flex>

        {(message || error) && (
          <Box mb={5} p={4} borderRadius="xl" border="1px solid" borderColor={error ? 'rgba(223,80,101,0.28)' : 'rgba(63,175,82,0.28)'} bg={error ? 'rgba(223,80,101,0.12)' : 'rgba(63,175,82,0.12)'}>
            <Text color={error ? '#ff7b8e' : '#71d681'}>{error || message}</Text>
          </Box>
        )}

        <HStack gap={2} flexWrap="wrap" mb={6}>
          {tabs.map((tab) => (
            <Button
              key={tab.value}
              h="40px"
              px={4}
              borderRadius="full"
              bg={activeTab === tab.value ? '#FF6B35' : '#262626'}
              color={activeTab === tab.value ? 'white' : '#d4d4d4'}
              _hover={{ bg: activeTab === tab.value ? '#e55a2a' : '#333333' }}
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
                <Text color="#a3a3a3">
                  The payments dashboard did not finish loading. Refresh after the latest functions deploy completes.
                </Text>
              </Panel>
            )}

            {dashboard && activeTab === 'overview' && (
              <>
                <SimpleGrid columns={{ base: 1, xl: 2 }} gap={5}>
                  <Box bg="#171717" border="1px solid" borderColor="rgba(255,255,255,0.10)" borderRadius="18px" p={{ base: 5, md: 7 }} boxShadow="0 10px 32px rgba(0,0,0,0.28)">
                    <Flex justify="space-between" align="flex-start" gap={4}>
                      <Badge bg="#262626" color="#d4d4d4" border="1px solid rgba(255,255,255,0.12)" borderRadius="8px" px={3} py={1.5} textTransform="none" fontSize="sm">
                        Prime
                      </Badge>
                      <Badge bg="#262626" color="#d4d4d4" borderRadius="full" px={3} py={1.5} textTransform="none">
                        Local ledger
                      </Badge>
                    </Flex>
                    <Box bg="#1f1f1f" borderRadius="16px" p={5} mt={8}>
                      <Text color="#a3a3a3" fontSize="sm" fontWeight="medium">
                        Recorded off-platform funds
                      </Text>
                      <Text color="#faf9f6" fontSize={{ base: '3xl', md: '4xl' }} fontWeight="700" letterSpacing="-0.04em" mt={2}>
                        {formatMoney(externalFunds)}
                      </Text>
                      <Text color="#737373" fontSize="xs" mt={2}>
                        Cash, bank transfers, card, and other funds recorded outside Lenco
                      </Text>
                    </Box>
                    <SimpleGrid columns={2} gap={4} mt={5}>
                      <AmountCell label="Cash on hand" value={formatMoney(recordedCashPosition)} tone="#FF6B35" />
                      <AmountCell label="Bank & other" value={formatMoney(recordedBankPosition + recordedOtherPosition)} />
                    </SimpleGrid>
                  </Box>

                  <Box bg="#171717" border="1px solid" borderColor="rgba(255,255,255,0.10)" borderRadius="18px" p={{ base: 5, md: 7 }} boxShadow="0 10px 32px rgba(0,0,0,0.28)">
                    <Flex justify="space-between" align="center" gap={3}>
                      <HStack gap={2}>
                        <Text color="#a3a3a3" fontWeight="medium">Lenco account balance</Text>
                        <Button aria-label={balanceVisible ? 'Hide balance' : 'Show balance'} boxSize="34px" minW="34px" p={0} borderRadius="10px" bg="#262626" color="#a3a3a3" _hover={{ bg: '#333333', color: '#faf9f6' }} onClick={() => setBalanceVisible((visible) => !visible)}>
                          {balanceVisible ? <Eye size={17} /> : <EyeOff size={17} />}
                        </Button>
                      </HStack>
                      <Badge bg={providerBalanceAuthoritative ? 'rgba(63,175,82,0.14)' : 'rgba(223,80,101,0.14)'} color={providerBalanceAuthoritative ? '#71d681' : '#ff7b8e'} borderRadius="full" px={3} py={1.5} textTransform="none">
                        {providerBalanceAuthoritative ? 'Live from Lenco' : 'Unavailable'}
                      </Badge>
                    </Flex>
                    <Text color="#faf9f6" fontSize={{ base: '3xl', md: '5xl' }} fontWeight="700" letterSpacing="-0.05em" mt={6}>
                      {balanceVisible
                        ? !providerBalanceAuthoritative
                          ? 'Unavailable'
                          : formatMoney(providerAccount.currentBalance, providerCurrency)
                        : '••••••'}
                    </Text>
                    <Text color="#a3a3a3" fontSize="sm" mt={2}>
                      Available: {providerAccount?.availableBalance === null || providerAccount?.availableBalance === undefined
                        ? 'Unavailable'
                        : formatMoney(providerAccount.availableBalance, providerCurrency)}
                    </Text>
                    <Text color="#737373" fontSize="xs" mt={2}>
                      Account {providerAccount?.accountNumber || 'not identified'} · synced {formatDate(dashboard.provider?.syncedAt)}
                    </Text>
                    <SimpleGrid columns={{ base: 2, md: 4 }} gap={4} mt={8}>
                      <AmountCell label="30-day inflows" value={formatProviderMoney(providerTotals?.inflow)} tone="#3faf52" />
                      <AmountCell label="30-day payouts" value={formatProviderMoney(providerTotals?.payout)} tone="#df5065" />
                      <AmountCell label="30-day fees" value={providerFeesAvailable ? formatMoney(providerTotals?.fees, providerCurrency) : 'Unavailable'} tone="#ff9a70" />
                      <AmountCell label="30-day net movement" value={formatProviderMoney(providerTotals?.netMovement)} />
                    </SimpleGrid>
                    <Text color="#737373" fontSize="xs" mt={4}>Reporting period: {providerPeriodLabel} · Africa/Lusaka</Text>
                  </Box>
                </SimpleGrid>

                {!providerBalanceAuthoritative && (
                  <HStack align="flex-start" gap={3} p={4} borderRadius="xl" bg="rgba(223,80,101,0.10)" border="1px solid rgba(223,80,101,0.24)">
                    <AlertTriangle size={18} color="#ff7b8e" />
                    <Box>
                      <Text color="#ffb2bd" fontWeight="semibold">Authoritative Lenco balance unavailable</Text>
                      <Text color="#a3a3a3" fontSize="sm">
                        {dashboard.provider.error || 'No transaction-derived estimate is shown. Refresh after the account API connection is restored.'}
                      </Text>
                    </Box>
                  </HStack>
                )}

                {dashboard.provider.settlementWarning && (
                  <HStack align="flex-start" gap={3} p={4} borderRadius="xl" bg="rgba(255,107,53,0.10)" border="1px solid rgba(255,107,53,0.24)">
                    <AlertTriangle size={18} color="#ff9a70" />
                    <Box>
                      <Text color="#ffc1a8" fontWeight="semibold">Settlement reconciliation is temporarily unavailable</Text>
                      <Text color="#a3a3a3" fontSize="sm">Balance and transaction activity remain visible, but collection matching is paused to avoid false discrepancies.</Text>
                    </Box>
                  </HStack>
                )}

                <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap={4}>
                  <MetricCard label="Recognized session revenue" value={formatMoney(recognizedSessionRevenue)} detail="Session collections and external receipts, less returns and corrections" icon={<FileText size={18} />} />
                  <MetricCard label="Session collections" value={formatMoney(dashboard.totals.onlineCollected)} detail="Completed Club BZR session collection records" icon={<WalletCards size={18} />} tone="#3faf52" />
                  <MetricCard label="Point purchases · 30 days" value={formatMoney(dashboard.totals.pointPurchaseCollected)} detail="Successful Lenco point purchases in the provider reporting period" icon={<ArrowDownLeft size={18} />} tone="#71d681" />
                  <MetricCard label="Cash on hand" value={formatMoney(recordedCashPosition)} detail="Cash received less refunds and recorded spending" icon={<Banknote size={18} />} tone="#ff9a70" />
                </SimpleGrid>

                <Panel
                  title="Recent Clubbzr Wallet activity"
                  action={<Button size="sm" bg="#262626" color="#d4d4d4" _hover={{ bg: '#333333' }} onClick={() => setActiveTab('transactions')}>View all</Button>}
                >
                  <VStack align="stretch" gap={0}>
                    {(dashboard.provider?.transactions || []).slice(0, 5).map((record, index) => (
                      <ProviderTransactionRow key={asString(record.id) || `${index}`} record={record} />
                    ))}
                    {(dashboard.provider?.transactions || []).length === 0 && (
                      <Text color="#a3a3a3">No provider transactions are available yet.</Text>
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
                      <Flex key={session.sessionId} py={4} gap={4} justify="space-between" align={{ base: 'stretch', lg: 'center' }} direction={{ base: 'column', lg: 'row' }} borderBottom="1px solid" borderColor="rgba(255,255,255,0.08)">
                        <Box minW={0}>
                          <HStack gap={2} minW={0}>
                            <Text color="#faf9f6" fontWeight="semibold" lineClamp={1}>{session.title}</Text>
                            {session.isDeleted && (
                              <Badge bg="rgba(255,107,53,0.14)" color="#ff9a70" borderRadius="full" px={2} py={0.5}>
                                Deleted
                              </Badge>
                            )}
                          </HStack>
                          <Text color="#a3a3a3" fontSize="sm">{session.registrationCount} registrations · {session.transactionCount} collections</Text>
                        </Box>
                        <HStack gap={4} flexWrap="wrap" justify={{ base: 'space-between', lg: 'flex-end' }}>
                          <Text color="#71d681">{formatMoney(session.grossCollected, session.currency)}</Text>
                          {session.corrections > 0 && (
                            <Text color="#ff9a70">{formatMoney(session.corrections, session.currency)} corrected</Text>
                          )}
                          <Text color="#ff9a70">{formatMoney(session.pending, session.currency)} pending</Text>
                          <Text color="#faf9f6">{formatMoney(
                            session.grossCollected - session.returned - session.corrections,
                            session.currency
                          )} recognized</Text>
                        </HStack>
                      </Flex>
                    ))}
                    {filteredOverviewSessions.length === 0 && <Text color="#a3a3a3">No session payment records found.</Text>}
                  </VStack>
                  <PaginationFooter
                    page={activePage}
                    pageSize={pageSize}
                    total={filteredOverviewSessions.length}
                    onPageChange={setActivePage}
                  />
                </Panel>

                <Panel title="Reporting notes">
                  <VStack align="stretch" gap={2}>
                    {(dashboard.sourceNotes || []).map((note) => <Text key={note} color="#a3a3a3">{note}</Text>)}
                    <Text color="#a3a3a3">Payouts move cash out of the Clubbzr Wallet; they do not reduce recognized revenue unless separately recorded as a refund or correction.</Text>
                  </VStack>
                </Panel>
              </>
            )}

            {dashboard && activeTab === 'transactions' && (
              <>
                <TabActionHeader
                  title="Wallet activity"
                  description="The authoritative movement of money into and out of your Lenco account."
                  actionLabel="Export CSV"
                  icon={<Download size={16} />}
                  onAction={handleExport}
                />
                <DataScopeBanner
                  source="Lenco"
                  title="Posted account ledger"
                  description="Use this view to verify what actually reached or left the wallet. Entries are not automatically tied to a Club BZR attendee or session."
                  icon={<WalletCards size={18} />}
                  tone="#71d681"
                />
                <Panel title="Posted wallet entries">
                  <Flex gap={3} wrap="wrap" mb={4}>
                    <select value={transactionType} onChange={(event) => setTransactionType(event.target.value as typeof transactionType)} style={compactSelectStyle}>
                      <option value="all">All types</option>
                      <option value="credit">Inflows</option>
                      <option value="debit">Payouts</option>
                    </select>
                    <select value={transactionStatus} onChange={(event) => setTransactionStatus(event.target.value)} style={compactSelectStyle}>
                      <option value="all">All statuses</option>
                      <option value="completed">Completed</option>
                      <option value="pending">Pending</option>
                      <option value="failed">Failed</option>
                      <option value="declined">Declined</option>
                    </select>
                  </Flex>
                  <ListControls
                    searchValue={activeSearch}
                    onSearchChange={setActiveSearch}
                    pageSize={pageSize}
                    onPageSizeChange={handlePageSizeChange}
                    total={filteredProviderTransactions.length}
                    placeholder="Search names, references, or narration"
                  />
                  <VStack align="stretch" gap={0}>
                    {pageItems(filteredProviderTransactions, activePage, pageSize).map((record, index) => (
                      <ProviderTransactionRow key={asString(record.id) || `${activePage}-${index}`} record={record} />
                    ))}
                    {filteredProviderTransactions.length === 0 && <Text color="#a3a3a3">No posted wallet entries match these filters.</Text>}
                  </VStack>
                  <PaginationFooter page={activePage} pageSize={pageSize} total={filteredProviderTransactions.length} onPageChange={setActivePage} />
                </Panel>
              </>
            )}

            {dashboard && activeTab === 'collections' && (
              <>
                <TabActionHeader
                  title="Payment requests"
                  description="Initiate and track mobile-money charges sent to Club BZR attendees."
                  actionLabel="Request Payment"
                  icon={<Send size={16} />}
                  onAction={() => setActionModal('collection')}
                />

                <DataScopeBanner
                  source="Club BZR"
                  title="Attendee payment workflow"
                  description="Use this view to see who was charged, which session they belong to, and whether they approved the request. Successful requests later appear as inflows in Wallet Activity."
                  icon={<Send size={18} />}
                  tone="#FF6B35"
                />
                <Panel title="Attendee payment requests">
                  <ListControls
                    searchValue={activeSearch}
                    onSearchChange={setActiveSearch}
                    pageSize={pageSize}
                    onPageSizeChange={handlePageSizeChange}
                    total={filteredCollections.length}
                    placeholder="Search attendees, references, or requests"
                  />
                  <VStack align="stretch" gap={0}>
                    {pageItems(filteredCollections, activePage, pageSize).map((record) => {
                      const key = asString(record.reference) || asString(record.transactionId) || asString(record.id)
                      return <PaymentRow key={key} record={record} onSync={handleSync} syncing={syncingKey === key} />
                    })}
                    {filteredCollections.length === 0 && <Text color="#a3a3a3">No attendee payment requests found.</Text>}
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

            {dashboard && activeTab === 'external' && (
              <>
                <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} gap={4} direction={{ base: 'column', md: 'row' }}>
                  <Box minW={0}>
                    <Heading as="h2" size="md" color="#faf9f6">Cash & external funds</Heading>
                    <Text color="#a3a3a3" mt={1}>Track money received and money used outside the Clubbzr Wallet.</Text>
                  </Box>
                  <HStack gap={2} flexWrap="wrap">
                    <Button h="42px" px={5} borderRadius="full" bg="#262626" color="#faf9f6" border="1px solid rgba(255,255,255,0.10)" _hover={{ bg: '#333333' }} onClick={() => setActionModal('outflow')}>
                      <ArrowUpRight size={16} />
                      Record money out
                    </Button>
                    <Button h="42px" px={5} borderRadius="full" bg="#FF6B35" color="#faf9f6" _hover={{ bg: '#e55a2a' }} onClick={() => setActionModal('external')}>
                      <Banknote size={16} />
                      Record payment
                    </Button>
                  </HStack>
                </Flex>
                <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap={4}>
                  <MetricCard label="Cash on hand" value={formatMoney(recordedCashPosition)} detail="Cash received less refunds and spending" icon={<Banknote size={18} />} tone="#ff9a70" />
                  <MetricCard label="External bank balance" value={formatMoney(recordedBankPosition)} detail="Bank receipts less refunds and spending" icon={<ArrowDownLeft size={18} />} />
                  <MetricCard label="Other external balance" value={formatMoney(recordedOtherPosition)} detail="Card and other receipts less money used" icon={<FileText size={18} />} tone="#a3a3a3" />
                  <MetricCard label="Total money used" value={formatMoney(dashboard.totals.externalSpent)} detail="Recorded spending from external funds" icon={<ArrowUpRight size={18} />} tone="#df5065" />
                </SimpleGrid>
                <Panel title="Receipt records">
                  <ListControls
                    searchValue={activeSearch}
                    onSearchChange={setActiveSearch}
                    pageSize={pageSize}
                    onPageSizeChange={handlePageSizeChange}
                    total={filteredExternalPayments.length}
                    placeholder="Search cash and external receipts"
                  />
                  <VStack align="stretch" gap={0}>
                    {pageItems(filteredExternalPayments, activePage, pageSize).map((record) => (
                      <Flex key={asString(record.id)} py={4} gap={4} justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} borderBottom="1px solid" borderColor="rgba(255,255,255,0.08)">
                        <Box minW={0}>
                          <HStack gap={2} flexWrap="wrap">
                            <Text color="#faf9f6" fontWeight="semibold">{recordLabel(record, ['displayName', 'email', 'reference'])}</Text>
                            <StatusBadge status={record.status} />
                            {record.legacy && <Badge bg="rgba(255,107,53,0.14)" color="#ff9a70" borderRadius="full" px={3} py={1} textTransform="none">Needs classification</Badge>}
                          </HStack>
                          <Text color="#a3a3a3" fontSize="sm" mt={1} textTransform="capitalize">
                            {asString(record.method).replace(/_/g, ' ')} · {formatDate(record.receivedAt || record['paidAt'] || record['createdAt'])}
                          </Text>
                        </Box>
                        <HStack gap={3} justify={{ base: 'space-between', md: 'flex-end' }}>
                          {Boolean(record.legacy) && (
                            <Button size="sm" borderRadius="full" bg="#FF6B35" color="white" _hover={{ bg: '#e55a2a' }} onClick={() => openExternalPaymentClassification(record)}>
                              Classify
                            </Button>
                          )}
                          <Text color={asString(record.method) === 'cash' ? '#ff9a70' : '#FF6B35'} fontWeight="700">
                            {formatMoney(record.amount, asString(record.currency) || 'ZMW')}
                          </Text>
                        </HStack>
                      </Flex>
                    ))}
                    {filteredExternalPayments.length === 0 && <Text color="#a3a3a3">No external receipts found.</Text>}
                  </VStack>
                  <PaginationFooter page={activePage} pageSize={pageSize} total={filteredExternalPayments.length} onPageChange={setActivePage} />
                </Panel>
                <Panel title="Money out records">
                  <VStack align="stretch" gap={0}>
                    {(dashboard.externalFundMovements || []).map((record) => (
                      <Flex key={asString(record.id)} py={4} gap={4} justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} borderBottom="1px solid" borderColor="rgba(255,255,255,0.08)">
                        <Box minW={0}>
                          <HStack gap={2} flexWrap="wrap">
                            <Text color="#faf9f6" fontWeight="semibold">{recordLabel(record, ['reason', 'reference'])}</Text>
                            <StatusBadge status={record.status} />
                          </HStack>
                          <Text color="#a3a3a3" fontSize="sm" mt={1} textTransform="capitalize">
                            {asString(record.source).replace(/_/g, ' ')} · {formatDate(record.spentAt || record.createdAt)}
                          </Text>
                          {record.note && <Text color="#737373" fontSize="xs" mt={1}>{asString(record.note)}</Text>}
                        </Box>
                        <Text color="#df5065" fontWeight="700">-{formatMoney(record.amount, asString(record.currency) || 'ZMW')}</Text>
                      </Flex>
                    ))}
                    {(dashboard.externalFundMovements || []).length === 0 && <Text color="#a3a3a3">No money-out records yet.</Text>}
                  </VStack>
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
                    <Flex
                      key={item.id}
                      p={4}
                      bg={item.tone === 'orange' ? 'rgba(255,107,53,0.10)' : 'rgba(223,80,101,0.12)'}
                      border="1px solid"
                      borderColor={item.tone === 'orange' ? 'rgba(255,107,53,0.28)' : 'rgba(223,80,101,0.28)'}
                      borderRadius="xl"
                      align={{ base: 'stretch', md: 'center' }}
                      justify="space-between"
                      direction={{ base: 'column', md: 'row' }}
                      gap={4}
                    >
                      <Box minW={0}>
                        <HStack gap={2}>
                          <AlertTriangle size={16} color={item.tone === 'orange' ? '#FF6B35' : '#ff7b8e'} />
                          <Text color={item.tone === 'orange' ? '#ff9a70' : '#ff7b8e'} fontWeight="semibold">
                            {item.title}
                          </Text>
                        </HStack>
                        <Text color="#a3a3a3" fontSize="sm" mt={1} overflowWrap="anywhere">
                          {item.subtitle}
                        </Text>
                      </Box>
                      {item.action === 'update_signup' ? (
                        <Button
                          h="38px"
                          minW="132px"
                          px={4}
                          borderRadius="full"
                          bg="rgba(255,107,53,0.16)"
                          color="#ff9a70"
                          border="1px solid"
                          borderColor="rgba(255,107,53,0.30)"
                          _hover={{ bg: 'rgba(255,107,53,0.24)' }}
                          onClick={() => void handleResolveReconciliationIssue(item)}
                          disabled={resolvingIssueKey === item.id}
                        >
                          {resolvingIssueKey === item.id ? <Spinner size="sm" /> : <CheckCircle2 size={15} />}
                          Update Signup
                        </Button>
                      ) : (
                        <Badge
                          alignSelf={{ base: 'flex-start', md: 'center' }}
                          bg="#262626"
                          color="#a3a3a3"
                          borderRadius="full"
                          px={3}
                          py={1}
                          textTransform="none"
                        >
                          Review manually
                        </Badge>
                      )}
                    </Flex>
                  ))}
                  {filteredReconciliation.length === 0 && <Text color="#a3a3a3">No reconciliation issues found.</Text>}
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
                  description="Send money from the Clubbzr Wallet to an admin mobile-money account and review transfer records."
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
                        <Flex key={asString(record.id) || key} justify="space-between" align={{ base: 'stretch', lg: 'center' }} direction={{ base: 'column', lg: 'row' }} gap={4} p={4} bg="#1f1f1f" borderRadius="xl">
                          <Box minW={0}>
                            <HStack gap={2} flexWrap="wrap">
                              <Text color="#faf9f6" fontWeight="semibold">{recordLabel(record, ['recipientDisplayName', 'reason', 'reference', 'id'])}</Text>
                              <StatusBadge status={record.status} />
                            </HStack>
                            <Text color="#a3a3a3" fontSize="sm" mt={1}>
                              {asString(record.phone) || 'No phone'} · {asString(record.operator) || 'No operator'} · {formatDate(record.createdAt || record.updatedAt)}
                            </Text>
                            {(failureDetail || statusMessage || providerReference) && (
                              <VStack align="stretch" gap={1} mt={2}>
                                {failureDetail && (
                                  <Text color="#ff7b8e" fontSize="sm" overflowWrap="anywhere">
                                    {failureDetail}
                                  </Text>
                                )}
                                {!failureDetail && statusMessage && (
                                  <Text color="#a3a3a3" fontSize="sm" overflowWrap="anywhere">
                                    {statusMessage}
                                  </Text>
                                )}
                                {providerReference && (
                                  <Text color="#737373" fontSize="xs" overflowWrap="anywhere">
                                    Ref: {providerReference}
                                  </Text>
                                )}
                              </VStack>
                            )}
                          </Box>
                          <HStack gap={3} justify={{ base: 'space-between', lg: 'flex-end' }} flexWrap="wrap">
                            <Text color="#ff9a70" fontWeight="bold">{formatMoney(record.amount, asString(record.currency) || 'ZMW')}</Text>
                            <Button
                              h="38px"
                              minW="112px"
                              px={4}
                              borderRadius="full"
                              bg="#262626"
                              color="#faf9f6"
                              _hover={{ bg: '#333333' }}
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
                    {filteredWithdrawals.length === 0 && <Text color="#a3a3a3">No withdrawal records found.</Text>}
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
                  title="Returns & Corrections"
                  description="Record customer refunds and correct payments that were entered as revenue by mistake."
                  actionLabel="New Entry"
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
                      <Flex
                        key={asString(record.id)}
                        justify="space-between"
                        align={{ base: 'stretch', md: 'center' }}
                        direction={{ base: 'column', md: 'row' }}
                        gap={4}
                        p={4}
                        bg="#1f1f1f"
                        borderRadius="xl"
                      >
                        <Box minW={0}>
                          <HStack gap={2} flexWrap="wrap">
                            <Text color="#faf9f6" fontWeight="semibold">{recordLabel(record, ['reason', 'reference'])}</Text>
                            <StatusBadge status={record.status} />
                            <Badge bg="#262626" color="#a3a3a3" borderRadius="full" px={3} py={1}>
                              {asString(record.effect) === 'revenue_correction' ? 'Revenue correction' : 'Customer refund'}
                            </Badge>
                          </HStack>
                          <Text color="#a3a3a3" fontSize="sm" mt={1}>{formatDate(record.createdAt)}</Text>
                          {(record.registrationId || record.externalReference) && (
                            <Text color="#a3a3a3" fontSize="xs" mt={1}>
                              {record.registrationId ? `Registration ${asString(record.registrationId)}` : ''}
                              {record.registrationId && record.externalReference ? ' · ' : ''}
                              {record.externalReference ? `Reference ${asString(record.externalReference)}` : ''}
                            </Text>
                          )}
                        </Box>
                        <HStack gap={2} flexWrap="wrap" justify={{ base: 'flex-start', md: 'flex-end' }}>
                          <Text
                            color={asString(record.effect) === 'revenue_correction' ? '#ff9a70' : '#ff7b8e'}
                            fontWeight="bold"
                            mr={2}
                          >
                            {formatMoney(record.amount, asString(record.currency) || 'ZMW')}
                          </Text>
                          {asString(record.status).toLowerCase() === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                bg="rgba(63,175,82,0.14)"
                                color="#71d681"
                                _hover={{ bg: 'rgba(63,175,82,0.22)' }}
                                onClick={() => void handleUpdateReturn(record, 'completed')}
                                disabled={updatingReturnId === asString(record.id)}
                              >
                                {updatingReturnId === asString(record.id) ? <Spinner size="xs" /> : <CheckCircle2 size={14} />}
                                Complete
                              </Button>
                              <Button
                                size="sm"
                                bg="#262626"
                                color="#a3a3a3"
                                _hover={{ bg: '#333333', color: 'white' }}
                                onClick={() => void handleUpdateReturn(record, 'cancelled')}
                                disabled={updatingReturnId === asString(record.id)}
                              >
                                <X size={14} />
                                Cancel
                              </Button>
                            </>
                          )}
                          {asString(record.status).toLowerCase() === 'completed' && (
                            <Button
                              size="sm"
                              bg="rgba(255,107,53,0.14)"
                              color="#ff9a70"
                              _hover={{ bg: 'rgba(255,107,53,0.22)' }}
                              onClick={() => void handleUpdateReturn(record, 'reversed')}
                              disabled={updatingReturnId === asString(record.id)}
                            >
                              {updatingReturnId === asString(record.id) ? <Spinner size="xs" /> : <RotateCcw size={14} />}
                              Undo ledger entry
                            </Button>
                          )}
                        </HStack>
                      </Flex>
                    ))}
                    {filteredReturns.length === 0 && <Text color="#a3a3a3">No return records found.</Text>}
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
              <Input value={collectionForm.phone} onChange={(event) => setCollectionForm((previous) => ({ ...previous, phone: event.target.value }))} placeholder="Mobile money number" h="46px" bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
              <Input value={collectionForm.amount} onChange={(event) => setCollectionForm((previous) => ({ ...previous, amount: event.target.value }))} placeholder={selectedCollectionSession?.price ? String(selectedCollectionSession.price) : 'Amount'} h="46px" bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
              <Input value={collectionForm.currency} onChange={(event) => setCollectionForm((previous) => ({ ...previous, currency: event.target.value.toUpperCase() }))} placeholder="Currency" h="46px" bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
            </SimpleGrid>
            <Textarea value={collectionForm.note} onChange={(event) => setCollectionForm((previous) => ({ ...previous, note: event.target.value }))} placeholder="Admin note" mt={3} bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
            <HStack justify="flex-end" gap={3} mt={5} flexWrap="wrap">
              <Button type="button" h="42px" px={5} borderRadius="full" bg="#262626" color="#faf9f6" _hover={{ bg: '#333333' }} onClick={() => setActionModal(null)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" h="42px" px={5} borderRadius="full" bg="#FF6B35" color="white" _hover={{ bg: '#e55a2a' }} disabled={busy}>
                {busy ? <Spinner size="sm" /> : <Send size={16} />}
                Send Payment Prompt
              </Button>
            </HStack>
          </form>
        </PaymentModal>
      )}

      {actionModal === 'external' && (
        <PaymentModal
          title="Record cash or external payment"
          description="This updates the Club BZR receipt ledger only. It never changes the Clubbzr Wallet balance."
          onClose={() => {
            if (!busy) setActionModal(null)
          }}
        >
          <form onSubmit={handleRecordExternalPayment}>
            <SimpleGrid columns={{ base: 1, lg: 3 }} gap={3}>
              <select value={externalPaymentForm.sessionId} onChange={(event) => handleExternalSessionChange(event.target.value)} style={selectStyle} disabled={sessionsLoading || busy}>
                <option value="">{sessionsLoading ? 'Loading sessions...' : 'Select session'}</option>
                {sessions.map((session: Session) => <option key={session.id} value={session.id}>{session.title}</option>)}
              </select>
              <select value={externalPaymentForm.registrationId} onChange={(event) => handleExternalRegistrationChange(event.target.value)} style={selectStyle} disabled={!externalPaymentForm.sessionId || busy}>
                <option value="">Select unpaid registration</option>
                {externalRegistrations.map((registration: SessionRegistration) => (
                  <option key={registration.id} value={registration.id}>{registration.displayName || registration.email || registration.userId}</option>
                ))}
              </select>
              <select value={externalPaymentForm.method} onChange={(event) => setExternalPaymentForm((previous) => ({ ...previous, method: event.target.value as ExternalPaymentForm['method'] }))} style={selectStyle} disabled={busy}>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer outside Clubbzr Wallet</option>
                <option value="card">Card outside Clubbzr Wallet</option>
                <option value="other">Other</option>
              </select>
              <Input value={externalPaymentForm.amount} onChange={(event) => setExternalPaymentForm((previous) => ({ ...previous, amount: event.target.value }))} placeholder="Amount" h="46px" bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
              <Input value={externalPaymentForm.currency} onChange={(event) => setExternalPaymentForm((previous) => ({ ...previous, currency: event.target.value.toUpperCase() }))} placeholder="Currency" h="46px" bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
              <Input type="datetime-local" value={externalPaymentForm.receivedAt} onChange={(event) => setExternalPaymentForm((previous) => ({ ...previous, receivedAt: event.target.value }))} h="46px" bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
            </SimpleGrid>
            <Input value={externalPaymentForm.reference} onChange={(event) => setExternalPaymentForm((previous) => ({ ...previous, reference: event.target.value }))} placeholder="Receipt or external reference (optional)" mt={3} h="46px" bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
            <Textarea value={externalPaymentForm.note} onChange={(event) => setExternalPaymentForm((previous) => ({ ...previous, note: event.target.value }))} placeholder="Who received it, where it is held, or any supporting note" mt={3} bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
            <Box mt={3} p={3} borderRadius="12px" bg="rgba(255,107,53,0.10)" border="1px solid rgba(255,107,53,0.28)">
              <Text color="#ff9a70" fontSize="sm">Cash will be added only to the recorded cash position. Depositing it into the Clubbzr Wallet later must be recorded as a transfer, not new revenue.</Text>
            </Box>
            <HStack justify="flex-end" gap={3} mt={5} flexWrap="wrap">
              <Button type="button" h="42px" px={5} borderRadius="full" bg="#262626" color="#d4d4d4" _hover={{ bg: '#333333' }} onClick={() => setActionModal(null)} disabled={busy}>Cancel</Button>
              <Button type="submit" h="42px" px={5} borderRadius="full" bg="#FF6B35" color="white" _hover={{ bg: '#e55a2a' }} disabled={busy}>
                {busy ? <Spinner size="sm" /> : <CheckCircle2 size={16} />}
                Record receipt
              </Button>
            </HStack>
          </form>
        </PaymentModal>
      )}

      {actionModal === 'classify' && (
        <PaymentModal
          title="Classify legacy receipt"
          description="Choose where this previously recorded payment was received. Its amount and revenue will not be added again."
          onClose={() => {
            if (!busy) setActionModal(null)
          }}
        >
          <form onSubmit={handleClassifyExternalPayment}>
            <Box p={4} borderRadius="14px" bg="#1f1f1f" border="1px solid rgba(255,255,255,0.08)" mb={3}>
              <Text color="#a3a3a3" fontSize="sm">Receipt</Text>
              <Text color="#faf9f6" fontWeight="semibold" mt={1}>
                {recordLabel(
                  externalPaymentRecords.find((record) => asString(record.registrationId) === classifyExternalPaymentForm.registrationId) || {},
                  ['displayName', 'email', 'reference']
                )}
              </Text>
            </Box>
            <select
              value={classifyExternalPaymentForm.method}
              onChange={(event) => setClassifyExternalPaymentForm((previous) => ({
                ...previous,
                method: event.target.value as ClassifyExternalPaymentForm['method'],
              }))}
              style={selectStyle}
              disabled={busy}
            >
              <option value="cash">Cash on hand</option>
              <option value="bank_transfer">External bank account</option>
              <option value="card">Card account</option>
              <option value="other">Other source</option>
            </select>
            <Textarea
              value={classifyExternalPaymentForm.note}
              onChange={(event) => setClassifyExternalPaymentForm((previous) => ({ ...previous, note: event.target.value }))}
              placeholder="Optional note about where the money is held"
              mt={3}
              bg="#1f1f1f"
              borderColor="rgba(255,255,255,0.12)"
              color="#faf9f6"
              disabled={busy}
            />
            <HStack justify="flex-end" gap={3} mt={5} flexWrap="wrap">
              <Button type="button" h="42px" px={5} borderRadius="full" bg="#262626" color="#d4d4d4" _hover={{ bg: '#333333' }} onClick={() => setActionModal(null)} disabled={busy}>Cancel</Button>
              <Button type="submit" h="42px" px={5} borderRadius="full" bg="#FF6B35" color="white" _hover={{ bg: '#e55a2a' }} disabled={busy}>
                {busy ? <Spinner size="sm" /> : <CheckCircle2 size={16} />}
                Save classification
              </Button>
            </HStack>
          </form>
        </PaymentModal>
      )}

      {actionModal === 'outflow' && (
        <PaymentModal
          title="Record money out"
          description="Use this when cash or external-account money has been spent, transferred, or is otherwise no longer held."
          onClose={() => {
            if (!busy) setActionModal(null)
          }}
        >
          <form onSubmit={handleRecordExternalFundOutflow}>
            <SimpleGrid columns={{ base: 1, lg: 3 }} gap={3}>
              <select
                value={externalFundOutflowForm.source}
                onChange={(event) => setExternalFundOutflowForm((previous) => ({
                  ...previous,
                  source: event.target.value as ExternalFundOutflowForm['source'],
                }))}
                style={selectStyle}
                disabled={busy}
              >
                <option value="cash">Cash on hand</option>
                <option value="bank_transfer">External bank account</option>
                <option value="card">Card account</option>
                <option value="other">Other external funds</option>
              </select>
              <select value={externalFundOutflowForm.sessionId} onChange={(event) => setExternalFundOutflowForm((previous) => ({ ...previous, sessionId: event.target.value }))} style={selectStyle} disabled={sessionsLoading || busy}>
                <option value="">General / no session</option>
                {sessions.map((session: Session) => <option key={session.id} value={session.id}>{session.title}</option>)}
              </select>
              <Input value={externalFundOutflowForm.amount} onChange={(event) => setExternalFundOutflowForm((previous) => ({ ...previous, amount: event.target.value }))} placeholder="Amount" type="number" min="0" step="0.01" h="46px" bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
              <Input value={externalFundOutflowForm.currency} onChange={(event) => setExternalFundOutflowForm((previous) => ({ ...previous, currency: event.target.value.toUpperCase() }))} placeholder="Currency" h="46px" bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
              <Input type="datetime-local" value={externalFundOutflowForm.spentAt} onChange={(event) => setExternalFundOutflowForm((previous) => ({ ...previous, spentAt: event.target.value }))} h="46px" bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
              <Input value={externalFundOutflowForm.reference} onChange={(event) => setExternalFundOutflowForm((previous) => ({ ...previous, reference: event.target.value }))} placeholder="Receipt/reference (optional)" h="46px" bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
            </SimpleGrid>
            <Input value={externalFundOutflowForm.reason} onChange={(event) => setExternalFundOutflowForm((previous) => ({ ...previous, reason: event.target.value }))} placeholder="What was the money used for?" mt={3} h="46px" bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
            <Textarea value={externalFundOutflowForm.note} onChange={(event) => setExternalFundOutflowForm((previous) => ({ ...previous, note: event.target.value }))} placeholder="Optional supporting note" mt={3} bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
            <Box mt={3} p={3} borderRadius="12px" bg="rgba(255,107,53,0.10)" border="1px solid rgba(255,107,53,0.28)">
              <Text color="#ff9a70" fontSize="sm">This reduces the selected current balance. It does not erase the original receipt or reduce historical revenue.</Text>
            </Box>
            <HStack justify="flex-end" gap={3} mt={5} flexWrap="wrap">
              <Button type="button" h="42px" px={5} borderRadius="full" bg="#262626" color="#d4d4d4" _hover={{ bg: '#333333' }} onClick={() => setActionModal(null)} disabled={busy}>Cancel</Button>
              <Button type="submit" h="42px" px={5} borderRadius="full" bg="#FF6B35" color="white" _hover={{ bg: '#e55a2a' }} disabled={busy}>
                {busy ? <Spinner size="sm" /> : <ArrowUpRight size={16} />}
                Record money out
              </Button>
            </HStack>
          </form>
        </PaymentModal>
      )}

      {actionModal === 'withdrawal' && (
        <PaymentModal
          title="Withdraw to Admin"
          description="Send money from the Clubbzr Wallet to an admin mobile-money account."
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
              <Input value={withdrawalForm.phone} onChange={(event) => setWithdrawalForm((previous) => ({ ...previous, phone: event.target.value }))} placeholder="Admin mobile money number" h="46px" bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
              <Input value={withdrawalForm.amount} onChange={(event) => setWithdrawalForm((previous) => ({ ...previous, amount: event.target.value }))} placeholder="Amount" h="46px" bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
              <Input value={withdrawalForm.currency} onChange={(event) => setWithdrawalForm((previous) => ({ ...previous, currency: event.target.value.toUpperCase() }))} placeholder="Currency" h="46px" bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
              <Input value={withdrawalForm.reason} onChange={(event) => setWithdrawalForm((previous) => ({ ...previous, reason: event.target.value }))} placeholder="Reason" h="46px" bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
            </SimpleGrid>
            <Textarea value={withdrawalForm.note} onChange={(event) => setWithdrawalForm((previous) => ({ ...previous, note: event.target.value }))} placeholder="Admin note" mt={3} bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
            {adminRecipients.length === 0 && !usersLoading && (
              <Text color="#ff9a70" fontSize="sm" mt={3}>
                No admin accounts with saved phone numbers were found. Use a manual number or update an admin profile first.
              </Text>
            )}
            <HStack justify="flex-end" gap={3} mt={5} flexWrap="wrap">
              <Button type="button" h="42px" px={5} borderRadius="full" bg="#262626" color="#faf9f6" _hover={{ bg: '#333333' }} onClick={() => setActionModal(null)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" h="42px" px={5} borderRadius="full" bg="#FF6B35" color="white" _hover={{ bg: '#e55a2a' }} disabled={busy}>
                {busy ? <Spinner size="sm" /> : <Send size={16} />}
                Send Withdrawal
              </Button>
            </HStack>
          </form>
        </PaymentModal>
      )}

      {actionModal === 'return' && (
        <PaymentModal
          title="Record Return or Correction"
          description="Record a customer refund or correct revenue that was entered by mistake."
          onClose={() => {
            if (!busy) setActionModal(null)
          }}
        >
          <form onSubmit={handleRecordReturn}>
            <SimpleGrid columns={{ base: 1, lg: 3 }} gap={3}>
              <select value={returnForm.transactionKey} onChange={(event) => handleReturnTransactionChange(event.target.value)} style={selectStyle} disabled={busy}>
                <option value="">No linked transaction</option>
                {returnSources.map((source) => (
                  <option key={source.key} value={source.key}>
                    {source.label}
                  </option>
                ))}
              </select>
              <select value={returnForm.sessionId} onChange={(event) => setReturnForm((previous) => ({ ...previous, sessionId: event.target.value }))} style={selectStyle} disabled={busy}>
                <option value="">Select session</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>{session.title}</option>
                ))}
              </select>
              <select
                value={returnForm.status}
                onChange={(event) => setReturnForm((previous) => ({ ...previous, status: event.target.value as ReturnForm['status'] }))}
                style={selectStyle}
                disabled={busy || selectedReturnSource?.type === 'registration'}
              >
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                value={returnForm.effect}
                onChange={(event) => setReturnForm((previous) => ({
                  ...previous,
                  effect: event.target.value as ReturnForm['effect'],
                }))}
                style={selectStyle}
                disabled={busy}
              >
                <option value="customer_refund">Customer refund</option>
                <option value="revenue_correction">Revenue correction</option>
              </select>
              <Input value={returnForm.amount} onChange={(event) => setReturnForm((previous) => ({ ...previous, amount: event.target.value }))} placeholder="Amount" h="46px" bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
              <Input value={returnForm.currency} onChange={(event) => setReturnForm((previous) => ({ ...previous, currency: event.target.value.toUpperCase() }))} placeholder="Currency" h="46px" bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
              <select value={returnForm.method} onChange={(event) => setReturnForm((previous) => ({ ...previous, method: event.target.value as ReturnForm['method'] }))} style={selectStyle} disabled={busy}>
                <option value="mobile_money">Mobile money</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </SimpleGrid>
            {selectedReturnSource?.type === 'registration' && (
              <Text color="#ff9a70" fontSize="sm" mt={3}>
                {returnForm.effect === 'customer_refund'
                  ? 'Cancelled and declined registrations create a pending return. Complete it from the Returns list after the funds are sent.'
                  : 'Revenue corrections are created as pending so another explicit action is required before totals change.'}
              </Text>
            )}
            {returnForm.effect === 'revenue_correction' && (
              <Text color="#ff9a70" fontSize="sm" mt={3}>
                Revenue corrections are for payments recorded by mistake. They reduce gross revenue and current net without recording a customer refund.
              </Text>
            )}
            <Input value={returnForm.reason} onChange={(event) => setReturnForm((previous) => ({ ...previous, reason: event.target.value }))} placeholder="Reason" mt={3} h="46px" bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
            <Input value={returnForm.externalReference} onChange={(event) => setReturnForm((previous) => ({ ...previous, externalReference: event.target.value }))} placeholder="External return reference" mt={3} h="46px" bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
            <Textarea value={returnForm.notes} onChange={(event) => setReturnForm((previous) => ({ ...previous, notes: event.target.value }))} placeholder="Return notes" mt={3} bg="#1f1f1f" borderColor="rgba(255,255,255,0.12)" color="#faf9f6" disabled={busy} />
            <HStack justify="flex-end" gap={3} mt={5} flexWrap="wrap">
              <Button type="button" h="42px" px={5} borderRadius="full" bg="#262626" color="#faf9f6" _hover={{ bg: '#333333' }} onClick={() => setActionModal(null)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" h="42px" px={5} borderRadius="full" bg="#FF6B35" color="white" _hover={{ bg: '#e55a2a' }} disabled={busy}>
                {busy ? <Spinner size="sm" /> : <RotateCcw size={16} />}
                Record entry
              </Button>
            </HStack>
          </form>
        </PaymentModal>
      )}
    </AdminLayout>
  )
}
