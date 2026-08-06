const test = require('node:test')
const assert = require('node:assert/strict')

const {
  calculateCommercialFee,
  calculatePurchasePoints,
} = require('../lib/core/economyMath.js')

test('commercial fees use integer points and round down', () => {
  assert.equal(calculateCommercialFee(1000, 500), 50)
  assert.equal(calculateCommercialFee(19, 500), 0)
})

test('purchase conversion uses ngwee without floating point balances', () => {
  assert.equal(calculatePurchasePoints(100, 25), 25)
  assert.equal(calculatePurchasePoints(150, 25), 37)
})

test('invalid conversion input is rejected', () => {
  assert.throws(() => calculatePurchasePoints(100, 0))
  assert.throws(() => calculateCommercialFee(-1, 500))
})
