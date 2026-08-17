import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const baseUrl = process.env.STITCH_SPRITES_URL || 'http://127.0.0.1:5180/'
const cpuRate = Number(process.env.STITCH_SPRITES_CPU_RATE || 6)
const level = Number(process.env.STITCH_SPRITES_LEVEL || 2)
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'zh-CN' })
const page = await context.newPage()
const cdp = await context.newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate })
await page.goto(`${baseUrl}?level=${level}`, { waitUntil: 'domcontentloaded' })
await page.locator('.ss-app').waitFor({ state: 'visible' })
await page.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })
await page.waitForTimeout(300)

const result = await page.evaluate(async () => {
  const button = document.querySelector('[data-column="0"]')
  if (!(button instanceof HTMLElement)) throw new Error('Missing first spool')
  const deltas = []
  let previous = performance.now()
  let firstResponse = 0
  const initial = document.querySelector('.ss-remaining')?.textContent
  const started = performance.now()
  button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }))
  const dispatchMs = performance.now() - started
  const slotAfterDispatch = Boolean(document.querySelector('.ss-slot:not(.ss-slot--empty)'))
  await new Promise((resolve) => {
    const sample = (now) => {
      deltas.push(now - previous)
      previous = now
      if (!firstResponse && document.querySelector('.ss-slot:not(.ss-slot--empty)')) firstResponse = Math.max(0, now - started)
      if (now - started < 2600) requestAnimationFrame(sample)
      else resolve()
    }
    requestAnimationFrame(sample)
  })
  const sorted = [...deltas].sort((a, b) => a - b)
  const quantile = (value) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))]
  return {
    initial,
    final: document.querySelector('.ss-remaining')?.textContent,
    dispatchMs: Number(dispatchMs.toFixed(1)),
    slotAfterDispatch,
    firstResponseMs: Number(firstResponse.toFixed(1)),
    frames: deltas.length,
    averageFrameMs: Number((deltas.reduce((sum, value) => sum + value, 0) / deltas.length).toFixed(2)),
    p95FrameMs: Number(quantile(0.95).toFixed(2)),
    worstFrameMs: Number(Math.max(...deltas).toFixed(2)),
    framesOver25Ms: deltas.filter((value) => value > 25).length,
    framesOver50Ms: deltas.filter((value) => value > 50).length,
  }
})

console.log(JSON.stringify({ url: baseUrl, level, cpuRate, ...result }))
await context.close()
await browser.close()
