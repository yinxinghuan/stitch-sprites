import type { PersistedProgress, ProgressRepository } from '../game/progress'

export interface LeaderboardEntry {
  userId: string
  name: string
  avatarUrl: string
  score: number
  rank: number
  isMe: boolean
}

export interface LeaderboardService {
  fetch(): Promise<LeaderboardEntry[]>
  submit(score: number, previousOwnScore: number): Promise<void>
  openProfile(userId: string): void
}

export interface PlatformServices {
  progress: ProgressRepository
  leaderboard: LeaderboardService | null
  mergeRemote(local: PersistedProgress): Promise<PersistedProgress | null>
}
