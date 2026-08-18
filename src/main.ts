import './styles.css'
import { getGameApiBase } from './game-id'
import { GameEngine } from './game/engine'
import { validateLevels } from './game/levels'
import { BoardRenderer } from './game/renderer'
import type { GameSnapshot } from './game/types'
import { GameView } from './ui/view'

validateLevels()
void getGameApiBase()

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('Missing #app')

const view = new GameView(root)
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
})

view.bind(engine)
view.update(engine.snapshot, engine)
renderer.setSnapshot(engine.snapshot)
