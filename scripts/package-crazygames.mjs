// Pack the Crazy Games guest build next to a zip with index.html at the root.
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist-crazygames')
const staticDir = path.join(root, 'artifacts', 'crazygames')
const zipPath = path.join(root, 'artifacts', 'unstitch-sprites-crazygames.zip')

if (!existsSync(path.join(dist, 'index.html'))) {
  console.error('dist-crazygames/index.html is missing. Run vite build --mode crazygames first.')
  process.exit(1)
}

for (const relative of [
  'alteru.svg',
  'alteru-storage-scope.js',
  'poster.png',
  'patterns/alteruBloom.png',
  'vite.svg',
]) {
  rmSync(path.join(dist, relative), { force: true })
}

const banned = [
  'AlterU',
  'aigram',
  'guest-shell',
  'alteru.svg',
  'vite.svg',
  'images.aiwaves.tech',
  'apps.apple.com',
]

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name)
    if (statSync(file).isDirectory()) out.push(...walk(file))
    else out.push(file)
  }
  return out
}

const indexHtml = readFileSync(path.join(dist, 'index.html'), 'utf8')
const title = indexHtml.match(/<title>([^<]*)<\/title>/i)
if (!title || title[1].trim() !== 'Unstitch Sprites') {
  console.error(`Crazy Games <title> must be "Unstitch Sprites", got ${JSON.stringify(title && title[1])}`)
  process.exit(1)
}
if (!/lang="en"/i.test(indexHtml)) {
  console.error('Crazy Games <html> must be lang="en"')
  process.exit(1)
}
if (indexHtml.includes('main.ts') && !indexHtml.includes('main-cg')) {
  console.error('Crazy Games index still points at the AlterU entry')
  process.exit(1)
}

for (const file of walk(dist)) {
  if (!/\.(html|js|css)$/.test(file)) continue
  const text = readFileSync(file, 'utf8')
  for (const needle of banned) {
    if (text.includes(needle)) {
      console.error(`${path.relative(root, file)} still contains ${JSON.stringify(needle)}`)
      process.exit(1)
    }
  }
}

const script = indexHtml.includes('main-cg') || indexHtml.includes('assets/')
if (!script) {
  console.error('Crazy Games index is missing its script')
  process.exit(1)
}

rmSync(staticDir, { recursive: true, force: true })
cpSync(dist, staticDir, { recursive: true })
rmSync(zipPath, { force: true })
execFileSync('zip', ['-r', '-X', zipPath, '.'], { cwd: dist, stdio: 'inherit' })
const listing = execFileSync('unzip', ['-l', zipPath], { encoding: 'utf8' })
if (!listing.split('\n').some((line) => /\sindex\.html$/.test(line) && !line.includes('/'))) {
  console.error('zip is missing index.html at the archive root')
  process.exit(1)
}
console.log(`static: ${staticDir}`)
console.log(`zip: ${zipPath}`)
