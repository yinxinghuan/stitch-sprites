import { CODE_TO_COLOR } from './palette'
import { GENERATED_PATTERNS } from './generated-patterns'
import { findReachable, reachableColors } from './reachability'
import type { Cell, LevelDefinition, SpoolDefinition, SpoolState, ThreadColor } from './types'

const LEVEL_KEYS = [
  'watermelon', 'ladybug', 'turtle', 'whale', 'butterfly', 'teapot', 'moonCat', 'cottage',
  'yarn', 'mitten', 'sweater', 'clock', 'basket', 'musicBox', 'craftRoom', 'potion', 'slime',
  'spellbook', 'mushroomHome', 'moth', 'starCat', 'flowerFox', 'spiritTree', 'umbrella',
  'suitcase', 'bell', 'tram', 'lighthouse', 'nightTrain', 'observatory', 'city', 'alteruCoral',
  'alteruSun', 'alteruNight', 'alteruBloom',
  'gardenLantern', 'nestingDoll', 'aquarium', 'sleepingFox', 'carouselBox', 'clockworkOwl',
  'greenhouse',
]

const LEVEL_COPY: Record<string, { titleKey: string; completeKey: string }> = Object.fromEntries(
  LEVEL_KEYS.map((key) => [key, { titleKey: `level.${key}`, completeKey: `complete.${key}` }]),
)

function defineLevel(index: number): LevelDefinition {
  const generated = GENERATED_PATTERNS[index]
  if (!generated) throw new Error(`Missing generated pattern ${index + 1}`)
  const id = index + 1
  const copy = LEVEL_COPY[generated.key]
  if (!copy) throw new Error(`Missing copy metadata for ${generated.key}`)
  const width = generated.rows[0]?.length ?? 0
  if (!width || generated.rows.some((row) => row.length !== width)) {
    throw new Error(`Level ${id}: all pattern rows must have the same width`)
  }
  const columns: SpoolDefinition[][] = generated.columns.map((column, columnIndex) => column.map(([code, capacity], spoolIndex) => {
    const color = CODE_TO_COLOR[code]
    if (!color) throw new Error(`Level ${id}: unknown generated spool color ${code}`)
    return {
      id: `l${id}-${color}-${columnIndex + 1}-${String(spoolIndex + 1).padStart(2, '0')}`,
      color,
      capacity,
    }
  }))
  return {
    id,
    ...copy,
    reveal: generated.key,
    density: 1,
    rows: generated.rows,
    displayPalette: Object.fromEntries(
      Object.entries(generated.palette)
        .map(([code, hex]) => [CODE_TO_COLOR[code], hex])
        .filter(([color]) => Boolean(color)),
    ) as Partial<Record<ThreadColor, string>>,
    tutorial: id <= 2,
    columns,
    solution: generated.solution,
  }
}

export const LEVELS: LevelDefinition[] = GENERATED_PATTERNS.map((_, index) => defineLevel(index))

export const DUAL_ENTRY_LAB_LEVEL: LevelDefinition = {
  id: 42,
  titleKey: 'level.dualEntryLab',
  completeKey: 'complete.dualEntryLab',
  reveal: 'dual-entry-lab',
  density: 1,
  textureMode: 'procedural',
  tutorial: false,
  displayPalette: {
    lake: '#3e9bd3', coral: '#ed5b67', leaf: '#55ad6e',
    sun: '#f3bf3f', violet: '#9473c8', ink: '#353541',
  },
  rows: [
    '........R........',
    '.....BBBRRRR.....',
    '...BBBBBYRRRRR...',
    '..BBBGGGYYYYRRR..',
    '..BBGGGGKYYYYRR..',
    '.BBGGGPPKKKYYYRR.',
    '.BBGGPPPKKKKYYRR.',
    '.BBGGPPPKKKKYYRR.',
    'BBGGPPPPKKKKKYYRR',
    '.BBGGPPPKKKKYYRR.',
    '.BBGGPPPKKKKYYRR.',
    '.BBGGGPPKKKYYYRR.',
    '..BBGGGGKYYYYRR..',
    '..BBBGGGYYYYRRR..',
    '...BBBBBYRRRRR...',
    '.....BBBRRRR.....',
    '........R........',
  ],
  columns: [
    [{ id: 'lab-lake-entry', color: 'lake', capacity: 40 }],
    [{ id: 'lab-leaf-left', color: 'leaf', capacity: 30 }],
    [{ id: 'lab-coral-entry', color: 'coral', capacity: 44 }],
    [
      { id: 'lab-violet-left', color: 'violet', capacity: 20 },
      { id: 'lab-ink-right', color: 'ink', capacity: 29 },
      { id: 'lab-sun-right', color: 'sun', capacity: 34 },
    ],
  ],
  solution: [0, 1, 3, 2, 3, 3],
}

export const MULTI_RING_LAB_LEVEL: LevelDefinition = {
  id: 42,
  titleKey: 'level.multiRingLab',
  completeKey: 'complete.multiRingLab',
  reveal: 'multi-ring-lab',
  density: 1,
  textureMode: 'procedural',
  tutorial: false,
  displayPalette: {
    lake: '#3e9bd3', coral: '#ed5b67', leaf: '#55ad6e',
    sun: '#f3bf3f', violet: '#9473c8', ink: '#353541',
  },
  rows: [
    '.................................................',
    '........................R........................',
    '..................BBBBBBRRRRRRR..................',
    '...............BBBBBBBBBRRRRRRRRRR...............',
    '.............BBBBBBBBBBBRRRRRRRRRRRR.............',
    '............BBBBBBBBBBBBRRRRRRRRRRRRR............',
    '..........BBBBBBBBBBBBBBRRRRRRRRRRRRRRR..........',
    '.........BBBBBBBBBBBPPPPPPPPPRRRRRRRRRRR.........',
    '........BBBBBBBBBPPPPPPPPPPPPPPPRRRRRRRRR........',
    '.......BBBBBBBBPPPPPPPPPPPPPPPPPPPRRRRRRRR.......',
    '......BBBBBBBBPPPPPPPPPPPPPPPPPPPPPRRRRRRRR......',
    '......BBBBBBBPPPPPPPPPPPPPPPPPPPPPPPRRRRRRR......',
    '.....BBBBBBBPPPPPPPPPPBBRRRPPPPPPPPPPRRRRRRR.....',
    '....BBBBBBBPPPPPPPPBBBBBRRRRRRPPPPPPPPRRRRRRR....',
    '....BBBBBBPPPPPPPBBBBBBBRRRRRRRRPPPPPPPRRRRRR....',
    '...BBBBBBPPPPPPPBBBBBBBBRRRRRRRRRPPPPPPPRRRRRR...',
    '...BBBBBBPPPPPPBBBBBBBBBRRRRRRRRRRPPPPPPRRRRRR...',
    '...BBBBBPPPPPPBBBBBBBBBBRRRRRRRRRRRPPPPPPRRRRR...',
    '..BBBBBBPPPPPPBBBBBBBBBBRRRRRRRRRRRPPPPPPRRRRRR..',
    '..BBBBBBPPPPPBBBBBBBBBBKKKRRRRRRRRRRPPPPPRRRRRR..',
    '..BBBBBPPPPPPBBBBBBBBKKKKKKKRRRRRRRRPPPPPPRRRRR..',
    '..BBBBBPPPPPPBBBBBBBKKKKKKKKKRRRRRRRPPPPPPRRRRR..',
    '..BBBBBPPPPPBBBBBBBBKKKKKKKKKRRRRRRRRPPPPPRRRRR..',
    '..BBBBBPPPPPBBBBBBBKKKKKKKKKKKRRRRRRRPPPPPRRRRR..',
    '.GGGGGGPPPPPGGGGGGGKKKKKKKKKKKYYYYYYYPPPPPYYYYYY.',
    '..GGGGGPPPPPGGGGGGGKKKKKKKKKKKYYYYYYYPPPPPYYYYY..',
    '..GGGGGPPPPPGGGGGGGGKKKKKKKKKYYYYYYYYPPPPPYYYYY..',
    '..GGGGGPPPPPPGGGGGGGKKKKKKKKKYYYYYYYPPPPPPYYYYY..',
    '..GGGGGPPPPPPGGGGGGGGKKKKKKKYYYYYYYYPPPPPPYYYYY..',
    '..GGGGGGPPPPPGGGGGGGGGGKKKYYYYYYYYYYPPPPPYYYYYY..',
    '..GGGGGGPPPPPPGGGGGGGGGGYYYYYYYYYYYPPPPPPYYYYYY..',
    '...GGGGGPPPPPPGGGGGGGGGGYYYYYYYYYYYPPPPPPYYYYY...',
    '...GGGGGGPPPPPPGGGGGGGGGYYYYYYYYYYPPPPPPYYYYYY...',
    '...GGGGGGPPPPPPPGGGGGGGGYYYYYYYYYPPPPPPPYYYYYY...',
    '....GGGGGGPPPPPPPGGGGGGGYYYYYYYYPPPPPPPYYYYYY....',
    '....GGGGGGGPPPPPPPPGGGGGYYYYYYPPPPPPPPYYYYYYY....',
    '.....GGGGGGGPPPPPPPPPPGGYYYPPPPPPPPPPYYYYYYY.....',
    '......GGGGGGGPPPPPPPPPPPPPPPPPPPPPPPYYYYYYY......',
    '......GGGGGGGGPPPPPPPPPPPPPPPPPPPPPYYYYYYYY......',
    '.......GGGGGGGGPPPPPPPPPPPPPPPPPPPYYYYYYYY.......',
    '........GGGGGGGGGPPPPPPPPPPPPPPPYYYYYYYYY........',
    '.........GGGGGGGGGGGPPPPPPPPPYYYYYYYYYYY.........',
    '..........GGGGGGGGGGGGGGYYYYYYYYYYYYYYY..........',
    '............GGGGGGGGGGGGYYYYYYYYYYYYY............',
    '.............GGGGGGGGGGGYYYYYYYYYYYY.............',
    '...............GGGGGGGGGYYYYYYYYYY...............',
    '..................GGGGGGYYYYYYY..................',
    '........................Y........................',
    '.................................................',
  ],
  columns: [
    [
      { id: 'ring-lake-carry', color: 'lake', capacity: 255 },
      { id: 'ring-violet-gate', color: 'violet', capacity: 492 },
    ],
    [
      { id: 'ring-coral-carry', color: 'coral', capacity: 268 },
      { id: 'ring-ink-core', color: 'ink', capacity: 89 },
    ],
    [{ id: 'ring-leaf-carry', color: 'leaf', capacity: 268 }],
    [{ id: 'ring-sun-carry', color: 'sun', capacity: 281 }],
  ],
  solution: [0, 0, 1, 2, 3, 1],
}

export function activateDualEntryLab(): void {
  LEVELS[LEVELS.length - 1] = DUAL_ENTRY_LAB_LEVEL
}

export function activateMultiRingLab(): void {
  LEVELS[LEVELS.length - 1] = MULTI_RING_LAB_LEVEL
}

export function createCells(level: LevelDefinition): Cell[][] {
  return level.rows.flatMap((row) => Array.from({ length: level.density }, () => (
    [...row].flatMap((code) => Array.from({ length: level.density }, () => ({
      color: code === '.' ? null : CODE_TO_COLOR[code] ?? null,
      cleared: false,
    })))
  )))
}

export function createColumns(level: LevelDefinition): SpoolState[][] {
  const capacityScale = level.density * level.density
  return level.columns.map((column) => column.map((spool) => ({
    ...spool,
    capacity: spool.capacity * capacityScale,
    remaining: spool.capacity * capacityScale,
  })))
}

function countCells(level: LevelDefinition): Map<ThreadColor, number> {
  const counts = new Map<ThreadColor, number>()
  createCells(level).flat().forEach((cell) => {
    if (cell.color) counts.set(cell.color, (counts.get(cell.color) ?? 0) + 1)
  })
  return counts
}

export function validateLevels(): void {
  if (LEVELS.length !== 42) throw new Error(`Expected 42 levels, found ${LEVELS.length}`)
  let previousColorCount = 0
  LEVELS.forEach((level, index) => {
    const generated = GENERATED_PATTERNS[index]
    if (generated.colorCount < previousColorCount) {
      throw new Error(`Level ${level.id}: color count order regressed`)
    }
    previousColorCount = generated.colorCount
    const initialCells = createCells(level)
    const entryColors = reachableColors(initialCells, findReachable(initialCells))
    if (!entryColors.size) throw new Error(`Level ${level.id}: expected a reachable outer color`)
    if (level.id === 1 && entryColors.size !== 1) {
      throw new Error(`Level 1: expected one tutorial outer color, found ${[...entryColors].join(', ')}`)
    }
    if (level.id >= 36 && entryColors.size !== 1) {
      throw new Error(`Challenge level ${level.id}: expected one outer color, found ${[...entryColors].join(', ')}`)
    }
    const cells = countCells(level)
    const spools = new Map<ThreadColor, number>()
    createColumns(level).flat().forEach((spool) => {
      spools.set(spool.color, (spools.get(spool.color) ?? 0) + spool.capacity)
    })
    cells.forEach((count, color) => {
      if (spools.get(color) !== count) {
        throw new Error(`Level ${level.id}: ${color} cells=${count}, spool capacity=${spools.get(color) ?? 0}`)
      }
    })
  })
}

export function validateDualEntryLab(): void {
  const level = DUAL_ENTRY_LAB_LEVEL
  const initialCells = createCells(level)
  const entryColors = reachableColors(initialCells, findReachable(initialCells))
  if (entryColors.size !== 2 || !entryColors.has('lake') || !entryColors.has('coral')) {
    throw new Error(`Dual-entry lab: expected lake + coral entries, found ${[...entryColors].join(', ')}`)
  }
  const cells = countCells(level)
  const spools = new Map<ThreadColor, number>()
  createColumns(level).flat().forEach((spool) => {
    spools.set(spool.color, (spools.get(spool.color) ?? 0) + spool.capacity)
  })
  cells.forEach((count, color) => {
    if (spools.get(color) !== count) {
      throw new Error(`Dual-entry lab: ${color} cells=${count}, spool capacity=${spools.get(color) ?? 0}`)
    }
  })
}

export function validateMultiRingLab(): void {
  const level = MULTI_RING_LAB_LEVEL
  const initialCells = createCells(level)
  const entryColors = reachableColors(initialCells, findReachable(initialCells))
  const expected = new Set<ThreadColor>(['lake', 'coral', 'leaf', 'sun'])
  if (entryColors.size !== expected.size || [...expected].some((color) => !entryColors.has(color))) {
    throw new Error(`Multi-ring lab: expected four outer colors, found ${[...entryColors].join(', ')}`)
  }
  const cells = countCells(level)
  const spools = new Map<ThreadColor, number>()
  createColumns(level).flat().forEach((spool) => {
    spools.set(spool.color, (spools.get(spool.color) ?? 0) + spool.capacity)
  })
  cells.forEach((count, color) => {
    if (spools.get(color) !== count) {
      throw new Error(`Multi-ring lab: ${color} cells=${count}, spool capacity=${spools.get(color) ?? 0}`)
    }
  })
}
