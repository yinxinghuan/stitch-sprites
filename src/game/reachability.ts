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

