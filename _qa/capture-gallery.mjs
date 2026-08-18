import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const qaDir = path.dirname(fileURLToPath(import.meta.url))
const outputDir = path.join(qaDir, 'ui')
const baseUrl = process.env.STITCH_SPRITES_URL || 'http://127.0.0.1:5180/'
const pass = process.env.STITCH_SPRITES_QA_PASS || 'full-gallery-first-pass'
const levelCount = Number(process.env.STITCH_SPRITES_LEVEL_COUNT || 41)
const browser = await chromium.launch({ headless: true })

async function capture(viewport, unlocked) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'zh-CN' })
  await context.addInitScript(({ unlockedLevel }) => {
    localStorage.setItem('alteru:68c68c63-9eee-4ee5-a46b-f453d2e8c6bf:game_locale', 'zh')
    localStorage.setItem('alteru:68c68c63-9eee-4ee5-a46b-f453d2e8c6bf:stitch_sprites_level', String(unlockedLevel))
  }, { unlockedLevel: unlocked })
  const page = await context.newPage()
  await page.goto(`${baseUrl}?level=1`, { waitUntil: 'domcontentloaded' })
  await page.locator('.ss-app').waitFor({ state: 'visible' })
  await page.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })
  await page.locator('.ss-heading').click()
  await page.locator('.ss-gallery').waitFor({ state: 'visible' })
  const result = await page.evaluate(() => ({
    cards: document.querySelectorAll('.ss-gallery-card').length,
    enabled: document.querySelectorAll('.ss-gallery-card:not(:disabled)').length,
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    undersized: [...document.querySelectorAll('.ss-gallery button')].filter((button) => {
      const rect = button.getBoundingClientRect()
      return rect.width < 44 || rect.height < 44
    }).length,
    unclippedThumbnails: [...document.querySelectorAll('.ss-gallery-card:not(:disabled) .ss-pattern-thumb')].filter((canvas) => {
      const style = getComputedStyle(canvas)
      return style.borderRadius !== '50%' || !style.clipPath.includes('circle')
    }).length,
  }))
  if (result.cards !== levelCount || result.enabled !== unlocked || result.scrollWidth > result.width || result.undersized || result.unclippedThumbnails) {
    throw new Error(`Gallery contract failed: ${JSON.stringify(result)}`)
  }
  await page.screenshot({ path: path.join(outputDir, `${pass}-unlocked${unlocked}-${viewport.width}x${viewport.height}.png`) })
  if (unlocked === levelCount) {
    const scroller = page.locator('.ss-gallery__scroll')
    await scroller.evaluate((element) => { element.scrollTop = element.scrollHeight })
    await page.waitForTimeout(180)
    const firstTop = await scroller.evaluate((element) => element.scrollTop)
    await page.waitForTimeout(180)
    const secondTop = await scroller.evaluate((element) => element.scrollTop)
    if (Math.abs(firstTop - secondTop) > 1) throw new Error(`Gallery scroll jumped: ${firstTop} -> ${secondTop}`)
    await page.screenshot({ path: path.join(outputDir, `${pass}-unlocked${unlocked}-bottom-${viewport.width}x${viewport.height}.png`) })
  }
  await context.close()
  return result
}

const results = [
  await capture({ width: 390, height: 844 }, 1),
  await capture({ width: 390, height: 844 }, levelCount),
  await capture({ width: 320, height: 568 }, levelCount),
]
await browser.close()
console.log(JSON.stringify({ ok: true, results }))
