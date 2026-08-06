import { useEffect, useState, type FormEvent } from 'react'
import { Box, Button, Flex, Heading, Text } from '@chakra-ui/react'
import { doc, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { db, functions } from '../../../lib/config'

interface EconomyForm {
  economyEnabled: boolean
  maintenanceMode: boolean
  transfersEnabled: boolean
  pointPurchasesEnabled: boolean
  tradingEnabled: boolean
  pointsPerZmw: string
  minPurchaseNgwee: string
  maxPurchaseNgwee: string
  maxTransferPoints: string
  dailyTransferLimitPoints: string
  tradeFeeBasisPoints: string
  rewardMultiplierBasisPoints: string
  escrowTimeoutHours: string
}

const defaults: EconomyForm = {
  economyEnabled: false, maintenanceMode: true, transfersEnabled: false,
  pointPurchasesEnabled: false, tradingEnabled: false, pointsPerZmw: '',
  minPurchaseNgwee: '', maxPurchaseNgwee: '', maxTransferPoints: '',
  dailyTransferLimitPoints: '', tradeFeeBasisPoints: '500',
  rewardMultiplierBasisPoints: '10000', escrowTimeoutHours: '168',
}

export default function Economy() {
  const [form, setForm] = useState(defaults)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    void getDoc(doc(db, 'settings', 'economy')).then((snapshot) => {
      if (!snapshot.exists()) return
      const data = snapshot.data()
      setForm({
        economyEnabled: data.economyEnabled === true,
        maintenanceMode: data.maintenanceMode !== false,
        transfersEnabled: data.transfersEnabled === true,
        pointPurchasesEnabled: data.pointPurchasesEnabled === true,
        tradingEnabled: data.tradingEnabled === true,
        pointsPerZmw: data.pointsPerZmw?.toString() ?? '',
        minPurchaseNgwee: data.minPurchaseNgwee?.toString() ?? '',
        maxPurchaseNgwee: data.maxPurchaseNgwee?.toString() ?? '',
        maxTransferPoints: data.maxTransferPoints?.toString() ?? '',
        dailyTransferLimitPoints: data.dailyTransferLimitPoints?.toString() ?? '',
        tradeFeeBasisPoints: data.tradeFeeBasisPoints?.toString() ?? '500',
        rewardMultiplierBasisPoints: data.rewardMultiplierBasisPoints?.toString() ?? '10000',
        escrowTimeoutHours: data.escrowTimeoutHours?.toString() ?? '168',
      })
    })
  }, [])

  function numberOrNull(value: string) { return value.trim() ? Number(value) : null }
  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFeedback(null)
    try {
      const update = httpsCallable(functions, 'updateEconomySettings')
      await update({
        ...form,
        pointsPerZmw: numberOrNull(form.pointsPerZmw),
        minPurchaseNgwee: numberOrNull(form.minPurchaseNgwee),
        maxPurchaseNgwee: numberOrNull(form.maxPurchaseNgwee),
        maxTransferPoints: numberOrNull(form.maxTransferPoints),
        dailyTransferLimitPoints: numberOrNull(form.dailyTransferLimitPoints),
        tradeFeeBasisPoints: Number(form.tradeFeeBasisPoints),
        rewardMultiplierBasisPoints: Number(form.rewardMultiplierBasisPoints),
        escrowTimeoutHours: Number(form.escrowTimeoutHours),
      })
      setFeedback('Economy settings saved.')
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Settings could not be saved.')
    } finally { setSaving(false) }
  }

  const toggles: Array<[keyof EconomyForm, string, string]> = [
    ['economyEnabled', 'Economy enabled', 'Master switch for all point operations.'],
    ['maintenanceMode', 'Maintenance mode', 'Blocks member economy actions while administrators investigate.'],
    ['transfersEnabled', 'Peer transfers', 'Allow members to send points without a fee.'],
    ['pointPurchasesEnabled', 'Point purchases', 'Requires conversion rate and purchase limits.'],
    ['tradingEnabled', 'Commercial trading', 'Enables marketplace and escrow workflows.'],
  ]
  const fields: Array<[keyof EconomyForm, string, string]> = [
    ['pointsPerZmw', 'Points per ZMW', 'Must be explicitly configured before purchases can open.'],
    ['minPurchaseNgwee', 'Minimum purchase (ngwee)', '100 ngwee = ZMW 1.'],
    ['maxPurchaseNgwee', 'Maximum purchase (ngwee)', 'Hard limit for one payment.'],
    ['maxTransferPoints', 'Maximum peer transfer', 'Maximum points in one transfer.'],
    ['dailyTransferLimitPoints', 'Daily peer transfer limit', 'Atomic per-member daily cap.'],
    ['tradeFeeBasisPoints', 'Commercial fee (basis points)', '500 basis points = 5%.'],
    ['rewardMultiplierBasisPoints', 'Quest reward multiplier', '10000 basis points = 1× rewards.'],
    ['escrowTimeoutHours', 'Escrow timeout (hours)', 'Unaccepted funded trades refund after this period.'],
  ]

  return (
    <AdminLayout>
      <Box px={{ base: 4, md: 8, xl: 12 }} py={{ base: 6, md: 8 }}>
        <Box as="form" onSubmit={submit}>
          <Box mb={8}>
            <Heading as="h1" color="white" size="lg">Economy controls</Heading>
            <Text color="whiteAlpha.600" mt={2}>Fail-closed controls for points, payments, transfers and trading.</Text>
          </Box>

          <Box bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" rounded="2xl" p={{ base: 5, md: 7 }} mb={6}>
            {toggles.map(([key, label, help]) => <Flex key={key} justify="space-between" align="center" gap={6} py={4} borderBottom="1px solid" borderColor="whiteAlpha.100" _first={{ pt: 0 }} _last={{ borderBottom: 0, pb: 0 }}>
              <Box><Text color="white" fontWeight="semibold">{label}</Text><Text color="whiteAlpha.500" fontSize="sm" mt={1}>{help}</Text></Box>
              <input className="economy-checkbox" type="checkbox" checked={Boolean(form[key])} onChange={(event) => setForm({ ...form, [key]: event.currentTarget.checked })} />
            </Flex>)}
          </Box>

          <Box display="grid" gridTemplateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={{ base: 5, md: 6 }} bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" rounded="2xl" p={{ base: 5, md: 7 }}>
            {fields.map(([key, label, help]) => <Box as="label" key={key}><Text color="white" fontWeight="medium" mb={2}>{label}</Text><input className="economy-input" type="number" min="0" step="1" value={String(form[key])} onChange={(event) => setForm({ ...form, [key]: event.currentTarget.value })} /><Text color="whiteAlpha.400" fontSize="xs" mt={2}>{help}</Text></Box>)}
          </Box>

          <Flex mt={6} align={{ base: 'stretch', sm: 'center' }} direction={{ base: 'column', sm: 'row' }} gap={4}>
            <Button type="submit" h="44px" bg="#f47742" color="white" rounded="full" px={8} disabled={saving} alignSelf={{ base: 'stretch', sm: 'flex-start' }}>{saving ? 'Saving…' : 'Save controls'}</Button>
            {feedback && <Text color="whiteAlpha.700">{feedback}</Text>}
          </Flex>
          <style>{`.economy-input{width:100%;height:52px;padding:0 16px;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:#09090b;color:white;outline:none}.economy-input:focus{border-color:#f47742}.economy-checkbox{width:22px;height:22px;accent-color:#f47742;flex:none}`}</style>
        </Box>
      </Box>
    </AdminLayout>
  )
}
