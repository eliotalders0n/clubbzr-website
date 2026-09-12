const { randomUUID } = require('node:crypto')

function emulatorOnly() {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST || !String(process.env.GCLOUD_PROJECT || '').startsWith('demo-')) throw new Error('Store fixtures require a demo project and Firestore/Storage emulators. Never use production.')
}
const actor = (uid, isAdmin = false) => ({ uid, email: `${uid}@store.test`, admin: isAdmin, curator: false })
const buyer = actor('store_buyer')
const seller = actor('store_seller')
const adminActor = actor('store_admin', true)
const outsider = actor('store_outsider')
async function seedBase() {
  emulatorOnly()
  const { admin, db } = require('../lib/core/firebase.js')
  const { STORE_DEFAULTS } = require('../lib/store/policy.js')
  const { DISABLED_ECONOMY_SETTINGS } = require('../lib/core/settings.js')
  const { postLedgerTransaction } = require('../lib/wallet/ledger.js')
  const { deterministicId } = require('../lib/core/idempotency.js')
  for (const a of [buyer, seller, adminActor, outsider]) {
    await db.collection('users').doc(a.uid).set({ uid: a.uid, displayName: a.uid === seller.uid ? 'Lusaka Studio' : a.uid, email: a.email, isActive: true, accountStatus: 'active', role: a.admin ? 'admin' : 'user', isOnboarded: true })
    await db.collection('wallets').doc(a.uid).set({ userId: a.uid, status: 'active', currency: 'POINT' })
    await postLedgerTransaction({ transactionId: deterministicId('fixture_credit', a.uid, 'initial'), type: 'admin_credit', status: 'completed', senderWalletId: null, receiverWalletId: a.uid, participants: [a.uid], amount: 100000, fee: 0, referenceType: 'fixture', referenceId: a.uid, createdBy: adminActor.uid, idempotencyKey: 'initial_seed', entries: [{ accountId: '__system_fixture', bucket: 'available', amount: -100000 }, { accountId: a.uid, bucket: 'available', amount: 100000 }] })
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      try { await admin.auth().createUser({ uid: a.uid, email: a.email, password: 'StoreDemo123!', emailVerified: true }) } catch (error) { if (error.code !== 'auth/uid-already-exists' && error.code !== 'auth/email-already-exists') throw error }
      await admin.auth().setCustomUserClaims(a.uid, a.admin ? { admin: true } : {})
    }
  }
  await db.collection('storeSellerProfiles').doc(seller.uid).set({ sellerId: seller.uid, displayName: 'Lusaka Studio', photoURL: '', description: 'Independent art from Lusaka.', available: true, verified: false, createdAt: admin.firestore.Timestamp.now() })
  await db.collection('settings').doc('store').set({ ...STORE_DEFAULTS, storeEnabled: true, physicalProductsEnabled: true, gatedCollectionsEnabled: true })
  await db.collection('settings').doc('economy').set({ ...DISABLED_ECONOMY_SETTINGS, economyEnabled: true, maintenanceMode: false, tradingEnabled: true })
  return { admin, db }
}
async function asset(ownerId = seller.uid) {
  emulatorOnly()
  const { admin } = require('../lib/core/firebase.js')
  const path = `store-private/${ownerId}/${randomUUID()}`
  const file = admin.storage().bucket().file(path)
  await file.save(Buffer.from('Store emulator protected test resource'), { metadata: { contentType: 'application/pdf' } })
  const [m] = await file.getMetadata()
  return { path, generation: String(m.generation), name: 'Artist-guide.pdf', contentType: 'application/pdf', size: Number(m.size) }
}
async function makeListing(kind = 'digital_release', overrides = {}, publish = true) {
  const { saveListing, moderateListing } = require('../lib/store/catalog.js')
  const { db } = require('../lib/core/firebase.js')
  const files = ['digital_release', 'gated_collection'].includes(kind) ? [await asset()] : []
  const input = {
    id: randomUUID(), productType: kind, title: `${kind.replaceAll('_', ' ')} by Lusaka Studio`, description: 'A carefully made original release from the Club BZR community, with a clear licence and private delivery.', coverImage: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=1000', images: [], tags: ['lusaka', 'art'], acceptedPaymentMethods: ['POINT', 'ZMW'], priceNgwee: 10000, pricePoints: 1000, inventory: kind === 'physical_original' ? 1 : null, licenceKind: 'personal', downloadLimit: null, promoteOnPublish: true, assets: files,
    fulfilment: { estimatedDays: 7, revisionRounds: 1, questions: [], addOns: [], dimensions: '40 x 60 cm', materials: 'Oil on canvas', condition: 'New original artwork', oneOfOne: kind === 'physical_original', framed: false, weightGrams: 1500, pickup: true, deliveryOptions: [{ region: 'Lusaka', priceNgwee: 2000, pricePoints: 200 }] }, ...overrides,
  }
  const saved = await saveListing(seller, input)
  if (publish) {
    await moderateListing(seller, { listingId: saved.listingId, action: 'submit' })
    await moderateListing(adminActor, { listingId: saved.listingId, action: 'approve', reason: 'Reviewed emulator listing and licence.' })
  }
  const snap = await db.collection('storeListings').doc(saved.listingId).get()
  return { id: snap.id, ...snap.data(), input }
}
const checkoutInput = (l, extra = {}) => ({ listingId: l.id, listingVersion: l.version, paymentRail: 'POINT', addOnIds: [], brief: {}, delivery: l.productType === 'physical_original' ? { recipient: 'Demo Buyer', phone: '0971234567', region: 'pickup', address: 'Arrange Lusaka studio collection', instructions: '' } : null, termsAccepted: true, idempotencyKey: randomUUID(), ...extra })
module.exports = { emulatorOnly, buyer, seller, adminActor, outsider, actor, seedBase, asset, makeListing, checkoutInput }
