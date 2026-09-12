// Run against the demo Store preview and local Firebase emulators only.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
const base = process.env.STORE_PREVIEW_URL || 'http://127.0.0.1:3010'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('Use a local demo preview only.')
const output = path.resolve('artifacts/store-browser')
async function main() {
  await fs.mkdir(output, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const results = []
  const errors = []
  async function pageFor(user, viewport) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`${base}/store`)
    // Verify isolation before entering any fixture credentials.
    const projectId = await page.evaluate(async () => (await import('/lib/config.ts')).app.options.projectId)
    assert.equal(projectId, 'demo-clubbzr-store')
    if (user) {
      await page.goto(`${base}/auth/login`)
      await page.locator('input[type=email]').fill(`${user}@store.test`)
      await page.locator('input[type=password]').first().fill('StoreDemo123!')
      await page.locator('button[type=submit]').click()
      await page.waitForURL((url) => !url.pathname.startsWith('/auth'))
    }
    return page
  }
  async function screenshot(page, name) {
    await page.evaluate(async () => { await Promise.all(Array.from(document.querySelectorAll('main img, .store-ui img')).filter((img) => img.getBoundingClientRect().top < innerHeight).map((img) => img.decode().catch(() => {}))) })
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true })
    await page.screenshot({ path: path.join(output, `${name}-viewport.png`), fullPage: false })
    const width = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }))
    assert(width.page <= width.viewport + 1, `${name}: horizontal overflow ${JSON.stringify(width)}`)
    results.push(name)
  }
  try {
    const desktop = await pageFor(null, { width: 1440, height: 1000 })
    await desktop.getByRole('heading', { name: 'Explore recent releases' }).waitFor()
    await desktop.locator('article').first().waitFor()
    await screenshot(desktop, 'store-desktop')
    const mobile = await pageFor('store_buyer', { width: 390, height: 844 })
    await mobile.goto(`${base}/store`)
    await mobile.locator('article').first().waitFor()
    await screenshot(mobile, 'store-mobile')
    await mobile.getByRole('button', { name: 'Digital', exact: true }).click()
    await mobile.locator('article').first().waitFor()
    await mobile.locator('article h3').first().click()
    await mobile.getByRole('heading', { name: 'Make it yours' }).waitFor()
    await mobile.getByText('Your total', { exact: true }).waitFor()
    await screenshot(mobile, 'listing-mobile')
    await mobile.locator('input[type=checkbox]').last().check()
    await mobile.getByRole('button', { name: 'Confirm purchase', exact: true }).click()
    await mobile.waitForURL(/\/store\/orders\//)
    await mobile.getByRole('heading', { name: 'Your files', exact: true }).waitFor()
    await screenshot(mobile, 'completed-order-mobile')
    const seller = await pageFor('store_seller', { width: 1440, height: 1000 })
    await seller.goto(`${base}/store/manage`)
    await seller.getByRole('link', { name: 'Create a release', exact: true }).waitFor()
    await screenshot(seller, 'seller-listings-desktop')
    await seller.getByRole('link', { name: 'Create a release', exact: true }).click()
    await seller.getByRole('heading', { name: 'The release', exact: true }).waitFor()
    await screenshot(seller, 'listing-editor-desktop')
    const administrator = await pageFor('store_admin', { width: 1440, height: 1000 })
    await administrator.goto(`${base}/admin/store`)
    await administrator.getByRole('button', { name: 'ZMW reconciliation', exact: true }).click()
    await administrator.getByRole('heading', { name: 'ZMW marketplace reconciliation', exact: true }).waitFor()
    await screenshot(administrator, 'admin-reconciliation-desktop')
    assert.deepEqual(errors, [])
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ passed: results, pageErrors: errors }, null, 2))
    console.log(`Passed ${results.length} browser checks, including real emulator Points checkout. No horizontal overflow or uncaught page errors.`)
  } finally { await browser.close() }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
