export function soundIcon(muted: boolean): string {
  return muted
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="m17 9 4 6m0-6-4 6"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12"/></svg>'
}

export const restartIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>'

export const arrowIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>'

export const galleryIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>'

export const closeIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>'

export const rankIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M9 18h6M12 13v5M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"/></svg>'

export const lockIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="10" width="12" height="10" rx="2"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10M12 14v2"/></svg>'

export function revealIcon(kind: string): string {
  const paths: Record<string, string> = {
    ladybug: '<path d="M19 28c0-10 6-17 13-17s13 7 13 17v13c0 8-6 13-13 13s-13-5-13-13V28Z"/><path d="M32 23v31M22 17l5 6m15-6-5 6"/><circle cx="25" cy="32" r="2"/><circle cx="39" cy="32" r="2"/><circle cx="25" cy="43" r="2"/><circle cx="39" cy="43" r="2"/>',
    turtle: '<path d="M18 26c4-9 24-9 28 0 4 10 0 23-14 23S14 36 18 26Z"/><path d="M28 18c0-7 8-9 12-4 2 3 1 7-2 10M17 30l-7-4m7 14-7 5m37-15 7-4m-7 14 7 5"/><path d="m25 30 7-5 7 5-2 10H27l-2-10Z"/>',
    whale: '<path d="M11 35c6-14 17-19 31-11 6 4 6 11 12 11l-3-8 8 4-3 8c-11 12-36 12-45-4Z"/><path d="M23 42c3 8 10 9 15 1M20 28h1"/><path d="M32 18c0-6 3-9 7-11m-7 11c-3-6-6-8-10-8"/>',
    butterfly: '<path class="ss-reveal-icon__wing" d="M31 31C20 12 8 15 10 29c1 9 9 12 20 7M33 31c11-19 23-16 21-2-1 9-9 12-20 7"/><path d="M32 23v26m-5-30c-4-6-8-6-11-3m21 3c4-6 8-6 11-3"/>',
    teapot: '<path d="M18 28h29v20c-7 7-22 7-29 0V28Z"/><path d="M23 22h19m-14-6h9m10 17c11-5 12 9 2 12m-31-9c-13-6-13 12-1 11"/>',
    moonCat: '<path d="M34 10c-16 5-20 26-7 36 7 6 16 5 22-1-14 1-21-18-15-35Z"/><path d="M36 48c2-10 12-13 17-5v11H35m4-12-1-7 6 5m7 0 6-5-1 10"/>',
    fox: '<path d="m13 18 13 6 6-10 6 10 13-6-4 28-15 10-15-10-4-28Z"/><path d="m22 35 6 3m14-3-6 3m-4 3v6m-5 0 5 3 5-3"/>',
    cottage: '<path d="m10 32 22-20 22 20M16 29v25h32V29"/><path d="M28 54V39h9v15m-15-17h6m11 0h5M42 17v-7h7v13"/>',
  }
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${paths[kind] ?? paths.cottage}</svg>`
}
