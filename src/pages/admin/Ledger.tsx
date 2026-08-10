import { useEffect, useState } from 'react'
import { Box, Button, Flex, Heading, Text } from '@chakra-ui/react'
import { httpsCallable } from 'firebase/functions'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { functions } from '../../../lib/config'
import type { WalletTransaction } from '../../../lib/economy'

interface RewardBackfillPage {
  scanned: number
  eligible: number
  awarded: number
  alreadyRewarded: number
  skipped: number
  pointsPerReward: number
  pointsAwarded: number
  potentialPoints: number
  nextCursor: string | null
  failures: Array<{ registrationId: string; message: string }>
}

interface RewardBackfillSummary extends Omit<RewardBackfillPage, 'nextCursor'> {
  dryRun: boolean
}

export default function Ledger() {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [walletId, setWalletId] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [backfillRunning, setBackfillRunning] = useState(false)
  const [backfillSummary, setBackfillSummary] = useState<RewardBackfillSummary | null>(null)

  const normalizedWalletId = walletId.trim()
  const normalizedReason = reason.trim()
  const parsedAmount = Number(amount)
  const walletIdIsValid = normalizedWalletId.length >= 6 && normalizedWalletId.length <= 128
  const amountIsValid = Number.isSafeInteger(parsedAmount) && parsedAmount > 0
  const reasonIsValid = normalizedReason.length >= 8 && normalizedReason.length <= 500
  const adjustmentIsValid = walletIdIsValid && amountIsValid && reasonIsValid

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const call = httpsCallable<{ limit: number }, { transactions: WalletTransaction[] }>(functions, 'adminGetPointLedger')
      const result = await call({ limit: 100 })
      setTransactions(result.data.transactions)
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'The ledger could not be loaded.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [])

  async function adjust(kind: 'credit' | 'debit') {
    setFeedback(null)
    if (!walletIdIsValid) {
      setFeedback('Enter a valid wallet or user ID.')
      return
    }
    if (!amountIsValid) {
      setFeedback('Points must be a positive whole number.')
      return
    }
    if (!reasonIsValid) {
      setFeedback('Enter an auditable reason of at least 8 characters.')
      return
    }
    setSubmitting(true)
    try {
      const call = httpsCallable(functions, kind === 'credit' ? 'adminCreditPoints' : 'adminDebitPoints')
      await call({ userId: normalizedWalletId, amount: parsedAmount, reason: normalizedReason, idempotencyKey: crypto.randomUUID() })
      setFeedback(`${kind === 'credit' ? 'Credit' : 'Debit'} recorded.`)
      await load()
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Adjustment failed.')
    } finally {
      setSubmitting(false)
    }
  }

  async function reconcile() {
    setFeedback(null)
    if (!walletIdIsValid) {
      setFeedback('Enter a valid wallet or user ID.')
      return
    }
    setSubmitting(true)
    try {
      const call = httpsCallable(functions, 'adminReconcileWallet')
      const result = await call({ walletId: normalizedWalletId })
      setFeedback(JSON.stringify(result.data))
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Reconciliation failed.')
    } finally {
      setSubmitting(false)
    }
  }

  async function runPaidSessionRewardBackfill(dryRun: boolean) {
    if (!dryRun && !window.confirm(
      `Grant ${backfillSummary?.potentialPoints || 0} points and the same XP across ${backfillSummary?.eligible || 0} eligible paid registrations?`
    )) return

    setBackfillRunning(true)
    setFeedback(null)
    let cursor: string | undefined
    const seenCursors = new Set<string>()
    const summary: RewardBackfillSummary = {
      dryRun,
      scanned: 0,
      eligible: 0,
      awarded: 0,
      alreadyRewarded: 0,
      skipped: 0,
      pointsPerReward: 0,
      pointsAwarded: 0,
      potentialPoints: 0,
      failures: [],
    }
    try {
      const call = httpsCallable<
        { dryRun: boolean; cursor?: string; limit: number },
        RewardBackfillPage
      >(functions, 'adminBackfillPaidSessionRewards')
      do {
        const result = (await call({ dryRun, cursor, limit: 25 })).data
        summary.scanned += result.scanned
        summary.eligible += result.eligible
        summary.awarded += result.awarded
        summary.alreadyRewarded += result.alreadyRewarded
        summary.skipped += result.skipped
        summary.pointsAwarded += result.pointsAwarded
        summary.potentialPoints += result.potentialPoints
        summary.pointsPerReward = result.pointsPerReward
        summary.failures.push(...result.failures)
        cursor = result.nextCursor || undefined
        if (cursor) {
          if (seenCursors.has(cursor)) throw new Error('Reward backfill pagination did not advance.')
          seenCursors.add(cursor)
        }
      } while (cursor)
      setBackfillSummary(summary)
      if (!dryRun) await load()
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Paid-session rewards could not be processed.')
    } finally {
      setBackfillRunning(false)
    }
  }

  return (
    <AdminLayout>
      <Box px={{ base: 4, md: 8, xl: 12 }} py={{ base: 6, md: 8 }}>
        <Box mb={8}>
          <Heading as="h1" color="white" size="lg">Points ledger</Heading>
          <Text color="whiteAlpha.600" mt={2}>Immutable point movements and audited adjustments.</Text>
        </Box>

        <Box bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" rounded="2xl" p={{ base: 5, md: 6 }} mb={6}>
          <Heading color="white" size="md">Paid-session rewards</Heading>
          <Text color="whiteAlpha.500" fontSize="sm" mt={2}>
            Find historical registrations marked paid and award each member the configured points plus matching XP. Existing reward transactions are skipped safely.
          </Text>
          <Flex gap={3} mt={5} wrap="wrap">
            <Button h="44px" px={5} rounded="full" variant="outline" color="white" onClick={() => void runPaidSessionRewardBackfill(true)} disabled={backfillRunning}>
              {backfillRunning ? 'Checking…' : 'Preview eligible rewards'}
            </Button>
            <Button h="44px" px={5} rounded="full" bg="#f47742" color="white" onClick={() => void runPaidSessionRewardBackfill(false)} disabled={backfillRunning || !backfillSummary?.dryRun || backfillSummary.eligible === 0}>
              Grant historical rewards
            </Button>
          </Flex>
          {backfillSummary && (
            <Text color="whiteAlpha.700" fontSize="sm" mt={4}>
              {backfillSummary.dryRun
                ? `${backfillSummary.eligible} eligible × ${backfillSummary.pointsPerReward} = ${backfillSummary.potentialPoints} points + ${backfillSummary.potentialPoints} XP. ${backfillSummary.alreadyRewarded} already rewarded; ${backfillSummary.skipped} skipped.`
                : `${backfillSummary.awarded} rewards granted: ${backfillSummary.pointsAwarded} points + ${backfillSummary.pointsAwarded} XP. ${backfillSummary.alreadyRewarded} already rewarded; ${backfillSummary.skipped} skipped.`}
            </Text>
          )}
          {backfillSummary?.failures.slice(0, 3).map((failure) => (
            <Text key={`${failure.registrationId}-${failure.message}`} color="red.200" fontSize="xs" mt={2}>
              {failure.registrationId}: {failure.message}
            </Text>
          ))}
        </Box>

        <Box bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" rounded="2xl" p={{ base: 5, md: 6 }}>
          <Heading color="white" size="md" mb={5}>Manual adjustment</Heading>
          <Box display="grid" gridTemplateColumns={{ base: '1fr', md: '1fr 160px 2fr' }} gap={3}>
            <input aria-label="Wallet or user ID" className="ledger-input" value={walletId} onChange={(event) => setWalletId(event.currentTarget.value)} placeholder="Wallet / user ID" />
            <input aria-label="Points" className="ledger-input" type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.currentTarget.value)} placeholder="Points" />
            <input aria-label="Auditable reason" className="ledger-input" value={reason} onChange={(event) => setReason(event.currentTarget.value)} placeholder="Auditable reason (required)" />
          </Box>
          <Flex gap={3} mt={5} wrap="wrap">
            <Button h="44px" px={5} rounded="full" bg="#f47742" color="white" onClick={() => void adjust('credit')} disabled={!adjustmentIsValid || submitting}>Credit</Button>
            <Button h="44px" px={5} rounded="full" variant="outline" color="white" onClick={() => void adjust('debit')} disabled={!adjustmentIsValid || submitting}>Debit</Button>
            <Button h="44px" px={5} rounded="full" variant="outline" color="white" onClick={() => void reconcile()} disabled={!walletIdIsValid || submitting}>Reconcile wallet</Button>
          </Flex>
          {feedback && <Text color="whiteAlpha.700" mt={4}>{feedback}</Text>}
        </Box>

        <Box mt={6} border="1px solid" borderColor="whiteAlpha.100" rounded="2xl" overflow="hidden">
          {loading ? <Text color="whiteAlpha.500" p={6}>Loading ledger…</Text> : loadError ? <Text color="red.200" p={6}>{loadError}</Text> : transactions.length === 0 ? <Text color="whiteAlpha.500" p={6}>No ledger transactions yet.</Text> : transactions.map((item) => <Flex key={item.id} p={{ base: 4, md: 5 }} gap={4} justify="space-between" borderBottom="1px solid" borderColor="whiteAlpha.100"><Box minW={0}><Text color="white" fontWeight="semibold">{item.type.replaceAll('_', ' ')}</Text><Text color="whiteAlpha.500" fontSize="sm" mt={1} truncate>{item.receiverWalletId || item.senderWalletId || 'System account'}</Text><Text color="whiteAlpha.400" fontSize="xs" truncate>{item.referenceType}: {item.id}</Text></Box><Box textAlign="right" flexShrink={0}><Text color="white">{item.amount} points</Text><Text color="whiteAlpha.500" fontSize="sm">fee {item.fee}</Text></Box></Flex>)}
        </Box>
        <style>{`.ledger-input{height:48px;padding:0 14px;border:1px solid rgba(255,255,255,.16);border-radius:10px;background:#09090b;color:white;outline:none}.ledger-input:focus{border-color:#f47742}`}</style>
      </Box>
    </AdminLayout>
  )
}
