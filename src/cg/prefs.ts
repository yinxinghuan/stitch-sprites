const TUTORIAL_KEY = 'stitch_sprites_cg_tutorial_v1'
const AUDIO_KEY = 'stitch_sprites_cg_audio_v1'

export interface TutorialState {
  done: boolean
  step: number
}

export interface AudioPrefs {
  muted: boolean
  volume: number
}

function storage(): Storage {
  return alteruLocalStorage
}

export function loadTutorial(): TutorialState {
  try {
    const raw = storage().getItem(TUTORIAL_KEY)
    if (!raw) return { done: false, step: 0 }
    const parsed = JSON.parse(raw) as Partial<TutorialState>
    return { done: Boolean(parsed.done), step: Math.max(0, Math.min(4, Number(parsed.step) || 0)) }
  } catch {
    return { done: false, step: 0 }
  }
}

export function saveTutorial(state: TutorialState): void {
  try {
    storage().setItem(TUTORIAL_KEY, JSON.stringify(state))
  } catch {
    // Private mode must not block the lesson.
  }
}

export function loadAudioPrefs(): AudioPrefs {
  try {
    const raw = storage().getItem(AUDIO_KEY)
    if (!raw) return { muted: false, volume: 0.8 }
    const parsed = JSON.parse(raw) as Partial<AudioPrefs>
    const volume = Number(parsed.volume)
    return {
      muted: Boolean(parsed.muted),
      volume: Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.8,
    }
  } catch {
    return { muted: false, volume: 0.8 }
  }
}

export function saveAudioPrefs(prefs: AudioPrefs): void {
  try {
    storage().setItem(AUDIO_KEY, JSON.stringify(prefs))
  } catch {
    // Ignore quota failures.
  }
}
