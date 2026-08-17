import type { Cell, ThreadColor } from './types'

export const cellKey = (row: number, col: number): string => `${row}:${col}`

export function findReachable(cells: Cell[][]): Set<string> {
  const rows = cells.length
  const cols = cells[0]?.length ?? 0
  const paddedRows = rows + 2
  const paddedCols = cols + 2
  const visited = new Set<string>()
  const queue: Array<[number, number]> = [[0, 0]]
  visited.add(cellKey(0, 0))
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const

  const isPassable = (pr: number, pc: number): boolean => {
    if (pr === 0 || pc === 0 || pr === paddedRows - 1 || pc === paddedCols - 1) return true
    const cell = cells[pr - 1][pc - 1]
    return cell.color === null || cell.cleared
  }

  while (queue.length) {
    const [row, col] = queue.shift()!
    directions.forEach(([dr, dc]) => {
      const nextRow = row + dr
      const nextCol = col + dc
      if (nextRow < 0 || nextCol < 0 || nextRow >= paddedRows || nextCol >= paddedCols) return
      const key = cellKey(nextRow, nextCol)
      if (visited.has(key) || !isPassable(nextRow, nextCol)) return
      visited.add(key)
      queue.push([nextRow, nextCol])
    })
  }

  const reachable = new Set<string>()
  visited.forEach((key) => {
    const [pr, pc] = key.split(':').map(Number)
    directions.forEach(([dr, dc]) => {
      const row = pr + dr - 1
      const col = pc + dc - 1
      if (row < 0 || col < 0 || row >= rows || col >= cols) return
      const cell = cells[row][col]
      if (cell.color && !cell.cleared) reachable.add(cellKey(row, col))
    })
  })
  return reachable
}

export function reachableColors(cells: Cell[][], reachable: Set<string>): Set<ThreadColor> {
  const colors = new Set<ThreadColor>()
  reachable.forEach((key) => {
    const [row, col] = key.split(':').map(Number)
    const color = cells[row]?.[col]?.color
    if (color) colors.add(color)
  })
  return colors
}

export function chooseReachableCell(
  cells: Cell[][],
  reachable: Set<string>,
  color: ThreadColor,
  reserved: Set<string>,
): { row: number; col: number } | null {
  const candidates: Array<{ row: number; col: number }> = []
  reachable.forEach((key) => {
    if (reserved.has(key)) return
    const [row, col] = key.split(':').map(Number)
    if (cells[row][col].color === color && !cells[row][col].cleared) candidates.push({ row, col })
  })
  candidates.sort((a, b) => b.row - a.row || Math.abs(a.col - cells[0].length / 2) - Math.abs(b.col - cells[0].length / 2))
  return candidates[0] ?? null
}

export function findWalkPath(
  cells: Cell[][],
  target: { row: number; col: number },
): Array<{ row: number; col: number }> {
  const rows = cells.length
  const cols = cells[0]?.length ?? 0
  if (!rows || !cols) return []

  const paddedRows = rows + 2
  const paddedCols = cols + 2
  const start: [number, number] = [paddedRows - 1, Math.max(1, Math.min(cols, Math.floor(cols / 2) + 1))]
  const targetRow = target.row + 1
  const targetCol = target.col + 1
  const directions = [[-1, 0], [0, -1], [0, 1], [1, 0]] as const
  const goalKeys = new Set<string>()

  const isPassable = (pr: number, pc: number): boolean => {
    if (pr === 0 || pc === 0 || pr === paddedRows - 1 || pc === paddedCols - 1) return true
    const cell = cells[pr - 1]?.[pc - 1]
    return Boolean(cell && (cell.color === null || cell.cleared))
  }

  directions.forEach(([dr, dc]) => {
    const row = targetRow + dr
    const col = targetCol + dc
    if (row >= 0 && col >= 0 && row < paddedRows && col < paddedCols && isPassable(row, col)) {
      goalKeys.add(cellKey(row, col))
    }
  })
  if (!goalKeys.size) return []

  const queue: Array<[number, number]> = [start]
  const visited = new Set<string>([cellKey(start[0], start[1])])
  const parent = new Map<string, string>()
  let goal: string | null = null

  while (queue.length) {
    const [row, col] = queue.shift()!
    const key = cellKey(row, col)
    if (goalKeys.has(key)) {
      goal = key
      break
    }
    directions.forEach(([dr, dc]) => {
      const nextRow = row + dr
      const nextCol = col + dc
      if (nextRow < 0 || nextCol < 0 || nextRow >= paddedRows || nextCol >= paddedCols) return
      const nextKey = cellKey(nextRow, nextCol)
      if (visited.has(nextKey) || !isPassable(nextRow, nextCol)) return
      visited.add(nextKey)
      parent.set(nextKey, key)
      queue.push([nextRow, nextCol])
    })
  }

  if (!goal) return []
  const reversed: Array<{ row: number; col: number }> = []
  let cursor: string | undefined = goal
  while (cursor) {
    const [row, col] = cursor.split(':').map(Number)
    reversed.push({ row: row - 1, col: col - 1 })
    cursor = parent.get(cursor)
  }
  return reversed.reverse()
}
