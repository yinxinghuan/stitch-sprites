import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const qaDir = path.dirname(fileURLToPath(import.meta.url))
const outputDir = path.join(qaDir, 'ui')
const baseUrl = process.env.STITCH_SPRITES_URL || 'http://127.0.0.1:5180/'
const pass = process.env.STITCH_SPRITES_QA_PASS || 'walking-core-first-pass'
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: 'zh-CN' })
await context.addInitScript(() => {
  localStorage.setItem('alteru:68c68c63-9eee-4ee5-a46b-f453d2e8c6bf:game_locale', 'zh')
})
const page = await context.newPage()
await page.goto(`${baseUrl}?level=1`, { waitUntil: 'domcontentloaded' })
await page.locator('.ss-app').waitFor({ state: 'visible' })
await page.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })
await page.waitForTimeout(250)

const remaining = async () => Number((await page.locator('.ss-remaining').textContent())?.match(/\d+/)?.[0] ?? NaN)
const initial = await remaining()
if (initial !== 792) throw new Error(`Expected 792 initial stitches, got ${initial}`)

await page.locator('[data-column="0"]').click()
const checkpoints = [0, 160, 340, 460, 540, 620, 720, 860, 1020, 1220, 1450, 2400, 3200]
let elapsed = 0
const readings = []
for (const checkpoint of checkpoints) {
  await page.waitForTimeout(checkpoint - elapsed)
  elapsed = checkpoint
  const value = await remaining()
  readings.push({ checkpoint, remaining: value })
  await page.screenshot({ path: path.join(outputDir, `${pass}-${String(checkpoint).padStart(4, '0')}ms-390x844.png`) })
}

if (readings.find(({ checkpoint }) => checkpoint === 340)?.remaining !== initial) {
  throw new Error(`Stitches changed before the first visible walking beat: ${JSON.stringify(readings)}`)
}
const firstResult = readings.find(({ checkpoint }) => checkpoint === 720)?.remaining ?? initial
if (!(firstResult < initial)) {
  throw new Error(`No visible work result after arrival: ${JSON.stringify(readings)}`)
}
if (!(readings.at(-1).remaining < firstResult)) {
  throw new Error(`Workers did not continue after first contact: ${JSON.stringify(readings)}`)
}

console.log(JSON.stringify({ ok: true, readings }))
await context.close()
await browser.close()
