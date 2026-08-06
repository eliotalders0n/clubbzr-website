import { useMemo, useState, type FormEvent } from 'react'
import { Box, Button, Flex, Heading, Spinner, Text } from '@chakra-ui/react'
import { Navigate } from 'react-router-dom'

import { Header } from '@/components/layout/Header'
import { useAuth } from '@/contexts/AuthContext'
import { useWallet } from '@/contexts/WalletContext'
import { checkPointPurchaseStatus, initiatePointPurchase } from '../../lib/economy'

function formatDate(value?: { seconds: number }) {
  return value ? new Date(value.seconds * 1000).toLocaleString() : 'Processing'
}

export default function Wallet() {
  const { firebaseUser, initialized } = useAuth()
  const { summary, transactions, loading, error, transfer, refresh: refreshWallet } = useWallet()
  const [recipientId, setRecipientId] = useState('')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [purchaseAmount, setPurchaseAmount] = useState('')
  const [phone, setPhone] = useState('')
  const [operator, setOperator] = useState<'mtn' | 'airtel' | 'zamtel'>('mtn')
  const [purchasing, setPurchasing] = useState(false)
  const balance = summary?.balance
  const canSubmit = useMemo(
    () => recipientId.trim().length >= 6 && Number.isSafeInteger(Number(amount)) && Number(amount) > 0,
    [amount, recipientId],
  )

  if (initialized && !firebaseUser) return <Navigate to="/auth/login" replace />

  async function handleTransfer(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setFeedback(null)
    try {
      await transfer(recipientId.trim(), Number(amount))
      setAmount('')
      setFeedback('Points sent successfully.')
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Transfer failed.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePurchase(event: FormEvent) {
    event.preventDefault()
    const zmw = Number(purchaseAmount)
    if (!Number.isFinite(zmw) || zmw <= 0) return
    setPurchasing(true)
    setFeedback(null)
    try {
      const result = await initiatePointPurchase({
        amountNgwee: Math.round(zmw * 100), phone, operator,
        idempotencyKey: crypto.randomUUID(),
      })
      setFeedback(`Payment started for ${result.points} points. Approve the mobile-money prompt.`)
      void monitorPayment(result.paymentId)
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Purchase could not be started.')
    } finally { setPurchasing(false) }
  }

  async function monitorPayment(paymentId: string) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 5000))
      try {
        const status = await checkPointPurchaseStatus(paymentId)
        if (status.status === 'successful') {
          setFeedback(`${status.points} points have been added to your wallet.`)
          await refreshWallet()
          return
        }
        if (status.status === 'failed') {
          setFeedback('The mobile-money payment failed. No points were charged.')
          return
        }
      } catch {
        // Scheduled reconciliation and the signed webhook remain authoritative.
      }
    }
    setFeedback('Payment is still pending. Your wallet will update after confirmation.')
  }

  return (
    <Box minH="100vh" bg="#080808" color="white">
      <Header />
      <Box as="main" maxW="1180px" mx="auto" px={{ base: 4, md: 8 }} pt={{ base: 28, md: 32 }} pb={24}>
        <Flex align="end" justify="space-between" gap={4} mb={8}>
          <Box>
            <Text color="#f47742" fontSize="sm" letterSpacing="0.18em" textTransform="uppercase">Club BZR Points</Text>
            <Heading size="3xl" mt={2}>Wallet</Heading>
          </Box>
          {loading && <Spinner color="#f47742" />}
        </Flex>

        <Box as="form" onSubmit={handlePurchase} mt={6} bg="#151515" border="1px solid #2b2b2b" rounded="2xl" p={{ base: 5, md: 7 }}>
          <Heading size="lg">Buy points</Heading>
          <Text color="whiteAlpha.500" mt={1} mb={5}>Pay securely in ZMW using mobile money. Points are credited only after Lenco confirms payment.</Text>
          <Box display="grid" gridTemplateColumns={{ base: '1fr', md: '1fr 1fr 1fr auto' }} gap={4} alignItems="end">
            <Box as="label"><Text fontSize="sm" mb={2}>Amount (ZMW)</Text><input className="wallet-input" type="number" min="1" step="0.01" value={purchaseAmount} onChange={(event) => setPurchaseAmount(event.currentTarget.value)} /></Box>
            <Box as="label"><Text fontSize="sm" mb={2}>Mobile number</Text><input className="wallet-input" value={phone} onChange={(event) => setPhone(event.currentTarget.value)} placeholder="096…" /></Box>
            <Box as="label"><Text fontSize="sm" mb={2}>Network</Text><select className="wallet-input" value={operator} onChange={(event) => setOperator(event.currentTarget.value as typeof operator)}><option value="mtn">MTN</option><option value="airtel">Airtel</option><option value="zamtel">Zamtel</option></select></Box>
            <Button type="submit" disabled={purchasing || !purchaseAmount || !phone} bg="#f47742" color="white" rounded="full" px={7} h="52px">{purchasing ? 'Starting…' : 'Buy points'}</Button>
          </Box>
        </Box>

        {error && <Box bg="red.950" border="1px solid" borderColor="red.700" p={4} rounded="xl" mb={6}>{error}</Box>}

        <Flex direction={{ base: 'column', lg: 'row' }} gap={6} align="stretch">
          <Box flex="1" bg="#151515" border="1px solid #2b2b2b" rounded="2xl" p={{ base: 5, md: 7 }}>
            <Text color="whiteAlpha.600">Available balance</Text>
            <Heading fontSize={{ base: '4xl', md: '6xl' }} mt={2}>{balance?.available ?? 0}</Heading>
            <Text color="whiteAlpha.500" mt={1}>points</Text>
            <Flex gap={8} mt={8} wrap="wrap">
              <Box><Text color="whiteAlpha.500" fontSize="sm">Locked</Text><Text fontSize="xl">{balance?.locked ?? 0}</Text></Box>
              <Box><Text color="whiteAlpha.500" fontSize="sm">Pending</Text><Text fontSize="xl">{balance?.pending ?? 0}</Text></Box>
              <Box><Text color="whiteAlpha.500" fontSize="sm">Total</Text><Text fontSize="xl">{balance?.total ?? 0}</Text></Box>
            </Flex>
          </Box>

          <Box as="form" onSubmit={handleTransfer} flex="1" bg="#151515" border="1px solid #2b2b2b" rounded="2xl" p={{ base: 5, md: 7 }}>
            <Heading size="lg">Send points</Heading>
            <Text color="whiteAlpha.500" mt={1} mb={5}>Transfers are final. Confirm the member ID before sending.</Text>
            <Box as="label" display="block" mb={4}>
              <Text fontSize="sm" mb={2}>Recipient member ID</Text>
              <input className="wallet-input" value={recipientId} onChange={(event) => setRecipientId(event.currentTarget.value)} />
            </Box>
            <Box as="label" display="block" mb={5}>
              <Text fontSize="sm" mb={2}>Amount</Text>
              <input className="wallet-input" type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.currentTarget.value)} />
            </Box>
            <Button type="submit" disabled={!canSubmit || submitting} bg="#f47742" color="white" rounded="full" px={7}>{submitting ? 'Sending…' : 'Send points'}</Button>
            {feedback && <Text mt={4} color="whiteAlpha.700">{feedback}</Text>}
          </Box>
        </Flex>

        <Box mt={10}>
          <Heading size="xl" mb={5}>Transaction history</Heading>
          <Box border="1px solid #292929" rounded="2xl" overflow="hidden">
            {transactions.length === 0 && !loading ? <Text p={6} color="whiteAlpha.500">No transactions yet.</Text> : transactions.map((item) => (
              <Flex key={item.id} px={{ base: 4, md: 6 }} py={4} gap={4} align="center" justify="space-between" borderBottom="1px solid #222" _last={{ borderBottom: 0 }}>
                <Box minW={0}><Text fontWeight="semibold" textTransform="capitalize">{item.type.replaceAll('_', ' ')}</Text><Text color="whiteAlpha.500" fontSize="sm">{formatDate(item.createdAt)}</Text></Box>
                <Text fontWeight="bold" color={item.receiverWalletId === firebaseUser?.uid ? 'green.300' : 'white'}>{item.receiverWalletId === firebaseUser?.uid ? '+' : '-'}{item.amount}</Text>
              </Flex>
            ))}
          </Box>
        </Box>
      </Box>
      <style>{`.wallet-input{width:100%;height:52px;padding:0 16px;border:1px solid #333;border-radius:12px;background:#0d0d0d;color:white;outline:none}.wallet-input:focus{border-color:#f47742}`}</style>
    </Box>
  )
}
