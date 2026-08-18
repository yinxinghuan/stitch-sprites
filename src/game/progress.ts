import { LEVELS } from './levels'
import type { ActiveSlot, GamePhase, SpoolState } from './types'

export const PROGRESS_KEY = 'stitch_sprites_progress_v2'
export const LEGACY_LEVEL_KEY = 'stitch_sprites_level'
export const PROGRESS_VERSION = 3

export interface StableRunState {
  levelId: number
  phase: Exclude<GamePhase, 'complete'>
  cleared: number[]
  columns: SpoolState[][]
  slots: ActiveSlot[]
  removed: number
  slotSequence: number
  wrongDispatches: number
  maxSlotsUsed: number
  usedHelp: boolean
  tutorialRescueUsed: boolean
}

export interface PersistedProgress {
  version: typeof PROGRESS_VERSION
  updatedAt: number
  unlockedLevel: number
  bestByLevel: Record<string, number>
  currentRun: StableRunState | null
  economy?: {
    coins: number
    speedTier: number
    inventory: Record<string, number>
  }
}

export interface ProgressRepository {
  loadLocal(): PersistedProgress
  loadRemote(): Promise<PersistedProgress | null>
  save(progress: PersistedProgress): void
  flush(): void
}

function clampLevel(value: unknown): number {
  const parsed = Number(value)
  return Math.max(1, Math.min(LEVELS.length, Number.isFinite(parsed) ? Math.floor(parsed) : 1))
}

export function emptyProgress(): PersistedProgress {
  return {
    version: PROGRESS_VERSION,
    updatedAt: Date.now(),
    unlockedLevel: clampLevel(alteruLocalStorage.getItem(LEGACY_LEVEL_KEY) ?? 1),
    bestByLevel: {},
    currentRun: null,
  }
}

export function normalizeProgress(value: unknown): PersistedProgress | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<PersistedProgress>
  const sourceVersion = Number(candidate.version)
  if (sourceVersion !== 2 && sourceVersion !== PROGRESS_VERSION) return null
  const bestByLevel: Record<string, number> = {}
  if (candidate.bestByLevel && typeof candidate.bestByLevel === 'object') {
    Object.entries(candidate.bestByLevel).forEach(([key, score]) => {
      const levelId = Number(key)
      const numericScore = Number(score)
      if (Number.isInteger(levelId) && levelId >= 1 && levelId <= LEVELS.length && Number.isFinite(numericScore) && numericScore > 0) {
        bestByLevel[String(levelId)] = Math.floor(numericScore)
      }
    })
  }
  // Version 2 runs contain the old reel layout. Keep long-term progress, but
  // deliberately restart the in-progress level against difficulty v2.
  const currentRun = sourceVersion === PROGRESS_VERSION && candidate.currentRun && validateRun(candidate.currentRun)
    ? structuredClone(candidate.currentRun)
    : null
  const storedUnlockedLevel = clampLevel(candidate.unlockedLevel)
  const unlockedLevel = LEVELS.length > 35 && storedUnlockedLevel >= 35 && bestByLevel['35']
    ? Math.max(storedUnlockedLevel, 36)
    : storedUnlockedLevel
  return {
    version: PROGRESS_VERSION,
    updatedAt: Number.isFinite(Number(candidate.updatedAt)) ? Number(candidate.updatedAt) : Date.now(),
    unlockedLevel,
    bestByLevel,
    currentRun,
    ...(candidate.economy ? { economy: candidate.economy } : {}),
  }
}

function validateRun(run: StableRunState): boolean {
  if (!Number.isInteger(run.levelId) || run.levelId < 1 || run.levelId > LEVELS.length) return false
  if (run.phase !== 'playing' && run.phase !== 'failed') return false
  if (!Array.isArray(run.cleared) || !Array.isArray(run.columns) || run.columns.length !== 4 || !Array.isArray(run.slots)) return false
  if (run.slots.length > 5) return false
  return run.columns.every((column) => Array.isArray(column))
    && run.slots.every((slot) => Number.isInteger(slot.sourceColumn) && slot.sourceColumn >= 0 && slot.sourceColumn < 4)
}

export function mergeProgress(local: PersistedProgress, remote: PersistedProgress): PersistedProgress {
  const bestByLevel = { ...local.bestByLevel }
  Object.entries(remote.bestByLevel).forEach(([levelId, score]) => {
    bestByLevel[levelId] = Math.max(bestByLevel[levelId] ?? 0, score)
  })
  const newer = remote.updatedAt > local.updatedAt ? remote : local
  return {
    ...newer,
    version: PROGRESS_VERSION,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
    unlockedLevel: Math.max(local.unlockedLevel, remote.unlockedLevel),
    bestByLevel,
  }
}

export function totalMastery(progress: PersistedProgress): number {
  return Object.values(progress.bestByLevel).reduce((sum, score) => sum + score, 0)
}

export function scoreLevel(levelId: number, wrongDispatches: number, usedHelp: boolean): number {
  return 1000 + levelId * 25 + (wrongDispatches === 0 ? 250 : 0) + (usedHelp ? 0 : 250)
}

export class LocalProgressRepository implements ProgressRepository {
  loadLocal(): PersistedProgress {
    try {
      const raw = alteruLocalStorage.getItem(PROGRESS_KEY)
      if (raw) return normalizeProgress(JSON.parse(raw)) ?? emptyProgress()
    } catch {
      // Fall through to the legacy highest-level migration.
    }
    return emptyProgress()
  }

  async loadRemote(): Promise<PersistedProgress | null> {
    return null
  }

  save(progress: PersistedProgress): void {
    try {
      alteruLocalStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
      alteruLocalStorage.setItem(LEGACY_LEVEL_KEY, String(progress.unlockedLevel))
    } catch {
      // Storage quota or privacy mode must not block play.
    }
  }

  flush(): void {}
}
