import { LocalProgressRepository, type PersistedProgress } from '../game/progress'
import type { PlatformServices } from '../platform/contracts'

export function createGuestServices(): PlatformServices {
  const progress = new LocalProgressRepository()
  return {
    progress,
    leaderboard: null,
    async mergeRemote(): Promise<PersistedProgress | null> {
      return null
    },
  }
}
