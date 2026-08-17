import { THREAD_COLORS } from './palette'
import { cellKey } from './reachability'
import type { GameSnapshot, StitchTask, ThreadColor } from './types'

interface Mission extends StitchTask {
  startedAt: number
  returnMs: number
}

const CONTACT_MS = 100
const PORTAL_DROP_MS = 180

interface BoardGeometry {
  cellSize: number
  left: number
  top: number
  width: number
  height: number
}

export class BoardRenderer {
  private readonly context: CanvasRenderingContext2D
  private readonly staticCanvas = document.createElement('canvas')
  private readonly staticContext: CanvasRenderingContext2D
  private snapshot: GameSnapshot | null = null
  private missions: Mission[] = []
  private dpr = 1
  private width = 0
  private height = 0
  private frame = 0
  private staticDirty = true
  private destroyed = false
  private resizeObserver: ResizeObserver
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d')
    const staticContext = this.staticCanvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D is unavailable')
    if (!staticContext) throw new Error('Canvas 2D cache is unavailable')
    this.context = context
    this.staticContext = staticContext
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas)
    this.resize()
  }

  setSnapshot(snapshot: GameSnapshot): void {
    this.snapshot = snapshot
    this.staticDirty = true
    this.requestDraw()
  }

  launch(tasks: StitchTask[]): void {
    const startedAt = performance.now()
    tasks.forEach((task) => {
      this.missions.push({
        ...task,
        startedAt,
        returnMs: Math.max(300, task.travelMs * 0.62),
      })
    })
    this.requestDraw()
  }

  destroy(): void {
    this.destroyed = true
    this.resizeObserver.disconnect()
    if (this.frame) cancelAnimationFrame(this.frame)
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect()
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.width = Math.max(1, rect.width)
    this.height = Math.max(1, rect.height)
    const pixelWidth = Math.round(this.width * this.dpr)
    const pixelHeight = Math.round(this.height * this.dpr)
    if (this.canvas.width === pixelWidth && this.canvas.height === pixelHeight) return
    this.canvas.width = pixelWidth
    this.canvas.height = pixelHeight
    this.staticCanvas.width = pixelWidth
    this.staticCanvas.height = pixelHeight
    this.staticDirty = true
    this.requestDraw()
  }

  private geometry(): BoardGeometry | null {
    if (!this.snapshot) return null
    const rows = this.snapshot.cells.length
    const cols = this.snapshot.cells[0]?.length ?? 0
    if (!rows || !cols) return null
    const available = Math.min(this.width - 48, this.height - 58)
    const cellSize = available / Math.max(rows, cols)
    const width = cols * cellSize
    const height = rows * cellSize
    return {
      cellSize,
      width,
      height,
      left: (this.width - width) / 2,
      top: (this.height - height) / 2 - 2,
    }
  }

  private requestDraw(): void {
    if (this.frame || this.destroyed) return
    this.frame = requestAnimationFrame((time) => this.draw(time))
  }

  private redrawStatic(): void {
    const ctx = this.staticContext
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)
    const geometry = this.geometry()
    if (this.snapshot && geometry) {
      this.drawHoop(ctx, geometry)
      this.drawFabric(ctx, geometry)
      this.drawReveal(ctx, geometry)
      this.drawStitches(ctx, geometry)
    }
    this.staticDirty = false
  }

  private draw(time: number): void {
    this.frame = 0
    if (this.destroyed) return
    const ctx = this.context
    if (this.staticDirty) this.redrawStatic()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.drawImage(this.staticCanvas, 0, 0)
    const geometry = this.geometry()
    if (this.snapshot && geometry) {
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
      this.drawMissions(ctx, geometry, time)
    }
    this.missions = this.missions.filter((mission) => time < mission.startedAt + mission.travelMs + CONTACT_MS + mission.returnMs + PORTAL_DROP_MS)
    if (this.missions.length) this.requestDraw()
  }

  private roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    const r = Math.min(radius, width / 2, height / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + width, y, x + width, y + height, r)
    ctx.arcTo(x + width, y + height, x, y + height, r)
    ctx.arcTo(x, y + height, x, y, r)
    ctx.arcTo(x, y, x + width, y, r)
    ctx.closePath()
  }

  private drawHoop(ctx: CanvasRenderingContext2D, geo: BoardGeometry): void {
    const pad = 17
    ctx.save()
    ctx.shadowColor = 'rgba(71, 50, 34, .23)'
    ctx.shadowBlur = 18
    ctx.shadowOffsetY = 8
    this.roundedRect(ctx, geo.left - pad, geo.top - pad, geo.width + pad * 2, geo.height + pad * 2, 30)
    ctx.fillStyle = '#c7985d'
    ctx.fill()
    ctx.shadowColor = 'transparent'
    this.roundedRect(ctx, geo.left - 10, geo.top - 10, geo.width + 20, geo.height + 20, 24)
    const wood = ctx.createLinearGradient(geo.left, geo.top, geo.left + geo.width, geo.top + geo.height)
    wood.addColorStop(0, '#f1c98e')
    wood.addColorStop(0.55, '#d7a96c')
    wood.addColorStop(1, '#bd8750')
    ctx.strokeStyle = wood
    ctx.lineWidth = 8
    ctx.stroke()
    ctx.restore()
  }

  private drawFabric(ctx: CanvasRenderingContext2D, geo: BoardGeometry): void {
    ctx.save()
    this.roundedRect(ctx, geo.left - 7, geo.top - 7, geo.width + 14, geo.height + 14, 19)
    ctx.clip()
    ctx.fillStyle = '#fff9ec'
    ctx.fillRect(geo.left - 8, geo.top - 8, geo.width + 16, geo.height + 16)
    ctx.lineWidth = 0.7
    ctx.strokeStyle = 'rgba(150, 132, 108, .18)'
    for (let x = geo.left; x <= geo.left + geo.width; x += Math.max(4, geo.cellSize / 4)) {
      ctx.beginPath()
      ctx.moveTo(x, geo.top - 8)
      ctx.lineTo(x, geo.top + geo.height + 8)
      ctx.stroke()
    }
    for (let y = geo.top; y <= geo.top + geo.height; y += Math.max(4, geo.cellSize / 4)) {
      ctx.beginPath()
      ctx.moveTo(geo.left - 8, y)
      ctx.lineTo(geo.left + geo.width + 8, y)
      ctx.stroke()
    }
    ctx.restore()
  }

  private drawReveal(ctx: CanvasRenderingContext2D, geo: BoardGeometry): void {
    if (!this.snapshot) return
    if (this.snapshot.phase !== 'complete') return
    ctx.save()
    ctx.beginPath()
    this.snapshot.cells.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
      if (!cell.color || !cell.cleared) return
      const inset = 1
      ctx.rect(
        geo.left + colIndex * geo.cellSize + inset,
        geo.top + rowIndex * geo.cellSize + inset,
        geo.cellSize - inset * 2,
        geo.cellSize - inset * 2,
      )
    }))
    ctx.clip()
    if (this.snapshot.level.reveal === 'sprout') this.drawSprout(ctx, geo)
    else this.drawMoth(ctx, geo)
    ctx.restore()
  }

  private drawSprout(ctx: CanvasRenderingContext2D, geo: BoardGeometry): void {
    const cx = geo.left + geo.width / 2
    const cy = geo.top + geo.height / 2 + geo.height * 0.06
    ctx.fillStyle = '#f7e6b9'
    ctx.fillRect(geo.left, geo.top, geo.width, geo.height)
    ctx.strokeStyle = '#778f62'
    ctx.lineWidth = Math.max(3, geo.cellSize * 0.18)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(cx, cy + geo.height * 0.27)
    ctx.quadraticCurveTo(cx - 4, cy + 8, cx + 2, cy - geo.height * 0.18)
    ctx.stroke()
    ctx.fillStyle = '#73a66d'
    ctx.beginPath()
    ctx.ellipse(cx - geo.width * 0.11, cy - geo.height * 0.09, geo.width * 0.13, geo.height * 0.07, -0.55, 0, Math.PI * 2)
    ctx.ellipse(cx + geo.width * 0.1, cy - geo.height * 0.16, geo.width * 0.13, geo.height * 0.07, 0.55, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2f3b31'
    ctx.beginPath()
    ctx.arc(cx - 6, cy + geo.height * 0.12, 2.1, 0, Math.PI * 2)
    ctx.arc(cx + 6, cy + geo.height * 0.12, 2.1, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#2f3b31'
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.arc(cx, cy + geo.height * 0.12, 8, 0.25, Math.PI - 0.25)
    ctx.stroke()
  }

  private drawMoth(ctx: CanvasRenderingContext2D, geo: BoardGeometry): void {
    const cx = geo.left + geo.width / 2
    const cy = geo.top + geo.height / 2
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, geo.width * 0.7)
    grad.addColorStop(0, '#fff2c9')
    grad.addColorStop(1, '#9ca8c7')
    ctx.fillStyle = grad
    ctx.fillRect(geo.left, geo.top, geo.width, geo.height)
    ctx.fillStyle = '#e8d7ee'
    ctx.beginPath()
    ctx.ellipse(cx - geo.width * 0.18, cy, geo.width * 0.2, geo.height * 0.27, -0.45, 0, Math.PI * 2)
    ctx.ellipse(cx + geo.width * 0.18, cy, geo.width * 0.2, geo.height * 0.27, 0.45, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#735f86'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.fillStyle = '#5a5067'
    ctx.beginPath()
    ctx.ellipse(cx, cy + 3, geo.width * 0.055, geo.height * 0.22, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#5a5067'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx - 3, cy - geo.height * 0.2)
    ctx.quadraticCurveTo(cx - geo.width * 0.11, cy - geo.height * 0.35, cx - geo.width * 0.16, cy - geo.height * 0.27)
    ctx.moveTo(cx + 3, cy - geo.height * 0.2)
    ctx.quadraticCurveTo(cx + geo.width * 0.11, cy - geo.height * 0.35, cx + geo.width * 0.16, cy - geo.height * 0.27)
    ctx.stroke()
    ctx.fillStyle = '#f2c14e'
    ;[-1, 1].forEach((side) => {
      ctx.beginPath()
      ctx.arc(cx + side * geo.width * 0.19, cy - geo.height * 0.02, geo.width * 0.035, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  private drawStitches(ctx: CanvasRenderingContext2D, geo: BoardGeometry): void {
    if (!this.snapshot) return
    if (this.snapshot.level.density >= 3) {
      this.drawDenseStitches(ctx, geo)
      return
    }
    const pulse = 0.55
    this.snapshot.cells.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
      if (!cell.color || cell.cleared) return
      const centerX = geo.left + (colIndex + 0.5) * geo.cellSize
      const centerY = geo.top + (rowIndex + 0.5) * geo.cellSize
      const accessible = this.snapshot!.reachable.has(cellKey(rowIndex, colIndex))
      this.drawStitchTile(ctx, cell.color, centerX, centerY, geo.cellSize * 0.985, accessible, pulse)
    }))
  }

  private drawDenseStitches(ctx: CanvasRenderingContext2D, geo: BoardGeometry): void {
    if (!this.snapshot) return
    const size = geo.cellSize * 0.985
    const pad = size * 0.17
    const tiles = new Map<ThreadColor, Path2D>()
    const crosses = new Map<ThreadColor, Path2D>()
    const highlights = new Path2D()

    this.snapshot.cells.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
      if (!cell.color || cell.cleared) return
      const x = geo.left + (colIndex + 0.5) * geo.cellSize
      const y = geo.top + (rowIndex + 0.5) * geo.cellSize
      const left = x - size / 2
      const top = y - size / 2
      const tilePath = tiles.get(cell.color) ?? new Path2D()
      const crossPath = crosses.get(cell.color) ?? new Path2D()
      tilePath.rect(left, top, size, size)
      crossPath.moveTo(left + pad, top + pad)
      crossPath.lineTo(left + size - pad, top + size - pad)
      crossPath.moveTo(left + size - pad, top + pad)
      crossPath.lineTo(left + pad, top + size - pad)
      tiles.set(cell.color, tilePath)
      crosses.set(cell.color, crossPath)
      if (this.snapshot!.reachable.has(cellKey(rowIndex, colIndex))) highlights.rect(left + 0.5, top + 0.5, size - 1, size - 1)
    }))

    tiles.forEach((path, color) => {
      ctx.fillStyle = THREAD_COLORS[color].dark
      ctx.fill(path)
    })
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineWidth = Math.max(0.8, size * 0.23)
    crosses.forEach((path, color) => {
      ctx.strokeStyle = THREAD_COLORS[color].hex
      ctx.stroke(path)
    })
    ctx.lineWidth = 0.65
    ctx.strokeStyle = 'rgba(255,255,255,.72)'
    ctx.stroke(highlights)
    ctx.restore()
  }

  private drawStitchTile(
    ctx: CanvasRenderingContext2D,
    color: ThreadColor,
    x: number,
    y: number,
    size: number,
    accessible: boolean,
    pulse: number,
  ): void {
    const thread = THREAD_COLORS[color]
    const left = x - size / 2
    const top = y - size / 2
    const pad = size * 0.16
    ctx.save()
    if (accessible) {
      ctx.shadowColor = `rgba(255,255,255,${0.45 + pulse * 0.35})`
      ctx.shadowBlur = 2 + pulse * 2
    } else {
      ctx.shadowColor = 'rgba(47,38,48,.22)'
      ctx.shadowBlur = 1.5
      ctx.shadowOffsetY = 0.7
    }
    ctx.fillStyle = thread.dark
    this.roundedRect(ctx, left, top, size, size, size * 0.06)
    ctx.fill()

    ctx.shadowColor = 'transparent'
    ctx.lineCap = 'round'
    ctx.lineWidth = Math.max(0.8, size * 0.24)
    ctx.strokeStyle = thread.hex
    ctx.beginPath()
    ctx.moveTo(left + pad, top + pad)
    ctx.lineTo(left + size - pad, top + size - pad)
    ctx.moveTo(left + size - pad, top + pad)
    ctx.lineTo(left + pad, top + size - pad)
    ctx.stroke()

    ctx.lineWidth = Math.max(0.45, size * 0.055)
    ctx.strokeStyle = thread.light
    ctx.beginPath()
    ctx.moveTo(left + pad + 0.7, top + pad)
    ctx.lineTo(left + size - pad, top + size - pad - 0.7)
    ctx.stroke()
    if (size >= 9) this.drawSymbol(ctx, color, x, y, size * 0.12)
    ctx.restore()
  }

  private drawSymbol(ctx: CanvasRenderingContext2D, color: ThreadColor, x: number, y: number, size: number): void {
    const symbol = THREAD_COLORS[color].symbol
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,.9)'
    ctx.fillStyle = 'rgba(255,255,255,.9)'
    ctx.lineWidth = Math.max(1, size * 0.32)
    if (symbol === 'circle') {
      ctx.beginPath(); ctx.arc(x, y, size * 0.52, 0, Math.PI * 2); ctx.fill()
    } else if (symbol === 'ring') {
      ctx.beginPath(); ctx.arc(x, y, size * 0.58, 0, Math.PI * 2); ctx.stroke()
    } else if (symbol === 'diamond') {
      ctx.beginPath(); ctx.moveTo(x, y - size * 0.7); ctx.lineTo(x + size * 0.7, y); ctx.lineTo(x, y + size * 0.7); ctx.lineTo(x - size * 0.7, y); ctx.closePath(); ctx.fill()
    } else if (symbol === 'triangle') {
      ctx.beginPath(); ctx.moveTo(x, y - size * 0.72); ctx.lineTo(x + size * 0.72, y + size * 0.55); ctx.lineTo(x - size * 0.72, y + size * 0.55); ctx.closePath(); ctx.fill()
    } else if (symbol === 'bar') {
      ctx.beginPath(); ctx.moveTo(x - size * 0.7, y); ctx.lineTo(x + size * 0.7, y); ctx.stroke()
    } else {
      ctx.beginPath(); ctx.moveTo(x - size * 0.55, y - size * 0.55); ctx.lineTo(x + size * 0.55, y + size * 0.55); ctx.moveTo(x + size * 0.55, y - size * 0.55); ctx.lineTo(x - size * 0.55, y + size * 0.55); ctx.stroke()
    }
    ctx.restore()
  }

  private drawMissions(ctx: CanvasRenderingContext2D, geo: BoardGeometry, time: number): void {
    this.missions.forEach((mission) => {
      const elapsed = time - mission.startedAt
      if (elapsed < 0) return
      const returnStart = mission.travelMs + CONTACT_MS
      const dropStart = returnStart + mission.returnMs
      const returning = elapsed > returnStart
      const dropping = elapsed > dropStart
      const outboundProgress = Math.max(0, Math.min(1, elapsed / mission.travelMs))
      const returnProgress = Math.max(0, Math.min(1, (elapsed - returnStart) / mission.returnMs))
      const dropProgress = Math.max(0, Math.min(1, (elapsed - dropStart) / PORTAL_DROP_MS))
      const pathProgress = returning ? Math.max(0, 1 - returnProgress) : outboundProgress
      const position = this.sampleWalkPath(mission.path, pathProgress, geo)
      const ahead = this.sampleWalkPath(mission.path, Math.max(0, Math.min(1, pathProgress + (returning ? -0.02 : 0.02))), geo)
      const direction = Math.atan2(ahead.y - position.y, ahead.x - position.x)
      const spread = (mission.workerIndex - 3) * Math.min(0.7, geo.cellSize * 0.08)
      const x = position.x + Math.cos(direction + Math.PI / 2) * spread
      const y = position.y + Math.sin(direction + Math.PI / 2) * spread
      const gait = elapsed / 115 + mission.workerIndex * 0.7
      ctx.save()
      const radius = Math.max(4.8, geo.cellSize * 0.88)
      const contactProgress = Math.max(0, Math.min(1, (elapsed - mission.travelMs) / CONTACT_MS))
      if (!returning && elapsed >= mission.travelMs) this.drawExtraction(ctx, x, y, radius, mission.color, contactProgress)
      if (dropping) {
        const easedDrop = dropProgress * dropProgress
        ctx.globalAlpha = 1 - dropProgress
        ctx.translate(x, y + easedDrop * radius * 2.2)
        ctx.scale(1 - dropProgress * 0.58, 1 - dropProgress * 0.58)
        this.drawPortalDrop(ctx, radius, mission.color, dropProgress)
        this.drawSprite(ctx, 0, 0, radius, mission.color, gait, direction, true)
      } else {
        this.drawSprite(ctx, x, y, radius, mission.color, gait, direction, returning)
      }
      ctx.restore()
    })
  }

  private drawExtraction(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    color: ThreadColor,
    progress: number,
  ): void {
    const thread = THREAD_COLORS[color]
    const size = radius * (1.15 - progress * 0.5)
    ctx.save()
    ctx.translate(x, y - progress * radius * 0.5)
    ctx.rotate(progress * 0.35)
    ctx.globalAlpha = 1 - progress * 0.25
    ctx.strokeStyle = thread.hex
    ctx.lineWidth = Math.max(1.2, radius * 0.24)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-size, -size)
    ctx.lineTo(size, size)
    ctx.moveTo(size, -size)
    ctx.lineTo(-size, size)
    ctx.stroke()
    ctx.restore()
  }

  private drawPortalDrop(ctx: CanvasRenderingContext2D, radius: number, color: ThreadColor, progress: number): void {
    const thread = THREAD_COLORS[color]
    ctx.save()
    ctx.globalAlpha = 0.7 * (1 - progress)
    ctx.strokeStyle = thread.hex
    ctx.lineWidth = Math.max(1, radius * 0.14)
    ctx.beginPath()
    ctx.moveTo(-radius * 0.7, -radius * 0.6)
    ctx.quadraticCurveTo(0, radius * (0.2 + progress), radius * 0.45, radius * 1.35)
    ctx.stroke()
    ctx.restore()
  }

  private sampleWalkPath(path: Array<{ row: number; col: number }>, progress: number, geo: BoardGeometry): { x: number; y: number } {
    if (!path.length) return { x: this.width / 2, y: geo.top + geo.height + geo.cellSize }
    if (path.length === 1) {
      return {
        x: geo.left + (path[0].col + 0.5) * geo.cellSize,
        y: geo.top + (path[0].row + 0.5) * geo.cellSize,
      }
    }
    const scaled = progress * (path.length - 1)
    const index = Math.min(path.length - 2, Math.floor(scaled))
    const local = scaled - index
    const from = path[index]
    const to = path[index + 1]
    return {
      x: geo.left + (from.col + 0.5 + (to.col - from.col) * local) * geo.cellSize,
      y: geo.top + (from.row + 0.5 + (to.row - from.row) * local) * geo.cellSize,
    }
  }

  private drawSprite(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    color: ThreadColor,
    gait: number,
    direction: number,
    carrying: boolean,
  ): void {
    const thread = THREAD_COLORS[color]
    const step = this.reducedMotion ? 0 : Math.sin(gait * Math.PI * 2)
    y += Math.abs(step) * -radius * 0.08
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(direction + Math.PI / 2)
    ctx.fillStyle = 'rgba(42,41,48,.18)'
    ctx.beginPath()
    ctx.ellipse(0, radius * 0.65, radius * 0.9, radius * 0.28, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = thread.dark
    ctx.lineWidth = Math.max(1.1, radius * 0.16)
    ctx.lineCap = 'round'
    ;[-1, 1].forEach((side, index) => {
      const phase = index === 0 ? step : -step
      ctx.beginPath()
      ctx.moveTo(side * radius * 0.42, radius * 0.2)
      ctx.lineTo(side * radius * (0.58 + phase * 0.12), radius * (0.72 - phase * 0.1))
      ctx.stroke()
    })

    ctx.beginPath()
    ctx.moveTo(-radius * 0.35, -radius * 0.62)
    ctx.quadraticCurveTo(-radius * 0.8, -radius * 1.05, -radius * 0.56, -radius * 1.25)
    ctx.moveTo(radius * 0.25, -radius * 0.7)
    ctx.quadraticCurveTo(radius * 0.55, -radius * 1.12, radius * 0.78, -radius * 1.04)
    ctx.stroke()
    ctx.fillStyle = thread.hex
    ctx.beginPath()
    ctx.ellipse(0, 0, radius * 0.9, radius * 0.78, -0.1, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#fffdf5'
    ctx.beginPath()
    ctx.arc(-radius * 0.28, -radius * 0.12, radius * 0.17, 0, Math.PI * 2)
    ctx.arc(radius * 0.24, -radius * 0.15, radius * 0.17, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#292833'
    ctx.beginPath()
    ctx.arc(-radius * 0.23, -radius * 0.1, radius * 0.075, 0, Math.PI * 2)
    ctx.arc(radius * 0.29, -radius * 0.13, radius * 0.075, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#9a9ba2'
    ctx.lineWidth = Math.max(1.2, radius * 0.11)
    ctx.beginPath()
    ctx.moveTo(radius * 0.7, radius * 0.25)
    ctx.lineTo(radius * 1.35, -radius * 0.2)
    ctx.stroke()
    if (carrying) {
      ctx.fillStyle = thread.hex
      ctx.strokeStyle = thread.dark
      ctx.lineWidth = Math.max(0.8, radius * 0.08)
      this.roundedRect(ctx, -radius * 0.42, -radius * 1.25, radius * 0.84, radius * 0.62, radius * 0.12)
      ctx.fill()
      ctx.stroke()
    }
    ctx.restore()
  }
}
