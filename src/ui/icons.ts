export function soundIcon(muted: boolean): string {
  return muted
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="m17 9 4 6m0-6-4 6"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12"/></svg>'
}

export const restartIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8V4m0 0h4M5 4l3.1 3.1A7 7 0 1 1 5.7 15"/></svg>'

export const arrowIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>'

