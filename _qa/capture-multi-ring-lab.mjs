import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const baseUrl = process.env.STITCH_SPRITES_URL || 'http://127.0.0.1:5184/'
const pass = process.env.STITCH_SPRITES_QA_PASS || 'multi-ring-first-pass'
const outputDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ui')
const browser = await chromium.launch({ headless: true })

async function waitForIdle(page) {
  await page.waitForFunction(() => document.querySelectorAll('.ss-slot--working').length === 0, null, { timeout: 30000 })
}

async function clickAndSettle(page, column) {
  await page.locator(`[data-column="${column}"]`).click()
  await page.waitForTimeout(80)
  await waitForIdle(page)
}

async function open(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'zh-CN' })
  await context.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window)
    window.setTimeout = (handler, timeout = 0, ...args) => nativeSetTimeout(handler, Math.min(timeout, 24), ...args)
    localStorage.setItem('alteru:68c68c63-9eee-4ee5-a46b-f453d2e8c6bf:game_locale', 'zh')
  })
  const page = await context.newPage()
  await page.goto(`${baseUrl}?lab=multi-ring&level=42`, { waitUntil: 'domcontentloaded' })
  await page.locator('.ss-app').waitFor({ state: 'visible' })
  await page.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })
  const layout = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    champion: document.querySelectorAll('.ss-champion').length,
    undersized: [...document.querySelectorAll('button')].filter((button) => {
      const rect = button.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)
    }).length,
  }))
  if (layout.scrollWidth > layout.width || layout.champion || layout.undersized) {
    throw new Error(`Multi-ring layout failed: ${JSON.stringify(layout)}`)
  }
  return { context, page, layout }
}

async function capture(viewport) {
  const { context, page, layout } = await open(viewport)
  const openingCards = await page.locator('.ss-spool').evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')))
  if (!openingCards[0]?.includes('蓝色')) {
    throw new Error(`Multi-ring opening must deal the outer lake reel: ${JSON.stringify(openingCards)}`)
  }
  await page.screenshot({ path: path.join(outputDir, `${pass}-platform-layout-initial-${viewport.width}x${viewport.height}.png`) })

  for (const column of [0, 1, 2, 3, 0, 1, 2, 3, 2, 3, 2]) await clickAndSettle(page, column)
  await page.locator('.ss-result--failed').waitFor({ state: 'visible', timeout: 30000 })
  const failure = await page.evaluate(() => ({
    waiting: document.querySelectorAll('.ss-slot--waiting').length,
    colors: document.querySelector('.ss-result--failed small')?.textContent,
  }))
  if (failure.waiting !== 5 || !failure.colors?.includes('红色')) {
    throw new Error(`Multi-ring failure is not legible: ${JSON.stringify(failure)}`)
  }
  await page.screenshot({ path: path.join(outputDir, `${pass}-platform-layout-failed-${viewport.width}x${viewport.height}.png`) })
  await context.close()
  return { viewport, layout, failure }
}

async function captureComplete(viewport) {
  const { context, page } = await open(viewport)
  for (const column of [0, 1, 2, 3, 0, 1, 1, 1, 2, 2, 3, 3, 1, 1, 2, 2, 3, 3]) {
    await clickAndSettle(page, column)
  }
  await page.locator('.ss-result--complete').waitFor({ state: 'visible', timeout: 30000 })
  await page.screenshot({ path: path.join(outputDir, `${pass}-platform-layout-complete-${viewport.width}x${viewport.height}.png`) })
  await context.close()
  return { complete: true, viewport }
}

const results = [
  await capture({ width: 390, height: 844 }),
  await capture({ width: 320, height: 568 }),
]
const completion = await captureComplete({ width: 390, height: 844 })
await browser.close()
console.log(JSON.stringify({ ok: true, results, completion }))
