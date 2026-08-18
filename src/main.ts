import './styles.css'
import { getGameApiBase } from './game-id'
import { GameEngine } from './game/engine'
import { validateLevels } from './game/levels'
import { BoardRenderer } from './game/renderer'
import type { GameSnapshot } from './game/types'
import { createPlatformServices } from './platform/create-platform-services'
import { GameView } from './ui/view'

validateLevels()
void getGameApiBase()

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('Missing #app')

const platform = createPlatformServices()
const view = new GameView(root, platform.leaderboard)
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
    void platform.leaderboard?.submit(score, previousScore).then(() => view.refreshLeaderboard(engine))
  },
}, platform.progress)

view.bind(engine)
view.update(engine.snapshot, engine)
renderer.setSnapshot(engine.snapshot)

void platform.mergeRemote(engine.persistedProgress).then((merged) => {
  if (merged) engine.applyMergedProgress(merged)
  else engine.finalizeInitialProgress()
})

window.addEventListener('pagehide', () => platform.progress.flush())
