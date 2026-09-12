const test = require('node:test')
const assert = require('node:assert/strict')
const { createHmac, createHash } = require('node:crypto')
const { calculateCommercialFee } = require('../lib/core/economyMath.js')
const { quote, decimalToNgwee, ngweeToDecimal, requireCapability, STORE_DEFAULTS, validateBrief, discoveryKeys } = require('../lib/store/policy.js')
const { nextState } = require('../lib/store/orders.js')
const { validWebhookSignature } = require('../lib/payments/lenco.js')

const listing = {
  title: 'Portrait brushes', sellerName: 'Zambian Artist', tags: ['painting'], productType: 'bespoke_request',
  acceptedPaymentMethods: ['POINT', 'ZMW'], pricePoints: 1000, priceNgwee: 10000,
  fulfilment: { addOns: [{ id: 'extra', priceNgwee: 1000, pricePoints: 100 }], questions: [], deliveryOptions: [{ region: 'Lusaka', priceNgwee: 2000, pricePoints: 200 }], pickup: true, revisionRounds: 1 },
}
test('both rails use the same fee policy without converting artist prices', () => {
  for (const paymentRail of ['POINT', 'ZMW']) {
    const result = quote(listing, { paymentRail, addOnIds: ['extra'] }, 500)
    assert.equal(result.platformFee, paymentRail === 'POINT' ? 55 : 550)
    assert.equal(result.sellerPayable, paymentRail === 'POINT' ? 1045 : 10450)
    assert.equal(result.buyerTotal, result.platformFee + result.sellerPayable)
  }
})
test('delivery is allocated to seller without a platform fee', () => {
  const result = quote({ ...listing, productType: 'physical_original' }, { paymentRail: 'ZMW', addOnIds: [], delivery: { region: 'Lusaka' } }, 500)
  assert.equal(result.platformFee, 500)
  assert.equal(result.deliveryCharge, 2000)
  assert.equal(result.buyerTotal, 12000)
  assert.equal(result.sellerPayable, 11500)
})
test('fee calculations are exact for safe integers and round down', () => {
  assert.equal(calculateCommercialFee(Number.MAX_SAFE_INTEGER, 2000), Number(BigInt(Number.MAX_SAFE_INTEGER) * 2000n / 10000n))
  assert.equal(calculateCommercialFee(19, 500), 0)
  assert.throws(() => quote(listing, { paymentRail: 'POINT', addOnIds: [] }, 2001))
})
test('invalid currency, duplicate extras and unsupported delivery fail closed', () => {
  assert.throws(() => quote(listing, { paymentRail: 'USD', addOnIds: [] }, 500))
  assert.throws(() => quote(listing, { paymentRail: 'POINT', addOnIds: ['extra', 'extra'] }, 500))
  assert.throws(() => quote(listing, { paymentRail: 'POINT', addOnIds: ['invented'] }, 500))
  assert.throws(() => quote({ ...listing, productType: 'physical_original' }, { paymentRail: 'POINT', addOnIds: [], delivery: { region: 'France' } }, 500))
})
test('decimal provider amounts are parsed without floating point multiplication', () => {
  assert.equal(decimalToNgwee('123.45'), 12345)
  assert.equal(decimalToNgwee('0.29'), 29)
  assert.equal(ngweeToDecimal(12345), '123.45')
  for (const value of ['1e5', '-1', '0.001', 'NaN', '1.2345']) assert.throws(() => decimalToNgwee(value))
})
test('disabled and missing capabilities reject new purchases', () => {
  assert.throws(() => requireCapability(STORE_DEFAULTS))
  assert.throws(() => requireCapability({ ...STORE_DEFAULTS, storeEnabled: true }, 'physical_original'))
  assert.throws(() => requireCapability({ ...STORE_DEFAULTS, storeEnabled: true }, 'gated_collection'))
  assert.throws(() => requireCapability({ ...STORE_DEFAULTS, storeEnabled: true }, 'digital_release', 'ZMW'))
})
test('required brief answers and choice membership are validated', () => {
  const l = { ...listing, fulfilment: { ...listing.fulfilment, questions: [{ id: 'style', label: 'Style', type: 'single_choice', required: true, options: ['ink', 'oil'] }] } }
  assert.throws(() => validateBrief(l, {}))
  assert.throws(() => validateBrief(l, { style: 'invented' }))
  assert.deepEqual(validateBrief(l, { style: 'ink', injectedPrice: '1' }), { style: 'ink' })
})
test('discovery stores bounded combined filter keys for indexed prefix searches', () => {
  const keys = discoveryKeys(listing)
  assert(keys.includes('all|POINT|portr'))
  assert(keys.includes('bespoke_request|ZMW|zambian'))
  assert(keys.includes('all|all|paint'))
  assert(keys.length <= 900)
})
test('sellers cannot approve their own held payment or resolve a dispute', () => {
  const order = { buyerId: 'buyer', sellerId: 'seller', kind: 'bespoke_request', status: 'submitted', listing, revisionCount: 0 }
  assert.throws(() => nextState(order, 'seller', 'approve', false))
  assert.equal(nextState(order, 'buyer', 'approve', false), 'completed')
  assert.throws(() => nextState({ ...order, status: 'disputed' }, 'seller', 'resolve_release', false))
  assert.equal(nextState({ ...order, status: 'disputed' }, 'admin', 'resolve_refund', true), 'refunded')
  assert.throws(() => nextState({ ...order, revisionCount: 1 }, 'buyer', 'revise', false))
})
test('webhook signature validates exact raw bytes and rejects forgeries', () => {
  const secret = 'test-only-not-a-provider-secret'
  const raw = Buffer.from('{"event":"collection.successful"}')
  const key = createHash('sha256').update(secret).digest('hex')
  const signature = createHmac('sha512', key).update(raw).digest('hex')
  assert.equal(validWebhookSignature(raw, signature, secret), true)
  assert.equal(validWebhookSignature(Buffer.from('{}'), signature, secret), false)
  assert.equal(validWebhookSignature(raw, 'garbage', secret), false)
})
