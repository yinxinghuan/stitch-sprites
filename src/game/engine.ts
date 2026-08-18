import { GameAudio } from './audio'
import { createCells, createColumns, LEVELS } from './levels'
import { PROGRESS_VERSION, scoreLevel, totalMastery, type PersistedProgress, type ProgressRepository, type StableRunState } from './progress'
import { chooseReachableCell, createWalkPathfinder, findReachable, reachableColors } from './reachability'
import type { ActiveSlot, GameSnapshot, LevelDefinition, SpoolState, StitchTask, ThreadColor } from './types'

interface EngineHooks {
  onChange: (snapshot: GameSnapshot) => void
  onTasks: (tasks: StitchTask[]) => void
  onMastery: (score: number, previousScore: number) => void
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms))
// The first pace tier is deliberately readable. Later progression can reduce
// these values without having to speed up the renderer as a whole.
const RELEASE_MS = 170
const BASE_TRAVEL_MIN_MS = 560
const BASE_TRAVEL_MAX_MS = 1180
const BASE_QUEUE_INTERVAL_MS = 190

export class GameEngine {
  readonly audio = new GameAudio()
  private levelIndex = 0
  private level!: LevelDefinition
  private cells = createCells(LEVELS[0])
  private columns: SpoolState[][] = []
  private slots: ActiveSlot[] = []
  private phase: GameSnapshot['phase'] = 'playing'
  private removed = 0
  private messageKey = 'hint.start'
  private slotSequence = 0
  private busy = false
  private generation = 0
  private arrivalEmitTimer = 0
  private wrongDispatches = 0
  private maxSlotsUsed = 0
  private usedHelp = false
  private tutorialRescueUsed = false
  private progress: PersistedProgress
  private hasPlayerAction = false
  private readonly queryLevel: number | null

  constructor(private readonly hooks: EngineHooks, private readonly repository: ProgressRepository) {
    const rawQueryLevel = Number(new URLSearchParams(location.search).get('level'))
    this.queryLevel = Number.isFinite(rawQueryLevel) && rawQueryLevel > 0 ? rawQueryLevel : null
    this.progress = repository.loadLocal()
    const savedRun = this.queryLevel === null ? this.progress.currentRun : null
    if (savedRun && savedRun.levelId <= this.progress.unlockedLevel) this.restoreRun(savedRun)
    else {
      const requested = this.queryLevel ?? this.progress.unlockedLevel
      this.loadLevel(Math.max(0, Math.min(LEVELS.length - 1, requested - 1)), false)
    }
  }

  get snapshot(): GameSnapshot {
    const reachable = findReachable(this.cells)
    const remaining = this.cells.flat().filter((cell) => cell.color && !cell.cleared).length
    return {
      level: this.level,
      cells: this.cells,
      columns: this.columns,
      slots: this.slots,
      phase: this.phase,
      removed: this.removed,
      remaining,
      reachable,
      messageKey: this.messageKey,
      wrongDispatches: this.wrongDispatches,
      usedHelp: this.usedHelp,
      levelScore: scoreLevel(this.level.id, this.wrongDispatches, this.usedHelp),
      totalMastery: totalMastery(this.progress),
    }
  }

  get unlockedLevel(): number {
    return this.progress.unlockedLevel
  }

  get persistedProgress(): PersistedProgress {
    return structuredClone(this.progress)
  }

  canSelectColumn(index: number): boolean {
    if (this.phase !== 'playing' || this.slots.length >= 5) return false
    const spool = this.columns[index]?.[0]
    if (!spool) return false
    return !(this.level.id === 1 && this.removed === 0 && index !== 0)
  }

  async selectColumn(index: number): Promise<void> {
    if (!this.canSelectColumn(index)) return
    const reachable = reachableColors(this.cells, findReachable(this.cells))
    const spool = this.columns[index].shift()
    if (!spool) return
    const wrongDispatch = !reachable.has(spool.color)
    this.hasPlayerAction = true
    this.audio.spool()
    this.slots.push({ slotId: ++this.slotSequence, sourceColumn: index, spool, state: 'waiting' })
    this.maxSlotsUsed = Math.max(this.maxSlotsUsed, this.slots.length)
    if (wrongDispatch) {
      this.wrongDispatches += 1
      this.messageKey = 'hint.wait'
      this.audio.wait()
    } else if (this.removed === 0) this.messageKey = 'hint.first'
    this.emit()
    window.requestAnimationFrame(() => void this.processWork())
  }

  restart(): void {
    this.hasPlayerAction = true
    this.audio.spool()
    this.loadLevel(this.levelIndex)
  }

  next(): void {
    this.hasPlayerAction = true
    const nextIndex = (this.levelIndex + 1) % LEVELS.length
    this.loadLevel(nextIndex)
  }

  openLevel(levelId: number): void {
    if (!Number.isInteger(levelId) || levelId < 1 || levelId > this.unlockedLevel) return
    this.hasPlayerAction = true
    this.loadLevel(levelId - 1)
  }

  applyMergedProgress(progress: PersistedProgress): void {
    if (this.hasPlayerAction) {
      this.progress = {
        ...this.progress,
        ...progress,
        unlockedLevel: Math.max(this.progress.unlockedLevel, progress.unlockedLevel),
        bestByLevel: Object.fromEntries(
          [...new Set([...Object.keys(this.progress.bestByLevel), ...Object.keys(progress.bestByLevel)])]
            .map((levelId) => [levelId, Math.max(this.progress.bestByLevel[levelId] ?? 0, progress.bestByLevel[levelId] ?? 0)]),
        ),
      }
      this.persistStable(this.phase === 'complete')
      return
    }
    this.progress = progress
    const savedRun = this.queryLevel === null ? progress.currentRun : null
    if (savedRun && savedRun.levelId <= progress.unlockedLevel) this.restoreRun(savedRun)
    else {
      const requested = this.queryLevel ?? progress.unlockedLevel
      this.loadLevel(Math.max(0, Math.min(LEVELS.length - 1, requested - 1)), false)
    }
    this.persistStable()
  }

  finalizeInitialProgress(): void {
    if (!this.progress.currentRun || this.queryLevel !== null) this.persistStable()
  }

  currentNeededColors(): ThreadColor[] {
    return [...reachableColors(this.cells, findReachable(this.cells))]
  }

  private loadLevel(index: number, persist = true): void {
    if (this.arrivalEmitTimer) window.clearTimeout(this.arrivalEmitTimer)
    this.arrivalEmitTimer = 0
    this.generation += 1
    this.levelIndex = index
    this.level = LEVELS[index]
    this.cells = createCells(this.level)
    this.columns = createColumns(this.level)
    this.slots = []
    this.phase = 'playing'
    this.removed = 0
    this.messageKey = this.level.tutorial ? 'hint.start' : 'hint.normal'
    this.slotSequence = 0
    this.busy = false
    this.wrongDispatches = 0
    this.maxSlotsUsed = 0
    this.usedHelp = false
    this.tutorialRescueUsed = false
    if (persist) this.persistStable()
    this.emit()
  }

  private restoreRun(run: StableRunState): void {
    const level = LEVELS[run.levelId - 1]
    this.generation += 1
    this.levelIndex = run.levelId - 1
    this.level = level
    this.cells = createCells(level)
    const cols = this.cells[0]?.length ?? 0
    run.cleared.forEach((index) => {
      const row = Math.floor(index / cols)
      const col = index % cols
      const cell = this.cells[row]?.[col]
      if (cell?.color) cell.cleared = true
    })
    this.columns = structuredClone(run.columns)
    this.slots = structuredClone(run.slots).map((slot) => ({ ...slot, state: 'waiting' }))
    this.phase = run.phase
    this.removed = run.removed
    this.messageKey = run.phase === 'failed' ? 'hint.danger' : 'hint.resume'
    this.slotSequence = run.slotSequence
    this.wrongDispatches = run.wrongDispatches
    this.maxSlotsUsed = run.maxSlotsUsed
    this.usedHelp = run.usedHelp
    this.tutorialRescueUsed = run.tutorialRescueUsed
    this.busy = false
    this.emit()
    if (this.phase === 'playing' && this.slots.length) window.requestAnimationFrame(() => void this.processWork())
  }

  private stableRun(): StableRunState {
    const cols = this.cells[0]?.length ?? 0
    const cleared: number[] = []
    this.cells.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
      if (cell.cleared) cleared.push(rowIndex * cols + colIndex)
    }))
    return {
      levelId: this.level.id,
      phase: this.phase === 'complete' ? 'playing' : this.phase,
      cleared,
      columns: structuredClone(this.columns),
      slots: structuredClone(this.slots).map((slot) => ({ ...slot, state: 'waiting' })),
      removed: this.removed,
      slotSequence: this.slotSequence,
      wrongDispatches: this.wrongDispatches,
      maxSlotsUsed: this.maxSlotsUsed,
      usedHelp: this.usedHelp,
      tutorialRescueUsed: this.tutorialRescueUsed,
    }
  }

  private persistStable(clearRun = false): void {
    if (this.queryLevel !== null) return
    this.progress = {
      ...this.progress,
      version: PROGRESS_VERSION,
      updatedAt: Date.now(),
      currentRun: clearRun ? null : this.stableRun(),
    }
    this.repository.save(this.progress)
  }

  private emit(): void {
    this.hooks.onChange(this.snapshot)
  }

  private emitArrivalBatched(): void {
    if (this.arrivalEmitTimer) return
    this.arrivalEmitTimer = window.setTimeout(() => {
      this.arrivalEmitTimer = 0
      this.emit()
    }, 80)
  }

  private flushArrivalEmit(): void {
    if (!this.arrivalEmitTimer) return
    window.clearTimeout(this.arrivalEmitTimer)
    this.arrivalEmitTimer = 0
    this.emit()
  }

  private async processWork(): Promise<void> {
    if (this.busy || this.phase !== 'playing') return
    this.busy = true
    const runGeneration = this.generation
    const densityScale = this.level.density * this.level.density
    const settleDelay = 110

    while (this.phase === 'playing' && runGeneration === this.generation) {
      const reachable = findReachable(this.cells)
      const findWalkPath = createWalkPathfinder(this.cells)
      const reserved = new Set<string>()
      const tasks: StitchTask[] = []
      let introducedWaiting = false

      this.slots.forEach((slot) => {
        const workerCount = Math.min(
          slot.spool.remaining,
          Math.max(4, Math.min(12, Math.ceil(slot.spool.capacity / 9))),
        )
        let foundTarget = false
        for (let workerIndex = 0; workerIndex < workerCount; workerIndex += 1) {
          const target = chooseReachableCell(this.cells, reachable, slot.spool.color, reserved)
          if (!target) break
          const path = findWalkPath(target)
          if (!path.length) break
          foundTarget = true
          reserved.add(`${target.row}:${target.col}`)
          const paceVariation = ((workerIndex * 17 + target.row * 3 + target.col) % 7 - 3) * 18
          const travelMs = Math.max(
            BASE_TRAVEL_MIN_MS,
            Math.min(BASE_TRAVEL_MAX_MS, 350 + path.length * 24 + paceVariation),
          )
          const queueJitter = ((target.row * 5 + target.col + workerIndex * 3) % 4) * 10
          const departMs = workerIndex * BASE_QUEUE_INTERVAL_MS + queueJitter
          tasks.push({
            slotId: slot.slotId,
            color: slot.spool.color,
            row: target.row,
            col: target.col,
            workerIndex,
            path,
            departMs,
            travelMs,
          })
        }
        const target = foundTarget
        const nextState = target ? 'working' : 'waiting'
        if (slot.state !== 'waiting' && nextState === 'waiting') introducedWaiting = true
        slot.state = nextState
      })

      if (!tasks.length) {
        if (this.slots.length >= 4) this.messageKey = this.slots.length === 5 ? 'hint.danger' : 'hint.wait'
        this.emit()
        if (this.slots.length >= 5 && this.snapshot.remaining > 0) {
          if (this.level.tutorial && !this.tutorialRescueUsed) {
            this.messageKey = 'hint.tutorialRescue'
            this.audio.wait()
            this.emit()
            await delay(650)
            if (runGeneration !== this.generation) return
            const rescued = this.slots.pop()
            if (rescued) this.columns[rescued.sourceColumn].unshift(rescued.spool)
            this.tutorialRescueUsed = true
            this.usedHelp = true
            this.messageKey = 'hint.tutorialRescued'
            this.persistStable()
            this.emit()
          } else {
            this.phase = 'failed'
            this.audio.fail()
            this.persistStable()
            this.emit()
          }
        } else if (introducedWaiting) {
          this.audio.wait()
        }
        this.persistStable()
        break
      }

      this.messageKey = this.slots.length >= 4
        ? 'hint.danger'
        : (this.level.tutorial && this.removed < 10 * densityScale ? 'hint.first' : 'hint.normal')
      this.hooks.onTasks(tasks)
      this.audio.depart()
      this.emit()
      await Promise.all(tasks.map(async (task) => {
        await delay(task.departMs + task.travelMs + RELEASE_MS)
        if (runGeneration !== this.generation) return
        const cell = this.cells[task.row]?.[task.col]
        const slot = this.slots.find((candidate) => candidate.slotId === task.slotId)
        if (!cell || !slot || cell.cleared || slot.spool.remaining <= 0) return
        cell.cleared = true
        slot.spool.remaining -= 1
        this.removed += 1
        if (this.removed % this.level.density === 0) this.audio.unstitch()
        this.emitArrivalBatched()
      }))
      if (runGeneration !== this.generation) return
      this.flushArrivalEmit()
      await delay(settleDelay)
      if (runGeneration !== this.generation) return

      this.slots = this.slots.filter((slot) => slot.spool.remaining > 0)
      const remaining = this.snapshot.remaining
      if (remaining === 0) {
        this.phase = 'complete'
        if (this.queryLevel !== null) {
          this.audio.complete()
          this.emit()
          break
        }
        const previousScore = totalMastery(this.progress)
        const levelScore = scoreLevel(this.level.id, this.wrongDispatches, this.usedHelp)
        const bestByLevel = {
          ...this.progress.bestByLevel,
          [String(this.level.id)]: Math.max(this.progress.bestByLevel[String(this.level.id)] ?? 0, levelScore),
        }
        this.progress = {
          ...this.progress,
          unlockedLevel: Math.max(this.unlockedLevel, Math.min(LEVELS.length, this.levelIndex + 2)),
          bestByLevel,
        }
        this.persistStable(true)
        this.audio.complete()
        this.emit()
        const nextScore = totalMastery(this.progress)
        if (nextScore > previousScore) this.hooks.onMastery(nextScore, previousScore)
        break
      }
      this.persistStable()
      this.emit()
    }

    if (runGeneration === this.generation) this.busy = false
  }
}
