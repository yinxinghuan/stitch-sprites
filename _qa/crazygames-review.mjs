import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire('/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/')
const { chromium } = require('playwright')
const qaRoot = path.dirname(fileURLToPath(import.meta.url))
const outputDir = path.join(qaRoot, 'ui', 'crazygames-final')
mkdirSync(outputDir, { recursive: true })
const baseUrl = process.env.STITCH_SPRITES_URL || 'http://127.0.0.1:4179/'
const source = readFileSync(path.join(qaRoot, '..', 'src', 'cg', 'game', 'generated-patterns.ts'), 'utf8')
const assignment = source.indexOf('= [', source.indexOf('GENERATED_PATTERNS'))
const patterns = JSON.parse(source.slice(assignment + 2).trim())
const sdkStub = `window.__cgEvents=[];window.CrazyGames={SDK:{environment:'local',init:async()=>{window.__cgEvents.push('init')},game:{settings:{muteAudio:false},loadingStart(){window.__cgEvents.push('loadingStart')},loadingStop(){window.__cgEvents.push('loadingStop')},gameplayStart(){window.__cgEvents.push('gameplayStart')},gameplayStop(){window.__cgEvents.push('gameplayStop')},addSettingsChangeListener(){}}}};`
const browser = await chromium.launch({ headless: true })
const errors = []

async function contextFor(viewport, accelerate = false) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'en-US' })
  await context.route('https://sdk.crazygames.com/**', (route) => route.fulfill({ contentType: 'text/javascript', body: sdkStub }))
  await context.addInitScript(({ fast }) => {
    localStorage.clear()
    if (fast) {
      const nativeSetTimeout = window.setTimeout.bind(window)
      window.setTimeout = (handler, timeout = 0, ...args) => nativeSetTimeout(handler, Math.min(timeout, 1), ...args)
    }
  }, { fast: accelerate })
  return context
}

function watch(page) {
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
}

async function clickColumn(page, column) {
  const button = page.locator(`.ss-spool[data-column="${column}"]`)
  await button.waitFor({ state: 'visible' })
  await page.keyboard.press(String(column + 1))
  await page.waitForTimeout(30)
  await page.waitForFunction(() => !window.__CG_QA__.isProcessing || window.__CG_QA__.snapshot.phase !== 'playing', null, { timeout: 10000 })
}

async function captureViewport(viewport) {
  const context = await contextFor(viewport, true)
  const page = await context.newPage()
  watch(page)
  await page.goto(`${baseUrl}?qa=1`, { waitUntil: 'domcontentloaded' })
  await page.locator('.cg-title').waitFor()
  const size = `${viewport.width}x${viewport.height}`
  await page.screenshot({ path: path.join(outputDir, `${size}-title.png`) })
  await page.locator('[data-cg="play"]').click()
  await page.locator('.cg-coach__card').waitFor()
  const tutorialLayout = await page.evaluate(() => {
    const coach = document.querySelector('.cg-coach__card')?.getBoundingClientRect()
    const board = document.querySelector('.ss-board')?.getBoundingClientRect()
    const enabled = [...document.querySelectorAll('.ss-spool:not(:disabled)')].map((item) => item.getAttribute('data-column'))
    const clipped = [...document.querySelectorAll('button, .cg-coach__card p, .cg-coach__card h2')].filter((item) => {
      const rect = item.getBoundingClientRect()
      return rect.left < 0 || rect.top < 0 || rect.right > innerWidth || rect.bottom > innerHeight
    }).map((item) => ({ className: item.className, text: item.textContent?.trim().slice(0, 60), rect: item.getBoundingClientRect().toJSON() }))
    const overlap = coach && board
      ? Math.max(0, Math.min(coach.right, board.right) - Math.max(coach.left, board.left))
        * Math.max(0, Math.min(coach.bottom, board.bottom) - Math.max(coach.top, board.top))
      : -1
    return { enabled, clipped, overlap, viewport: { width: innerWidth, height: innerHeight }, scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight } }
  })
  if (tutorialLayout.enabled.join(',') !== '0') throw new Error(`${size}: tutorial enabled ${tutorialLayout.enabled.join(',')}`)
  await page.screenshot({ path: path.join(outputDir, `${size}-tutorial.png`) })
  if (tutorialLayout.clipped.length || tutorialLayout.overlap > 0) throw new Error(`${size}: tutorial layout ${JSON.stringify(tutorialLayout)}`)
  if (tutorialLayout.scroll.width > viewport.width || tutorialLayout.scroll.height > viewport.height) throw new Error(`${size}: page overflow ${JSON.stringify(tutorialLayout)}`)
  await page.locator('[data-cg="tutor-skip"]').click()
  await clickColumn(page, patterns[0].solution[0])
  await page.screenshot({ path: path.join(outputDir, `${size}-mid.png`) })
  for (const column of patterns[0].solution.slice(1)) await clickColumn(page, column)
  await page.locator('.cg-result').waitFor({ timeout: 30000 })
  const resultText = await page.locator('.cg-result').innerText()
  if (!resultText.includes('Next pattern:') || !resultText.includes('Next unlock:')) throw new Error(`${size}: incomplete result copy: ${resultText}`)
  await page.screenshot({ path: path.join(outputDir, `${size}-complete.png`) })
  await page.locator('[data-cg="album"]').click()
  await page.locator('.ss-gallery').waitFor()
  await page.screenshot({ path: path.join(outputDir, `${size}-album.png`) })
  const events = await page.evaluate(() => window.__cgEvents)
  for (const expected of ['init', 'loadingStart', 'loadingStop', 'gameplayStart', 'gameplayStop']) {
    if (!events.includes(expected)) throw new Error(`${size}: missing SDK event ${expected}: ${events.join(',')}`)
  }
  await context.close()
  return { viewport: size, tutorialLayout, events, resultText }
}

async function playFirstTen() {
  const results = []
  const requestedLevel = Number(process.env.STITCH_SPRITES_QA_LEVEL ?? 0)
  const levels = requestedLevel ? [requestedLevel] : Array.from({ length: 10 }, (_, index) => index + 1)
  for (const level of levels) {
    const context = await contextFor({ width: 907, height: 510 }, true)
    await context.addInitScript(() => localStorage.setItem('stitch_sprites_cg_tutorial_v1', JSON.stringify({ done: true, step: 5 })))
    const page = await context.newPage()
    watch(page)
    await page.goto(`${baseUrl}?level=${level}&qa=1`, { waitUntil: 'domcontentloaded' })
    await page.locator('[data-cg="play"]').click()
    const started = Date.now()
    let failure = null
    try {
      for (const column of patterns[level - 1].solution) {
        await page.evaluate((index) => window.__CG_QA__.selectColumn(index), column)
        await page.waitForTimeout(30)
        await page.waitForFunction(() => !window.__CG_QA__.isProcessing || window.__CG_QA__.snapshot.phase !== 'playing', null, { timeout: 10000 })
      }
      const final = await page.evaluate(() => ({ phase: window.__CG_QA__.snapshot.phase, remaining: window.__CG_QA__.snapshot.remaining, slots: window.__CG_QA__.snapshot.slots.length }))
      if (final.phase !== 'complete') failure = `path ended in ${final.phase} with ${final.remaining} stitches and ${final.slots} waiting reels`
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error)
    }
    results.push({ level, harnessSeconds: Number(((Date.now() - started) / 1000).toFixed(2)), timingMode: 'accelerated automated browser', failure, impossible: Boolean(failure) })
    console.log(JSON.stringify(results.at(-1)))
    await context.close()
  }
  return results
}

async function measureInitialTransfer() {
  const context = await contextFor({ width: 907, height: 510 }, false)
  const page = await context.newPage()
  watch(page)
  const resources = []
  page.on('response', async (response) => {
    if (!response.ok() || !response.url().startsWith(baseUrl)) return
    const body = await response.body().catch(() => null)
    if (body) resources.push({ url: response.url().replace(baseUrl, './'), bytes: body.byteLength })
  })
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.locator('.cg-title').waitFor()
  await page.waitForTimeout(100)
  const requestedPatterns = resources.filter((item) => item.url.includes('/patterns/'))
  const initial = { bytes: resources.reduce((sum, item) => sum + item.bytes, 0), files: resources, requestedPatterns }
  await context.close()
  return initial
}

const requestedViewport = process.env.STITCH_SPRITES_QA_VIEWPORT
const viewports = requestedViewport
  ? [Object.fromEntries(requestedViewport.split('x').map(Number).map((value, index) => [index ? 'height' : 'width', value]))]
  : [{ width: 800, height: 450 }, { width: 907, height: 510 }, { width: 1920, height: 1080 }]
const mode = process.env.STITCH_SPRITES_QA_MODE ?? 'all'
const screenshots = []
if (mode === 'all' || mode === 'capture') {
  for (const viewport of viewports) screenshots.push(await captureViewport(viewport))
}
const firstTen = mode === 'all' || mode === 'play' ? await playFirstTen() : []
const initialTransfer = mode === 'all' || mode === 'transfer' ? await measureInitialTransfer() : { bytes: 0, files: [], requestedPatterns: [] }
await browser.close()
if (errors.length) throw new Error(errors.join('\n'))
if (firstTen.some((row) => row.failure)) throw new Error(`First-ten playthrough failed: ${JSON.stringify(firstTen)}`)
if (initialTransfer.requestedPatterns.some((item) => !item.url.endsWith('/patterns/ladybug.png')) || initialTransfer.requestedPatterns.length > 1) {
  throw new Error(`Initial screen fetched deferred patterns: ${JSON.stringify(initialTransfer.requestedPatterns)}`)
}
const report = { ok: true, screenshots, firstTen, initialTransfer }
writeFileSync(path.join(qaRoot, `crazygames-review-${mode}${requestedViewport ? `-${requestedViewport}` : ''}.json`), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
