export type ThreadColor = 'sun' | 'coral' | 'leaf' | 'lake' | 'violet' | 'ink'

export interface Cell {
  color: ThreadColor | null
  cleared: boolean
}

export interface SpoolDefinition {
  id: string
  color: ThreadColor
  capacity: number
}

export interface SpoolState extends SpoolDefinition {
  remaining: number
}

export interface LevelDefinition {
  id: number
  titleKey: string
  completeKey: string
  reveal: string
  density: number
  rows: string[]
  columns: SpoolDefinition[][]
  solution: number[]
  tutorial: boolean
  displayPalette: Partial<Record<ThreadColor, string>>
  textureMode?: 'source' | 'procedural'
}

export interface ActiveSlot {
  slotId: number
  sourceColumn: number
  spool: SpoolState
  state: 'working' | 'waiting'
}

export interface StitchTask {
  slotId: number
  color: ThreadColor
  row: number
  col: number
  workerIndex: number
  path: Array<{ row: number; col: number }>
  departMs: number
  travelMs: number
}

export type GamePhase = 'playing' | 'complete' | 'failed'

export interface GameSnapshot {
  level: LevelDefinition
  cells: Cell[][]
  columns: SpoolState[][]
  slots: ActiveSlot[]
  phase: GamePhase
  removed: number
  remaining: number
  reachable: Set<string>
  messageKey: string
  wrongDispatches: number
  usedHelp: boolean
  levelScore: number
  totalMastery: number
}
