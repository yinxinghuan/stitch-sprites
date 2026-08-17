import { CODE_TO_COLOR } from './palette'
import type { Cell, LevelDefinition, SpoolState, ThreadColor } from './types'

export const LEVELS: LevelDefinition[] = [
  {
    id: 1,
    titleKey: 'level.flower',
    reveal: 'sprout',
    tutorial: true,
    rows: [
      '..YYY..',
      '.YYYYY.',
      'YYRRRYY',
      'YRRBRRY',
      'YYRRRYY',
      '.YYYYY.',
      '..YYY..',
    ],
    columns: [
      [
        { id: 'l1-y-10', color: 'sun', capacity: 10 },
        { id: 'l1-r-5a', color: 'coral', capacity: 5 },
      ],
      [
        { id: 'l1-y-8a', color: 'sun', capacity: 8 },
        { id: 'l1-r-5b', color: 'coral', capacity: 5 },
      ],
      [
        { id: 'l1-y-8b', color: 'sun', capacity: 8 },
        { id: 'l1-b-1', color: 'lake', capacity: 1 },
      ],
      [],
    ],
  },
  {
    id: 2,
    titleKey: 'level.moth',
    reveal: 'moth',
    tutorial: false,
    rows: [
      'PPPPPPPPP',
      'PRRRRRRRP',
      'PRYYYYYRP',
      'PRYBBBYRP',
      'PRYBKBYRP',
      'PRYBBBYRP',
      'PRYYYYYRP',
      'PRRRRRRRP',
      'PPPPPPPPP',
    ],
    columns: [
      [
        { id: 'l2-b-8a', color: 'coral', capacity: 8 },
        { id: 'l2-c-8a', color: 'sun', capacity: 8 },
        { id: 'l2-a-10a', color: 'violet', capacity: 10 },
      ],
      [
        { id: 'l2-c-8b', color: 'sun', capacity: 8 },
        { id: 'l2-d-4a', color: 'lake', capacity: 4 },
        { id: 'l2-a-10b', color: 'violet', capacity: 10 },
      ],
      [
        { id: 'l2-d-4b', color: 'lake', capacity: 4 },
        { id: 'l2-e-1', color: 'ink', capacity: 1 },
        { id: 'l2-b-8b', color: 'coral', capacity: 8 },
      ],
      [
        { id: 'l2-a-12', color: 'violet', capacity: 12 },
        { id: 'l2-b-8c', color: 'coral', capacity: 8 },
      ],
    ],
  },
]

export function createCells(level: LevelDefinition): Cell[][] {
  return level.rows.map((row) => [...row].map((code) => ({
    color: code === '.' ? null : CODE_TO_COLOR[code] ?? null,
    cleared: false,
  })))
}

export function createColumns(level: LevelDefinition): SpoolState[][] {
  return level.columns.map((column) => column.map((spool) => ({ ...spool, remaining: spool.capacity })))
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
    level.columns.flat().forEach((spool) => {
      spools.set(spool.color, (spools.get(spool.color) ?? 0) + spool.capacity)
    })
    cells.forEach((count, color) => {
      if (spools.get(color) !== count) {
        throw new Error(`Level ${level.id}: ${color} cells=${count}, spool capacity=${spools.get(color) ?? 0}`)
      }
    })
  })
}
