import type { PersistedProgress } from '../game/progress'
import type { LevelDefinition, ThreadColor } from '../game/types'

export type PowerId = 'recall' | 'shuffle' | 'extra' | 'vacuum'

export interface Economy {
  coins: number
  speedTier: number
  selectedSpeed: number
}

export interface SpeedOffer {
  tier: 0 | 1 | 2
  unlockLevel: number
  price: number
  scale: number
  name: string
  detail: string
}

export interface PowerOffer {
  id: PowerId
  unlockLevel: number
  price: number
  key: string
  name: string
  detail: string
}

export const SPEED_OFFERS: SpeedOffer[] = [
  { tier: 0, unlockLevel: 1, price: 0, scale: 1, name: 'Steady', detail: 'The normal pace.' },
  { tier: 1, unlockLevel: 6, price: 400, scale: 1.12, name: 'Light Step', detail: 'Sprites travel and queue at 1.12×. Switch back any time.' },
  { tier: 2, unlockLevel: 18, price: 1000, scale: 1.25, name: 'Quick Queue', detail: 'Sprites travel and queue at 1.25×. This is the top pace.' },
]

export const POWER_OFFERS: PowerOffer[] = [
  { id: 'recall', unlockLevel: 3, price: 80, key: 'Q', name: 'Recall', detail: 'Return one waiting reel that has not started working.' },
  { id: 'shuffle', unlockLevel: 7, price: 120, key: 'W', name: 'Shuffle', detail: 'Shuffle the cards under one stack. The top card stays.' },
  { id: 'extra', unlockLevel: 11, price: 180, key: 'E', name: 'Extra slot', detail: 'Add a sixth waiting slot for this pattern only.' },
  { id: 'vacuum', unlockLevel: 24, price: 280, key: 'V', name: 'Peel', detail: 'Clear one color that is already exposed. It does not dig deeper.' },
]

export function paceFor(selectedSpeed: number): number {
  return SPEED_OFFERS.find((offer) => offer.tier === selectedSpeed)?.scale ?? 1
}

export function readEconomy(progress: PersistedProgress): Economy {
  const raw = progress.economy
  const coins = Number(raw?.coins)
  const tierValue = Number(raw?.speedTier)
  const speedTier = tierValue === 1 || tierValue === 2 ? tierValue : 0
  const selectedValue = Number(raw?.inventory?.selectedSpeed)
  const selectedSpeed = selectedValue === 0 || selectedValue === 1 || selectedValue === 2
    ? Math.min(speedTier, selectedValue)
    : speedTier
  return {
    coins: Number.isFinite(coins) && coins >= 0 ? Math.floor(coins) : 200,
    speedTier,
    selectedSpeed,
  }
}

export function writeEconomy(progress: PersistedProgress, economy: Economy): PersistedProgress {
  return {
    ...progress,
    economy: {
      coins: economy.coins,
      speedTier: economy.speedTier,
      inventory: {
        ...(progress.economy?.inventory ?? {}),
        selectedSpeed: economy.selectedSpeed,
      },
    },
  }
}

export function colorCount(level: Pick<LevelDefinition, 'rows'>): number {
  return new Set(level.rows.join('').replaceAll('.', '')).size
}

export function clearReward(levelIndex: number, levels: Pick<LevelDefinition, 'rows'>[], first: boolean): number {
  if (!first) return 20
  const next = levels[levelIndex + 1]
  const chapter = !next || colorCount(next) > colorCount(levels[levelIndex])
  return chapter ? 300 : 100
}

export interface GuestCard {
  id: string
  name: string
  detail: string
  price: number
  key: string
  state: 'selected' | 'owned' | 'buy' | 'locked' | 'armed' | 'spent' | 'ready'
  lock: string
}

export interface GuestSnapshot {
  coins: number
  showCoins: boolean
  speedTier: number
  selectedSpeed: number
  reward: number
  armed: PowerId | null
  extraSlot: boolean
  speeds: GuestCard[]
  powers: GuestCard[]
  goal: string
}

export function presentGuest(input: {
  economy: Economy
  unlockedLevel: number
  reward: number
  armed: PowerId | null
  extraSlot: boolean
  phase: string
}): GuestSnapshot {
  const { economy } = input
  const showCoins = input.unlockedLevel >= 3
  const speeds: GuestCard[] = SPEED_OFFERS.map((offer) => {
    const owned = offer.tier <= economy.speedTier
    const unlocked = input.unlockedLevel >= offer.unlockLevel
    let state: GuestCard['state'] = 'locked'
    if (owned && economy.selectedSpeed === offer.tier) state = 'selected'
    else if (owned) state = 'owned'
    else if (unlocked && offer.tier === economy.speedTier + 1) state = 'buy'
    return {
      id: `speed-${offer.tier}`,
      name: offer.name,
      detail: offer.detail,
      price: offer.price,
      key: '',
      state,
      lock: unlocked ? '' : `After pattern ${offer.unlockLevel - 1}`,
    }
  })
  const powers: GuestCard[] = POWER_OFFERS.map((offer) => {
    const unlocked = input.unlockedLevel >= offer.unlockLevel
    let state: GuestCard['state'] = 'locked'
    if (offer.id === 'extra' && input.extraSlot) state = 'spent'
    else if (input.armed === offer.id) state = 'armed'
    else if (unlocked) state = 'ready'
    return {
      id: offer.id,
      name: offer.name,
      detail: offer.detail,
      price: offer.price,
      key: offer.key,
      state,
      lock: unlocked ? '' : `After pattern ${offer.unlockLevel - 1}`,
    }
  })
  const affordable = showCoins
    ? speeds.find((card) => card.state === 'buy' && economy.coins >= card.price)
      ?? powers.find((card) => card.state === 'ready' && economy.coins >= card.price)
    : undefined
  const upcoming = powers.find((card) => card.state === 'locked') ?? speeds.find((card) => card.state === 'locked')
  let goal = 'Clear the stitches on the outside of the hoop.'
  if (input.phase === 'playing') {
    if (!showCoins) goal = 'Finish pattern 2 to open your coin purse.'
    else if (affordable) goal = `You can buy ${affordable.name} (${affordable.price} coins).`
    else if (upcoming) goal = `Next unlock: ${upcoming.name}, ${upcoming.lock.toLowerCase()}.`
    else goal = 'Every tool is unlocked. Replay patterns for a few more coins.'
  }
  return {
    coins: economy.coins,
    showCoins,
    speedTier: economy.speedTier,
    selectedSpeed: economy.selectedSpeed,
    reward: input.reward,
    armed: input.armed,
    extraSlot: input.extraSlot,
    speeds,
    powers,
    goal,
  }
}

export function offerFor(id: PowerId): PowerOffer {
  const offer = POWER_OFFERS.find((candidate) => candidate.id === id)
  if (!offer) throw new Error(`Unknown tool ${id}`)
  return offer
}

export function canAfford(economy: Economy, price: number, unlockedLevel: number, unlockLevel: number): boolean {
  return unlockedLevel >= unlockLevel && economy.coins >= price
}

export type VacuumColor = ThreadColor
