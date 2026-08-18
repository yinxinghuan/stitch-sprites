import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const baseUrl = process.env.STITCH_SPRITES_URL || 'http://127.0.0.1:5184/'
const pass = process.env.STITCH_SPRITES_QA_PASS || 'dual-entry-first-pass'
const outputDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ui')
const browser = await chromium.launch({ headless: true })

async function waitForIdle(page) {
  await page.waitForFunction(() => document.querySelectorAll('.ss-slot--working').length === 0, null, { timeout: 30000 })
}

async function capture(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'zh-CN' })
  await context.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window)
    window.setTimeout = (handler, timeout = 0, ...args) => nativeSetTimeout(handler, Math.min(timeout, 24), ...args)
    localStorage.setItem('alteru:68c68c63-9eee-4ee5-a46b-f453d2e8c6bf:game_locale', 'zh')
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${baseUrl}?lab=dual-entry&level=42`, { waitUntil: 'domcontentloaded' })
  await page.locator('.ss-app').waitFor({ state: 'visible' })
  await page.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })
  await page.waitForTimeout(120)

  const initial = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    level: document.querySelector('.ss-level')?.textContent,
    champion: document.querySelectorAll('.ss-champion').length,
    undersized: [...document.querySelectorAll('button')].filter((button) => {
      const rect = button.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)
    }).length,
  }))
  if (initial.level !== '42' || initial.champion || initial.scrollWidth > initial.width || initial.undersized) {
    throw new Error(`Lab layout contract failed: ${JSON.stringify(initial)}`)
  }
  await page.screenshot({ path: path.join(outputDir, `${pass}-platform-layout-initial-${viewport.width}x${viewport.height}.png`) })

  await page.locator('[data-column="2"]').click()
  await waitForIdle(page)
  await page.locator('[data-column="3"]').click()
  await waitForIdle(page)
  await page.locator('[data-column="3"]').click()
  await waitForIdle(page)
  const pressureSlots = await page.locator('.ss-slot--waiting').count()
  if (pressureSlots !== 2) throw new Error(`Expected two visible waiting reels, found ${pressureSlots}`)
  // Engine timers are accelerated for QA, while renderer missions use real
  // performance time. Let the last return and thread-recovery animations
  // finish before judging the stable two-slot pressure state.
  await page.waitForTimeout(8200)
  await page.screenshot({ path: path.join(outputDir, `${pass}-platform-layout-pressure-${viewport.width}x${viewport.height}.png`) })

  await page.locator('[data-column="3"]').click()
  await waitForIdle(page)
  await page.locator('[data-column="0"]').click()
  await waitForIdle(page)
  await page.locator('[data-column="1"]').click()
  await page.locator('.ss-result--complete').waitFor({ state: 'visible', timeout: 30000 })
  if (await page.locator('.ss-result__mastery').count()) throw new Error('Lab result leaked formal mastery scoring')
  if (!(await page.locator('.ss-primary').textContent())?.includes('再拆一次')) throw new Error('Lab result did not offer a replay')
  await page.screenshot({ path: path.join(outputDir, `${pass}-platform-layout-complete-${viewport.width}x${viewport.height}.png`) })
  if (errors.length) throw new Error(errors.join('\n'))
  await context.close()
  return { viewport, pressureSlots, initial }
}

const results = [
  await capture({ width: 390, height: 844 }),
  await capture({ width: 320, height: 568 }),
]
await browser.close()
console.log(JSON.stringify({ ok: true, results }))
