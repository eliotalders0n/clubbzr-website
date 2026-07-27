import { httpsCallable } from 'firebase/functions';

import { functions } from './config';

export interface AdminSendSessionConfirmationWhatsAppInput {
  registrationId: string;
  force?: boolean;
}

export interface AdminSendSessionConfirmationWhatsAppResponse {
  status: 'sent' | 'skipped' | 'failed';
  messageId?: string | null;
  reason?: string;
}

const sendSessionConfirmationWhatsAppFn = httpsCallable<
  AdminSendSessionConfirmationWhatsAppInput,
  AdminSendSessionConfirmationWhatsAppResponse
>(functions, 'adminSendSessionConfirmationWhatsApp');

export async function sendSessionConfirmationWhatsApp(
  input: AdminSendSessionConfirmationWhatsAppInput
) {
  const result = await sendSessionConfirmationWhatsAppFn(input);
  return result.data;
}
