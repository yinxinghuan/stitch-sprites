import type { GameEngine } from './game/engine'
import type { PowerId } from './economy'
import { completeLines, failLines } from './goals'
import type { AudioPrefs } from './prefs'
import { t } from './i18n'
import { LEVELS } from './game/levels'
import type { GameSnapshot, ThreadColor } from './game/types'

const mouseIcon = '<svg class="cg-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="5"/><path d="M12 3v7"/></svg>'

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character)
}

function keycaps(keys: string[]): string {
  return keys.map((key) => `<kbd class="cg-kbd">${escapeHtml(key)}</kbd>`).join('')
}

export function tutorialMarkup(step: number): string {
  const pages = [
    {
      title: 'Start with the red reel',
      body: 'Only the red stack can reach the Crimson Kite. Click it, or press 1.',
      keys: `${mouseIcon}${keycaps(['1'])}`,
      next: false,
    },
    {
      title: 'Watch the path open',
      body: 'Sprites walk out and pull real stitches. The cloth they clear becomes a path.',
      keys: mouseIcon,
      next: true,
    },
    {
      title: 'Match the outside color',
      body: 'Read the stitches on the rim, then pick that reel. The mouse and the number keys do the same thing.',
      keys: `${mouseIcon}${keycaps(['1', '2', '3', '4'])}`,
      next: true,
    },
    {
      title: 'The rack can fill up',
      body: 'A reel that cannot reach yet waits in a slot. Five waiting reels ends a real pattern. This first one puts the last reel back once.',
      keys: keycaps(['1', '2', '3', '4']),
      next: true,
    },
    {
      title: 'Clear the hoop',
      body: 'Empty every stitch to file the Crimson Kite in the album. The result screen always names the next pattern and the next unlock.',
      keys: `${keycaps(['P'])}<span>pause</span>${keycaps(['M'])}<span>mute</span>`,
      next: true,
    },
  ]
  const page = pages[step] ?? pages[0]
  return `
    <div class="cg-coach__card">
      <p class="cg-kicker">Lesson ${step + 1} of 5</p>
      <h2>${page.title}</h2>
      <p>${page.body}</p>
      <div class="cg-coach__keys">${page.keys}</div>
      <div class="cg-coach__actions">
        ${page.next ? '<button class="cg-btn cg-btn--gold" type="button" data-cg="tutor-next">Next</button>' : ''}
        <button class="cg-btn" type="button" data-cg="tutor-skip">Skip lesson</button>
      </div>
    </div>
  `
}

export function railMarkup(engine: GameEngine, snapshot: GameSnapshot): string {
  const guest = engine.guest
  if (!guest) return ''
  const name = t(snapshot.level.titleKey)
  const armed = guest.armed
  const prompt = armed === 'recall'
    ? 'Click a waiting reel that has not started.'
    : armed === 'shuffle'
      ? 'Click a stack, or press 1–4. The top card stays.'
      : armed === 'extra'
        ? 'Add a sixth slot for this pattern?'
        : armed === 'vacuum'
          ? 'Peel one exposed color.'
          : ''
  const vacuumColors = armed === 'vacuum'
    ? engine.currentNeededColors().map((color) => `<button class="cg-btn" type="button" data-cg="vacuum" data-color="${color}">${escapeHtml(t(`color.${color}`))}</button>`).join('')
    : ''
  const rule = snapshot.level.guestRule === 'combined'
    ? '<strong>Tight + Alternating</strong><span>4 rack slots. Switch stacks after every pick.</span>'
    : snapshot.level.guestRule === 'alternate'
      ? '<strong>Alternating Loom</strong><span>Switch stacks after every pick.</span>'
      : snapshot.level.guestRule === 'tight-rack'
        ? '<strong>Tight Rack</strong><span>Only 4 waiting slots. Extra slot restores one.</span>'
        : '<strong>Classic Loom</strong><span>5 waiting slots. Work from the rim inward.</span>'
  const visibleSpeeds = guest.speeds.filter((card, index) => card.state !== 'locked'
    || guest.speeds.slice(0, index).every((earlier) => earlier.state !== 'locked'))
  const visiblePowers = guest.powers.filter((card, index) => card.state !== 'locked'
    || guest.powers.slice(0, index).every((earlier) => earlier.state !== 'locked'))
  return `
    <p class="cg-kicker">Pattern ${snapshot.level.id} of ${LEVELS.length}</p>
    <h2 class="cg-rail__title">${escapeHtml(name)}</h2>
    <p class="cg-rail__goal">${escapeHtml(guest.goal)}</p>
    <p class="cg-rule">${rule}</p>
    <p class="cg-purse">${guest.showCoins ? `<span>Coins</span><strong>${guest.coins.toLocaleString()}</strong>` : 'Coin purse locked'}</p>
    <section>
      <h3>Pace</h3>
      ${visibleSpeeds.map((card) => `
        <button class="cg-card cg-card--${card.state}" type="button" data-cg="speed" data-tier="${card.id.slice(6)}" ${card.state === 'locked' ? 'disabled' : ''}>
          <span>${escapeHtml(card.name)}</span>
          <small>${card.state === 'buy' ? `${card.price}` : card.state === 'locked' ? escapeHtml(card.lock.replace('After pattern ', 'After ')) : card.state === 'selected' ? 'On' : 'Switch'}</small>
        </button>
      `).join('')}
    </section>
    <section>
      <h3>Tools</h3>
      ${visiblePowers.map((card) => `
        <button class="cg-card cg-card--${card.state}" type="button" data-cg="power" data-power="${card.id}" ${card.state === 'locked' || card.state === 'spent' ? 'disabled' : ''}>
          <span>${card.key ? `<kbd class="cg-kbd">${card.key}</kbd>` : ''}${escapeHtml(card.name)}</span>
          <small>${card.state === 'locked' ? escapeHtml(card.lock.replace('After pattern ', 'After ')) : card.state === 'spent' ? 'Used' : card.state === 'armed' ? 'Choosing…' : `${card.price}`}</small>
        </button>
      `).join('')}
      ${prompt ? `<p class="cg-prompt">${escapeHtml(prompt)}</p>` : ''}
      <div class="cg-prompt__actions">
        ${vacuumColors}
        ${armed === 'extra' ? '<button class="cg-btn cg-btn--gold" type="button" data-cg="extra-yes">Spend 180</button>' : ''}
        ${armed ? '<button class="cg-btn" type="button" data-cg="arm-cancel">Cancel</button>' : ''}
      </div>
    </section>
    <button class="cg-btn" type="button" data-cg="settings">Settings</button>
  `
}

export function titleMarkup(continuing: boolean): string {
  return `
    <div class="cg-modal cg-title" role="dialog" aria-modal="true" aria-label="Unstitch Sprites">
      <p class="cg-kicker">Thread puzzle</p>
      <h1>Unstitch Sprites</h1>
      <p>Unpick the hoop from the outside in. A reel that cannot reach yet takes a waiting slot. Fill every slot with waiting reels and the pattern fails.</p>
      <button class="cg-btn cg-btn--gold cg-btn--large" type="button" data-cg="play">${continuing ? 'Continue' : 'Play'}</button>
      <p class="cg-quiet">${LEVELS.length} patterns. Coins, pace, and tools stay on this device.</p>
      <div class="cg-title__keys">
        ${mouseIcon}
        ${keycaps(['1', '2', '3', '4'])}<span>stacks</span>
        ${keycaps(['P'])}<span>pause</span>
        ${keycaps(['M'])}<span>mute</span>
      </div>
      <div class="cg-title__links">
        <button class="cg-btn" type="button" data-cg="settings">Settings</button>
        <button class="cg-btn" type="button" data-cg="album">Album</button>
      </div>
    </div>
  `
}

export function settingsMarkup(prefs: AudioPrefs, muted: boolean): string {
  const volume = Math.round(prefs.volume * 100)
  return `
    <div class="cg-modal" role="dialog" aria-modal="true" aria-label="Settings">
      <p class="cg-kicker">Settings</p>
      <h2>Sound and lesson</h2>
      <label class="cg-volume-label">Volume <strong class="cg-volume-readout">${volume}</strong>
        <input class="cg-volume" type="range" min="0" max="100" value="${volume}" />
      </label>
      <button class="cg-btn" type="button" data-cg="mute">${muted ? 'Unmute' : 'Mute'} <kbd class="cg-kbd">M</kbd></button>
      <button class="cg-btn" type="button" data-cg="replay">Replay tutorial</button>
      <p class="cg-quiet">1–4 pick stacks. P pauses. Q W E V are Recall, Shuffle, Extra slot, and Peel once those tools are unlocked.</p>
      <p class="cg-credit">Music: <a href="https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400037" target="_blank" rel="noopener">Carefree</a> by Kevin MacLeod, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>. Loop points: 0.03–204.43s. Interface sounds: Kenney, CC0.</p>
      <button class="cg-btn cg-btn--gold" type="button" data-cg="settings-close">Back</button>
    </div>
  `
}

export function pauseMarkup(): string {
  return `
    <div class="cg-modal" role="dialog" aria-modal="true" aria-label="Paused">
      <p class="cg-kicker">Paused</p>
      <h2>The sprites are holding still.</h2>
      <button class="cg-btn cg-btn--gold" type="button" data-cg="resume">Resume <kbd class="cg-kbd">P</kbd></button>
      <button class="cg-btn" type="button" data-cg="settings">Settings</button>
    </div>
  `
}

export function resultMarkup(snapshot: GameSnapshot, engine: GameEngine): string {
  const guest = engine.guest
  const next = LEVELS[snapshot.level.id] ?? null
  const nextUnlock = [...(guest?.powers ?? []), ...(guest?.speeds ?? [])]
    .filter((card) => card.state === 'locked')
    .sort((left, right) => Number(left.lock.match(/\d+/)?.[0] ?? 999) - Number(right.lock.match(/\d+/)?.[0] ?? 999))[0]
  const unlockLine = nextUnlock?.lock
    ? `Next unlock: ${nextUnlock.name}, ${nextUnlock.lock.toLowerCase()} (${nextUnlock.price ? `${nextUnlock.price} coins` : 'free'}).`
    : null
  if (snapshot.phase === 'complete') {
    const lines = completeLines({
      reward: guest?.reward ?? 0,
      coins: guest?.coins ?? 0,
      showCoins: guest?.showCoins ?? false,
      levelId: snapshot.level.id,
      nextName: next ? t(next.titleKey) : null,
      nextUnlock: unlockLine,
      score: snapshot.levelScore,
      total: snapshot.totalMastery,
      usedHelp: snapshot.usedHelp,
    })
    return `
      <div class="cg-modal cg-result" role="dialog" aria-modal="true">
        <p class="cg-kicker">Pattern ${snapshot.level.id} clear</p>
        <h2>${escapeHtml(t(snapshot.level.completeKey))}</h2>
        <canvas class="ss-pattern-thumb ss-pattern-thumb--result" data-pattern-level="${snapshot.level.id}"></canvas>
        ${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
        <button class="cg-btn cg-btn--gold" type="button" data-cg="result-next">${next ? 'Next pattern' : 'Open album'} <kbd class="cg-kbd">${next ? 'N' : 'G'}</kbd></button>
        <button class="cg-btn" type="button" data-cg="album">Album</button>
      </div>
    `
  }
  const colors = engine.currentNeededColors().map((color: ThreadColor) => t(`color.${color}`)).join(', ')
  const recallReady = Boolean(guest?.powers.some((card) => card.id === 'recall' && card.state !== 'locked' && (guest?.coins ?? 0) >= 80))
  const lines = failLines({ colors: colors || 'a color you can reach', name: t(snapshot.level.titleKey), recallReady, rackLimit: engine.slotLimit })
  return `
    <div class="cg-modal cg-result" role="dialog" aria-modal="true">
      <p class="cg-kicker">Tangled</p>
      <h2>${escapeHtml(t('fail.title'))}</h2>
      ${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
      <button class="cg-btn cg-btn--gold" type="button" data-cg="restart">Replay pattern <kbd class="cg-kbd">R</kbd></button>
    </div>
  `
}

export function bindGuestActions(
  root: ParentNode,
  engine: GameEngine,
  handlers: {
    play: () => void
    settings: () => void
    closeSettings: () => void
    album: () => void
    resume: () => void
    restart: () => void
    next: () => void
    mute: () => void
    volume: (value: number) => void
    replay: () => void
    tutorNext: () => void
    tutorSkip: () => void
  },
): void {
  root.querySelectorAll<HTMLButtonElement>('[data-cg]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.cg
      if (action === 'play') handlers.play()
      if (action === 'settings') handlers.settings()
      if (action === 'settings-close') handlers.closeSettings()
      if (action === 'album') handlers.album()
      if (action === 'resume') handlers.resume()
      if (action === 'restart') handlers.restart()
      if (action === 'result-next') handlers.next()
      if (action === 'mute') handlers.mute()
      if (action === 'replay') handlers.replay()
      if (action === 'tutor-next') handlers.tutorNext()
      if (action === 'tutor-skip') handlers.tutorSkip()
      if (action === 'arm-cancel') engine.armPower(null)
      if (action === 'extra-yes') engine.confirmExtra()
      if (action === 'speed') engine.setSpeed(Number(button.dataset.tier))
      if (action === 'power') engine.armPower((button.dataset.power ?? null) as PowerId | null)
      if (action === 'vacuum') engine.confirmVacuum((button.dataset.color ?? '') as ThreadColor)
    })
  })
  root.querySelector<HTMLInputElement>('.cg-volume')?.addEventListener('input', (event) => {
    const value = Number((event.target as HTMLInputElement).value) / 100
    handlers.volume(value)
    const readout = root.querySelector('.cg-volume-readout')
    if (readout) readout.textContent = String(Math.round(value * 100))
  })
}
