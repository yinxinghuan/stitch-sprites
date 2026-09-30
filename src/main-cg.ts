import { isCrazyGames } from './cg/mode'
import { crazySdkForcesMute, finishCrazyLoading, initializeCrazySdk, onCrazyMuteChange } from './cg/crazy-sdk'
import bgmUrl from './cg/audio/bgm.mp3'
import buyUrl from './cg/audio/buy.ogg'
import failUrl from './cg/audio/fail.ogg'
import spoolUrl from './cg/audio/spool.ogg'
import stitchUrl from './cg/audio/stitch.ogg'
import travelUrl from './cg/audio/travel.ogg'
import waitUrl from './cg/audio/wait.ogg'
import winUrl from './cg/audio/win.ogg'
import { GameEngine } from './cg/game/engine'
import { LEVELS } from './cg/game/levels'
import { BoardRenderer } from './cg/game/renderer'
import type { GameSnapshot } from './cg/game/types'
import { createGuestServices } from './cg/platform'
import { loadAudioPrefs, saveAudioPrefs } from './cg/prefs'
import { GameView } from './cg/ui/view'
import './styles.css'
import './cg/desk.css'

if (!isCrazyGames) throw new Error('Guest entry loaded outside the Crazy Games build')

async function start(): Promise<void> {
await initializeCrazySdk()

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

if (new URLSearchParams(location.search).get('qa') === '1') {
  ;(window as unknown as { __CG_QA__: unknown }).__CG_QA__ = {
    get snapshot() { return engine.snapshot },
    get isProcessing() { return engine.isProcessing },
    get visibleMissionCount() { return renderer.visibleMissionCount },
    selectColumn: (column: number) => engine.selectColumn(column),
    unlockThrough: (level: number) => engine.applyMergedProgress({
      ...engine.persistedProgress,
      unlockedLevel: Math.max(engine.unlockedLevel, Math.min(LEVELS.length, level)),
      updatedAt: Date.now(),
    }),
  }
}

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
  saveAudioPrefs({ muted: engine.audio.preferenceMuted, volume: engine.audio.volumeLevel })
})
engine.audio.setPlatformMuted(crazySdkForcesMute())
onCrazyMuteChange((muted) => engine.audio.setPlatformMuted(muted))

view.attachClock(renderer)
view.bind(engine)
view.update(engine.snapshot, engine)
renderer.setSnapshot(engine.snapshot)
engine.finalizeInitialProgress()
finishCrazyLoading()
window.addEventListener('pagehide', () => platform.progress.flush())
}

void start()
