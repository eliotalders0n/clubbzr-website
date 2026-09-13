/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  getWalletSummary,
  getWalletTransactions,
  transferPoints as sendPoints,
  type WalletSummary,
  type WalletTransaction,
} from '../../lib/economy'
import { useRealtime } from '@/hooks/useFirestore'
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

  // The summary callable is fetched once when the provider mounts, so a
  // balance that changes afterwards (a reward, a purchase, another device)
  // would leave the wallet showing a stale figure while the passport, which
  // subscribes to the same document, shows the current one. Follow the
  // balance live and pull fresh transactions whenever the ledger advances.
  const { data: liveBalance } = useRealtime('balances', firebaseUser?.uid, {
    skip: !firebaseUser?.uid,
  })
  const ledgerSequence = liveBalance?.ledgerSequence
  useEffect(() => {
    if (ledgerSequence === undefined) return
    let cancelled = false
    void getWalletTransactions()
      .then((next) => { if (!cancelled) setTransactions(next) })
      .catch(() => { /* the balance is still correct; history retries on refresh */ })
    return () => { cancelled = true }
  }, [ledgerSequence])

  const transfer = useCallback(async (recipientId: string, amount: number) => {
    const idempotencyKey = crypto.randomUUID()
    await sendPoints({ recipientId, amount, idempotencyKey })
    await refresh()
  }, [refresh])

  const liveSummary = useMemo<WalletSummary | null>(() => {
    if (!summary) return null
    if (!liveBalance) return summary
    return {
      ...summary,
      balance: {
        ...summary.balance,
        walletId: liveBalance.walletId ?? summary.balance.walletId,
        available: liveBalance.available,
        locked: liveBalance.locked,
        pending: liveBalance.pending,
        total: liveBalance.total,
        ledgerSequence: liveBalance.ledgerSequence,
      },
    }
  }, [summary, liveBalance])

  const value = useMemo(() => ({
    summary: liveSummary,
    transactions,
    loading,
    error,
    refresh,
    transfer,
  }), [liveSummary, transactions, loading, error, refresh, transfer])

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext)
  if (!context) throw new Error('useWallet must be used within WalletProvider')
  return context
}
