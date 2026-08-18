import { createCells, createColumns, LEVELS } from '../src/game/levels.ts'
import { chooseReachableCell, findReachable, reachableColors } from '../src/game/reachability.ts'
import type { ActiveSlot, Cell, SpoolState } from '../src/game/types.ts'

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
  const seen = new Set<string>()
  function visit(state: SearchState, path: number[]): number[] | null {
    const stateKey = key(state)
    if (seen.has(stateKey)) return null
    seen.add(stateKey)
    if (path.length >= 5) return null
    const available = reachableColors(state.cells, findReachable(state.cells))
    const choices = state.columns
      .map((column, index) => ({ index, spool: column[0] }))
      .filter((choice) => choice.spool)
      .sort((a, b) => Number(available.has(a.spool!.color)) - Number(available.has(b.spool!.color)))
    for (const choice of choices) {
      const result = select(state, choice.index)
      if (!result) continue
      const nextPath = [...path, choice.index]
      if (result.failed) return nextPath
      if (!result.complete) {
        const failure = visit(result.state, nextPath)
        if (failure) return failure
      }
    }
    return null
  }
  return visit(initial, [])
}

const requestedLevel = Number(process.env.STITCH_SPRITES_LEVEL ?? 0)
const levels = requestedLevel > 0 ? LEVELS.filter((level) => level.id === requestedLevel) : LEVELS
const requiredFailureLevels = new Set([24, 37, 38])
const failureAuditLevels = requiredFailureLevels
const skipFailure = process.env.STITCH_SPRITES_SKIP_FAILURE === '1'

interface SolutionMetrics {
  valid: boolean
  peakWaitingSlots: number
  repeatedColumnRate: number
  longestColumnRun: number
  colorRuns: number
}

function measureSolution(initial: SearchState, path: number[]): SolutionMetrics {
  let state = initial
  let peakWaitingSlots = 0
  let longestColumnRun = 0
  let currentColumnRun = 0
  let previousColumn = -1
  let colorRuns = 0
  let previousColor = ''
  for (const column of path) {
    const color = state.columns[column]?.[0]?.color ?? ''
    if (column === previousColumn) currentColumnRun += 1
    else currentColumnRun = 1
    longestColumnRun = Math.max(longestColumnRun, currentColumnRun)
    previousColumn = column
    if (color !== previousColor) colorRuns += 1
    previousColor = color
    const result = select(state, column)
    if (!result || result.failed) return {
      valid: false,
      peakWaitingSlots,
      repeatedColumnRate: 0,
      longestColumnRun,
      colorRuns,
    }
    peakWaitingSlots = Math.max(peakWaitingSlots, result.state.slots.length)
    if (result.complete) return {
      valid: true,
      peakWaitingSlots,
      repeatedColumnRate: path.length > 1
        ? path.slice(1).filter((value, index) => value === path[index]).length / (path.length - 1)
        : 0,
      longestColumnRun,
      colorRuns,
    }
    state = result.state
  }
  return {
    valid: false,
    peakWaitingSlots,
    repeatedColumnRate: 0,
    longestColumnRun,
    colorRuns,
  }
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
  const metrics = solution ? measureSolution(initial, solution) : null
  if (!solution || !metrics?.valid) throw new Error(`Level ${level.id} has no valid solution`)
  const failure = !skipFailure && failureAuditLevels.has(level.id) ? findFailure(initial) : null
  if (!skipFailure && requiredFailureLevels.has(level.id) && !failure) throw new Error(`Difficulty checkpoint ${level.id} has no failure path within 5 selections`)
  const spools = level.columns.flat()
  const summary = {
    level: level.id,
    stitches: level.rows.reduce((count, row) => count + [...row].filter((code) => code !== '.').length, 0),
    colors: new Set(level.rows.join('').replaceAll('.', '')).size,
    selections: solution.length,
    minCapacity: Math.min(...spools.map((spool) => spool.capacity)),
    maxCapacity: Math.max(...spools.map((spool) => spool.capacity)),
    colorRuns: metrics.colorRuns,
    repeatedColumnRate: Number(metrics.repeatedColumnRate.toFixed(2)),
    longestColumnRun: metrics.longestColumnRun,
    peakWaitingSlots: metrics.peakWaitingSlots,
    failure,
  }
  summaries.push(summary)
  if (summary.colors >= 6 && (solution.length < 24 || solution.length > 48)) {
    throw new Error(`Advanced level ${level.id}: expected 24–48 selections, found ${solution.length}`)
  }
  console.log(JSON.stringify(summary))
}

const selectionCounts = summaries.map((summary) => summary.selections)
const failureAudited = summaries.filter((summary) => requiredFailureLevels.has(summary.level))
console.log(JSON.stringify({
  ok: true,
  levels: summaries.length,
  minSelections: Math.min(...selectionCounts),
  maxSelections: Math.max(...selectionCounts),
  averageSelections: Number((selectionCounts.reduce((sum, value) => sum + value, 0) / selectionCounts.length).toFixed(1)),
  failurePaths: failureAudited.filter((summary) => summary.failure).length,
  failureAudited: failureAudited.length,
}))
