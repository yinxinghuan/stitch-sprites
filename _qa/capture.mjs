import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const qaDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(qaDir, 'ui')
const baseUrl = process.env.STITCH_SPRITES_URL || 'http://127.0.0.1:5174/'
const browser = await chromium.launch({ headless: true })
const errors = []

async function open(viewport, level, hideGuest = true) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'zh-CN' })
  await context.addInitScript(() => {
    localStorage.setItem('alteru:stitch-sprites:game_locale', 'zh')
  })
  const page = await context.newPage()
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (text.includes('/game/track/report') || text.includes('net::ERR_FAILED')) return
    errors.push(`console: ${text}`)
  })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  await page.goto(`${baseUrl}?level=${level}`, { waitUntil: 'networkidle' })
  if (hideGuest) await page.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })
  const layout = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    undersized: [...document.querySelectorAll('button')]
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)
      })
      .map((element) => ({ className: element.className, rect: element.getBoundingClientRect().toJSON() })),
  }))
  if (layout.scrollWidth > layout.width) throw new Error(`Horizontal overflow: ${JSON.stringify(layout)}`)
  if (layout.undersized.length) throw new Error(`Undersized buttons: ${JSON.stringify(layout.undersized)}`)
  return { context, page }
}

{
  const { context, page } = await open({ width: 390, height: 844 }, 1)
  await page.screenshot({ path: path.join(root, 'recheck-platform-layout-level1-initial-390x844.png') })
  await page.locator('[data-column="0"]').click()
  await page.waitForTimeout(950)
  await page.screenshot({ path: path.join(root, 'recheck-platform-layout-level1-after-first-action-390x844.png') })

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await page.locator('.ss-result--complete').count()) break
    const enabled = page.locator('.ss-spool:not(:disabled)')
    if (await enabled.count()) await enabled.first().click()
    await page.waitForTimeout(800)
  }
  await page.waitForTimeout(900)
  await page.screenshot({ path: path.join(root, 'recheck-platform-layout-level1-complete-390x844.png') })
  await context.close()
}

{
  const { context, page } = await open({ width: 390, height: 844 }, 2)
  for (const column of [0, 0, 1, 1, 2]) {
    await page.locator(`[data-column="${column}"]`).click()
    await page.waitForTimeout(90)
  }
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(root, 'recheck-platform-layout-level2-failed-390x844.png') })
  await context.close()
}

{
  const { context, page } = await open({ width: 320, height: 568 }, 2)
  await page.screenshot({ path: path.join(root, 'recheck-platform-layout-level2-initial-320x568.png') })
  await context.close()
}

{
  const { context, page } = await open({ width: 390, height: 844 }, 2)
  for (const column of [3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3]) {
    const spool = page.locator(`[data-column="${column}"]`)
    await spool.waitFor({ state: 'visible' })
    await spool.click()
    await page.waitForTimeout(1250)
  }
  await page.waitForTimeout(2800)
  if (!await page.locator('.ss-result--complete').count()) throw new Error('Level 2 correct path did not complete')
  await page.screenshot({ path: path.join(root, 'recheck-platform-layout-level2-complete-390x844.png') })
  await context.close()
}

{
  const { context, page } = await open({ width: 390, height: 844 }, 1, false)
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(root, 'recheck-external-guest-level1-390x844.png') })
  await context.close()
}

await browser.close()
if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
}
