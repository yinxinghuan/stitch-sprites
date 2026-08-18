import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const qaDir = path.dirname(fileURLToPath(import.meta.url))
const outputDir = path.join(qaDir, 'ui')
const baseUrl = process.env.STITCH_SPRITES_URL || 'http://127.0.0.1:5180/'
const pass = process.env.STITCH_SPRITES_QA_PASS || 'full-levels-first-pass'
const requestedLevel = Number(process.env.STITCH_SPRITES_LEVEL || 0)
const levelCount = Number(process.env.STITCH_SPRITES_LEVEL_COUNT || 41)
const includeNarrow = process.env.STITCH_SPRITES_NARROW === '1'
const externalGuest = process.env.STITCH_SPRITES_EXTERNAL_GUEST === '1'
const browser = await chromium.launch({ headless: true })
const errors = []

async function capture(level, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'zh-CN' })
  await context.addInitScript(() => {
    localStorage.setItem('alteru:68c68c63-9eee-4ee5-a46b-f453d2e8c6bf:game_locale', 'zh')
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(`level ${level}: ${error.message}`))
  await page.goto(`${baseUrl}?level=${level}`, { waitUntil: 'commit', timeout: 30_000 })
  await page.locator('.ss-app').waitFor({ state: 'visible' })
  if (!externalGuest) await page.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })
  await page.waitForTimeout(externalGuest ? 900 : 320)
  const geometry = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    title: document.querySelector('.ss-level')?.textContent,
    cards: [...document.querySelectorAll('.ss-spool')].map((card) => {
      const rect = card.getBoundingClientRect()
      return { width: Number(rect.width.toFixed(2)), height: Number(rect.height.toFixed(2)) }
    }),
    previews: [...document.querySelectorAll('.ss-column')].map((column) => (
      [...column.querySelectorAll('.ss-spool-back')].map((card) => {
        const rect = card.getBoundingClientRect()
        return {
          top: Number(rect.top.toFixed(2)),
          color: getComputedStyle(card).getPropertyValue('--thread').trim(),
        }
      })
    )),
    guestVisible: Boolean(document.querySelector('#alteru-guest-banner'))
      && getComputedStyle(document.querySelector('#alteru-guest-banner')).display !== 'none',
  }))
  if (geometry.scrollWidth > geometry.width) throw new Error(`Level ${level} overflows: ${JSON.stringify(geometry)}`)
  if (geometry.title?.trim() !== String(level).padStart(2, '0')) throw new Error(`Level ${level} title mismatch: ${JSON.stringify(geometry)}`)
  const widths = new Set(geometry.cards.map((card) => card.width))
  const heights = new Set(geometry.cards.map((card) => card.height))
  if (widths.size > 1 || heights.size > 1) throw new Error(`Level ${level} cards are uneven: ${JSON.stringify(geometry.cards)}`)
  if (geometry.previews.some((column) => column.length > 6)) throw new Error(`Level ${level} exposes too many back cards: ${JSON.stringify(geometry.previews)}`)
  if (geometry.previews.flat().some((card) => !card.color)) throw new Error(`Level ${level} has a back card without a visible color: ${JSON.stringify(geometry.previews)}`)
  if (geometry.previews.some((column) => new Set(column.map((card) => card.top)).size !== column.length)) {
    throw new Error(`Level ${level} has overlapping back-card color bands: ${JSON.stringify(geometry.previews)}`)
  }
  if (externalGuest && !geometry.guestVisible) throw new Error(`Level ${level} external guest banner did not render`)
  await page.screenshot({
    path: path.join(outputDir, `${pass}-level${level}-${viewport.width}x${viewport.height}.png`),
  })
  await context.close()
  return geometry
}

const results = []
const firstLevel = requestedLevel > 0 ? requestedLevel : 1
const lastLevel = requestedLevel > 0 ? requestedLevel : levelCount
for (let level = firstLevel; level <= lastLevel; level += 1) {
  results.push(await capture(level, { width: 390, height: 844 }))
}
if (!requestedLevel || includeNarrow) results.push(await capture(requestedLevel || levelCount, { width: 320, height: 568 }))
await browser.close()
if (errors.length) throw new Error(errors.join('\n'))
console.log(JSON.stringify({ ok: true, results }))
