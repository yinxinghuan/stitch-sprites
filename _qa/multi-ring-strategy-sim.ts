import { createColumns, MULTI_RING_LAB_LEVEL, validateMultiRingLab } from '../src/game/levels.ts'
import type { SpoolState, ThreadColor } from '../src/game/types.ts'

type Policy = 'uniform' | 'visible-match' | 'one-card-lookahead'

interface Slot {
  color: ThreadColor
  remaining: number
}

interface RingState {
  ringIndex: number
  ringRemaining: number
  columns: SpoolState[][]
  slots: Slot[]
  selections: number
  peakSlots: number
}

interface Outcome {
  complete: boolean
  failed: boolean
  selections: number
  peakSlots: number
  failedRing: number
  needed: ThreadColor | null
  path: number[]
}

const runs = Number(process.env.RING_RANDOM_RUNS ?? 10000)
const slotLimit = 5
const cardsByRing = createColumns(MULTI_RING_LAB_LEVEL)
  .flat()
  .map((spool) => ({
    ring: Number(spool.id.match(/^ring-(\d+)-/)?.[1] ?? 0) - 1,
    color: spool.color,
    capacity: spool.capacity,
  }))
  .sort((a, b) => a.ring - b.ring)

if (cardsByRing.length !== 18 || cardsByRing.some((ring, index) => ring.ring !== index)) {
  throw new Error(`Expected one numbered card for each of 18 rings: ${JSON.stringify(cardsByRing)}`)
}

function initial(): RingState {
  return {
    ringIndex: 0,
    ringRemaining: cardsByRing[0].capacity,
    columns: createColumns(MULTI_RING_LAB_LEVEL),
    slots: [],
    selections: 0,
    peakSlots: 0,
  }
}

function settle(state: RingState): void {
  while (state.ringIndex < cardsByRing.length) {
    const ring = cardsByRing[state.ringIndex]
    let progressed = false
    for (const slot of state.slots) {
      if (slot.color !== ring.color || slot.remaining <= 0) continue
      const amount = Math.min(slot.remaining, state.ringRemaining)
      slot.remaining -= amount
      state.ringRemaining -= amount
      progressed ||= amount > 0
      if (state.ringRemaining === 0) break
    }
    state.slots = state.slots.filter((slot) => slot.remaining > 0)
    if (state.ringRemaining === 0) {
      state.ringIndex += 1
      if (state.ringIndex < cardsByRing.length) {
        state.ringRemaining = cardsByRing[state.ringIndex].capacity
      }
      continue
    }
    if (!progressed) return
  }
}

function select(state: RingState, columnIndex: number): void {
  const spool = state.columns[columnIndex].shift()
  if (!spool) throw new Error(`Selected empty column ${columnIndex}`)
  state.slots.push({ color: spool.color, remaining: spool.remaining })
  state.selections += 1
  state.peakSlots = Math.max(state.peakSlots, state.slots.length)
  settle(state)
}

function randomFor(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value += 0x6D2B79F5
    let mixed = value
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

function choose(state: RingState, policy: Policy, random: () => number): number | null {
  const available = state.columns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => column.length > 0)
  if (!available.length || state.slots.length >= slotLimit) return null
  if (policy !== 'uniform') {
    const needed = cardsByRing[state.ringIndex]?.color
    const direct = available.filter(({ column }) => column[0].color === needed)
    if (direct.length) return direct[Math.floor(random() * direct.length)].index
    if (policy === 'one-card-lookahead') {
      const reveal = available.filter(({ column }) => column[1]?.color === needed)
      if (reveal.length) return reveal[Math.floor(random() * reveal.length)].index
    }
  }
  return available[Math.floor(random() * available.length)].index
}

function outcome(state: RingState, path: number[]): Outcome {
  const complete = state.ringIndex >= cardsByRing.length
  const needed = complete ? null : cardsByRing[state.ringIndex].color
  const failed = !complete && state.slots.length >= slotLimit
  return {
    complete,
    failed,
    selections: state.selections,
    peakSlots: state.peakSlots,
    failedRing: failed ? state.ringIndex + 1 : 0,
    needed,
    path,
  }
}

function simulateOne(policy: Policy, seed: number): Outcome {
  const state = initial()
  const random = randomFor(seed)
  const path: number[] = []
  for (let guard = 0; guard < 40; guard += 1) {
    const current = outcome(state, path)
    if (current.complete || current.failed) return current
    const column = choose(state, policy, random)
    if (column === null) return current
    select(state, column)
    path.push(column)
  }
  throw new Error(`Simulation guard exceeded for ${policy}`)
}

function percentile(values: number[], fraction: number): number {
  if (!values.length) return 0
  const ordered = [...values].sort((a, b) => a - b)
  return ordered[Math.floor((ordered.length - 1) * fraction)]
}

function summarize(policy: Policy) {
  const outcomes = Array.from({ length: runs }, (_, index) => simulateOne(policy, index + 1))
  const completes = outcomes.filter((item) => item.complete)
  const failures = outcomes.filter((item) => item.failed)
  const rings: Record<string, number> = {}
  failures.forEach((item) => {
    const key = String(item.failedRing)
    rings[key] = (rings[key] ?? 0) + 1
  })
  return {
    policy,
    runs,
    completionRate: Number((completes.length / runs).toFixed(4)),
    failureRate: Number((failures.length / runs).toFixed(4)),
    medianFailureSelection: percentile(failures.map((item) => item.selections), 0.5),
    medianFailureRing: percentile(failures.map((item) => item.failedRing), 0.5),
    p90PeakSlots: percentile(outcomes.map((item) => item.peakSlots), 0.9),
    failureByRing: rings,
    exampleFailurePath: failures[0]?.path ?? [],
  }
}

function runAuthored(): Outcome {
  const state = initial()
  const path: number[] = []
  MULTI_RING_LAB_LEVEL.solution.forEach((column) => {
    if (outcome(state, path).failed) return
    select(state, column)
    path.push(column)
  })
  return outcome(state, path)
}

validateMultiRingLab()
const authored = runAuthored()
if (!authored.complete || authored.failed) throw new Error(`Authored deal is not solvable: ${JSON.stringify(authored)}`)

console.log(JSON.stringify({
  ok: true,
  rings: cardsByRing.length,
  colors: new Set(cardsByRing.map((ring) => ring.color)).size,
  opening: MULTI_RING_LAB_LEVEL.columns.map((column) => column[0].color),
  authored,
  strategies: [
    summarize('uniform'),
    summarize('visible-match'),
    summarize('one-card-lookahead'),
  ],
}, null, 2))
