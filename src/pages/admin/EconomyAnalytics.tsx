import { useEffect, useState } from 'react'
import { Box, Flex, Heading, SimpleGrid, Text } from '@chakra-ui/react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { db } from '../../../lib/config'

interface DailyAnalytics {
  id: string
  date: string
  transactions?: { count?: number; volume?: number; fees?: number }
  payments?: { count?: number; revenueNgwee?: number }
  questCompletions?: number
}

interface FraudAlert { id: string; reasons: string[]; riskScore: number; status: string; transactionId: string }

export default function EconomyAnalytics() {
  const [daily, setDaily] = useState<DailyAnalytics | null>(null)
  const [alerts, setAlerts] = useState<FraudAlert[]>([])
  useEffect(() => {
    const timer = window.setTimeout(() => void Promise.all([
      getDocs(query(collection(db, 'analytics'), orderBy('date', 'desc'), limit(1))),
      getDocs(query(collection(db, 'fraudAlerts'), orderBy('createdAt', 'desc'), limit(25))),
    ]).then(([analytics, fraud]) => {
      const latest = analytics.docs[0]
      setDaily(latest ? { id: latest.id, ...latest.data() } as DailyAnalytics : null)
      setAlerts(fraud.docs.map((item) => ({ id: item.id, ...item.data() } as FraudAlert)))
    }), 0)
    return () => window.clearTimeout(timer)
  }, [])
  const cards = [
    ['Point volume', daily?.transactions?.volume ?? 0],
    ['Transactions', daily?.transactions?.count ?? 0],
    ['Fees earned', daily?.transactions?.fees ?? 0],
    ['ZMW revenue', ((daily?.payments?.revenueNgwee ?? 0) / 100).toFixed(2)],
    ['Point purchases', daily?.payments?.count ?? 0],
    ['Quest completions', daily?.questCompletions ?? 0],
  ]
  return (
    <AdminLayout>
      <Box px={{ base: 4, md: 8, xl: 12 }} py={{ base: 6, md: 8 }}>
        <Box mb={8}>
          <Heading as="h1" color="white" size="lg">Economy analytics</Heading>
          <Text color="whiteAlpha.600" mt={2}>Daily operational metrics and review signals{daily?.date ? ` for ${daily.date}` : ''}.</Text>
        </Box>

        <SimpleGrid columns={{ base: 2, lg: 3 }} gap={4}>
          {cards.map(([label, value]) => <Box key={label} bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" rounded="xl" p={{ base: 4, md: 5 }}><Text color="white" fontSize={{ base: '2xl', md: '3xl' }} fontWeight="bold">{value}</Text><Text color="whiteAlpha.500" fontSize="xs" mt={1}>{label}</Text></Box>)}
        </SimpleGrid>

        <Heading color="white" size="md" mt={10} mb={4}>Fraud review queue</Heading>
        <Box border="1px solid" borderColor="whiteAlpha.100" rounded="2xl" overflow="hidden">
          {!alerts.length ? <Text p={6} color="whiteAlpha.500">No open risk signals.</Text> : alerts.map((alert) => <Flex key={alert.id} justify="space-between" align="center" gap={4} p={{ base: 4, md: 5 }} borderBottom="1px solid" borderColor="whiteAlpha.100"><Box minW={0}><Text color="white">{alert.reasons.join(', ').replaceAll('_', ' ')}</Text><Text color="whiteAlpha.400" fontSize="xs" truncate>{alert.transactionId}</Text></Box><Text color="orange.300" flexShrink={0}>Risk {alert.riskScore}</Text></Flex>)}
        </Box>
      </Box>
    </AdminLayout>
  )
}
