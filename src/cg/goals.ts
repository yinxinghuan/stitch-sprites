export function completeLines(input: {
  reward: number
  coins: number
  showCoins: boolean
  levelId: number
  nextName: string | null
  nextUnlock: string | null
  score: number
  total: number
  usedHelp: boolean
}): string[] {
  const lines = [
    `Pattern score ${input.score.toLocaleString()} · album ${input.total.toLocaleString()}`,
  ]
  if (input.usedHelp) lines.push('A tool or the lesson rewind was used, so the clean-run bonus is off.')
  if (input.levelId === 2) lines.push('Your coin purse is open. It stays on this device.')
  if (!input.showCoins) {
    lines.push('Finish the next pattern to open your coin purse.')
  } else if (input.reward >= 300) {
    lines.push(`+${input.reward} coins, including a 200 coin chapter bonus. Purse: ${input.coins.toLocaleString()}.`)
  } else {
    lines.push(`+${input.reward} coins. Purse: ${input.coins.toLocaleString()}.`)
  }
  lines.push(input.nextName ? `Next pattern: ${input.nextName}.` : 'The album is complete. Replay any pattern you like.')
  if (input.nextUnlock) lines.push(input.nextUnlock)
  return lines
}

export function failLines(input: {
  colors: string
  name: string
  recallReady: boolean
  rackLimit: number
}): string[] {
  return [
    `The outer layer needs ${input.colors}.`,
    `Next: replay ${input.name}. Your coins stay.`,
    input.recallReady
      ? 'Recall (Q) puts an unused waiting reel back for 80 coins.'
      : `${input.rackLimit} waiting reels that cannot reach the edge ends the pattern.`,
  ]
}
