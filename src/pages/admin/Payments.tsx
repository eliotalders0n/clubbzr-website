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
  Banknote,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  Send,
  Wallet,
} from 'lucide-react'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { useCollection } from '@/hooks'
import {
  collectSessionPayment,
  getAdminPaymentsDashboard,
  recordPaymentReturn,
  syncPaymentCollection,
  type AdminPaymentDashboard,
} from '../../../lib/adminPayments'
import type { MobileMoneyOperator } from '../../../lib/lenco'
import type { Session, SessionRegistration } from '../../../lib/schema'

type PaymentsTab = 'overview' | 'collections' | 'reconciliation' | 'withdrawals' | 'returns'

interface CollectionForm {
  sessionId: string
  registrationId: string
  phone: string
  operator: MobileMoneyOperator
  amount: string
  currency: string
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

const tabs: { value: PaymentsTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'collections', label: 'Collections' },
  { value: 'reconciliation', label: 'Reconciliation' },
  { value: 'withdrawals', label: 'Withdrawals' },
  { value: 'returns', label: 'Returns' },
]

const DASHBOARD_LOAD_TIMEOUT_MS = 18000

const emptyCollectionForm: CollectionForm = {
  sessionId: '',
  registrationId: '',
  phone: '',
  operator: 'airtel',
  amount: '',
  currency: 'ZMW',
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

const formatMoney = (amount: unknown, currency = 'ZMW'): string =>
  `${currency} ${asNumber(amount).toFixed(2)}`

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

function MetricCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string
  value: string
  helper: string
  icon: React.ReactNode
}) {
  return (
    <Box p={5} bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.100" borderRadius="xl">
      <Flex justify="space-between" gap={4} align="flex-start">
        <Box minW={0}>
          <Text color="whiteAlpha.500" fontSize="xs" textTransform="uppercase" letterSpacing="0.12em">
            {label}
          </Text>
          <Text color="white" fontSize="2xl" fontWeight="bold" mt={2}>
            {value}
          </Text>
          <Text color="whiteAlpha.500" fontSize="sm" mt={1}>
            {helper}
          </Text>
        </Box>
        <Flex boxSize="42px" borderRadius="full" bg="brand.500/16" color="brand.200" align="center" justify="center" flexShrink={0}>
          {icon}
        </Flex>
      </Flex>
    </Box>
  )
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

  const [activeTab, setActiveTab] = useState<PaymentsTab>('overview')
  const [sessionFilter, setSessionFilter] = useState('all')
  const [dashboard, setDashboard] = useState<AdminPaymentDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [syncingKey, setSyncingKey] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [collectionForm, setCollectionForm] = useState<CollectionForm>(emptyCollectionForm)
  const [returnForm, setReturnForm] = useState<ReturnForm>(emptyReturnForm)

  const sessions = useMemo(
    () => [...sessionDocs].sort((a, b) => asNumber(b.price) - asNumber(a.price)),
    [sessionDocs]
  )
  const selectedCollectionSession = sessions.find((session) => session.id === collectionForm.sessionId)
  const filteredRegistrations = registrations.filter((registration) => registration.sessionId === collectionForm.sessionId)
  const completedTransactions = (dashboard?.localTransactions || []).filter((transaction) =>
    String(transaction.status || '').toLowerCase() === 'completed'
  )

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await withTimeout(
        getAdminPaymentsDashboard({
          sessionId: sessionFilter === 'all' ? undefined : sessionFilter,
          limit: 150,
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
    } catch (collectError) {
      setError(collectError instanceof Error ? collectError.message : 'Unable to start collection.')
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
    } catch (returnError) {
      setError(returnError instanceof Error ? returnError.message : 'Unable to record return.')
    } finally {
      setBusy(false)
    }
  }

  const totals = dashboard?.totals

  return (
    <AdminLayout>
      <Box p={{ base: 4, md: 8 }}>
        <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} gap={4} direction={{ base: 'column', md: 'row' }} mb={6}>
          <Box>
            <Heading as="h1" color="white" fontSize={{ base: '2xl', md: '3xl' }}>
              Payments
            </Heading>
            <Text color="whiteAlpha.600" mt={1}>
              Collections, reconciliation, settlements, withdrawals, and returns.
            </Text>
          </Box>
          <HStack gap={3} flexWrap="wrap">
            <select value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value)} style={selectStyle}>
              <option value="all">All sessions</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title}
                </option>
              ))}
            </select>
            <Button h="46px" px={5} borderRadius="xl" bg="brand.500" color="white" _hover={{ bg: 'brand.600' }} onClick={() => void loadDashboard()} disabled={loading}>
              {loading ? <Spinner size="sm" /> : <RefreshCw size={16} />}
              Refresh
            </Button>
          </HStack>
        </Flex>

        {(message || error) && (
          <Box mb={5} p={4} borderRadius="xl" border="1px solid" borderColor={error ? 'red.400/50' : 'green.400/40'} bg={error ? 'red.500/10' : 'green.500/10'}>
            <Text color={error ? 'red.200' : 'green.200'}>{error || message}</Text>
          </Box>
        )}

        <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap={4} mb={6}>
          <MetricCard label="Net collected" value={formatMoney(totals?.netCollected)} helper="Online and external minus returns" icon={<Wallet size={20} />} />
          <MetricCard label="Pending" value={formatMoney(totals?.pending)} helper="Collections awaiting confirmation" icon={<RefreshCw size={20} />} />
          <MetricCard label="Withdrawals" value={formatMoney(totals?.providerWithdrawals)} helper="Provider debit-like transactions" icon={<Banknote size={20} />} />
          <MetricCard label="Returns" value={formatMoney(totals?.completedReturns)} helper="Completed return records" icon={<RotateCcw size={20} />} />
        </SimpleGrid>

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
                <Panel title="Session Totals">
                  <VStack align="stretch" gap={0}>
                    {(dashboard?.sessions || []).map((session) => (
                      <Flex key={session.sessionId} py={4} gap={4} justify="space-between" align={{ base: 'stretch', lg: 'center' }} direction={{ base: 'column', lg: 'row' }} borderBottom="1px solid" borderColor="whiteAlpha.100">
                        <Box minW={0}>
                          <Text color="white" fontWeight="semibold" lineClamp={1}>{session.title}</Text>
                          <Text color="whiteAlpha.500" fontSize="sm">{session.registrationCount} registrations · {session.transactionCount} collections</Text>
                        </Box>
                        <HStack gap={4} flexWrap="wrap" justify={{ base: 'space-between', lg: 'flex-end' }}>
                          <Text color="green.200">{formatMoney(session.grossCollected, session.currency)}</Text>
                          <Text color="orange.200">{formatMoney(session.pending, session.currency)} pending</Text>
                          <Text color="white">{formatMoney(session.netCollected, session.currency)} net</Text>
                        </HStack>
                      </Flex>
                    ))}
                    {dashboard?.sessions.length === 0 && <Text color="whiteAlpha.500">No session payment records yet.</Text>}
                  </VStack>
                </Panel>

                <Panel title="Provider Status">
                  <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap={3}>
                    {Object.entries(dashboard?.provider.errors || {}).map(([key, providerError]) => (
                      <Box key={key} p={4} bg="blackAlpha.200" borderRadius="xl" border="1px solid" borderColor="whiteAlpha.100">
                        <HStack gap={2}>
                          {providerError ? <AlertTriangle size={16} color="#fca5a5" /> : <CheckCircle2 size={16} color="#86efac" />}
                          <Text color="white" textTransform="capitalize">{key}</Text>
                        </HStack>
                        <Text color={providerError ? 'red.200' : 'whiteAlpha.500'} fontSize="sm" mt={2}>
                          {providerError || 'Connected'}
                        </Text>
                      </Box>
                    ))}
                  </SimpleGrid>
                </Panel>
              </>
            )}

            {dashboard && activeTab === 'collections' && (
              <>
                <Panel title="Collect Session Payment">
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
                    <Button type="submit" mt={4} h="46px" px={5} borderRadius="xl" bg="brand.500" color="white" _hover={{ bg: 'brand.600' }} disabled={busy}>
                      {busy ? <Spinner size="sm" /> : <Send size={16} />}
                      Collect Payment
                    </Button>
                  </form>
                </Panel>

                <Panel title="Local Collections">
                  <VStack align="stretch" gap={0}>
                    {(dashboard?.localTransactions || []).map((record) => {
                      const key = asString(record.reference) || asString(record.transactionId) || asString(record.id)
                      return <PaymentRow key={key} record={record} onSync={handleSync} syncing={syncingKey === key} />
                    })}
                    {dashboard?.localTransactions.length === 0 && <Text color="whiteAlpha.500">No local collections yet.</Text>}
                  </VStack>
                </Panel>
              </>
            )}

            {dashboard && activeTab === 'reconciliation' && (
              <Panel title={`Reconciliation Issues (${dashboard?.reconciliation.issueCount || 0})`}>
                <VStack align="stretch" gap={4}>
                  {dashboard?.reconciliation.statusMismatches.map((issue, index) => (
                    <Box key={`mismatch-${index}`} p={4} bg="orange.500/10" border="1px solid" borderColor="orange.400/30" borderRadius="xl">
                      <Text color="orange.100" fontWeight="semibold">Status mismatch</Text>
                      <Text color="whiteAlpha.600" fontSize="sm" mt={1}>{asString(issue.reference)}</Text>
                    </Box>
                  ))}
                  {dashboard?.reconciliation.missingProviderCollections.map((record) => (
                    <Box key={asString(record.id)} p={4} bg="red.500/10" border="1px solid" borderColor="red.400/30" borderRadius="xl">
                      <Text color="red.100" fontWeight="semibold">Missing provider record</Text>
                      <Text color="whiteAlpha.600" fontSize="sm" mt={1}>{recordLabel(record, ['reference', 'transactionId'])}</Text>
                    </Box>
                  ))}
                  {dashboard?.reconciliation.unmatchedProviderCollections.slice(0, 20).map((record, index) => (
                    <Box key={`provider-${index}`} p={4} bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.100" borderRadius="xl">
                      <Text color="white" fontWeight="semibold">Unmatched Lenco collection</Text>
                      <Text color="whiteAlpha.600" fontSize="sm" mt={1}>{recordLabel(record, ['reference', 'id'])}</Text>
                    </Box>
                  ))}
                  {dashboard?.reconciliation.issueCount === 0 && <Text color="whiteAlpha.500">No reconciliation issues in the loaded window.</Text>}
                </VStack>
              </Panel>
            )}

            {dashboard && activeTab === 'withdrawals' && (
              <>
                <Panel title="Accounts">
                  <SimpleGrid columns={{ base: 1, lg: 2 }} gap={3}>
                    {(dashboard?.provider.accounts || []).map((account, index) => (
                      <Box key={String(account.id || index)} p={4} bg="blackAlpha.200" borderRadius="xl" border="1px solid" borderColor="whiteAlpha.100">
                        <Text color="white" fontWeight="semibold">{recordLabel(account, ['name', 'accountName', 'id'])}</Text>
                        <Text color="brand.200" fontSize="xl" fontWeight="bold" mt={2}>
                          {formatMoney(account.balance || account.availableBalance || account.amount, asString(account.currency) || 'ZMW')}
                        </Text>
                      </Box>
                    ))}
                    {dashboard?.provider.accounts.length === 0 && <Text color="whiteAlpha.500">No provider accounts returned.</Text>}
                  </SimpleGrid>
                </Panel>
                <Panel title="Withdrawals And Debits">
                  <VStack align="stretch" gap={3}>
                    {(dashboard?.provider.withdrawals || []).map((record, index) => (
                      <Flex key={String(record.id || index)} justify="space-between" gap={4} p={4} bg="blackAlpha.200" borderRadius="xl">
                        <Box minW={0}>
                          <Text color="white" fontWeight="semibold" lineClamp={1}>{recordLabel(record, ['description', 'narration', 'type'])}</Text>
                          <Text color="whiteAlpha.500" fontSize="sm">{recordLabel(record, ['reference', 'id'])}</Text>
                        </Box>
                        <Text color="orange.200" fontWeight="bold">{formatMoney(Math.abs(asNumber(record.amount)), asString(record.currency) || 'ZMW')}</Text>
                      </Flex>
                    ))}
                    {dashboard?.provider.withdrawals.length === 0 && <Text color="whiteAlpha.500">No provider withdrawals/debits returned.</Text>}
                  </VStack>
                </Panel>
                <Panel title="Settlements">
                  <VStack align="stretch" gap={3}>
                    {(dashboard?.provider.settlements || []).slice(0, 20).map((record, index) => (
                      <Flex key={String(record.id || index)} justify="space-between" gap={4} p={4} bg="blackAlpha.200" borderRadius="xl">
                        <Box minW={0}>
                          <Text color="white" fontWeight="semibold">{recordLabel(record, ['reference', 'id', 'status'])}</Text>
                          <Text color="whiteAlpha.500" fontSize="sm">{formatDate(record.createdAt || record.date)}</Text>
                        </Box>
                        <Text color="green.200" fontWeight="bold">{formatMoney(record.amount || record.total, asString(record.currency) || 'ZMW')}</Text>
                      </Flex>
                    ))}
                    {dashboard?.provider.settlements.length === 0 && <Text color="whiteAlpha.500">No provider settlements returned.</Text>}
                  </VStack>
                </Panel>
              </>
            )}

            {dashboard && activeTab === 'returns' && (
              <>
                <Panel title="Record Return">
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
                    <Button type="submit" mt={4} h="46px" px={5} borderRadius="xl" bg="brand.500" color="white" _hover={{ bg: 'brand.600' }} disabled={busy}>
                      {busy ? <Spinner size="sm" /> : <RotateCcw size={16} />}
                      Record Return
                    </Button>
                  </form>
                </Panel>

                <Panel title="Return Records">
                  <VStack align="stretch" gap={3}>
                    {(dashboard?.returns || []).map((record) => (
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
                    {dashboard?.returns.length === 0 && <Text color="whiteAlpha.500">No return records yet.</Text>}
                  </VStack>
                </Panel>
              </>
            )}
          </VStack>
        )}
      </Box>
    </AdminLayout>
  )
}
