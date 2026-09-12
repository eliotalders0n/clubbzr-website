const test = require('node:test')
const assert = require('node:assert/strict')

const {
  claimsForRole,
  isManagedAccountStatus,
  isManagedRole,
  removesOwnAdminAccess,
} = require('../lib/core/accessPolicy.js')

test('only supported roles and account states are accepted', () => {
  assert.equal(isManagedRole('facilitator'), true)
  assert.equal(isManagedRole('owner'), false)
  assert.equal(isManagedAccountStatus('suspended'), true)
  assert.equal(isManagedAccountStatus('pending'), false)
})

test('role claims are mutually exclusive and retain unrelated claims', () => {
  assert.deepEqual(claimsForRole('curator', { plan: 'founding', admin: true }), {
    plan: 'founding',
    role: 'curator',
    admin: false,
    curator: true,
    facilitator: false,
  })
})

test('an admin cannot demote or restrict their own account', () => {
  assert.equal(removesOwnAdminAccess('a', 'a', 'user', 'active'), true)
  assert.equal(removesOwnAdminAccess('a', 'a', 'admin', 'suspended'), true)
  assert.equal(removesOwnAdminAccess('a', 'a', 'admin', 'active'), false)
  assert.equal(removesOwnAdminAccess('a', 'b', 'user', 'closed'), false)
})
