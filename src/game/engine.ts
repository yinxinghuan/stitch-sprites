import { isCrazyGames } from '../cg/mode'
import {
  canAfford,
  clearReward,
  offerFor,
  paceFor,
  presentGuest,
  readEconomy,
  writeEconomy,
  type GuestSnapshot,
  type PowerId,
} from '../cg/economy'
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
  private hold = false
  private extraSlot = false
  private pace = 1
  private armed: PowerId | null = null
  private lastReward = 0
  private progress: PersistedProgress
  private hasPlayerAction = false
  private readonly queryLevel: number | null

  constructor(private readonly hooks: EngineHooks, private readonly repository: ProgressRepository) {
    const rawQueryLevel = Number(new URLSearchParams(location.search).get('level'))
    this.queryLevel = Number.isFinite(rawQueryLevel) && rawQueryLevel > 0 ? rawQueryLevel : null
    this.progress = repository.loadLocal()
    if (isCrazyGames) {
      this.progress = writeEconomy(this.progress, readEconomy(this.progress))
      this.applyPace()
    }
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
      runRevision: this.generation,
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

  get slotLimit(): number {
    return this.extraSlot ? 6 : 5
  }

  get isPaused(): boolean {
    return this.hold
  }

  get clearRewardCoins(): number {
    return this.lastReward
  }

  get guest(): GuestSnapshot | null {
    if (!isCrazyGames) return null
    return presentGuest({
      economy: readEconomy(this.progress),
      unlockedLevel: this.unlockedLevel,
      reward: this.lastReward,
      armed: this.armed,
      extraSlot: this.extraSlot,
      phase: this.phase,
    })
  }

  canSelectColumn(index: number): boolean {
    if (this.phase !== 'playing' || this.hold || this.armed || this.slots.length >= this.slotLimit) return false
    const spool = this.columns[index]?.[0]
    if (!spool) return false
    return !(this.level.id === 1 && this.removed === 0 && index !== 0)
  }

  async selectColumn(index: number): Promise<void> {
    if (this.armed === 'shuffle') {
      this.confirmShuffle(index)
      return
    }
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
    this.extraSlot = false
    this.armed = null
    this.hold = false
    this.lastReward = 0
    if (isCrazyGames) this.applyPace()
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
    this.extraSlot = isCrazyGames && Boolean(run.extraSlot)
    this.armed = null
    this.hold = false
    if (isCrazyGames) this.applyPace()
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
      ...(isCrazyGames ? { extraSlot: this.extraSlot } : {}),
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
      if (isCrazyGames && this.hold) {
        if (!(await this.sleep(40, runGeneration))) return
        continue
      }
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
          const rawTravel = Math.max(
            BASE_TRAVEL_MIN_MS,
            Math.min(BASE_TRAVEL_MAX_MS, 350 + path.length * 24 + paceVariation),
          )
          const queueJitter = ((target.row * 5 + target.col + workerIndex * 3) % 4) * 10
          const rawDepart = workerIndex * BASE_QUEUE_INTERVAL_MS + queueJitter
          const travelMs = this.pace === 1 ? rawTravel : rawTravel / this.pace
          const departMs = this.pace === 1 ? rawDepart : rawDepart / this.pace
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
        const crowded = this.slots.length >= this.slotLimit - 1
        if (crowded) this.messageKey = this.slots.length >= this.slotLimit ? 'hint.danger' : 'hint.wait'
        this.emit()
        if (this.slots.length >= this.slotLimit && this.snapshot.remaining > 0) {
          if (this.level.tutorial && !this.tutorialRescueUsed) {
            this.messageKey = 'hint.tutorialRescue'
            this.audio.wait()
            this.emit()
            if (!(await this.sleep(650, runGeneration))) return
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

      this.messageKey = this.slots.length >= this.slotLimit - 1
        ? 'hint.danger'
        : (this.level.tutorial && this.removed < 10 * densityScale ? 'hint.first' : 'hint.normal')
      this.hooks.onTasks(tasks)
      this.audio.depart()
      this.emit()
      await Promise.all(tasks.map(async (task) => {
        if (!(await this.sleep(task.departMs + task.travelMs + RELEASE_MS, runGeneration))) return
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
      if (!(await this.sleep(settleDelay, runGeneration))) return

      this.slots = this.slots.filter((slot) => slot.spool.remaining > 0)
      const remaining = this.snapshot.remaining
      if (remaining === 0) {
        this.completeLevel()
        break
      }
      this.persistStable()
      this.emit()
    }

    if (runGeneration === this.generation) this.busy = false
  }

  setPaused(paused: boolean): void {
    if (!isCrazyGames || this.phase !== 'playing') return
    this.hold = paused
    this.emit()
  }

  armPower(id: PowerId | null): void {
    if (!isCrazyGames || this.hold || this.phase !== 'playing') return
    if (id === null || this.armed === id) {
      this.armed = null
      this.emit()
      return
    }
    const offer = offerFor(id)
    if (!canAfford(readEconomy(this.progress), offer.price, this.unlockedLevel, offer.unlockLevel)) return
    if (id === 'extra' && this.extraSlot) return
    this.armed = id
    this.emit()
  }

  setSpeed(tier: number): boolean {
    if (!isCrazyGames || this.hold) return false
    if (tier !== 0 && tier !== 1 && tier !== 2) return false
    const economy = readEconomy(this.progress)
    if (tier > economy.speedTier) {
      const offer = tier === 1 ? { unlockLevel: 6, price: 400 } : { unlockLevel: 18, price: 1000 }
      if (tier !== economy.speedTier + 1) return false
      if (!canAfford(economy, offer.price, this.unlockedLevel, offer.unlockLevel)) return false
      economy.coins -= offer.price
      economy.speedTier = tier
      economy.selectedSpeed = tier
      this.audio.purchase()
    } else {
      economy.selectedSpeed = tier
    }
    this.progress = writeEconomy(this.progress, economy)
    this.applyPace()
    this.persistStable(this.phase === 'complete')
    this.emit()
    return true
  }

  confirmRecall(slotIndex: number): boolean {
    return this.spendPower('recall', () => {
      const slot = this.slots[slotIndex]
      if (!slot || slot.state !== 'waiting' || slot.spool.remaining !== slot.spool.capacity) return false
      this.slots.splice(slotIndex, 1)
      this.columns[slot.sourceColumn].unshift(slot.spool)
      return true
    })
  }

  confirmShuffle(columnIndex: number): boolean {
    return this.spendPower('shuffle', () => {
      const column = this.columns[columnIndex]
      if (!column || column.length < 3) return false
      const top = column[0]
      const rest = column.slice(1)
      for (let index = rest.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(Math.random() * (index + 1))
        const current = rest[index]
        rest[index] = rest[swap]
        rest[swap] = current
      }
      this.columns[columnIndex] = [top, ...rest]
      return true
    })
  }

  confirmExtra(): boolean {
    return this.spendPower('extra', () => {
      if (this.extraSlot) return false
      this.extraSlot = true
      return true
    })
  }

  confirmVacuum(color: ThreadColor): boolean {
    return this.spendPower('vacuum', () => this.peelExposed(color))
  }

  private applyPace(): void {
    this.pace = paceFor(readEconomy(this.progress).selectedSpeed)
  }

  private spendPower(id: PowerId, apply: () => boolean): boolean {
    if (!isCrazyGames || this.hold || this.phase !== 'playing') return false
    if (id !== 'extra' && this.busy) return false
    const offer = offerFor(id)
    const economy = readEconomy(this.progress)
    if (!canAfford(economy, offer.price, this.unlockedLevel, offer.unlockLevel)) return false
    if (!apply()) return false
    economy.coins -= offer.price
    this.progress = writeEconomy(this.progress, economy)
    this.usedHelp = true
    this.armed = null
    this.audio.purchase()
    this.persistStable()
    this.emit()
    if (id === 'vacuum' && this.snapshot.remaining === 0) this.completeLevel()
    else if (id === 'vacuum' || id === 'recall') void this.processWork()
    return true
  }

  private peelExposed(color: ThreadColor): boolean {
    const reachable = findReachable(this.cells)
    const exposed: Array<{ row: number; col: number }> = []
    this.cells.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
      if (!cell.color || cell.cleared || cell.color !== color) return
      if (!reachable.has(`${rowIndex}:${colIndex}`)) return
      exposed.push({ row: rowIndex, col: colIndex })
    }))
    if (!exposed.length) return false
    let available = 0
    this.slots.forEach((slot) => { if (slot.spool.color === color) available += slot.spool.remaining })
    this.columns.forEach((column) => column.forEach((spool) => { if (spool.color === color) available += spool.remaining }))
    if (available < exposed.length) return false
    exposed.forEach(({ row, col }) => {
      const cell = this.cells[row][col]
      cell.cleared = true
      this.removed += 1
    })
    let debt = exposed.length
    const take = (spool: SpoolState): void => {
      if (debt <= 0 || spool.color !== color) return
      const used = Math.min(spool.remaining, debt)
      spool.remaining -= used
      spool.capacity -= used
      debt -= used
    }
    this.slots.forEach((slot) => take(slot.spool))
    this.slots = this.slots.filter((slot) => slot.spool.remaining > 0)
    this.columns.forEach((column, index) => {
      column.forEach((spool) => take(spool))
      this.columns[index] = column.filter((spool) => spool.remaining > 0)
    })
    return debt === 0
  }

  private completeLevel(): void {
    this.phase = 'complete'
    if (this.queryLevel !== null) {
      this.audio.complete()
      this.emit()
      return
    }
    const previousScore = totalMastery(this.progress)
    const levelScore = scoreLevel(this.level.id, this.wrongDispatches, this.usedHelp)
    if (isCrazyGames) {
      const first = !((this.progress.bestByLevel[String(this.level.id)] ?? 0) > 0)
      const reward = clearReward(this.levelIndex, LEVELS, first)
      const economy = readEconomy(this.progress)
      economy.coins += reward
      this.progress = writeEconomy(this.progress, economy)
      this.lastReward = reward
    }
    this.progress = {
      ...this.progress,
      unlockedLevel: Math.max(this.unlockedLevel, Math.min(LEVELS.length, this.levelIndex + 2)),
      bestByLevel: {
        ...this.progress.bestByLevel,
        [String(this.level.id)]: Math.max(this.progress.bestByLevel[String(this.level.id)] ?? 0, levelScore),
      },
    }
    this.persistStable(true)
    this.audio.complete()
    this.emit()
    const nextScore = totalMastery(this.progress)
    if (nextScore > previousScore) this.hooks.onMastery(nextScore, previousScore)
  }

  private async sleep(ms: number, generation: number): Promise<boolean> {
    if (!isCrazyGames) {
      await delay(ms)
      return generation === this.generation
    }
    let left = ms
    while (left > 0) {
      if (generation !== this.generation) return false
      if (this.hold) {
        await delay(40)
        continue
      }
      const slice = Math.min(40, left)
      await delay(slice)
      left -= slice
    }
    return generation === this.generation
  }
}
