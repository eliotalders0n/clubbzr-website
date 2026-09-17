import { httpsCallable } from 'firebase/functions'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { functions, storage } from './config'
import type { StoreAsset, StoreSettings, PaymentRail } from './schema'
export type { StoreListing, StoreOrder, StoreAsset, StoreSettings, ProductType, PaymentRail, PriceSnapshot, CheckoutInput } from './schema'

export type StoreConfig = StoreSettings & { feeBasisPoints: number; pointsCheckoutEnabled: boolean; zmwCheckoutAvailable?: boolean; sellerPayoutsAvailable?: boolean }
export type StoreCursor = { id: string; value: number } | null
export const storeCall = <T>(name: string, input: unknown = {}) =>
  httpsCallable<unknown, T>(functions, name)(input).then((result) => result.data)
export const storeKey = () => crypto.randomUUID()
// Every Store release is published by Club BZR, so listings credit the house
// shop rather than the administrator who created them.
export const STORE_SHOP_NAME = 'Club BZR'

export const storeLabels = {
  digital_release: 'Digital', bespoke_request: 'Bespoke', physical_original: 'Physical', gated_collection: 'Collections',
}
export const storeAmount = (value: number, rail: PaymentRail) => rail === 'POINT'
  ? `${value.toLocaleString()} Points`
  : `ZMW ${Math.floor(value / 100).toLocaleString()}.${String(value % 100).padStart(2, '0')}`
export function parseStorePrice(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error('Enter a price with no more than two decimal places.')
  const [whole, fraction = ''] = value.split('.')
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(result)) throw new Error('Price is too large.')
  return result
}
export async function uploadStoreFile(file: File, orderId?: string): Promise<StoreAsset> {
  const contentType = file.type || 'application/octet-stream'
  const access = await storeCall<{ path: string; uploadUrl: string; headers: Record<string, string> }>('createStoreUpload', { contentType, size: file.size, ...(orderId ? { orderId } : {}) })
  const result = await fetch(access.uploadUrl, { method: 'PUT', headers: access.headers, body: file })
  if (!result.ok) throw new Error('File upload failed. Try again.')
  return { path: access.path, generation: '', name: file.name, size: file.size, contentType }
}
export async function uploadStoreCover(file: File, uid: string): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size >= 10 * 1024 * 1024) throw new Error('Choose a JPG, PNG or WebP image smaller than 10 MB.')
  const object = ref(storage, `store-previews/${uid}/${storeKey()}`)
  await uploadBytes(object, file)
  return getDownloadURL(object)
}
