import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const expected = new Map([
  ['dist/index.html', '10fe9034dd0e36a7256e2e472b95d35815de4208d076a27477f61af81f8fd02c'],
  ['dist/assets/index-JLPrKM9G.css', '39754c2a45d704a38b609631ea4699bedffb1889ad9812ff5976458f68a65add'],
  ['dist/assets/index-DAzv1NZE.js', 'b106480738d4c82e3a4c07f895dac2a6324f7f2e9bab8be97a8ba4911c48b37a'],
  ['dist/alteru-storage-scope.js', '7dc73a406c88605cab3b3a06d99380a638d7218d652f4b26b10c86bab2cd54bc'],
  ['dist/alteru.svg', '4a4186a41df361ef97db7c6337752fd8a901d140b86541807134e01600a6dc4c'],
  ['dist/poster.png', '3670fbbca215bba38bb161c77cda72d9878b7773beff5bbf2e5a354fed6aeb6e'],
])

for (const [relative, wanted] of expected) {
  const file = path.join(root, relative)
  if (!existsSync(file)) throw new Error(`Missing host artifact ${relative}`)
  const actual = createHash('sha256').update(readFileSync(file)).digest('hex')
  if (actual !== wanted) throw new Error(`${relative}: expected ${wanted}, got ${actual}`)
  console.log(`${actual}  ${relative}`)
}

