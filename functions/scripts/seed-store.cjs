// Explicitly opt into local emulators. No production credentials or writes.
process.env.GCLOUD_PROJECT ||= 'demo-clubbzr-store'
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080'
process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= '127.0.0.1:9199'
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099'
process.env.FIREBASE_CONFIG ||= JSON.stringify({ projectId: process.env.GCLOUD_PROJECT, storageBucket: `${process.env.GCLOUD_PROJECT}.appspot.com` })
const { seedBase, makeListing, buyer, adminActor, checkoutInput } = require('../test/storeFixtures.cjs')
const { checkout } = require('../lib/store/orders.js')
const { moderateListing } = require('../lib/store/catalog.js')
async function main() {
  await seedBase()
  for (const kind of ['digital_release', 'bespoke_request', 'physical_original', 'gated_collection']) {
    const listing = await makeListing(kind)
    const order = await checkout(buyer, checkoutInput(listing))
    if (kind === 'digital_release') await moderateListing(adminActor, { listingId: listing.id, action: 'feature', reason: 'Feature the demo digital release in the Store.' })
    console.log(`${kind}: listing ${listing.id}; order ${order.orderId}`)
  }
  console.log('Local demo accounts: store_buyer@store.test, store_seller@store.test, store_admin@store.test. Password: StoreDemo123!')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
