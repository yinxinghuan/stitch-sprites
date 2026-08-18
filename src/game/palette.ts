import type { ThreadColor } from './types'

export const THREAD_COLORS: Record<ThreadColor, { hex: string; dark: string; light: string; symbol: string }> = {
  sun: { hex: '#f2c14e', dark: '#9b6b19', light: '#ffe59a', symbol: 'circle' },
  coral: { hex: '#e85b67', dark: '#963843', light: '#ffabb1', symbol: 'diamond' },
  leaf: { hex: '#5fae73', dark: '#326c44', light: '#a7d8ae', symbol: 'bar' },
  lake: { hex: '#4e9ccc', dark: '#2a658d', light: '#a9d7ef', symbol: 'ring' },
  violet: { hex: '#8e75c5', dark: '#59468b', light: '#cbbcec', symbol: 'triangle' },
  ink: { hex: '#3b3a47', dark: '#1f1f29', light: '#898795', symbol: 'cross' },
  aqua: { hex: '#35bfc2', dark: '#177b80', light: '#9decef', symbol: 'square' },
}

export type ThreadStyle = (typeof THREAD_COLORS)[ThreadColor]

function mix(hex: string, target: string, amount: number): string {
  const parse = (value: string): number[] => [1, 3, 5].map((index) => Number.parseInt(value.slice(index, index + 2), 16))
  const source = parse(hex)
  const destination = parse(target)
  return `#${source.map((channel, index) => Math.round(channel + (destination[index] - channel) * amount).toString(16).padStart(2, '0')).join('')}`
}

export function resolveThreadStyle(
  color: ThreadColor,
  palette?: Partial<Record<ThreadColor, string>>,
): ThreadStyle {
  const base = THREAD_COLORS[color]
  const hex = palette?.[color] ?? base.hex
  if (hex.toLowerCase() === base.hex.toLowerCase()) return base
  return {
    hex,
    dark: mix(hex, '#17151c', 0.42),
    light: mix(hex, '#fff7e8', 0.48),
    symbol: base.symbol,
  }
}

export const CODE_TO_COLOR: Record<string, ThreadColor> = {
  Y: 'sun',
  R: 'coral',
  G: 'leaf',
  B: 'lake',
  P: 'violet',
  K: 'ink',
  A: 'violet',
  C: 'aqua',
  D: 'lake',
  E: 'ink',
}
