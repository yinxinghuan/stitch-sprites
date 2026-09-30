type SampleName = 'spool' | 'depart' | 'unstitch' | 'wait' | 'danger' | 'complete' | 'fail' | 'purchase'

export class GameAudio {
  private context: AudioContext | null = null
  private muted = false
  private platformMuted = false
  private volume = 1
  private stitchStep = 0
  private gestureUnlocked = false
  private sampleMode = false
  private samples: Partial<Record<SampleName, string>> = {}
  private bgmUrl = ''
  private bgm: HTMLAudioElement | null = null
  private lastUnstitch = 0
  private persistPrefs: (() => void) | null = null

  get isMuted(): boolean {
    return this.muted || this.platformMuted
  }

  get volumeLevel(): number {
    return this.volume
  }

  get preferenceMuted(): boolean {
    return this.muted
  }

  useSamples(
    bgmUrl: string,
    samples: Partial<Record<SampleName, string>>,
    prefs: { muted: boolean; volume: number },
    persist: () => void,
  ): void {
    this.sampleMode = true
    this.bgmUrl = bgmUrl
    this.samples = samples
    this.muted = prefs.muted
    this.volume = prefs.volume
    this.persistPrefs = persist
  }

  async unlock(): Promise<void> {
    this.gestureUnlocked = true
    this.startBgm()
    try {
      this.context ??= new AudioContext()
      if (this.context.state === 'suspended') await this.context.resume()
    } catch {
      this.context = null
    }
  }

  toggle(): boolean {
    this.muted = !this.muted
    if (this.isMuted) this.bgm?.pause()
    else if (this.gestureUnlocked) this.startBgm()
    this.persistPrefs?.()
    return this.isMuted
  }

  setPlatformMuted(muted: boolean): void {
    this.platformMuted = muted
    if (this.isMuted) this.bgm?.pause()
    else if (this.gestureUnlocked) this.startBgm()
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume))
    if (this.bgm) this.bgm.volume = this.volume
    this.persistPrefs?.()
  }

  private startBgm(): void {
    if (!this.bgmUrl || this.isMuted || !this.gestureUnlocked) return
    if (!this.bgm) {
      this.bgm = new Audio(this.bgmUrl)
      this.bgm.preload = 'auto'
      // Carefree's encoded file includes a silent tail. These documented
      // points keep that tail out of the repeat without altering the track.
      const loopStart = 0.03
      const loopEnd = 204.43
      this.bgm.addEventListener('timeupdate', () => {
        if (this.bgm && this.bgm.currentTime >= loopEnd) this.bgm.currentTime = loopStart
      })
      this.bgm.addEventListener('ended', () => {
        if (!this.bgm) return
        this.bgm.currentTime = loopStart
        void this.bgm.play().catch(() => {})
      })
    }
    this.bgm.volume = this.volume
    if (!this.bgm.paused) return
    void this.bgm.play().catch(() => {})
  }

  private playSample(name: SampleName): boolean {
    if (!this.sampleMode) return false
    const url = this.samples[name]
    if (this.isMuted || !this.gestureUnlocked || !url) return true
    const node = new Audio(url)
    node.volume = this.volume
    void node.play().catch(() => {})
    return true
  }

  private tone(from: number, to: number, duration: number, volume: number, type: OscillatorType = 'sine', delay = 0): void {
    if (this.isMuted || !this.context) return
    const now = this.context.currentTime + delay
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(from, now)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, to), now + duration)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(volume * this.volume, now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    oscillator.connect(gain).connect(this.context.destination)
    oscillator.start(now)
    oscillator.stop(now + duration + 0.02)
  }

  spool(): void {
    if (this.playSample('spool')) return
    this.tone(300, 220, 0.055, 0.12, 'triangle')
  }

  depart(): void {
    if (this.playSample('depart')) return
    this.tone(520, 680, 0.07, 0.065, 'sine')
  }

  unstitch(): void {
    if (this.sampleMode) {
      const now = performance.now()
      if (now - this.lastUnstitch < 280) return
      this.lastUnstitch = now
    }
    if (this.playSample('unstitch')) return
    const notes = [784, 880, 988, 1047]
    const note = notes[this.stitchStep++ % notes.length]
    this.tone(note * 0.84, note, 0.055, 0.045, 'triangle')
  }

  wait(): void {
    if (this.playSample('wait')) return
    this.tone(205, 185, 0.09, 0.07, 'sine')
  }

  danger(): void {
    if (this.playSample('danger')) return
    this.tone(150, 135, 0.075, 0.085, 'triangle')
    this.tone(150, 128, 0.075, 0.085, 'triangle', 0.11)
  }

  complete(): void {
    if (this.playSample('complete')) return
    ;[523, 659, 784, 1047].forEach((note, index) => this.tone(note, note * 1.015, 0.19, 0.065, 'sine', index * 0.12))
  }

  fail(): void {
    if (this.playSample('fail')) return
    this.tone(240, 110, 0.42, 0.085, 'sawtooth')
  }

  purchase(): void {
    if (this.playSample('purchase')) return
    this.tone(660, 880, 0.12, 0.06, 'sine')
  }
}
