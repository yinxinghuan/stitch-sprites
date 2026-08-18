import { createCells, createColumns, LEVELS } from '../src/game/levels'
import { chooseReachableCell, findReachable, reachableColors } from '../src/game/reachability'
import type { ActiveSlot, Cell, SpoolState } from '../src/game/types'

interface SearchState {
  cells: Cell[][]
  columns: SpoolState[][]
  slots: ActiveSlot[]
  sequence: number
}

function cloneState(state: SearchState): SearchState {
  return {
    cells: state.cells.map((row) => row.map((cell) => ({ ...cell }))),
    columns: state.columns.map((column) => column.map((spool) => ({ ...spool }))),
    slots: state.slots.map((slot) => ({ ...slot, spool: { ...slot.spool } })),
    sequence: state.sequence,
  }
}

function settle(input: SearchState): { state: SearchState; complete: boolean; failed: boolean } {
  const state = cloneState(input)
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

function select(input: SearchState, column: number) {
  const state = cloneState(input)
  const spool = state.columns[column].shift()
  if (!spool || state.slots.length >= 5) return null
  state.slots.push({ slotId: ++state.sequence, sourceColumn: column, spool, state: 'waiting' })
  return settle(state)
}

function key(state: SearchState): string {
  const cleared = state.cells.flat().map((cell) => cell.cleared ? '1' : '0').join('')
  const columns = state.columns.map((column) => column.length).join(',')
  const slots = state.slots.map((slot) => `${slot.spool.id}:${slot.spool.remaining}`).join(',')
  return `${cleared}|${columns}|${slots}`
}

function findSolution(initial: SearchState): number[] | null {
  const seen = new Set<string>()
  function visit(state: SearchState, path: number[]): number[] | null {
    const stateKey = key(state)
    if (seen.has(stateKey)) return null
    seen.add(stateKey)
    const available = reachableColors(state.cells, findReachable(state.cells))
    const choices = state.columns
      .map((column, index) => ({ index, spool: column[0] }))
      .filter((choice) => choice.spool)
      .sort((a, b) => Number(available.has(b.spool!.color)) - Number(available.has(a.spool!.color)))
    for (const choice of choices) {
      const result = select(state, choice.index)
      if (!result || result.failed) continue
      const nextPath = [...path, choice.index]
      if (result.complete) return nextPath
      const solved = visit(result.state, nextPath)
      if (solved) return solved
    }
    return null
  }
  return visit(initial, [])
}

function findFailure(initial: SearchState): number[] | null {
  const queue = [{ state: initial, path: [] as number[] }]
  const seen = new Set<string>()
  while (queue.length) {
    const current = queue.shift()!
    const stateKey = key(current.state)
    if (seen.has(stateKey)) continue
    seen.add(stateKey)
    if (current.path.length >= 5) continue
    const available = reachableColors(current.state.cells, findReachable(current.state.cells))
    const choices = current.state.columns
      .map((column, index) => ({ index, spool: column[0] }))
      .filter((choice) => choice.spool)
      .sort((a, b) => Number(available.has(a.spool!.color)) - Number(available.has(b.spool!.color)))
    for (const choice of choices) {
      const result = select(current.state, choice.index)
      if (!result) continue
      const path = [...current.path, choice.index]
      if (result.failed) return path
      if (!result.complete) queue.push({ state: result.state, path })
    }
  }
  return null
}

const requestedLevel = Number(process.env.STITCH_SPRITES_LEVEL ?? 0)
const levels = requestedLevel > 0 ? LEVELS.filter((level) => level.id === requestedLevel) : LEVELS
const failureCheckLevels = new Set([7, 20, 35])

function validatesSolution(initial: SearchState, path: number[]): boolean {
  let state = initial
  for (const column of path) {
    const result = select(state, column)
    if (!result || result.failed) return false
    if (result.complete) return true
    state = result.state
  }
  return false
}

const summaries = []
for (const level of levels) {
  const initial: SearchState = {
    cells: createCells(level),
    columns: createColumns(level),
    slots: [],
    sequence: 0,
  }
  const solution = level.solution
  const failure = failureCheckLevels.has(level.id) ? findFailure(initial) : null
  if (!solution || !validatesSolution(initial, solution)) throw new Error(`Level ${level.id} has no valid solution`)
  if (failureCheckLevels.has(level.id) && !failure) throw new Error(`Difficulty checkpoint ${level.id} has no failure path within 5 selections`)
  const spools = level.columns.flat()
  const summary = {
    level: level.id,
    stitches: level.rows.reduce((count, row) => count + [...row].filter((code) => code !== '.').length, 0),
    colors: new Set(level.rows.join('').replaceAll('.', '')).size,
    selections: solution.length,
    minCapacity: Math.min(...spools.map((spool) => spool.capacity)),
    maxCapacity: Math.max(...spools.map((spool) => spool.capacity)),
    failure,
  }
  summaries.push(summary)
  console.log(JSON.stringify(summary))
}

const selectionCounts = summaries.map((summary) => summary.selections)
console.log(JSON.stringify({
  ok: true,
  levels: summaries.length,
  minSelections: Math.min(...selectionCounts),
  maxSelections: Math.max(...selectionCounts),
  averageSelections: Number((selectionCounts.reduce((sum, value) => sum + value, 0) / selectionCounts.length).toFixed(1)),
}))
