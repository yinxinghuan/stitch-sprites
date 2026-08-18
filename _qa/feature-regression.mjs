import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const baseUrl = process.env.STITCH_SPRITES_URL || 'http://127.0.0.1:5173/'
const output = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ui', 'feature-social-save-platform-leaderboard-390x844.png')
const narrowOutput = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ui', 'feature-social-save-platform-leaderboard-320x568.png')
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' })
await context.addInitScript(() => {
  if (sessionStorage.getItem('ss-qa-initialized')) return
  localStorage.clear()
  sessionStorage.setItem('ss-qa-initialized', '1')
})

const page = await context.newPage()
await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
await page.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })
await page.locator('.ss-app').waitFor({ state: 'visible' })

const initialSpools = await page.locator('.ss-spool').count()
const initialEnabled = await page.locator('.ss-spool:not(:disabled)').count()
if (initialSpools < 2 || initialEnabled !== 1) throw new Error(`Level 1 should protect only the first choice: ${initialEnabled}/${initialSpools}`)

const initialRemaining = Number((await page.locator('.ss-remaining').textContent())?.match(/\d+/)?.[0])
await page.locator('[data-column="0"]').click()
await page.waitForFunction((remaining) => {
  const current = Number(document.querySelector('.ss-remaining')?.textContent?.match(/\d+/)?.[0])
  return current < remaining
}, initialRemaining)
if (await page.locator('.ss-spool:disabled').count()) throw new Error('Level 1 kept blocking wrong colors after the first real result')

const doubleTapContract = await page.evaluate(() => {
  const app = document.querySelector('.ss-app')
  if (!app) return null
  const event = new MouseEvent('dblclick', { bubbles: true, cancelable: true })
  const dispatched = app.dispatchEvent(event)
  return { dispatched, defaultPrevented: event.defaultPrevented, touchAction: getComputedStyle(app).touchAction }
})
if (!doubleTapContract || doubleTapContract.dispatched || !doubleTapContract.defaultPrevented || doubleTapContract.touchAction !== 'manipulation') {
  throw new Error(`Double-tap zoom contract failed: ${JSON.stringify(doubleTapContract)}`)
}

await page.waitForFunction(() => {
  const key = Object.keys(localStorage).find((candidate) => candidate.endsWith(':stitch_sprites_progress_v2'))
  if (!key) return false
  const progress = JSON.parse(localStorage.getItem(key) || 'null')
  return progress?.currentRun?.removed > 0
})
const stored = await page.evaluate(() => {
  const key = Object.keys(localStorage).find((candidate) => candidate.endsWith(':stitch_sprites_progress_v2'))
  return key ? JSON.parse(localStorage.getItem(key) || 'null') : null
})
if (stored?.currentRun?.levelId !== 1 || stored.currentRun.removed <= 0) throw new Error(`Stable local save missing: ${JSON.stringify(stored)}`)

await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
await page.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })
await page.locator('.ss-level').waitFor({ state: 'visible' })
const resumedLabel = await page.locator('.ss-level').textContent()
const resumedStorage = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))
if (!resumedLabel?.startsWith('1 ·')) throw new Error(`Reload did not resume level 1: ${resumedLabel} ${JSON.stringify(resumedStorage)}`)
const resumedRemaining = Number((await page.locator('.ss-remaining').textContent())?.match(/\d+/)?.[0])
if (!(resumedRemaining < initialRemaining)) throw new Error(`Reload did not restore cleared stitches: ${resumedRemaining}/${initialRemaining}`)

const plainPage = await context.newPage()
await plainPage.goto(`${baseUrl}?level=1`, { waitUntil: 'domcontentloaded' })
if (await plainPage.locator('.ss-champion').count()) throw new Error('Leaderboard leaked into a platform without rank capability')
await plainPage.close()

const platformPage = await context.newPage()
await platformPage.goto(`${baseUrl}?level=1&api_origin=${encodeURIComponent('https://game.aiwaves.tech')}&telegram_id=qa-player`, { waitUntil: 'domcontentloaded' })
await platformPage.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })
await platformPage.locator('.ss-champion').click()
await platformPage.locator('.ss-leaderboard').waitFor({ state: 'visible' })
await platformPage.screenshot({ path: output })
await platformPage.setViewportSize({ width: 320, height: 568 })
const narrowLayout = await platformPage.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
if (narrowLayout.scrollWidth > narrowLayout.width) throw new Error(`Narrow leaderboard overflow: ${JSON.stringify(narrowLayout)}`)
await platformPage.screenshot({ path: narrowOutput })

console.log(JSON.stringify({ ok: true, initialEnabled, doubleTapContract, savedLevel: stored.currentRun.levelId, savedRemoved: stored.currentRun.removed, platformLeaderboard: true }))
await context.close()
await browser.close()
