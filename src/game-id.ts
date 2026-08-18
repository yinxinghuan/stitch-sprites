declare global {
  interface Window {
    __GAME_UUID__?: string
  }
}

export function getGameUuid(): string {
  if (typeof window !== 'undefined' && window.__GAME_UUID__) return window.__GAME_UUID__
  const meta = typeof document !== 'undefined' ? document.querySelector('meta[name="game-uuid"]') : null
  const uuid = meta?.getAttribute('content')
  if (!uuid) throw new Error('Missing game UUID')
  return uuid
}

/** Same-origin base for game-owned Worker routes after Remix UUID replacement. */
export function getGameApiBase(): string {
  return `/${getGameUuid()}`
}
