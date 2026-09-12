// Local emulator regression for the closed Store setup flow.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const base = process.env.STORE_PREVIEW_URL || 'http://127.0.0.1:3010'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('Use a local demo preview only.')
async function main() {
  const browser = await chromium.launch({ headless: true })
  let original
  let adminPage
  const pageErrors = []
  async function login(user) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await context.newPage()
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto(`${base}/store`)
    assert.equal(await page.evaluate(async () => (await import('/lib/config.ts')).app.options.projectId), 'demo-clubbzr-store')
    await page.goto(`${base}/auth/login`)
    await page.locator('input[type=email]').fill(`${user}@store.test`)
    await page.locator('input[type=password]').first().fill('StoreDemo123!')
    await page.locator('button[type=submit]').click()
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'))
    return page
  }
  const update = (settings) => adminPage.evaluate(async (data) => (await import('/lib/store.ts')).storeCall('adminUpdateStoreSettings', data), { ...settings, reason: 'Local emulator Store availability regression.' })
  try {
    adminPage = await login('store_admin')
    original = await adminPage.evaluate(async () => (await import('/lib/store.ts')).storeCall('getStoreConfig'))
    await update({ ...original, storeEnabled: false })
    await adminPage.goto(`${base}/store/manage`)
    await adminPage.getByText('The Store is currently closed.', { exact: true }).waitFor()
    assert.equal(await adminPage.getByRole('button', { name: 'Save shop settings', exact: true }).count(), 0)
    await fs.mkdir('artifacts/store-browser', { recursive: true })
    await adminPage.screenshot({ path: 'artifacts/store-browser/store-closed-admin.png', fullPage: true })
    await adminPage.getByRole('link', { name: 'Open Store controls', exact: true }).click()
    await adminPage.getByRole('heading', { name: 'Store capabilities', exact: true }).waitFor()
    assert.equal(await adminPage.getByLabel('Store open', { exact: true }).isChecked(), false)
    const member = await login('store_buyer')
    await member.goto(`${base}/store/manage`)
    await member.getByText('The Store is currently closed.', { exact: true }).waitFor()
    assert.equal(await member.getByRole('link', { name: 'Open Store controls', exact: true }).count(), 0)
    assert.equal(await member.getByRole('button', { name: 'Save shop settings', exact: true }).count(), 0)
    await member.getByRole('button', { name: 'Orders', exact: true }).click()
    await member.getByText('No orders here yet.', { exact: true }).waitFor()
    await member.getByRole('button', { name: 'Payouts', exact: true }).click()
    assert.equal(await member.getByRole('button', { name: 'Request payout', exact: true }).isDisabled(), true)
    await adminPage.goto(`${base}/store/manage`)
    await adminPage.getByRole('button', { name: 'Check Store status', exact: true }).waitFor()
    await update({ ...original, storeEnabled: true })
    await adminPage.getByRole('button', { name: 'Check Store status', exact: true }).click()
    await adminPage.getByLabel('About your shop', { exact: true }).waitFor()
    assert.equal(await adminPage.getByRole('button', { name: 'Save shop settings', exact: true }).isEnabled(), true)
    assert.deepEqual(pageErrors, [])
    console.log('Passed: closed setup hidden, admin control link, member permissions, existing orders, payout guard and reopening setup. No uncaught page errors.')
  } finally {
    try { if (original && adminPage) await update(original) }
    finally { await browser.close() }
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
