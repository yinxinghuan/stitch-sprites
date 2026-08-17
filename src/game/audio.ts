export class GameAudio {
  private context: AudioContext | null = null
  private muted = false
  private stitchStep = 0

  get isMuted(): boolean {
    return this.muted
  }

  async unlock(): Promise<void> {
    try {
      this.context ??= new AudioContext()
      if (this.context.state === 'suspended') await this.context.resume()
    } catch {
      this.context = null
    }
  }

  toggle(): boolean {
    this.muted = !this.muted
    return this.muted
  }

  private tone(from: number, to: number, duration: number, volume: number, type: OscillatorType = 'sine', delay = 0): void {
    if (this.muted || !this.context) return
    const now = this.context.currentTime + delay
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(from, now)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, to), now + duration)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    oscillator.connect(gain).connect(this.context.destination)
    oscillator.start(now)
    oscillator.stop(now + duration + 0.02)
  }

  spool(): void {
    this.tone(300, 220, 0.055, 0.12, 'triangle')
  }

  depart(): void {
    this.tone(520, 680, 0.07, 0.065, 'sine')
  }

  unstitch(): void {
    const notes = [784, 880, 988, 1047]
    const note = notes[this.stitchStep++ % notes.length]
    this.tone(note * 0.84, note, 0.055, 0.045, 'triangle')
  }

  wait(): void {
    this.tone(205, 185, 0.09, 0.07, 'sine')
  }

  danger(): void {
    this.tone(150, 135, 0.075, 0.085, 'triangle')
    this.tone(150, 128, 0.075, 0.085, 'triangle', 0.11)
  }

  complete(): void {
    ;[523, 659, 784, 1047].forEach((note, index) => this.tone(note, note * 1.015, 0.19, 0.065, 'sine', index * 0.12))
  }

  fail(): void {
    this.tone(240, 110, 0.42, 0.085, 'sawtooth')
  }
}

