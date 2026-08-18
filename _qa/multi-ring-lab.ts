import { createCells, createColumns, MULTI_RING_LAB_LEVEL, validateMultiRingLab } from '../src/game/levels.ts'
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

function settle(input: State): { state: State; failed: boolean; complete: boolean } {
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
    if (!tasks.length) {
      const complete = state.cells.flat().every((cell) => !cell.color || cell.cleared)
      return { state, complete, failed: !complete && state.slots.length >= 5 }
    }
    tasks.forEach(({ slot, target }) => {
      state.cells[target.row][target.col].cleared = true
      slot.spool.remaining -= 1
    })
    state.slots = state.slots.filter((slot) => slot.spool.remaining > 0)
  }
}

function select(input: State, column: number) {
  const state = copy(input)
  const spool = state.columns[column].shift()
  if (!spool) throw new Error(`Column ${column} has no reel`)
  state.slots.push({ slotId: ++state.sequence, sourceColumn: column, spool, state: 'waiting' })
  return settle(state)
}

function run(path: number[]) {
  let state: State = {
    cells: createCells(MULTI_RING_LAB_LEVEL),
    columns: createColumns(MULTI_RING_LAB_LEVEL),
    slots: [],
    sequence: 0,
  }
  let failedAt = 0
  for (let index = 0; index < path.length; index += 1) {
    const result = select(state, path[index])
    state = result.state
    if (result.failed) {
      failedAt = index + 1
      break
    }
  }
  const remaining = state.cells.flat().filter((cell) => cell.color && !cell.cleared).length
  return {
    complete: remaining === 0,
    failedAt,
    remaining,
    slots: state.slots.map((slot) => ({ color: slot.spool.color, remaining: slot.spool.remaining })),
    reachable: [...reachableColors(state.cells, findReachable(state.cells))].sort(),
  }
}

validateMultiRingLab()
const safe = run([0, 0, 1, 2, 3, 1])
const prematureCore = run([0, 1, 1, 2, 3])

if (!safe.complete || safe.failedAt) throw new Error(`Safe route failed: ${JSON.stringify(safe)}`)
if (prematureCore.failedAt !== 5) throw new Error(`Premature core route should fail on selection 5: ${JSON.stringify(prematureCore)}`)
if (prematureCore.reachable.join(',') !== 'violet') {
  throw new Error(`Failure should visibly require the violet gate: ${JSON.stringify(prematureCore)}`)
}

console.log(JSON.stringify({ ok: true, safe, prematureCore }))
