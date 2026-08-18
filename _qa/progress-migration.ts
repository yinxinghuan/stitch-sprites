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
if (legacy.unlockedLevel !== 8 || legacy.bestByLevel['7'] !== 1600) throw new Error('Selected legacy progress was not remapped')
if (legacy.bestByLevel['1']) throw new Error('A removed legacy level leaked into the new collection')
if (legacy.currentRun !== null) throw new Error('Old in-progress layout survived the difficulty migration')
if (legacy.economy?.coins !== 45 || legacy.economy.speedTier !== 2) throw new Error('Forward-compatible economy data was lost')

const versionThree = normalizeProgress({
  version: 3,
  updatedAt: 2345,
  unlockedLevel: 20,
  bestByLevel: { 2: 1550, 20: 2050 },
  currentRun: null,
})

if (!versionThree || versionThree.unlockedLevel !== 7 || versionThree.bestByLevel['1'] !== 1525 || versionThree.bestByLevel['6'] !== 1700) {
  throw new Error('Version 3 selected levels were not remapped to the compact collection')
}

const current = normalizeProgress({
  version: PROGRESS_VERSION,
  updatedAt: 3456,
  unlockedLevel: 31,
  bestByLevel: { 31: 2025 },
  currentRun: null,
})

if (!current || current.unlockedLevel !== 31 || current.bestByLevel['31'] !== 2025) {
  throw new Error('Current-version progress changed during normalization')
}

console.log(JSON.stringify({
  ok: true,
  version: legacy.version,
  unlockedLevel: legacy.unlockedLevel,
  versionThreeUnlockedLevel: versionThree.unlockedLevel,
  currentUnlockedLevel: current.unlockedLevel,
  currentRun: legacy.currentRun,
}))
