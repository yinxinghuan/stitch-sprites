import { CODE_TO_COLOR, resolveThreadStyle } from '../game/palette'
import { LEVELS } from '../game/levels'
import type { GameEngine } from '../game/engine'
import type { GameSnapshot, LevelDefinition, SpoolState, ThreadColor } from '../game/types'
import { t } from '../i18n'
import type { LeaderboardEntry, LeaderboardService } from '../platform/contracts'
import { arrowIcon, closeIcon, galleryIcon, lockIcon, rankIcon, restartIcon, soundIcon } from './icons'

const VISIBLE_BACK_CARD_COUNT = 6

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character)
}

function safeAvatar(value: string): string {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? escapeHtml(url.href) : ''
  } catch {
    return ''
  }
}

export class GameView {
  readonly canvas: HTMLCanvasElement
  private readonly levelLabel: HTMLElement
  private readonly remainingLabel: HTMLElement
  private readonly message: HTMLElement
  private readonly slots: HTMLElement
  private readonly tray: HTMLElement
  private readonly overlay: HTMLElement
  private readonly soundButton: HTMLButtonElement
  private readonly restartButton: HTMLButtonElement
  private readonly headingButton: HTMLButtonElement
  private readonly championButton: HTMLButtonElement | null
  private galleryOpen = false
  private galleryRenderedUnlocked = -1
  private leaderboardOpen = false
  private leaderboardRows: LeaderboardEntry[] = []
  constructor(
    root: HTMLElement,
    private readonly leaderboard: LeaderboardService | null,
    private readonly labMode = false,
  ) {
    root.innerHTML = `
      <div class="ss-app">
        <header class="ss-header">
          <button class="ss-heading" type="button">
            <span class="ss-level"></span>${galleryIcon}
          </button>
          <div class="ss-header__actions">
            <span class="ss-remaining"></span>
            ${leaderboard ? `<button class="ss-champion ss-icon-button" type="button" aria-label="${t('action.rank')}">${rankIcon}</button>` : ''}
            <button class="ss-restart ss-icon-button" type="button">${restartIcon}</button>
            <button class="ss-icon-button ss-sound" type="button"></button>
          </div>
        </header>
        <p class="ss-message" aria-live="polite"></p>
        <section class="ss-board" aria-label="${t('game.title')}">
          <canvas class="ss-board__canvas" role="img"></canvas>
          <div class="ss-board__portal" aria-hidden="true"><span></span><span></span></div>
        </section>
        <section class="ss-rack" aria-label="reel rack"><div class="ss-slots"></div></section>
        <section class="ss-tray" aria-label="thread reels"></section>
        <img class="ss-watermark" src="./alteru.svg" alt="" aria-hidden="true" draggable="false" />
        <div class="ss-overlay" hidden></div>
      </div>
    `
    this.canvas = root.querySelector('.ss-board__canvas')!
    this.levelLabel = root.querySelector('.ss-level')!
    this.remainingLabel = root.querySelector('.ss-remaining')!
    this.message = root.querySelector('.ss-message')!
    this.slots = root.querySelector('.ss-slots')!
    this.tray = root.querySelector('.ss-tray')!
    this.overlay = root.querySelector('.ss-overlay')!
    this.soundButton = root.querySelector('.ss-sound')!
    this.restartButton = root.querySelector('.ss-restart')!
    this.headingButton = root.querySelector('.ss-heading')!
    this.championButton = root.querySelector('.ss-champion')
    root.addEventListener('dblclick', (event) => event.preventDefault(), { passive: false })
  }

  bind(engine: GameEngine): void {
    window.addEventListener('pointerup', () => {
      void engine.audio.unlock().then(() => {
        if (engine.snapshot.slots.length) engine.audio.spool()
      })
    }, { once: true, capture: true })
    this.soundButton.addEventListener('click', async () => {
      await engine.audio.unlock()
      engine.audio.toggle()
      this.renderSound(engine)
    })
    this.restartButton.addEventListener('click', () => engine.restart())
    this.headingButton.addEventListener('click', () => {
      this.galleryOpen = true
      this.leaderboardOpen = false
      this.renderOverlay(engine.snapshot, engine)
    })
    this.championButton?.addEventListener('click', () => {
      this.leaderboardOpen = true
      this.galleryOpen = false
      this.renderOverlay(engine.snapshot, engine)
      void this.refreshLeaderboard(engine)
    })
    window.addEventListener('keydown', (event) => {
      if (event.key.toLowerCase() === 'r') engine.restart()
      const index = Number(event.key) - 1
      if (index >= 0 && index < 4) void engine.selectColumn(index)
    })
    this.renderSound(engine)
    void this.refreshLeaderboard(engine)
  }

  async refreshLeaderboard(engine: GameEngine): Promise<void> {
    if (!this.leaderboard) return
    this.leaderboardRows = await this.leaderboard.fetch()
    this.renderChampion()
    if (this.leaderboardOpen) this.renderOverlay(engine.snapshot, engine)
  }

  update(snapshot: GameSnapshot, engine: GameEngine): void {
    this.levelLabel.textContent = String(snapshot.level.id).padStart(2, '0')
    this.remainingLabel.textContent = t('hud.remaining', { n: snapshot.remaining })
    this.message.textContent = t(snapshot.messageKey)
    this.canvas.setAttribute('aria-label', `${t(snapshot.level.titleKey)}，${t('hud.remaining', { n: snapshot.remaining })}`)
    this.renderSlots(snapshot)
    this.renderTray(snapshot, engine)
    this.renderOverlay(snapshot, engine)
    this.restartButton.setAttribute('aria-label', t('action.restart'))
    this.headingButton.setAttribute('aria-label', t('action.gallery'))
    this.renderSound(engine)
  }

  private renderSound(engine: GameEngine): void {
    this.soundButton.innerHTML = soundIcon(engine.audio.isMuted)
    this.soundButton.setAttribute('aria-label', t(engine.audio.isMuted ? 'action.soundOn' : 'action.soundOff'))
  }

  private renderChampion(): void {
    if (!this.championButton) return
    const champion = this.leaderboardRows[0]
    if (!champion) {
      this.championButton.innerHTML = rankIcon
      this.championButton.setAttribute('aria-label', t('action.rank'))
      return
    }
    const characters = Array.from(champion.name.trim())
    const limit = /\p{Script=Han}/u.test(champion.name) ? 2 : 3
    const initials = characters.slice(0, limit).join('').toUpperCase() || '?'
    const avatar = safeAvatar(champion.avatarUrl)
    const identity = avatar
      ? `<img src="${avatar}" alt="" draggable="false" />`
      : `<span class="ss-champion__initial">${escapeHtml(initials)}</span>`
    const compactScore = new Intl.NumberFormat(undefined, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(champion.score)
    this.championButton.innerHTML = `${rankIcon}${identity}<strong>${escapeHtml(compactScore)}</strong>`
    this.championButton.setAttribute('aria-label', `${t('action.rank')} · ${champion.name} · ${champion.score.toLocaleString()}`)
  }

  private renderSlots(snapshot: GameSnapshot): void {
    const items = Array.from({ length: 5 }, (_, index) => {
      const slot = snapshot.slots[index]
      if (!slot) return `
        <div class="ss-slot ss-slot--empty" aria-label="${t('slot.empty')}">
          <span class="ss-slot__notch ss-slot__notch--top"></span>
          <span class="ss-slot__empty-mark"></span>
          <span class="ss-slot__notch ss-slot__notch--bottom"></span>
        </div>
      `
      const thread = resolveThreadStyle(slot.spool.color, snapshot.level.displayPalette)
      const stateText = t(slot.state === 'working' ? 'status.working' : 'status.waiting')
      return `
        <div class="ss-slot ss-slot--${slot.state}" style="--thread:${thread.hex};--thread-dark:${thread.dark};--thread-light:${thread.light}" aria-label="${stateText} ${slot.spool.remaining}">
          <span class="ss-slot__notch ss-slot__notch--top"></span>
          <span class="ss-slot__thread"></span>
          <span class="ss-color-symbol ss-color-symbol--${thread.symbol}" aria-hidden="true"></span>
          <strong>${slot.spool.remaining}</strong>
          <small>${stateText}</small>
          <span class="ss-slot__notch ss-slot__notch--bottom"></span>
        </div>
      `
    })
    this.slots.innerHTML = items.join('')
  }

  private spoolMarkup(spool: SpoolState, columnIndex: number, enabled: boolean, level: LevelDefinition): string {
    const thread = resolveThreadStyle(spool.color, level.displayPalette)
    const colorName = t(`color.${spool.color}`)
    const label = t('tray.spool', { color: colorName, n: spool.remaining })
    return `
      <button class="ss-spool ${enabled ? '' : 'ss-spool--disabled'}" type="button" data-column="${columnIndex}" ${enabled ? '' : 'disabled'} style="--thread:${thread.hex};--thread-dark:${thread.dark};--thread-light:${thread.light}" aria-label="${label}">
        <span class="ss-spool__card">
          <span class="ss-spool__notch ss-spool__notch--top"></span>
          <span class="ss-spool__thread"></span>
          <span class="ss-color-symbol ss-color-symbol--${thread.symbol}" aria-hidden="true"></span>
          <strong>${spool.remaining}</strong>
          <span class="ss-spool__notch ss-spool__notch--bottom"></span>
        </span>
      </button>
    `
  }

  private renderTray(snapshot: GameSnapshot, engine: GameEngine): void {
    this.tray.innerHTML = snapshot.columns.map((column, index) => {
      const top = column[0]
      const enabled = engine.canSelectColumn(index)
      const backLayers = column.slice(1, VISIBLE_BACK_CARD_COUNT + 1).map((spool, depth) => {
        const thread = resolveThreadStyle(spool.color, snapshot.level.displayPalette)
        return `<span class="ss-spool-back" aria-hidden="true" style="--depth:${depth + 1};--thread:${thread.hex};--thread-dark:${thread.dark};--thread-light:${thread.light}"></span>`
      }).reverse().join('')
      return `
        <div class="ss-column" aria-label="${t('tray.column', { n: index + 1 })}">
          ${backLayers}
          ${top ? this.spoolMarkup(top, index, enabled, snapshot.level) : '<span class="ss-column__empty"></span>'}
        </div>
      `
    }).join('')
    this.tray.querySelectorAll<HTMLButtonElement>('.ss-spool').forEach((button) => {
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault()
        const index = Number(button.dataset.column)
        void engine.selectColumn(index)
      }, { once: true })
    })
  }

  private renderOverlay(snapshot: GameSnapshot, engine: GameEngine): void {
    if (this.leaderboardOpen) {
      this.renderLeaderboard(snapshot, engine)
      return
    }
    if (this.galleryOpen) {
      this.renderGallery(engine)
      return
    }
    if (snapshot.phase === 'playing') {
      this.overlay.hidden = true
      this.overlay.innerHTML = ''
      this.galleryRenderedUnlocked = -1
      return
    }
    this.overlay.hidden = false
    if (snapshot.phase === 'complete') {
      this.overlay.innerHTML = `
        <div class="ss-result ss-result--complete" role="dialog" aria-modal="true">
          <span class="ss-result__badge ss-result__badge--complete" aria-hidden="true"><canvas class="ss-pattern-thumb ss-pattern-thumb--result" data-pattern-level="${snapshot.level.id}"></canvas></span>
          <div class="ss-result__copy">
            <span class="ss-result__eyebrow">${t('complete.title')}</span>
            <p>${t('complete.reveal')}</p>
            <h2>${t(snapshot.level.completeKey)}</h2>
            ${this.labMode ? '' : `<small class="ss-result__mastery">${t('complete.score', { n: snapshot.levelScore })} · ${t('complete.totalScore', { n: snapshot.totalMastery })}</small>`}
          </div>
          <button class="ss-primary" type="button">${this.labMode ? t('action.again') : (snapshot.level.id < LEVELS.length ? t('action.next') : t('action.gallery'))} ${this.labMode ? restartIcon : (snapshot.level.id < LEVELS.length ? arrowIcon : galleryIcon)}</button>
        </div>
      `
      this.paintPatternCanvases()
      this.overlay.querySelector('button')?.addEventListener('click', () => {
        if (this.labMode) engine.restart()
        else if (snapshot.level.id < LEVELS.length) engine.next()
        else {
          this.galleryOpen = true
          this.renderGallery(engine)
        }
      }, { once: true })
    } else {
      const colors = engine.currentNeededColors().map((color: ThreadColor) => t(`color.${color}`)).join('、')
      this.overlay.innerHTML = `
        <div class="ss-result ss-result--failed" role="dialog" aria-modal="true">
          <span class="ss-result__badge ss-result__badge--failed" aria-hidden="true"><span class="ss-knot"></span></span>
          <div class="ss-result__copy">
            <span class="ss-result__eyebrow">${t('fail.title')}</span>
            <p>${t('fail.body')}</p>
            <small>${t('fail.need', { colors })}</small>
          </div>
          <button class="ss-primary" type="button">${restartIcon} ${t('action.restart')}</button>
        </div>
      `
      this.overlay.querySelector('button')?.addEventListener('click', () => engine.restart(), { once: true })
    }
  }

  private renderLeaderboard(snapshot: GameSnapshot, engine: GameEngine): void {
    const rows = this.leaderboardRows
    this.overlay.hidden = false
    this.overlay.innerHTML = `
      <div class="ss-leaderboard" role="dialog" aria-modal="true" aria-label="${t('rank.title')}">
        <header class="ss-leaderboard__header">
          <div><span>${t('rank.kicker')}</span><h2>${t('rank.title')}</h2></div>
          <button class="ss-leaderboard__close ss-icon-button" type="button" aria-label="${t('action.close')}">${closeIcon}</button>
        </header>
        <div class="ss-leaderboard__list">
          ${rows.length ? rows.map((row) => {
            const avatar = safeAvatar(row.avatarUrl)
            const avatarMarkup = avatar
              ? `<img src="${avatar}" alt="" draggable="false" />`
              : `<span class="ss-rank-row__initial" aria-hidden="true">${escapeHtml(row.name.slice(0, 1).toUpperCase() || '?')}</span>`
            return `<button class="ss-rank-row ${row.isMe ? 'ss-rank-row--me' : ''}" type="button" data-user-id="${escapeHtml(row.userId)}" ${row.isMe ? 'disabled' : ''}>
              <span class="ss-rank-row__rank">${row.rank || '—'}</span>${avatarMarkup}
              <span class="ss-rank-row__name">${escapeHtml(row.name)}${row.isMe ? ` <small>${t('rank.me')}</small>` : ''}</span>
              <strong>${t('rank.score', { n: row.score.toLocaleString() })}</strong>
            </button>`
          }).join('') : `<p class="ss-leaderboard__empty">${t('rank.empty')}</p>`}
        </div>
      </div>
    `
    this.overlay.querySelector('.ss-leaderboard__close')?.addEventListener('click', () => {
      this.leaderboardOpen = false
      this.renderOverlay(snapshot, engine)
    }, { once: true })
    this.overlay.querySelectorAll<HTMLButtonElement>('.ss-rank-row:not(:disabled)').forEach((button) => {
      button.addEventListener('click', () => {
        const userId = button.dataset.userId
        if (userId) this.leaderboard?.openProfile(userId)
      })
    })
  }

  private renderGallery(engine: GameEngine): void {
    if (this.galleryRenderedUnlocked === engine.unlockedLevel && this.overlay.querySelector('.ss-gallery')) {
      this.overlay.hidden = false
      return
    }
    const previousScroll = this.overlay.querySelector<HTMLElement>('.ss-gallery__scroll')?.scrollTop ?? 0
    const colorCount = (level: LevelDefinition): number => new Set(level.rows.join('').replaceAll('.', '')).size
    const chapters = [2, 3, 4, 5, 6, 7].map((count) => ({
      key: `chapter.colors${count}`,
      levels: LEVELS.filter((level) => colorCount(level) === count),
    })).filter((chapter) => chapter.levels.length)
    this.overlay.hidden = false
    this.overlay.innerHTML = `
      <div class="ss-gallery" role="dialog" aria-modal="true" aria-label="${t('gallery.title')}">
        <header class="ss-gallery__header">
          <div><span>${t('game.title')}</span><h2>${t('gallery.title')}</h2></div>
          <button class="ss-gallery__close ss-icon-button" type="button" aria-label="${t('action.close')}">${closeIcon}</button>
        </header>
        <div class="ss-gallery__scroll">
          ${chapters.map((chapter) => `
            <section class="ss-gallery__chapter">
              <h3>${t(chapter.key)}</h3>
              <div class="ss-gallery__grid">
                ${chapter.levels.map((level) => {
                  const unlocked = level.id <= engine.unlockedLevel
                  const colors = colorCount(level)
                  return `
                    <button class="ss-gallery-card ${unlocked ? '' : 'ss-gallery-card--locked'}" type="button" data-level="${level.id}" ${unlocked ? '' : 'disabled'}>
                      <span class="ss-gallery-card__icon" aria-hidden="true">${unlocked ? `<canvas class="ss-pattern-thumb" data-pattern-level="${level.id}"></canvas>` : lockIcon}</span>
                      <span class="ss-gallery-card__copy"><strong>${unlocked ? `${level.id} · ${t(level.titleKey)}` : String(level.id).padStart(2, '0')}</strong>${unlocked ? `<small>${t('gallery.colors', { n: colors })}</small>` : ''}</span>
                    </button>
                  `
                }).join('')}
              </div>
            </section>
          `).join('')}
        </div>
      </div>
    `
    this.galleryRenderedUnlocked = engine.unlockedLevel
    this.paintPatternCanvases()
    const scroll = this.overlay.querySelector<HTMLElement>('.ss-gallery__scroll')
    if (scroll) scroll.scrollTop = previousScroll
    this.overlay.querySelector('.ss-gallery__close')?.addEventListener('click', () => {
      this.galleryOpen = false
      this.renderOverlay(engine.snapshot, engine)
    }, { once: true })
    this.overlay.querySelectorAll<HTMLButtonElement>('.ss-gallery-card:not(:disabled)').forEach((button) => {
      button.addEventListener('click', () => {
        this.galleryOpen = false
        engine.openLevel(Number(button.dataset.level))
      }, { once: true })
    })
  }

  private paintPatternCanvases(): void {
    this.overlay.querySelectorAll<HTMLCanvasElement>('[data-pattern-level]').forEach((canvas) => {
      const level = LEVELS.find((candidate) => candidate.id === Number(canvas.dataset.patternLevel))
      if (level) this.paintPattern(canvas, level)
    })
  }

  private paintPattern(canvas: HTMLCanvasElement, level: LevelDefinition): void {
    const size = canvas.classList.contains('ss-pattern-thumb--result') ? 128 : 92
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, size, size)
    const occupied: Array<{ row: number; col: number }> = []
    level.rows.forEach((row, rowIndex) => [...row].forEach((code, colIndex) => {
      if (code !== '.') occupied.push({ row: rowIndex, col: colIndex })
    }))
    if (!occupied.length) return
    const minRow = Math.min(...occupied.map((cell) => cell.row))
    const maxRow = Math.max(...occupied.map((cell) => cell.row))
    const minCol = Math.min(...occupied.map((cell) => cell.col))
    const maxCol = Math.max(...occupied.map((cell) => cell.col))
    const patternRows = maxRow - minRow + 1
    const patternCols = maxCol - minCol + 1
    const padding = size * 0.08
    const cell = Math.min((size - padding * 2) / patternCols, (size - padding * 2) / patternRows)
    const left = (size - patternCols * cell) / 2
    const top = (size - patternRows * cell) / 2
    if (level.textureMode !== 'procedural') {
      const texture = new Image()
      texture.decoding = 'async'
      texture.onload = () => {
        ctx.clearRect(0, 0, size, size)
        ctx.fillStyle = '#fbf3e2'
        ctx.fillRect(0, 0, size, size)
        ctx.drawImage(texture, left, top, patternCols * cell, patternRows * cell)
      }
      texture.src = new URL(`./patterns/${level.reveal}.png`, document.baseURI).href
    }
    ctx.lineCap = 'round'
    level.rows.forEach((row, rowIndex) => [...row].forEach((code, colIndex) => {
      if (code === '.') return
      const color = CODE_TO_COLOR[code]
      if (!color) return
      const thread = resolveThreadStyle(color, level.displayPalette)
      const x = left + (colIndex - minCol) * cell
      const y = top + (rowIndex - minRow) * cell
      ctx.strokeStyle = thread.dark
      ctx.lineWidth = Math.max(1, cell * 0.42)
      ctx.beginPath()
      ctx.moveTo(x + cell * 0.18, y + cell * 0.18)
      ctx.lineTo(x + cell * 0.82, y + cell * 0.82)
      ctx.moveTo(x + cell * 0.82, y + cell * 0.18)
      ctx.lineTo(x + cell * 0.18, y + cell * 0.82)
      ctx.stroke()
      ctx.strokeStyle = thread.hex
      ctx.lineWidth = Math.max(0.8, cell * 0.25)
      ctx.beginPath()
      ctx.moveTo(x + cell * 0.18, y + cell * 0.18)
      ctx.lineTo(x + cell * 0.82, y + cell * 0.82)
      ctx.moveTo(x + cell * 0.82, y + cell * 0.18)
      ctx.lineTo(x + cell * 0.18, y + cell * 0.82)
      ctx.stroke()
    }))
  }
}
