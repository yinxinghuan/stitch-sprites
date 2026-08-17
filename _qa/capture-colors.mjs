import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const qaDir = path.dirname(fileURLToPath(import.meta.url))
const outputDir = path.join(qaDir, 'ui')
const baseUrl = process.env.STITCH_SPRITES_URL || 'http://127.0.0.1:5180/'
const pass = process.env.STITCH_SPRITES_QA_PASS || 'worker-colors'
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: 'zh-CN' })
const page = await context.newPage()
await page.goto(`${baseUrl}?level=2`, { waitUntil: 'domcontentloaded' })
await page.locator('.ss-app').waitFor({ state: 'visible' })
await page.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })

const sequence = [
  { column: 0, color: 'violet' },
  { column: 0, color: 'coral' },
  { column: 0, color: 'violet-2' },
  { column: 1, color: 'sun' },
  { column: 0, color: 'lake' },
  { column: 0, color: 'ink' },
  { column: 1, color: 'lake-2' },
  { column: 1, color: 'violet-3' },
  { column: 1, color: 'coral-2' },
  { column: 1, color: 'leaf' },
]

for (const [index, step] of sequence.entries()) {
  await page.locator(`[data-column="${step.column}"]`).click()
  await page.waitForTimeout(330)
  if (!step.color.includes('-')) {
    await page.screenshot({ path: path.join(outputDir, `${pass}-${step.color}-390x844.png`) })
  }
  await page.waitForFunction(() => document.querySelectorAll('.ss-slot--working').length === 0, null, { timeout: 25000 })
  if (index < sequence.length - 1) await page.waitForTimeout(80)
}

console.log(JSON.stringify({ ok: true, captured: ['violet', 'coral', 'sun', 'lake', 'ink', 'leaf'] }))
await context.close()
await browser.close()
