import { GameAudio } from './audio'
import { createCells, createColumns, LEVELS } from './levels'
import { chooseReachableCell, findReachable, findWalkPath, reachableColors } from './reachability'
import type { ActiveSlot, GameSnapshot, LevelDefinition, SpoolState, StitchTask, ThreadColor } from './types'

interface EngineHooks {
  onChange: (snapshot: GameSnapshot) => void
  onTasks: (tasks: StitchTask[]) => void
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms))

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

  constructor(private readonly hooks: EngineHooks) {
    const queryLevel = Number(new URLSearchParams(location.search).get('level'))
    const savedLevel = Number(alteruLocalStorage.getItem('stitch_sprites_level') ?? '1')
    const requested = Number.isFinite(queryLevel) && queryLevel > 0 ? queryLevel : savedLevel
    this.loadLevel(Math.max(0, Math.min(LEVELS.length - 1, requested - 1)))
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
    }
  }

  canSelectColumn(index: number): boolean {
    if (this.phase !== 'playing' || this.slots.length >= 5) return false
    const spool = this.columns[index]?.[0]
    if (!spool) return false
    if (!this.level.tutorial) return true
    if (this.removed === 0) return index === 0
    const colors = reachableColors(this.cells, findReachable(this.cells))
    return colors.has(spool.color)
  }

  async selectColumn(index: number): Promise<void> {
    if (!this.canSelectColumn(index)) return
    await this.audio.unlock()
    const spool = this.columns[index].shift()
    if (!spool) return
    this.audio.spool()
    this.slots.push({ slotId: ++this.slotSequence, spool, state: 'waiting' })
    if (this.removed === 0) this.messageKey = 'hint.first'
    this.emit()
    void this.processWork()
  }

  restart(): void {
    this.audio.spool()
    this.loadLevel(this.levelIndex)
  }

  next(): void {
    const nextIndex = (this.levelIndex + 1) % LEVELS.length
    this.loadLevel(nextIndex)
  }

  currentNeededColors(): ThreadColor[] {
    return [...reachableColors(this.cells, findReachable(this.cells))]
  }

  private loadLevel(index: number): void {
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
    this.emit()
  }

  private emit(): void {
    this.hooks.onChange(this.snapshot)
  }

  private async processWork(): Promise<void> {
    if (this.busy || this.phase !== 'playing') return
    this.busy = true
    const runGeneration = this.generation
    const densityScale = this.level.density * this.level.density
    const settleDelay = 110

    while (this.phase === 'playing' && runGeneration === this.generation) {
      const reachable = findReachable(this.cells)
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
          const path = findWalkPath(this.cells, target)
          if (!path.length) break
          foundTarget = true
          reserved.add(`${target.row}:${target.col}`)
          const travelMs = Math.max(430, Math.min(920, 270 + path.length * 18))
          tasks.push({
            slotId: slot.slotId,
            color: slot.spool.color,
            row: target.row,
            col: target.col,
            workerIndex,
            path,
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
          this.phase = 'failed'
          this.audio.fail()
          this.emit()
        } else if (introducedWaiting) {
          this.audio.wait()
        }
        break
      }

      this.messageKey = this.slots.length >= 4
        ? 'hint.danger'
        : (this.level.tutorial && this.removed < 10 * densityScale ? 'hint.first' : 'hint.normal')
      this.hooks.onTasks(tasks)
      this.audio.depart()
      this.emit()
      await Promise.all(tasks.map(async (task) => {
        await delay(task.travelMs)
        if (runGeneration !== this.generation) return
        const cell = this.cells[task.row]?.[task.col]
        const slot = this.slots.find((candidate) => candidate.slotId === task.slotId)
        if (!cell || !slot || cell.cleared || slot.spool.remaining <= 0) return
        cell.cleared = true
        slot.spool.remaining -= 1
        this.removed += 1
        if (this.removed % this.level.density === 0) this.audio.unstitch()
        this.emit()
      }))
      if (runGeneration !== this.generation) return
      await delay(settleDelay)
      if (runGeneration !== this.generation) return

      this.slots = this.slots.filter((slot) => slot.spool.remaining > 0)
      const remaining = this.snapshot.remaining
      if (remaining === 0) {
        this.phase = 'complete'
        const unlockedLevel = Math.min(LEVELS.length, this.levelIndex + 2)
        alteruLocalStorage.setItem('stitch_sprites_level', String(unlockedLevel))
        this.audio.complete()
        this.emit()
        break
      }
      this.emit()
    }

    if (runGeneration === this.generation) this.busy = false
  }
}
