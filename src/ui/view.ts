import { THREAD_COLORS } from '../game/palette'
import type { GameEngine } from '../game/engine'
import type { GameSnapshot, SpoolState, ThreadColor } from '../game/types'
import { t } from '../i18n'
import { arrowIcon, restartIcon, soundIcon } from './icons'

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
  constructor(root: HTMLElement) {
    root.innerHTML = `
      <div class="ss-app">
        <header class="ss-header">
          <div class="ss-heading">
            <span class="ss-kicker">${t('game.title')}</span>
            <h1 class="ss-level"></h1>
          </div>
          <div class="ss-header__actions">
            <span class="ss-remaining"></span>
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
  }

  bind(engine: GameEngine): void {
    this.soundButton.addEventListener('click', async () => {
      await engine.audio.unlock()
      engine.audio.toggle()
      this.renderSound(engine)
    })
    this.restartButton.addEventListener('click', () => engine.restart())
    window.addEventListener('keydown', (event) => {
      if (event.key.toLowerCase() === 'r') engine.restart()
      const index = Number(event.key) - 1
      if (index >= 0 && index < 4) void engine.selectColumn(index)
    })
    this.renderSound(engine)
  }

  update(snapshot: GameSnapshot, engine: GameEngine): void {
    this.levelLabel.textContent = `${snapshot.level.id} · ${t(snapshot.level.titleKey)}`
    this.remainingLabel.textContent = t('hud.remaining', { n: snapshot.remaining })
    this.message.textContent = t(snapshot.messageKey)
    this.canvas.setAttribute('aria-label', `${t(snapshot.level.titleKey)}，${t('hud.remaining', { n: snapshot.remaining })}`)
    this.renderSlots(snapshot)
    this.renderTray(snapshot, engine)
    this.renderOverlay(snapshot, engine)
    this.restartButton.setAttribute('aria-label', t('action.restart'))
    this.renderSound(engine)
  }

  private renderSound(engine: GameEngine): void {
    this.soundButton.innerHTML = soundIcon(engine.audio.isMuted)
    this.soundButton.setAttribute('aria-label', t(engine.audio.isMuted ? 'action.soundOn' : 'action.soundOff'))
  }

  private renderSlots(snapshot: GameSnapshot): void {
    const items = Array.from({ length: 5 }, (_, index) => {
      const slot = snapshot.slots[index]
      if (!slot) return `<div class="ss-slot ss-slot--empty" aria-label="${t('slot.empty')}"><span></span></div>`
      const thread = THREAD_COLORS[slot.spool.color]
      const stateText = t(slot.state === 'working' ? 'status.working' : 'status.waiting')
      return `
        <div class="ss-slot ss-slot--${slot.state}" style="--thread:${thread.hex};--thread-dark:${thread.dark}" aria-label="${stateText} ${slot.spool.remaining}">
          <span class="ss-slot__sprite"><i></i><b></b></span>
          <strong>${slot.spool.remaining}</strong>
          <small>${stateText}</small>
        </div>
      `
    })
    this.slots.innerHTML = items.join('')
  }

  private spoolMarkup(spool: SpoolState, columnIndex: number, enabled: boolean): string {
    const thread = THREAD_COLORS[spool.color]
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
      const backLayers = column.slice(1, 3).map((spool, depth) => {
        const thread = THREAD_COLORS[spool.color]
        return `<span class="ss-spool-back" style="--depth:${depth + 1};--thread:${thread.hex}"></span>`
      }).reverse().join('')
      return `
        <div class="ss-column" aria-label="${t('tray.column', { n: index + 1 })}">
          ${backLayers}
          ${top ? this.spoolMarkup(top, index, enabled) : '<span class="ss-column__empty"></span>'}
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
    if (snapshot.phase === 'playing') {
      this.overlay.hidden = true
      this.overlay.innerHTML = ''
      return
    }
    this.overlay.hidden = false
    if (snapshot.phase === 'complete') {
      const revealKey = snapshot.level.reveal === 'sprout' ? 'complete.flower' : 'complete.moth'
      this.overlay.innerHTML = `
        <div class="ss-result ss-result--complete" role="dialog" aria-modal="true">
          <span class="ss-result__sprite" aria-hidden="true"><i></i><b></b></span>
          <p>${t('complete.title')}</p>
          <h2>${t(revealKey)}</h2>
          <button class="ss-primary" type="button">${snapshot.level.id < 2 ? t('action.next') : t('action.again')} ${arrowIcon}</button>
        </div>
      `
      this.overlay.querySelector('button')?.addEventListener('click', () => snapshot.level.id < 2 ? engine.next() : engine.restart(), { once: true })
    } else {
      const colors = engine.currentNeededColors().map((color: ThreadColor) => t(`color.${color}`)).join('、')
      this.overlay.innerHTML = `
        <div class="ss-result ss-result--failed" role="dialog" aria-modal="true">
          <span class="ss-knot" aria-hidden="true"></span>
          <h2>${t('fail.title')}</h2>
          <p>${t('fail.body')}</p>
          <small>${t('fail.need', { colors })}</small>
          <button class="ss-primary" type="button">${restartIcon} ${t('action.restart')}</button>
        </div>
      `
      this.overlay.querySelector('button')?.addEventListener('click', () => engine.restart(), { once: true })
    }
  }
}
