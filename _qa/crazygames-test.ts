import { createCells, createColumns, LEVELS, validateLevels } from '../src/cg/game/levels.ts'
import { chooseReachableCell, findReachable } from '../src/cg/game/reachability.ts'
import type { ActiveSlot, Cell, SpoolState } from '../src/cg/game/types.ts'

interface State {
  cells: Cell[][]
  columns: SpoolState[][]
  slots: ActiveSlot[]
  sequence: number
}

function settle(state: State): void {
  while (true) {
    const reachable = findReachable(state.cells)
    let progressed = false
    for (const slot of state.slots) {
      while (slot.spool.remaining > 0) {
        const target = chooseReachableCell(state.cells, reachable, slot.spool.color, new Set())
        if (!target) break
        state.cells[target.row][target.col].cleared = true
        slot.spool.remaining -= 1
        progressed = true
      }
    }
    state.slots = state.slots.filter((slot) => slot.spool.remaining > 0)
    if (!progressed) return
  }
}

validateLevels()
if (LEVELS.length !== 40) throw new Error(`Expected 40 guest patterns, found ${LEVELS.length}`)
if (LEVELS.some((level) => level.reveal === 'alteruBloom')) throw new Error('AlterU logo chart leaked into guest levels')

const report = LEVELS.map((level) => {
  const state: State = { cells: createCells(level), columns: createColumns(level), slots: [], sequence: 0 }
  const slotLimit = level.guestRule === 'tight-rack' || level.guestRule === 'combined' ? 4 : 5
  let previous = -1
  let peakWaiting = 0
  level.solution.forEach((column) => {
    const alternates = level.guestRule === 'alternate' || level.guestRule === 'combined'
    if (alternates && column === previous) throw new Error(`Level ${level.id} violates Alternating Loom in its solution`)
    if (state.slots.length >= slotLimit) throw new Error(`Level ${level.id} fills its ${slotLimit}-slot rack on the authored solution`)
    const spool = state.columns[column].shift()
    if (!spool) throw new Error(`Level ${level.id} solution selects empty column ${column + 1}`)
    state.slots.push({ slotId: ++state.sequence, sourceColumn: column, spool, state: 'waiting' })
    settle(state)
    peakWaiting = Math.max(peakWaiting, state.slots.length)
    previous = column
  })
  const remaining = state.cells.flat().filter((cell) => cell.color && !cell.cleared).length
  if (remaining) throw new Error(`Level ${level.id} authored solution leaves ${remaining} stitches`)
  return {
    level: level.id,
    selections: level.solution.length,
    peakWaiting,
    rule: level.guestRule ?? 'classic',
    impossible: false,
  }
})

console.log(JSON.stringify({ ok: true, levels: report.length, firstTen: report.slice(0, 10), chapters: {
  classic: report.filter((row) => row.rule === 'classic').length,
  tightRack: report.filter((row) => row.rule === 'tight-rack').length,
  alternate: report.filter((row) => row.rule === 'alternate').length,
  combined: report.filter((row) => row.rule === 'combined').length,
} }, null, 2))
