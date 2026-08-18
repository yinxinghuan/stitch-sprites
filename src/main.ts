import './styles.css'
import { getGameApiBase } from './game-id'
import { GameEngine } from './game/engine'
import { activateDualEntryLab, validateDualEntryLab, validateLevels } from './game/levels'
import { BoardRenderer } from './game/renderer'
import type { GameSnapshot } from './game/types'
import { createPlatformServices } from './platform/create-platform-services'
import { GameView } from './ui/view'

validateLevels()
const query = new URLSearchParams(location.search)
const dualEntryLab = query.get('lab') === 'dual-entry' && query.get('level') === '42'
if (dualEntryLab) {
  validateDualEntryLab()
  activateDualEntryLab()
}
void getGameApiBase()

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('Missing #app')

const platform = createPlatformServices()
const view = new GameView(root, dualEntryLab ? null : platform.leaderboard, dualEntryLab)
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
    if (!dualEntryLab) void platform.leaderboard?.submit(score, previousScore).then(() => view.refreshLeaderboard(engine))
  },
}, platform.progress)

view.bind(engine)
view.update(engine.snapshot, engine)
renderer.setSnapshot(engine.snapshot)

if (!dualEntryLab) {
  void platform.mergeRemote(engine.persistedProgress).then((merged) => {
    if (merged) engine.applyMergedProgress(merged)
    else engine.finalizeInitialProgress()
  })
}

window.addEventListener('pagehide', () => platform.progress.flush())
