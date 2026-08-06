/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  getWalletSummary,
  getWalletTransactions,
  transferPoints as sendPoints,
  type WalletSummary,
  type WalletTransaction,
} from '../../lib/economy'
import { useAuth } from './AuthContext'

interface WalletContextValue {
  summary: WalletSummary | null
  transactions: WalletTransaction[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  transfer: (recipientId: string, amount: number) => Promise<void>
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined)

export function WalletProvider({ children }: { children: ReactNode }) {
  const { firebaseUser } = useAuth()
  const [summary, setSummary] = useState<WalletSummary | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!firebaseUser) {
      setSummary(null)
      setTransactions([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [nextSummary, nextTransactions] = await Promise.all([
        getWalletSummary(),
        getWalletTransactions(),
      ])
      setSummary(nextSummary)
      setTransactions(nextTransactions)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Wallet could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [firebaseUser])

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(timer)
  }, [refresh])

  const transfer = useCallback(async (recipientId: string, amount: number) => {
    const idempotencyKey = crypto.randomUUID()
    await sendPoints({ recipientId, amount, idempotencyKey })
    await refresh()
  }, [refresh])

  const value = useMemo(() => ({
    summary,
    transactions,
    loading,
    error,
    refresh,
    transfer,
  }), [summary, transactions, loading, error, refresh, transfer])

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext)
  if (!context) throw new Error('useWallet must be used within WalletProvider')
  return context
}
