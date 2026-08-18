import { normalizeProgress, PROGRESS_VERSION } from '../src/game/progress.ts'

const legacy = normalizeProgress({
  version: 2,
  updatedAt: 1234,
  unlockedLevel: 27,
  bestByLevel: { 1: 1500, 27: 2100 },
  currentRun: {
    levelId: 27,
    phase: 'playing',
    cleared: [1, 2, 3],
    columns: [[], [], [], []],
    slots: [],
    removed: 3,
    slotSequence: 1,
    wrongDispatches: 0,
    maxSlotsUsed: 1,
    usedHelp: false,
    tutorialRescueUsed: false,
  },
  economy: { coins: 45, speedTier: 2, inventory: { undo: 1 } },
})

if (!legacy) throw new Error('Version 2 progress was rejected instead of migrated')
if (legacy.version !== PROGRESS_VERSION) throw new Error(`Expected version ${PROGRESS_VERSION}, got ${legacy.version}`)
if (legacy.unlockedLevel !== 27 || legacy.bestByLevel['27'] !== 2100) throw new Error('Long-term progress was not preserved')
if (legacy.currentRun !== null) throw new Error('Old in-progress layout survived the difficulty migration')
if (legacy.economy?.coins !== 45 || legacy.economy.speedTier !== 2) throw new Error('Forward-compatible economy data was lost')

const formerFinale = normalizeProgress({
  version: PROGRESS_VERSION,
  updatedAt: 2345,
  unlockedLevel: 35,
  bestByLevel: { 35: 2125 },
  currentRun: null,
})

if (!formerFinale || formerFinale.unlockedLevel !== 36) {
  throw new Error('A player who completed the former level 35 finale did not unlock level 36')
}

const merelyUnlockedFinale = normalizeProgress({
  version: PROGRESS_VERSION,
  updatedAt: 3456,
  unlockedLevel: 35,
  bestByLevel: {},
  currentRun: null,
})

if (!merelyUnlockedFinale || merelyUnlockedFinale.unlockedLevel !== 35) {
  throw new Error('A player who only unlocked level 35 incorrectly skipped to level 36')
}

console.log(JSON.stringify({
  ok: true,
  version: legacy.version,
  unlockedLevel: legacy.unlockedLevel,
  formerFinaleUnlockedLevel: formerFinale.unlockedLevel,
  currentRun: legacy.currentRun,
}))
