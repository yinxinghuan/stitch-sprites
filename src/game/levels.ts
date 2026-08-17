import { CODE_TO_COLOR } from './palette'
import type { Cell, LevelDefinition, SpoolState, ThreadColor } from './types'

export const LEVELS: LevelDefinition[] = [
  {
    id: 1,
    titleKey: 'level.flower',
    reveal: 'sprout',
    density: 2,
    tutorial: true,
    rows: [
      '..YYYYYY..',
      '.YYYYYYYY.',
      'YYRRRRRRYY',
      'YRRRRRRRRY',
      'YRRBBBRRRY',
      'YRRBGBRRRY',
      'YRRBBBRRRY',
      'YYRRRRRRYY',
      '.YYYYYYYY.',
      '..YYYYYY..',
    ],
    columns: [
      [
        { id: 'l1-y-12a', color: 'sun', capacity: 12 },
        { id: 'l1-r-12a', color: 'coral', capacity: 12 },
        { id: 'l1-b-4a', color: 'lake', capacity: 4 },
      ],
      [
        { id: 'l1-y-12b', color: 'sun', capacity: 12 },
        { id: 'l1-r-12b', color: 'coral', capacity: 12 },
        { id: 'l1-b-4b', color: 'lake', capacity: 4 },
      ],
      [
        { id: 'l1-y-10a', color: 'sun', capacity: 10 },
        { id: 'l1-r-11', color: 'coral', capacity: 11 },
        { id: 'l1-g-1', color: 'leaf', capacity: 1 },
      ],
      [
        { id: 'l1-y-10b', color: 'sun', capacity: 10 },
      ],
    ],
  },
  {
    id: 2,
    titleKey: 'level.moth',
    reveal: 'moth',
    density: 2,
    tutorial: false,
    rows: [
      '..PPPPPPPPPP..',
      '.PPRRRRRRRRPP.',
      'PPRRYYYYYYRRPP',
      'PRRYYBBBBYYRRP',
      'PRYYBBKKBBYYRP',
      'PRYBBKGGKBBYRP',
      'PRYBKGGGGKBYRP',
      'PRYBKGGGGKBYRP',
      'PRYBBKGGKBBYRP',
      'PRYYBBKKBBYYRP',
      'PRRYYBBBBYYRRP',
      'PPRRYYYYYYRRPP',
      '.PPRRRRRRRRPP.',
      '..PPPPPPPPPP..',
    ],
    columns: [
      [
        { id: 'l2-p-12', color: 'violet', capacity: 12 },
        { id: 'l2-r-12', color: 'coral', capacity: 12 },
        { id: 'l2-p-10a', color: 'violet', capacity: 10 },
        { id: 'l2-b-10a', color: 'lake', capacity: 10 },
        { id: 'l2-k-6a', color: 'ink', capacity: 6 },
      ],
      [
        { id: 'l2-y-12a', color: 'sun', capacity: 12 },
        { id: 'l2-b-10b', color: 'lake', capacity: 10 },
        { id: 'l2-p-10b', color: 'violet', capacity: 10 },
        { id: 'l2-r-8a', color: 'coral', capacity: 8 },
        { id: 'l2-g-6b', color: 'leaf', capacity: 6 },
      ],
      [
        { id: 'l2-b-8', color: 'lake', capacity: 8 },
        { id: 'l2-k-6b', color: 'ink', capacity: 6 },
        { id: 'l2-p-10c', color: 'violet', capacity: 10 },
        { id: 'l2-r-8b', color: 'coral', capacity: 8 },
        { id: 'l2-y-12b', color: 'sun', capacity: 12 },
      ],
      [
        { id: 'l2-g-6a', color: 'leaf', capacity: 6 },
        { id: 'l2-r-8c', color: 'coral', capacity: 8 },
        { id: 'l2-p-10d', color: 'violet', capacity: 10 },
        { id: 'l2-r-8d', color: 'coral', capacity: 8 },
        { id: 'l2-y-12c', color: 'sun', capacity: 12 },
      ],
    ],
  },
]

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
  LEVELS.forEach((level) => {
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
