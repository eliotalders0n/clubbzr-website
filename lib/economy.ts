import { httpsCallable } from 'firebase/functions'

import { functions } from './config'

export interface WalletBalance {
  walletId: string
  available: number
  locked: number
  pending: number
  total: number
  ledgerSequence: number
}

export interface WalletSummary {
  wallet: null | {
    id: string
    userId: string
    status: 'active' | 'frozen' | 'closed'
    currency: 'POINT'
  }
  balance: WalletBalance
}

export interface WalletTransaction {
  id: string
  type: string
  status: string
  senderWalletId: string | null
  receiverWalletId: string | null
  amount: number
  fee: number
  referenceType: string
  createdAt?: { seconds: number; nanoseconds: number }
}

const getWalletSummaryFn = httpsCallable<Record<string, never>, WalletSummary>(
  functions,
  'getWalletSummary',
)
const getWalletTransactionsFn = httpsCallable<
  { limit?: number },
  { transactions: WalletTransaction[] }
>(functions, 'getWalletTransactions')
const transferPointsFn = httpsCallable<
  { recipientId: string; amount: number; idempotencyKey: string },
  { transactionId: string; duplicate: boolean; amount: number; fee: number }
>(functions, 'transferPoints')
const initiatePointPurchaseFn = httpsCallable<
  { amountNgwee: number; phone: string; operator: string; idempotencyKey: string },
  { paymentId: string; status: string; points: number }
>(functions, 'initiatePointPurchase')
const checkPointPurchaseStatusFn = httpsCallable<
  { paymentId: string },
  { paymentId: string; status: string; points: number }
>(functions, 'checkPointPurchaseStatus')

export async function getWalletSummary(): Promise<WalletSummary> {
  return (await getWalletSummaryFn({})).data
}

export async function getWalletTransactions(limit = 30): Promise<WalletTransaction[]> {
  return (await getWalletTransactionsFn({ limit })).data.transactions
}

export async function transferPoints(input: {
  recipientId: string
  amount: number
  idempotencyKey: string
}) {
  return (await transferPointsFn(input)).data
}

export async function initiatePointPurchase(input: {
  amountNgwee: number
  phone: string
  operator: 'mtn' | 'airtel' | 'zamtel'
  idempotencyKey: string
}) {
  return (await initiatePointPurchaseFn(input)).data
}

export async function checkPointPurchaseStatus(paymentId: string) {
  return (await checkPointPurchaseStatusFn({ paymentId })).data
}
