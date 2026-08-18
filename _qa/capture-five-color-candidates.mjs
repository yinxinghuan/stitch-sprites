import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const qaDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.dirname(qaDir)
const output = path.join(qaDir, 'ui', 'five-color-candidates-selection-20-27.png')

const candidates = [
  [20, '海角灯塔', 'lighthouse'],
  [21, '花窗电车', 'tram'],
  [22, '蘑菇小屋', 'mushroomHome'],
  [23, 'AlterU · 珊瑚章', 'alteruCoral'],
  [24, '花环狐狸面具', 'flowerFox'],
  [25, '月色毛线', 'yarn'],
  [26, '雪花手套', 'mitten'],
  [27, 'AlterU · 盛放章', 'alteruBloom'],
]

const cards = await Promise.all(candidates.map(async ([level, title, key]) => {
  const bytes = await fs.readFile(path.join(rootDir, 'public', 'patterns', `${key}.png`))
  return { level, title, src: `data:image/png;base64,${bytes.toString('base64')}` }
}))

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1080, height: 1540 }, deviceScaleFactor: 1 })
await page.setContent(`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}html,body{margin:0;width:1080px;height:1540px;overflow:hidden}
  body{padding:42px 44px 46px;color:#2a2930;font-family:"PingFang SC","Noto Sans CJK SC",system-ui,sans-serif;background:#e8e0d3}
  h1{margin:0 0 8px;font-size:44px;line-height:1.15}p{margin:0 0 28px;color:#696168;font-size:22px}
  .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}
  .card{height:320px;padding:18px 20px;display:grid;grid-template-columns:226px minmax(0,1fr);align-items:center;gap:18px;border:2px solid rgba(92,68,53,.14);border-radius:28px;background:#fff9ec;box-shadow:0 7px 0 rgba(92,68,53,.10)}
  .hoop{width:226px;height:226px;padding:16px;display:grid;place-items:center;border:9px solid #c98746;border-radius:50%;background:#f8f0dd;box-shadow:inset 0 0 0 4px #edbf79,0 5px 9px rgba(80,51,34,.18);overflow:hidden}
  img{display:block;width:100%;height:100%;object-fit:contain}
  .copy{align-self:center;min-width:0}.number{display:block;margin-bottom:12px;color:#9b6a43;font-size:24px;font-weight:800;letter-spacing:.08em}
  h2{margin:0;font-size:31px;line-height:1.24;overflow-wrap:anywhere}.meta{display:block;margin-top:14px;color:#746b70;font-size:20px;font-weight:650}
</style></head><body>
  <h1>五色关候选</h1><p>第 20–27 关 · 请直接截图打勾或打叉</p>
  <main class="grid">${cards.map((card) => `<section class="card"><div class="hoop"><img src="${card.src}" alt=""></div><div class="copy"><span class="number">${String(card.level).padStart(2, '0')}</span><h2>${card.title}</h2><span class="meta">5 种线色</span></div></section>`).join('')}</main>
</body></html>`, { waitUntil: 'load' })
await page.screenshot({ path: output })
await browser.close()
console.log(output)
