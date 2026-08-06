import { httpsCallable } from 'firebase/functions'
import { functions } from './config'

const recordDailyLoginFn = httpsCallable<Record<string, never>, { success: boolean; day: string }>(
  functions,
  'recordDailyLogin',
)

export async function recordDailyLogin() {
  return (await recordDailyLoginFn({})).data
}
