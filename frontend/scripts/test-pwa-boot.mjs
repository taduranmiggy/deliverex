import { chromium } from 'playwright'

const url = process.argv[2] || 'http://localhost:4173/customer'

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
})
const page = await context.newPage()

const errors = []
page.on('pageerror', (err) => errors.push(String(err)))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
})

await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(4500)

const snapshot = await page.evaluate(() => ({
  hasPwaHome: Boolean(document.querySelector('.pwa-home')),
  hasCustomerNav: Boolean(document.querySelector('.customer-nav')),
  hasCustomerLayout: Boolean(document.querySelector('.customer-layout')),
  hasSplash: Boolean(document.querySelector('.pwa-splash')),
  hasError: Boolean(document.querySelector('.dx-app-error')),
  rootChildCount: document.getElementById('root')?.childElementCount ?? 0,
  text: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 400),
}))

console.log(JSON.stringify({ url, snapshot, errors }, null, 2))
await browser.close()
