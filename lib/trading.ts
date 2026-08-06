import { httpsCallable } from 'firebase/functions'
import { functions } from './config'

type TradeActionResponse = { success: boolean; tradeId: string; status: string }

const invoke = <Input, Output>(name: string, input: Input) =>
  httpsCallable<Input, Output>(functions, name)(input).then((result) => result.data)

export const tradingApi = {
  create: (input: { sellerId: string; kind: 'commission' | 'digital_download' | 'marketplace_purchase'; referenceId: string; amount: number; idempotencyKey: string }) => invoke<typeof input, TradeActionResponse & { fee: number }>('createTrade', input),
  accept: (tradeId: string) => invoke<{ tradeId: string }, TradeActionResponse>('acceptTrade', { tradeId }),
  deliver: (tradeId: string) => invoke<{ tradeId: string }, TradeActionResponse>('markTradeDelivered', { tradeId }),
  complete: (tradeId: string) => invoke<{ tradeId: string }, TradeActionResponse>('completeTrade', { tradeId }),
  cancel: (tradeId: string) => invoke<{ tradeId: string }, TradeActionResponse>('cancelTrade', { tradeId }),
  dispute: (tradeId: string, reason: string) => invoke<{ tradeId: string; reason: string }, TradeActionResponse>('disputeTrade', { tradeId, reason }),
}
