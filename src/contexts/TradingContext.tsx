/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'

import { db } from '../../lib/config'
import { tradingApi } from '../../lib/trading'
import { useAuth } from './AuthContext'

export interface TradeRecord {
  id: string
  buyerId: string
  sellerId: string
  participants: string[]
  kind: string
  amount: number
  fee: number
  status: string
  createdAt?: unknown
}

const TradingContext = createContext<{ trades: TradeRecord[]; loading: boolean; api: typeof tradingApi } | undefined>(undefined)

export function TradingProvider({ children }: { children: ReactNode }) {
  const { firebaseUser } = useAuth()
  const [trades, setTrades] = useState<TradeRecord[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!firebaseUser) return
    return onSnapshot(query(collection(db, 'trades'), where('participants', 'array-contains', firebaseUser.uid), orderBy('createdAt', 'desc'), limit(50)), (snapshot) => {
      setTrades(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as TradeRecord)))
      setLoading(false)
    }, () => setLoading(false))
  }, [firebaseUser])
  const value = useMemo(() => ({
    trades: firebaseUser ? trades : [],
    loading: firebaseUser ? loading : false,
    api: tradingApi,
  }), [firebaseUser, loading, trades])
  return <TradingContext.Provider value={value}>{children}</TradingContext.Provider>
}

export function useTrading() {
  const context = useContext(TradingContext)
  if (!context) throw new Error('useTrading must be used within TradingProvider')
  return context
}
