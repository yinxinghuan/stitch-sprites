import { createCells, createColumns, DUAL_ENTRY_LAB_LEVEL, validateDualEntryLab } from '../src/game/levels.ts'
import { chooseReachableCell, findReachable, reachableColors } from '../src/game/reachability.ts'
import type { ActiveSlot, Cell, SpoolState } from '../src/game/types.ts'

interface State {
  cells: Cell[][]
  columns: SpoolState[][]
  slots: ActiveSlot[]
  sequence: number
}

function copy(state: State): State {
  return {
    cells: state.cells.map((row) => row.map((cell) => ({ ...cell }))),
    columns: state.columns.map((column) => column.map((spool) => ({ ...spool }))),
    slots: state.slots.map((slot) => ({ ...slot, spool: { ...slot.spool } })),
    sequence: state.sequence,
  }
}

function settle(input: State): State {
  const state = copy(input)
  while (true) {
    const reachable = findReachable(state.cells)
    const reserved = new Set<string>()
    const tasks = state.slots.flatMap((slot) => {
      const target = chooseReachableCell(state.cells, reachable, slot.spool.color, reserved)
      if (!target) return []
      reserved.add(`${target.row}:${target.col}`)
      return [{ slot, target }]
    })
    if (!tasks.length) return state
    tasks.forEach(({ slot, target }) => {
      state.cells[target.row][target.col].cleared = true
      slot.spool.remaining -= 1
    })
    state.slots = state.slots.filter((slot) => slot.spool.remaining > 0)
  }
}

function select(input: State, column: number): State {
  const state = copy(input)
  const spool = state.columns[column].shift()
  if (!spool) throw new Error(`Column ${column} has no reel`)
  state.slots.push({ slotId: ++state.sequence, sourceColumn: column, spool, state: 'waiting' })
  return settle(state)
}

function run(path: number[]): { complete: boolean; peakSlots: number; firstRemoved: number } {
  let state: State = {
    cells: createCells(DUAL_ENTRY_LAB_LEVEL),
    columns: createColumns(DUAL_ENTRY_LAB_LEVEL),
    slots: [],
    sequence: 0,
  }
  let peakSlots = 0
  let firstRemoved = 0
  path.forEach((column, index) => {
    const before = state.cells.flat().filter((cell) => cell.color && !cell.cleared).length
    state = select(state, column)
    const after = state.cells.flat().filter((cell) => cell.color && !cell.cleared).length
    if (index === 0) firstRemoved = before - after
    peakSlots = Math.max(peakSlots, state.slots.length)
  })
  return {
    complete: state.cells.flat().every((cell) => !cell.color || cell.cleared),
    peakSlots,
    firstRemoved,
  }
}

validateDualEntryLab()
const initial = createCells(DUAL_ENTRY_LAB_LEVEL)
const entryColors = [...reachableColors(initial, findReachable(initial))].sort()
const lowerPressure = run([0, 1, 3, 2, 3, 3])
const higherPressure = run([2, 3, 3, 3, 0, 1])

if (!lowerPressure.complete || !higherPressure.complete) throw new Error('Both visible routes must remain recoverable')
if (lowerPressure.firstRemoved <= 0 || higherPressure.firstRemoved <= 0) throw new Error('Both entry colors must work immediately')
if (lowerPressure.peakSlots !== 0) throw new Error(`Expected lower-pressure peak 0, found ${lowerPressure.peakSlots}`)
if (higherPressure.peakSlots !== 2) throw new Error(`Expected higher-pressure peak 2, found ${higherPressure.peakSlots}`)

console.log(JSON.stringify({ ok: true, entryColors, lowerPressure, higherPressure }))
