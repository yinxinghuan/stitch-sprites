export function soundIcon(muted: boolean): string {
  return muted
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="m17 9 4 6m0-6-4 6"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12"/></svg>'
}

export const restartIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8V4m0 0h4M5 4l3.1 3.1A7 7 0 1 1 5.7 15"/></svg>'

export const arrowIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>'

export function revealIcon(kind: 'sprout' | 'moth'): string {
  if (kind === 'sprout') {
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><path class="ss-reveal-icon__stem" d="M32 51c1-14 0-23-1-31"/><path class="ss-reveal-icon__leaf" d="M31 28C20 28 14 22 14 13c10-1 17 3 19 12M32 35c10 0 18-5 19-15-10-2-18 2-20 11"/><path class="ss-reveal-icon__ground" d="M20 52c8-4 16-4 24 0"/></svg>'
  }
  return '<svg viewBox="0 0 64 64" aria-hidden="true"><path class="ss-reveal-icon__wing" d="M31 31C20 12 8 15 10 29c1 9 9 12 20 7M33 31c11-19 23-16 21-2-1 9-9 12-20 7"/><path class="ss-reveal-icon__body" d="M32 23v26m-5-30c-4-6-8-6-11-3m21 3c4-6 8-6 11-3"/><circle cx="32" cy="25" r="3"/></svg>'
}
