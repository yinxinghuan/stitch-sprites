import { getGameUuid } from '../game-id'
import { LocalProgressRepository, mergeProgress, normalizeProgress, type PersistedProgress, type ProgressRepository } from '../game/progress'
import { callAigramAPI, isAigramPlayer, openAigramProfile, playerId, postAigramAPI, type AigramResponse } from './aigram-bridge'
import type { LeaderboardEntry, LeaderboardService, PlatformServices } from './contracts'

interface SaveRow {
  user_id: string
  resource_data: string
}

interface RankRow {
  user_id: string
  score: string | number
  rank: number
  user_name: string
  head_url: string
}

class SyncedProgressRepository implements ProgressRepository {
  private pending: PersistedProgress | null = null
  private timer = 0

  constructor(private readonly local: LocalProgressRepository, private readonly sessionId: string) {}

  loadLocal(): PersistedProgress {
    return this.local.loadLocal()
  }

  async loadRemote(): Promise<PersistedProgress | null> {
    if (!isAigramPlayer || !playerId) return null
    try {
      const response = await callAigramAPI<AigramResponse<SaveRow[]>>(
        `/note/aigram/ai/game/get/data/list?session_id=${encodeURIComponent(this.sessionId)}`,
      )
      const mine = (Array.isArray(response?.data) ? response.data : []).find((row) => String(row.user_id) === String(playerId))
      if (!mine?.resource_data) return null
      return normalizeProgress(JSON.parse(mine.resource_data))
    } catch {
      return null
    }
  }

  save(progress: PersistedProgress): void {
    this.local.save(progress)
    this.pending = progress
    if (this.timer) window.clearTimeout(this.timer)
    this.timer = window.setTimeout(() => this.flush(), 1000)
  }

  flush(): void {
    if (this.timer) window.clearTimeout(this.timer)
    this.timer = 0
    const pending = this.pending
    this.pending = null
    if (!pending || !isAigramPlayer) return
    postAigramAPI('/note/aigram/ai/game/save/data', {
      session_id: this.sessionId,
      resource_data: JSON.stringify(pending),
    })
  }
}

class AigramLeaderboardService implements LeaderboardService {
  private rows: LeaderboardEntry[] = []

  constructor(private readonly sessionId: string) {}

  async fetch(): Promise<LeaderboardEntry[]> {
    try {
      const response = await callAigramAPI<AigramResponse<RankRow[]>>(
        `/note/aigram/ai/game/rank/score/list/by/session_id?session_id=${encodeURIComponent(this.sessionId)}`,
      )
      this.rows = (Array.isArray(response?.data) ? response.data : []).map((row) => ({
        userId: String(row.user_id),
        name: row.user_name || '?',
        avatarUrl: row.head_url || '',
        score: Number(row.score) || 0,
        rank: Number(row.rank) || 0,
        isMe: String(row.user_id) === String(playerId),
      })).sort((a, b) => a.rank - b.rank)
      return this.rows
    } catch {
      return this.rows
    }
  }

  async submit(score: number, previousOwnScore: number): Promise<void> {
    if (score <= 0) return
    const before = this.rows.length ? [...this.rows] : await this.fetch()
    try {
      await callAigramAPI<AigramResponse<null>>('/note/aigram/ai/game/rank/score/save', 'POST', {
        session_id: this.sessionId,
        score: Math.round(score),
      })
      const beaten = before
        .filter((row) => !row.isMe && row.score > previousOwnScore && row.score < score)
        .sort((a, b) => b.score - a.score)[0]
      if (beaten) {
        postAigramAPI('/note/aigram/ai/game/record/play', {
          session_id: this.sessionId,
          event: 'score_beat',
          config_json: {
            actions: [{
              type: 'notify',
              target_user_id: beaten.userId,
              image: {
                ref_url: 'https://yinxinghuan.github.io/stitch-sprites/poster.png',
                prompt: 'A warm modern cross-stitch game poster with tiny black sprites and colorful thread.',
              },
              message: {
                template: `{sender_name} 刚以 ${Math.round(score)} 绣艺分超过了你。`,
                variables: ['sender_name'],
              },
            }],
          },
        })
      }
      await this.fetch()
    } catch {
      // Ranking is optional and never blocks the result screen.
    }
  }

  openProfile(userId: string): void {
    openAigramProfile(userId)
  }
}

export function createPlatformServices(): PlatformServices {
  const local = new LocalProgressRepository()
  const sessionId = getGameUuid()
  const progress = isAigramPlayer ? new SyncedProgressRepository(local, sessionId) : local
  const leaderboard = isAigramPlayer ? new AigramLeaderboardService(sessionId) : null
  return {
    progress,
    leaderboard,
    async mergeRemote(current: PersistedProgress): Promise<PersistedProgress | null> {
      const remote = await progress.loadRemote()
      return remote ? mergeProgress(current, remote) : null
    },
  }
}
