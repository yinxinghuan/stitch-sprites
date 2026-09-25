import { isCrazyGames } from './cg/mode'
import bgmUrl from './cg/audio/bgm.mp3'
import buyUrl from './cg/audio/buy.ogg'
import failUrl from './cg/audio/fail.ogg'
import spoolUrl from './cg/audio/spool.ogg'
import stitchUrl from './cg/audio/stitch.ogg'
import travelUrl from './cg/audio/travel.ogg'
import waitUrl from './cg/audio/wait.ogg'
import winUrl from './cg/audio/win.ogg'
import { GameEngine } from './game/engine'
import { BoardRenderer } from './game/renderer'
import type { GameSnapshot } from './game/types'
import { createGuestServices } from './cg/platform'
import { loadAudioPrefs, saveAudioPrefs } from './cg/prefs'
import { GameView } from './ui/view'
import './styles.css'
import './cg/desk.css'

if (!isCrazyGames) throw new Error('Guest entry loaded outside the Crazy Games build')

document.documentElement.lang = 'en'
document.documentElement.classList.add('cg-root')
document.title = 'Unstitch Sprites'

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('Missing #app')

const platform = createGuestServices()
const view = new GameView(root, null, false)
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
  onMastery: () => {},
}, platform.progress)

const prefs = loadAudioPrefs()
engine.audio.useSamples(bgmUrl, {
  spool: spoolUrl,
  depart: travelUrl,
  unstitch: stitchUrl,
  wait: waitUrl,
  danger: waitUrl,
  complete: winUrl,
  fail: failUrl,
  purchase: buyUrl,
}, prefs, () => {
  saveAudioPrefs({ muted: engine.audio.isMuted, volume: engine.audio.volumeLevel })
})

view.attachClock(renderer)
view.bind(engine)
view.update(engine.snapshot, engine)
renderer.setSnapshot(engine.snapshot)
engine.finalizeInitialProgress()
window.addEventListener('pagehide', () => platform.progress.flush())
