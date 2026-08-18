import './styles.css'
import { getGameApiBase } from './game-id'
import { GameEngine } from './game/engine'
import {
  activateDualEntryLab,
  activateMultiRingLab,
  validateDualEntryLab,
  validateLevels,
  validateMultiRingLab,
} from './game/levels'
import { BoardRenderer } from './game/renderer'
import type { GameSnapshot } from './game/types'
import { createPlatformServices } from './platform/create-platform-services'
import { GameView } from './ui/view'

validateLevels()
const query = new URLSearchParams(location.search)
const dualEntryLab = query.get('lab') === 'dual-entry' && query.get('level') === '42'
const multiRingLab = query.get('lab') === 'multi-ring' && query.get('level') === '42'
const labMode = dualEntryLab || multiRingLab
if (dualEntryLab) {
  validateDualEntryLab()
  activateDualEntryLab()
}
if (multiRingLab) {
  validateMultiRingLab()
  activateMultiRingLab()
}
void getGameApiBase()

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('Missing #app')

const platform = createPlatformServices()
const view = new GameView(root, labMode ? null : platform.leaderboard, labMode)
const renderer = new BoardRenderer(view.canvas)
let queuedSnapshot: GameSnapshot | null = null

const engine = new GameEngine({
  onChange: (snapshot) => {
    queuedSnapshot = snapshot
    renderer.setSnapshot(snapshot)
    queueMicrotask(() => {
      if (!queuedSnapshot) return
      view.update(queuedSnapshot, engine)
      queuedSnapshot = null
    })
  },
  onTasks: (tasks) => renderer.launch(tasks),
  onMastery: (score, previousScore) => {
    if (!labMode) void platform.leaderboard?.submit(score, previousScore).then(() => view.refreshLeaderboard(engine))
  },
}, platform.progress)

view.bind(engine)
view.update(engine.snapshot, engine)
renderer.setSnapshot(engine.snapshot)

if (!labMode) {
  void platform.mergeRemote(engine.persistedProgress).then((merged) => {
    if (merged) engine.applyMergedProgress(merged)
    else engine.finalizeInitialProgress()
  })
}

window.addEventListener('pagehide', () => platform.progress.flush())
