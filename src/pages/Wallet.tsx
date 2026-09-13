import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Box, Button, Flex, Heading, Spinner, Text } from '@chakra-ui/react'
import { doc, getDoc } from 'firebase/firestore'
import { Navigate } from 'react-router-dom'

import { Header } from '@/components/layout/Header'
import { BuyPointsModal } from '@/components/features/wallet/BuyPointsModal'
import { useAuth } from '@/contexts/AuthContext'
import { useWallet } from '@/contexts/WalletContext'
import { db } from '../../lib/config'
import { checkPointPurchaseStatus, initiatePointPurchase } from '../../lib/economy'

interface PurchaseSettings {
  enabled: boolean
  minNgwee: number | null
  maxNgwee: number | null
  pointsPerZmw: number | null
}

type Feedback = { type: 'error' | 'success'; message: string }

type WalletTab = 'wallet' | 'history'

function formatDate(value?: { seconds: number }) {
  return value ? new Date(value.seconds * 1000).toLocaleString() : 'Processing'
}

export default function Wallet() {
  const { firebaseUser, initialized } = useAuth()
  const { summary, transactions, loading, error, transfer, refresh: refreshWallet } = useWallet()
  const [recipientId, setRecipientId] = useState('')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [transferFeedback, setTransferFeedback] = useState<Feedback | null>(null)
  const [purchaseAmount, setPurchaseAmount] = useState('')
  const [phone, setPhone] = useState('')
  const [operator, setOperator] = useState<'mtn' | 'airtel' | 'zamtel'>('mtn')
  const [purchasing, setPurchasing] = useState(false)
  const [purchaseFeedback, setPurchaseFeedback] = useState<Feedback | null>(null)
  const [purchaseSettings, setPurchaseSettings] = useState<PurchaseSettings | null>(null)
  const [activeTab, setActiveTab] = useState<WalletTab>('wallet')
  const [buyOpen, setBuyOpen] = useState(false)
  const balance = summary?.balance
  const canSubmit = useMemo(
    () => recipientId.trim().length >= 6 && Number.isSafeInteger(Number(amount)) && Number(amount) > 0,
    [amount, recipientId],
  )
  // Mirrors calculatePurchasePoints on the server so the amount being bought is
  // visible before the mobile-money prompt appears.
  const previewPoints = useMemo(() => {
    const zmw = Number(purchaseAmount)
    const rate = purchaseSettings?.pointsPerZmw
    if (!rate || !Number.isFinite(zmw) || zmw <= 0) return null
    return Math.floor((Math.round(zmw * 100) * rate) / 100)
  }, [purchaseAmount, purchaseSettings?.pointsPerZmw])

  useEffect(() => {
    if (!firebaseUser) return
    void getDoc(doc(db, 'settings', 'economy')).then((snapshot) => {
      const data = snapshot.data()
      setPurchaseSettings({
        enabled: data?.economyEnabled === true && data?.pointPurchasesEnabled === true && data?.maintenanceMode !== true,
        minNgwee: Number.isSafeInteger(data?.minPurchaseNgwee) ? data.minPurchaseNgwee : null,
        maxNgwee: Number.isSafeInteger(data?.maxPurchaseNgwee) ? data.maxPurchaseNgwee : null,
        pointsPerZmw: Number.isSafeInteger(data?.pointsPerZmw) ? data.pointsPerZmw : null,
      })
    }).catch(() => setPurchaseSettings({ enabled: false, minNgwee: null, maxNgwee: null, pointsPerZmw: null }))
  }, [firebaseUser])

  if (initialized && !firebaseUser) return <Navigate to="/auth/login" replace />

  async function handleTransfer(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setTransferFeedback(null)
    try {
      await transfer(recipientId.trim(), Number(amount))
      setAmount('')
      setTransferFeedback({ type: 'success', message: 'Points sent successfully.' })
    } catch (cause) {
      setTransferFeedback({ type: 'error', message: cause instanceof Error ? cause.message : 'Transfer failed.' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePurchase(event: FormEvent) {
    event.preventDefault()
    const zmw = Number(purchaseAmount)
    const amountNgwee = Math.round(zmw * 100)
    if (!Number.isFinite(zmw) || zmw <= 0) {
      setPurchaseFeedback({ type: 'error', message: 'Enter a valid purchase amount.' })
      return
    }
    if (purchaseSettings?.minNgwee && amountNgwee < purchaseSettings.minNgwee) {
      setPurchaseFeedback({ type: 'error', message: `The minimum purchase is ZMW ${(purchaseSettings.minNgwee / 100).toFixed(2)}.` })
      return
    }
    if (purchaseSettings?.maxNgwee && amountNgwee > purchaseSettings.maxNgwee) {
      setPurchaseFeedback({ type: 'error', message: `The maximum purchase is ZMW ${(purchaseSettings.maxNgwee / 100).toFixed(2)}.` })
      return
    }
    setPurchasing(true)
    setPurchaseFeedback(null)
    try {
      const result = await initiatePointPurchase({
        amountNgwee, phone: phone.trim(), operator,
        idempotencyKey: crypto.randomUUID(),
      })
      setPurchaseFeedback({ type: 'success', message: `Payment started for ${result.points} points. Approve the mobile-money prompt.` })
      void monitorPayment(result.paymentId)
    } catch (cause) {
      setPurchaseFeedback({ type: 'error', message: cause instanceof Error ? cause.message : 'Purchase could not be started.' })
    } finally { setPurchasing(false) }
  }

  async function monitorPayment(paymentId: string) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 5000))
      try {
        const status = await checkPointPurchaseStatus(paymentId)
        if (status.status === 'successful') {
          setPurchaseFeedback({ type: 'success', message: `${status.points} points have been added to your wallet.` })
          setPurchaseAmount('')
          setPhone('')
          // Close the prompt so the credited balance is what they land on.
          setBuyOpen(false)
          await refreshWallet()
          return
        }
        if (status.status === 'failed') {
          setPurchaseFeedback({ type: 'error', message: 'The mobile-money payment failed. No points were charged.' })
          return
        }
      } catch {
        // Scheduled reconciliation and the signed webhook remain authoritative.
      }
    }
    setPurchaseFeedback({ type: 'success', message: 'Payment is still pending. Your wallet will update after confirmation.' })
  }

  const walletTabs: { id: WalletTab; label: string; count?: number }[] = [
    { id: 'wallet', label: 'Wallet' },
    { id: 'history', label: 'Transaction history', count: transactions.length },
  ]

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

        <Flex
          role="tablist"
          aria-label="Wallet sections"
          gap={2}
          mb={{ base: 6, md: 8 }}
          overflowX="auto"
          pb={2}
          css={{ scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
        >
          {walletTabs.map((tab) => {
            const active = activeTab === tab.id
            return (
              <Button
                key={tab.id}
                type="button"
                role="tab"
                id={`wallet-tab-${tab.id}`}
                aria-selected={active}
                aria-controls={`wallet-panel-${tab.id}`}
                h="44px"
                px={4}
                flexShrink={0}
                rounded="full"
                bg={active ? '#f47742' : '#151515'}
                color={active ? 'white' : 'whiteAlpha.700'}
                border="1px solid"
                borderColor={active ? '#f47742' : '#2b2b2b'}
                fontSize="sm"
                fontWeight="semibold"
                _hover={{ bg: active ? '#e06a39' : 'whiteAlpha.100', color: 'white' }}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {typeof tab.count === 'number' && (
                  <Text as="span" ml={2} fontSize="xs" color={active ? 'whiteAlpha.800' : 'whiteAlpha.500'}>
                    {tab.count}
                  </Text>
                )}
              </Button>
            )
          })}
        </Flex>

        {error && <Box bg="red.950" border="1px solid" borderColor="red.700" p={4} rounded="xl" mb={6}>{error}</Box>}

        {activeTab === 'wallet' && (
        <Box role="tabpanel" id="wallet-panel-wallet" aria-labelledby="wallet-tab-wallet">
        <Flex direction={{ base: 'column', lg: 'row' }} gap={{ base: 6, md: 8 }} align="stretch">
          <Flex direction="column" flex="1" bg="#151515" border="1px solid #2b2b2b" rounded="2xl" p={{ base: 5, md: 7 }}>
            <Text color="whiteAlpha.600">Available balance</Text>
            <Heading fontSize={{ base: '4xl', md: '6xl' }} mt={2}>{balance?.available ?? 0}</Heading>
            <Text color="whiteAlpha.500" mt={1}>points</Text>
            <Flex gap={8} mt={8} wrap="wrap">
              <Box><Text color="whiteAlpha.500" fontSize="sm">Locked</Text><Text fontSize="xl">{balance?.locked ?? 0}</Text></Box>
              <Box><Text color="whiteAlpha.500" fontSize="sm">Pending</Text><Text fontSize="xl">{balance?.pending ?? 0}</Text></Box>
              <Box><Text color="whiteAlpha.500" fontSize="sm">Total</Text><Text fontSize="xl">{balance?.total ?? 0}</Text></Box>
            </Flex>
            <Box mt="auto" pt={8}>
              <Button
                type="button"
                onClick={() => { setPurchaseFeedback(null); setBuyOpen(true) }}
                disabled={purchaseSettings?.enabled !== true}
                bg="#f47742"
                color="white"
                rounded="full"
                px={7}
                h="52px"
                w={{ base: 'full', sm: 'auto' }}
                _hover={{ bg: '#e06a39' }}
              >
                Buy points
              </Button>
              {!purchaseSettings && <Text mt={3} color="whiteAlpha.500" fontSize="sm">Checking whether points are on sale…</Text>}
              {purchaseSettings?.enabled === false && <Text mt={3} color="orange.200" fontSize="sm">Point purchases are closed right now.</Text>}
              {purchaseFeedback && !buyOpen && (
                <Text mt={3} fontSize="sm" color={purchaseFeedback.type === 'error' ? 'red.200' : 'green.200'}>{purchaseFeedback.message}</Text>
              )}
            </Box>
          </Flex>

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
            {transferFeedback && <Text mt={4} color={transferFeedback.type === 'error' ? 'red.200' : 'green.200'}>{transferFeedback.message}</Text>}
          </Box>
        </Flex>
        </Box>
        )}

        {activeTab === 'history' && (
          <Box role="tabpanel" id="wallet-panel-history" aria-labelledby="wallet-tab-history" border="1px solid #292929" rounded="2xl" overflow="hidden">
            {loading && transactions.length === 0 ? (
              <Flex p={6} gap={3} align="center"><Spinner color="#f47742" size="sm" /><Text color="whiteAlpha.500">Loading your transactions…</Text></Flex>
            ) : transactions.length === 0 ? (
              <Box p={{ base: 6, md: 8 }}>
                <Text fontWeight="semibold">Nothing here yet</Text>
                <Text color="whiteAlpha.500" mt={1}>Points you earn, buy, or send will show up here.</Text>
              </Box>
            ) : transactions.map((item) => {
              const incoming = item.receiverWalletId === firebaseUser?.uid
              return (
                <Flex key={item.id} px={{ base: 4, md: 6 }} py={4} gap={4} align="center" justify="space-between" borderBottom="1px solid #222" _last={{ borderBottom: 0 }}>
                  <Box minW={0}>
                    <Text fontWeight="semibold" textTransform="capitalize">{item.type.replaceAll('_', ' ')}</Text>
                    <Text color="whiteAlpha.500" fontSize="sm">{formatDate(item.createdAt)}</Text>
                  </Box>
                  <Text fontWeight="bold" flexShrink={0} color={incoming ? 'green.300' : 'white'}>
                    {incoming ? '+' : '-'}{item.amount}
                  </Text>
                </Flex>
              )
            })}
          </Box>
        )}
      </Box>
      <BuyPointsModal
        isOpen={buyOpen}
        onClose={() => setBuyOpen(false)}
        amount={purchaseAmount}
        onAmountChange={setPurchaseAmount}
        phone={phone}
        onPhoneChange={setPhone}
        operator={operator}
        onOperatorChange={setOperator}
        settings={purchaseSettings}
        previewPoints={previewPoints}
        purchasing={purchasing}
        feedback={purchaseFeedback}
        onSubmit={handlePurchase}
      />

      <style>{`.wallet-input{width:100%;height:52px;padding:0 16px;border:1px solid #333;border-radius:12px;background:#0d0d0d;color:white;outline:none}.wallet-input:focus{border-color:#f47742}`}</style>
    </Box>
  )
}
