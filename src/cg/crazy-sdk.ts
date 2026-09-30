interface CrazyGameModule {
  loadingStart(): void
  loadingStop(): void
  gameplayStart(): void
  gameplayStop(): void
  settings?: { muteAudio?: boolean }
  addSettingsChangeListener?(listener: (settings: { muteAudio?: boolean }) => void): void
}

interface CrazySdk {
  environment?: string
  init(): Promise<void>
  game: CrazyGameModule
}

declare global {
  interface Window {
    CrazyGames?: { SDK: CrazySdk }
  }
}

let ready = false
let loading = false
let playing = false

function sdk(): CrazySdk | null {
  return window.CrazyGames?.SDK ?? null
}

export async function initializeCrazySdk(): Promise<void> {
  const current = sdk()
  if (!current) return
  try {
    await current.init()
    if (current.environment === 'disabled') return
    ready = true
    current.game.loadingStart()
    loading = true
  } catch {
    ready = false
  }
}

export function finishCrazyLoading(): void {
  if (!ready || !loading) return
  loading = false
  try {
    sdk()?.game.loadingStop()
  } catch {
    // The external GitHub page uses the disabled SDK environment.
  }
}

export function crazyGameplayStart(): void {
  if (!ready || playing) return
  playing = true
  try {
    sdk()?.game.gameplayStart()
  } catch {
    playing = false
  }
}

export function crazyGameplayStop(): void {
  if (!ready || !playing) return
  playing = false
  try {
    sdk()?.game.gameplayStop()
  } catch {
    // A disabled environment must not break the external-page fallback.
  }
}

export function crazySdkForcesMute(): boolean {
  return Boolean(ready && sdk()?.game.settings?.muteAudio)
}

export function onCrazyMuteChange(listener: (muted: boolean) => void): void {
  if (!ready) return
  sdk()?.game.addSettingsChangeListener?.((settings) => listener(Boolean(settings.muteAudio)))
}

