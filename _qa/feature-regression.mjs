import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const baseUrl = process.env.STITCH_SPRITES_URL || 'http://127.0.0.1:5173/'
const output = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ui', 'feature-social-save-platform-leaderboard-390x844.png')
const narrowOutput = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ui', 'feature-social-save-platform-leaderboard-320x568.png')
const headerOutput = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ui', 'feature-social-save-platform-header-390x844.png')
const narrowHeaderOutput = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ui', 'feature-social-save-platform-header-320x568.png')
const galleryOutput = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ui', 'feature-social-save-gallery-locks-390x844.png')
const narrowGalleryOutput = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ui', 'feature-social-save-gallery-locks-320x568.png')
const restartInitialOutput = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ui', 'feature-restart-initial-390x844.png')
const restartRestoredOutput = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ui', 'feature-restart-restored-390x844.png')
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' })
await context.addInitScript(() => {
  if (sessionStorage.getItem('ss-qa-initialized')) return
  localStorage.clear()
  sessionStorage.setItem('ss-qa-initialized', '1')
})

const page = await context.newPage()
const stableBoardCanvas = async (targetPage) => {
  let previous = ''
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await targetPage.waitForTimeout(250)
    const current = await targetPage.locator('.ss-board__canvas').evaluate((canvas) => {
      const crop = document.createElement('canvas')
      crop.width = canvas.width
      crop.height = Math.floor(canvas.height * 0.9)
      crop.getContext('2d')?.drawImage(
        canvas,
        0,
        0,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height,
      )
      return crop.toDataURL()
    })
    if (current === previous) return current
    previous = current
  }
  return previous
}
const boardDifferenceRatio = async (targetPage, referenceDataUrl) => targetPage.locator('.ss-board__canvas').evaluate(async (canvas, reference) => {
  const height = Math.floor(canvas.height * 0.9)
  const current = document.createElement('canvas')
  current.width = canvas.width
  current.height = height
  current.getContext('2d')?.drawImage(canvas, 0, 0, canvas.width, height, 0, 0, canvas.width, height)
  const image = new Image()
  image.src = reference
  await image.decode()
  const referenceCanvas = document.createElement('canvas')
  referenceCanvas.width = canvas.width
  referenceCanvas.height = height
  referenceCanvas.getContext('2d')?.drawImage(image, 0, 0)
  const currentPixels = current.getContext('2d')?.getImageData(0, 0, canvas.width, height).data ?? []
  const referencePixels = referenceCanvas.getContext('2d')?.getImageData(0, 0, canvas.width, height).data ?? []
  let materiallyDifferent = 0
  for (let index = 0; index < currentPixels.length; index += 4) {
    const difference = Math.max(
      Math.abs(currentPixels[index] - referencePixels[index]),
      Math.abs(currentPixels[index + 1] - referencePixels[index + 1]),
      Math.abs(currentPixels[index + 2] - referencePixels[index + 2]),
    )
    if (difference > 90) materiallyDifferent += 1
  }
  return materiallyDifferent / Math.max(1, currentPixels.length / 4)
}, referenceDataUrl)
await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
await page.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })
await page.locator('.ss-app').waitFor({ state: 'visible' })
const initialCanvas = await stableBoardCanvas(page)
await page.locator('.ss-board__canvas').screenshot({ path: restartInitialOutput })
await page.waitForFunction(() => {
  const key = Object.keys(localStorage).find((candidate) => candidate.endsWith(':stitch_sprites_progress_v2'))
  if (!key) return false
  return Boolean(JSON.parse(localStorage.getItem(key) || 'null')?.currentRun)
})
const initialRun = await page.evaluate(() => {
  const key = Object.keys(localStorage).find((candidate) => candidate.endsWith(':stitch_sprites_progress_v2'))
  return key ? JSON.parse(localStorage.getItem(key) || 'null')?.currentRun : null
})

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
if (resumedLabel !== '01') throw new Error(`Reload did not resume level 1: ${resumedLabel} ${JSON.stringify(resumedStorage)}`)
const resumedRemaining = Number((await page.locator('.ss-remaining').textContent())?.match(/\d+/)?.[0])
if (!(resumedRemaining < initialRemaining)) throw new Error(`Reload did not restore cleared stitches: ${resumedRemaining}/${initialRemaining}`)

await page.locator('.ss-restart').click()
await page.waitForFunction((remaining) => {
  const current = Number(document.querySelector('.ss-remaining')?.textContent?.match(/\d+/)?.[0])
  return current === remaining && !document.querySelector('.ss-slot:not(.ss-slot--empty)')
}, initialRemaining)
const restartedCanvas = await stableBoardCanvas(page)
await page.locator('.ss-board__canvas').screenshot({ path: restartRestoredOutput })
const restartDifference = restartedCanvas === initialCanvas ? 0 : await boardDifferenceRatio(page, initialCanvas)
if (restartDifference > 0.002) throw new Error(`Restart did not restore the complete initial board rendering: ${restartDifference}`)
const restartedProgress = await page.evaluate(() => {
  const key = Object.keys(localStorage).find((candidate) => candidate.endsWith(':stitch_sprites_progress_v2'))
  return key ? JSON.parse(localStorage.getItem(key) || 'null') : null
})
if (restartedProgress?.currentRun?.removed !== 0 || restartedProgress.currentRun.cleared.length !== 0) {
  throw new Error(`Restart left cleared stitches in the saved run: ${JSON.stringify(restartedProgress?.currentRun)}`)
}
if (JSON.stringify(restartedProgress.currentRun.columns) !== JSON.stringify(initialRun.columns)
  || restartedProgress.currentRun.slots.length !== 0) {
  throw new Error('Restart did not restore the initial spool order and five empty slots')
}

await page.locator('.ss-heading').click()
await page.locator('.ss-gallery').waitFor({ state: 'visible' })
const firstLockedCard = page.locator('.ss-gallery-card--locked').first()
if (!(await firstLockedCard.count())) throw new Error('Gallery has no locked card to verify')
if (await firstLockedCard.locator('canvas').count()) throw new Error('Locked gallery card still leaks a pattern thumbnail')
if (!(await firstLockedCard.locator('svg').count())) throw new Error('Locked gallery card is missing its lock icon')
const scrollBefore = await page.locator('.ss-gallery__scroll').evaluate((element) => {
  element.scrollTop = Math.min(560, element.scrollHeight - element.clientHeight)
  return element.scrollTop
})
await page.waitForTimeout(900)
const scrollAfter = await page.locator('.ss-gallery__scroll').evaluate((element) => element.scrollTop)
if (Math.abs(scrollAfter - scrollBefore) > 1) throw new Error(`Gallery scroll jumped during engine updates: ${scrollBefore} -> ${scrollAfter}`)
await page.screenshot({ path: galleryOutput })
await page.setViewportSize({ width: 320, height: 568 })
await page.screenshot({ path: narrowGalleryOutput })
await page.locator('.ss-gallery__close').click()

const plainPage = await context.newPage()
await plainPage.goto(`${baseUrl}?level=1`, { waitUntil: 'domcontentloaded' })
if (await plainPage.locator('.ss-champion').count()) throw new Error('Leaderboard leaked into a platform without rank capability')
await plainPage.close()

const platformPage = await context.newPage()
await platformPage.addInitScript(() => {
  window.addEventListener('message', (event) => {
    if (typeof event.data !== 'string' || !event.data.startsWith('callAPI-')) return
    try {
      const request = JSON.parse(decodeURIComponent(escape(atob(event.data.slice('callAPI-'.length)))))
      const rows = request.url.includes('/rank/score/list/')
        ? [{ user_id: 'qa-champion', score: 12680, rank: 1, user_name: 'Luna', head_url: 'https://avatars.githubusercontent.com/u/9919?v=4' }]
        : null
      const result = { request_id: request.request_id, success: true, data: { retcode: 0, msg: 'ok', data: rows } }
      const payload = btoa(unescape(encodeURIComponent(JSON.stringify(result))))
      window.postMessage(`callAPIResult-${payload}`, location.origin)
    } catch {
      // Let malformed calls time out so the production fallback remains covered.
    }
  })
})
const platformOrigin = new URL(baseUrl).origin
await platformPage.goto(`${baseUrl}?level=1&api_origin=${encodeURIComponent(platformOrigin)}&telegram_id=qa-player`, { waitUntil: 'domcontentloaded' })
await platformPage.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })
await platformPage.locator('.ss-champion img').waitFor({ state: 'visible' })
await platformPage.waitForFunction(() => {
  const image = document.querySelector('.ss-champion img')
  return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0
})
if (await platformPage.locator('.ss-kicker').count()) throw new Error('The compact HUD still renders the game title kicker')
if ((await platformPage.locator('.ss-level').textContent()) !== '01') throw new Error('The compact HUD does not show only the two-digit level number')
if (!(await platformPage.locator('.ss-header > .ss-header__actions > .ss-champion').count())) throw new Error('Leaderboard trigger is not inside the header actions')
if (await platformPage.locator('.ss-board > .ss-champion').count()) throw new Error('Leaderboard trigger still floats over the playfield')
if (!(await platformPage.locator('.ss-champion > strong').count())) throw new Error('Leaderboard trigger does not show the champion score')
await platformPage.screenshot({ path: headerOutput })
await platformPage.locator('.ss-champion').click()
await platformPage.locator('.ss-leaderboard').waitFor({ state: 'visible' })
await platformPage.screenshot({ path: output })
await platformPage.locator('.ss-leaderboard__close').click()
await platformPage.setViewportSize({ width: 320, height: 568 })
const narrowLayout = await platformPage.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
if (narrowLayout.scrollWidth > narrowLayout.width) throw new Error(`Narrow leaderboard overflow: ${JSON.stringify(narrowLayout)}`)
await platformPage.screenshot({ path: narrowHeaderOutput })
await platformPage.locator('.ss-champion').click()
await platformPage.locator('.ss-leaderboard').waitFor({ state: 'visible' })
await platformPage.screenshot({ path: narrowOutput })

console.log(JSON.stringify({ ok: true, initialEnabled, doubleTapContract, savedLevel: stored.currentRun.levelId, savedRemoved: stored.currentRun.removed, restartRestored: initialRemaining, restartDifference, platformLeaderboard: true }))
await context.close()
await browser.close()
