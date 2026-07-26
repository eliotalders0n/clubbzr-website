import { httpsCallable } from 'firebase/functions';

import { functions } from './config';

export type MobileMoneyOperator = 'mtn' | 'airtel' | 'zamtel';
export type MobileMoneyStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ChargeSessionMobileMoneyInput {
  sessionId: string;
  registrationId: string;
  phone: string;
  operator: MobileMoneyOperator;
  currency?: string;
}

export interface SessionMobileMoneyResponse {
  success: boolean;
  transactionId: string;
  reference: string;
  status: MobileMoneyStatus;
  message: string;
  failureReason?: string | null;
}

const chargeSessionMobileMoneyFn = httpsCallable<
  ChargeSessionMobileMoneyInput,
  SessionMobileMoneyResponse
>(functions, 'chargeSessionMobileMoney');

const checkSessionMomoStatusFn = httpsCallable<
  { transactionId?: string; reference?: string },
  SessionMobileMoneyResponse
>(functions, 'checkSessionMomoStatus');

export async function chargeSessionMobileMoney(input: ChargeSessionMobileMoneyInput) {
  const result = await chargeSessionMobileMoneyFn(input);
  return result.data;
}

export async function checkSessionMomoStatus(input: {
  transactionId?: string;
  reference?: string;
}) {
  const result = await checkSessionMomoStatusFn(input);
  return result.data;
}
