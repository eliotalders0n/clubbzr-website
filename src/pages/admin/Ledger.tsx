import { useEffect, useState } from 'react'
import { Box, Button, Flex, Heading, Text } from '@chakra-ui/react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { db, functions } from '../../../lib/config'
import type { WalletTransaction } from '../../../lib/economy'

export default function Ledger() {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [walletId, setWalletId] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const snapshot = await getDocs(query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(100)))
    setTransactions(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as WalletTransaction)))
    setLoading(false)
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [])

  async function adjust(kind: 'credit' | 'debit') {
    setFeedback(null)
    try {
      const call = httpsCallable(functions, kind === 'credit' ? 'adminCreditPoints' : 'adminDebitPoints')
      await call({ userId: walletId.trim(), amount: Number(amount), reason: reason.trim(), idempotencyKey: crypto.randomUUID() })
      setFeedback(`${kind === 'credit' ? 'Credit' : 'Debit'} recorded.`)
      await load()
    } catch (cause) { setFeedback(cause instanceof Error ? cause.message : 'Adjustment failed.') }
  }

  async function reconcile() {
    try {
      const call = httpsCallable(functions, 'adminReconcileWallet')
      const result = await call({ walletId: walletId.trim() })
      setFeedback(JSON.stringify(result.data))
    } catch (cause) { setFeedback(cause instanceof Error ? cause.message : 'Reconciliation failed.') }
  }

  return (
    <AdminLayout>
      <Box px={{ base: 4, md: 8, xl: 12 }} py={{ base: 6, md: 8 }}>
        <Box mb={8}>
          <Heading as="h1" color="white" size="lg">Points ledger</Heading>
          <Text color="whiteAlpha.600" mt={2}>Immutable point movements and audited adjustments.</Text>
        </Box>

        <Box bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" rounded="2xl" p={{ base: 5, md: 6 }}>
          <Heading color="white" size="md" mb={5}>Manual adjustment</Heading>
          <Box display="grid" gridTemplateColumns={{ base: '1fr', md: '1fr 160px 2fr' }} gap={3}>
            <input className="ledger-input" value={walletId} onChange={(event) => setWalletId(event.currentTarget.value)} placeholder="Wallet / user ID" />
            <input className="ledger-input" type="number" min="1" value={amount} onChange={(event) => setAmount(event.currentTarget.value)} placeholder="Points" />
            <input className="ledger-input" value={reason} onChange={(event) => setReason(event.currentTarget.value)} placeholder="Auditable reason (required)" />
          </Box>
          <Flex gap={3} mt={5} wrap="wrap">
            <Button h="44px" px={5} rounded="full" bg="#f47742" color="white" onClick={() => void adjust('credit')}>Credit</Button>
            <Button h="44px" px={5} rounded="full" variant="outline" color="white" onClick={() => void adjust('debit')}>Debit</Button>
            <Button h="44px" px={5} rounded="full" variant="outline" color="white" onClick={() => void reconcile()}>Reconcile wallet</Button>
          </Flex>
          {feedback && <Text color="whiteAlpha.700" mt={4}>{feedback}</Text>}
        </Box>

        <Box mt={6} border="1px solid" borderColor="whiteAlpha.100" rounded="2xl" overflow="hidden">
          {loading ? <Text color="whiteAlpha.500" p={6}>Loading ledger…</Text> : transactions.map((item) => <Flex key={item.id} p={{ base: 4, md: 5 }} gap={4} justify="space-between" borderBottom="1px solid" borderColor="whiteAlpha.100"><Box minW={0}><Text color="white" fontWeight="semibold">{item.type.replaceAll('_', ' ')}</Text><Text color="whiteAlpha.400" fontSize="xs" truncate>{item.id}</Text></Box><Box textAlign="right" flexShrink={0}><Text color="white">{item.amount} points</Text><Text color="whiteAlpha.500" fontSize="sm">fee {item.fee}</Text></Box></Flex>)}
        </Box>
        <style>{`.ledger-input{height:48px;padding:0 14px;border:1px solid rgba(255,255,255,.16);border-radius:10px;background:#09090b;color:white;outline:none}.ledger-input:focus{border-color:#f47742}`}</style>
      </Box>
    </AdminLayout>
  )
}
