import type { ThreadColor } from './types'

export const THREAD_COLORS: Record<ThreadColor, { hex: string; dark: string; light: string; symbol: string }> = {
  sun: { hex: '#f2c14e', dark: '#9b6b19', light: '#ffe59a', symbol: 'circle' },
  coral: { hex: '#e85b67', dark: '#963843', light: '#ffabb1', symbol: 'diamond' },
  leaf: { hex: '#5fae73', dark: '#326c44', light: '#a7d8ae', symbol: 'bar' },
  lake: { hex: '#4e9ccc', dark: '#2a658d', light: '#a9d7ef', symbol: 'ring' },
  violet: { hex: '#8e75c5', dark: '#59468b', light: '#cbbcec', symbol: 'triangle' },
  ink: { hex: '#3b3a47', dark: '#1f1f29', light: '#898795', symbol: 'cross' },
}

export const CODE_TO_COLOR: Record<string, ThreadColor> = {
  Y: 'sun',
  R: 'coral',
  G: 'leaf',
  B: 'lake',
  P: 'violet',
  K: 'ink',
  A: 'violet',
  C: 'sun',
  D: 'lake',
  E: 'ink',
}

