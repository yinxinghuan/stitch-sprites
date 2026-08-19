import { resolveThreadStyle } from './palette'
import { cellKey } from './reachability'
import type { GameSnapshot, StitchTask, ThreadColor } from './types'

interface Mission extends StitchTask {
  startedAt: number
  returnMs: number
  threadDelayMs: number
  threadRecoveryMs: number
}

const CONTACT_MS = 260
const PORTAL_DROP_MS = 220

interface BoardGeometry {
  cellSize: number
  left: number
  top: number
  width: number
  height: number
  centerX: number
  centerY: number
  hoopRadius: number
  fabricRadius: number
}

export class BoardRenderer {
  private readonly context: CanvasRenderingContext2D
  private readonly baseCanvas = document.createElement('canvas')
  private readonly baseContext: CanvasRenderingContext2D
  private readonly staticCanvas = document.createElement('canvas')
  private readonly staticContext: CanvasRenderingContext2D
  private snapshot: GameSnapshot | null = null
  private missions: Mission[] = []
  private dpr = 1
  private width = 0
  private height = 0
  private frame = 0
  private baseDirty = true
  private staticDirty = true
  private fullStaticRedraw = true
  private pendingCleared: Array<{ row: number; col: number }> = []
  private renderedCleared = new Set<string>()
  private renderedHighlights = new Set<string>()
  private geometryCache: BoardGeometry | null = null
  private geometryKey = ''
  private destroyed = false
  private resizeObserver: ResizeObserver
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  private readonly patternTextures = new Map<string, HTMLImageElement>()

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d')
    const baseContext = this.baseCanvas.getContext('2d')
    const staticContext = this.staticCanvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D is unavailable')
    if (!baseContext) throw new Error('Canvas 2D base cache is unavailable')
    if (!staticContext) throw new Error('Canvas 2D cache is unavailable')
    this.context = context
    this.baseContext = baseContext
    this.staticContext = staticContext
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas)
    this.resize()
  }

  private thread(color: ThreadColor) {
    return resolveThreadStyle(color, this.snapshot?.level.displayPalette)
  }

  private patternTexture(key: string): HTMLImageElement | null {
    const cached = this.patternTextures.get(key)
    if (cached) return cached.complete && cached.naturalWidth ? cached : null
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      this.fullStaticRedraw = true
      this.staticDirty = true
      this.requestDraw()
    }
    image.src = new URL(`./patterns/${key}.png`, document.baseURI).href
    this.patternTextures.set(key, image)
    return null
  }

  setSnapshot(snapshot: GameSnapshot): void {
    const previous = this.snapshot
    const runChanged = Boolean(previous && previous.runRevision !== snapshot.runRevision)
    if (runChanged || (previous?.phase === 'playing' && snapshot.phase !== 'playing')) this.missions = []
    const canPatch = Boolean(
      previous
      && previous.level.id === snapshot.level.id
      && previous.runRevision === snapshot.runRevision
      && previous.phase === 'playing'
      && snapshot.phase === 'playing'
      && !this.baseDirty
      && this.geometryCache,
    )
    const newlyCleared: Array<{ row: number; col: number }> = []
    if (canPatch) {
      snapshot.cells.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
        const key = cellKey(rowIndex, colIndex)
        if (cell.cleared && !this.renderedCleared.has(key)) {
          newlyCleared.push({ row: rowIndex, col: colIndex })
          this.renderedCleared.add(key)
        }
      }))
    }
    this.snapshot = snapshot
    if (!canPatch) {
      this.fullStaticRedraw = true
      this.pendingCleared = []
      this.renderedCleared.clear()
      this.renderedHighlights.clear()
      this.staticDirty = true
    } else if (newlyCleared.length) {
      this.pendingCleared.push(...newlyCleared)
      this.staticDirty = true
    }
    this.requestDraw()
  }

  launch(tasks: StitchTask[]): void {
    const waveStartedAt = performance.now()
    const prepared = tasks.map((task) => ({
      task,
      returnMs: Math.max(440, task.travelMs * (0.7 + (task.workerIndex % 3) * 0.018)),
    }))
    const waveSpriteEnd = Math.max(...prepared.map(({ task, returnMs }) => (
      task.departMs + task.travelMs + CONTACT_MS + returnMs + PORTAL_DROP_MS
    )))
    prepared.forEach(({ task, returnMs }) => {
      this.missions.push({
        ...task,
        startedAt: waveStartedAt + task.departMs,
        returnMs,
        threadDelayMs: Math.max(
          0,
          waveSpriteEnd + 230 + task.workerIndex * 96 - task.departMs - task.travelMs - CONTACT_MS,
        ),
        threadRecoveryMs: 1160 + ((task.workerIndex * 7 + task.row * 3 + task.col) % 5) * 86,
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
    this.baseCanvas.width = pixelWidth
    this.baseCanvas.height = pixelHeight
    this.staticCanvas.width = pixelWidth
    this.staticCanvas.height = pixelHeight
    this.geometryCache = null
    this.geometryKey = ''
    this.baseDirty = true
    this.fullStaticRedraw = true
    this.pendingCleared = []
    this.renderedCleared.clear()
    this.renderedHighlights.clear()
    this.staticDirty = true
    this.requestDraw()
  }

  private geometry(): BoardGeometry | null {
    if (!this.snapshot) return null
    const rows = this.snapshot.cells.length
    const cols = this.snapshot.cells[0]?.length ?? 0
    if (!rows || !cols) return null
    const key = `${this.snapshot.level.id}:${rows}:${cols}:${this.width}:${this.height}`
    if (this.geometryCache && this.geometryKey === key) return this.geometryCache
    const centerX = this.width / 2
    const centerY = this.height / 2 - 2
    const hoopRadius = Math.max(1, Math.min(this.width, this.height) / 2 - 7)
    const fabricRadius = Math.max(1, hoopRadius - 13)
    let occupiedRadius = 1
    this.snapshot.cells.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
      if (!cell.color) return
      const dx = colIndex + 0.5 - cols / 2
      const dy = rowIndex + 0.5 - rows / 2
      occupiedRadius = Math.max(occupiedRadius, Math.hypot(dx, dy) + Math.SQRT1_2)
    }))
    const cellSize = (fabricRadius - 3) / occupiedRadius
    const width = cols * cellSize
    const height = rows * cellSize
    this.geometryCache = {
      cellSize,
      width,
      height,
      left: centerX - width / 2,
      top: centerY - height / 2,
      centerX,
      centerY,
      hoopRadius,
      fabricRadius,
    }
    this.geometryKey = key
    this.baseDirty = true
    return this.geometryCache
  }

  private requestDraw(): void {
    if (this.frame || this.destroyed) return
    this.frame = requestAnimationFrame((time) => this.draw(time))
  }

  private redrawStatic(): void {
    const ctx = this.staticContext
    const geometry = this.geometry()
    if (this.snapshot && geometry) {
      if (this.baseDirty) {
        const base = this.baseContext
        base.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
        base.clearRect(0, 0, this.width, this.height)
        this.drawHoop(base, geometry)
        this.drawFabric(base, geometry)
        this.baseDirty = false
        this.fullStaticRedraw = true
      }
      if (this.fullStaticRedraw) {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, this.staticCanvas.width, this.staticCanvas.height)
        ctx.drawImage(this.baseCanvas, 0, 0)
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
        this.drawStitches(ctx, geometry)
        this.fullStaticRedraw = false
        this.pendingCleared = []
        this.renderedCleared = new Set<string>()
        this.renderedHighlights = new Set<string>()
        this.snapshot.cells.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
          if (cell.cleared) this.renderedCleared.add(cellKey(rowIndex, colIndex))
        }))
        this.snapshot.reachable.forEach((key) => {
          const [row, col] = key.split(':').map(Number)
          const cell = this.snapshot?.cells[row]?.[col]
          if (cell?.color && !cell.cleared) this.renderedHighlights.add(key)
        })
      } else if (this.pendingCleared.length) {
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        this.pendingCleared.forEach(({ row, col }) => {
          this.renderedHighlights.delete(cellKey(row, col))
          const padding = 0.15
          const x = Math.floor((geometry.left + col * geometry.cellSize - padding) * this.dpr)
          const y = Math.floor((geometry.top + row * geometry.cellSize - padding) * this.dpr)
          const size = Math.ceil((geometry.cellSize + padding * 2) * this.dpr)
          ctx.drawImage(this.baseCanvas, x, y, size, size, x, y, size, size)
        })
        ctx.restore()
        this.pendingCleared = []
        this.drawReachableHighlights(ctx, geometry)
      }
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, this.staticCanvas.width, this.staticCanvas.height)
    }
    this.staticDirty = false
  }

  private drawReachableHighlights(ctx: CanvasRenderingContext2D, geo: BoardGeometry): void {
    if (!this.snapshot) return
    const highlights = new Path2D()
    const size = geo.cellSize * 0.985
    this.snapshot.reachable.forEach((key) => {
      if (this.renderedHighlights.has(key)) return
      const [row, col] = key.split(':').map(Number)
      const cell = this.snapshot?.cells[row]?.[col]
      if (!cell?.color || cell.cleared) return
      highlights.rect(
        geo.left + (col + 0.5) * geo.cellSize - size / 2 + 0.5,
        geo.top + (row + 0.5) * geo.cellSize - size / 2 + 0.5,
        size - 1,
        size - 1,
      )
      this.renderedHighlights.add(key)
    })
    ctx.save()
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.lineWidth = 0.65
    ctx.strokeStyle = 'rgba(255,255,255,.72)'
    ctx.stroke(highlights)
    ctx.restore()
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
    this.missions = this.missions.filter((mission) => {
      const spriteEnd = mission.startedAt + mission.travelMs + CONTACT_MS + mission.returnMs + PORTAL_DROP_MS
      const threadEnd = mission.startedAt + mission.travelMs + CONTACT_MS + mission.threadDelayMs + mission.threadRecoveryMs
      return time < Math.max(spriteEnd, threadEnd)
    })
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
    ctx.save()
    ctx.shadowColor = 'rgba(71, 50, 34, .23)'
    ctx.shadowBlur = 18
    ctx.shadowOffsetY = 8
    ctx.beginPath()
    ctx.arc(geo.centerX, geo.centerY, geo.hoopRadius, 0, Math.PI * 2)
    const wood = ctx.createLinearGradient(
      geo.centerX - geo.hoopRadius,
      geo.centerY - geo.hoopRadius,
      geo.centerX + geo.hoopRadius,
      geo.centerY + geo.hoopRadius,
    )
    wood.addColorStop(0, '#f3cf99')
    wood.addColorStop(0.48, '#d7a66b')
    wood.addColorStop(1, '#b77b48')
    ctx.fillStyle = wood
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.strokeStyle = 'rgba(112,70,37,.34)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(geo.centerX, geo.centerY, geo.fabricRadius + 5, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,231,192,.78)'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(geo.centerX, geo.centerY, geo.fabricRadius + 9, -2.5, 0.45)
    ctx.strokeStyle = 'rgba(118,73,40,.24)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()
  }

  private drawFabric(ctx: CanvasRenderingContext2D, geo: BoardGeometry): void {
    ctx.save()
    ctx.beginPath()
    ctx.arc(geo.centerX, geo.centerY, geo.fabricRadius, 0, Math.PI * 2)
    ctx.clip()
    const cloth = ctx.createRadialGradient(
      geo.centerX - geo.fabricRadius * 0.18,
      geo.centerY - geo.fabricRadius * 0.22,
      geo.fabricRadius * 0.08,
      geo.centerX,
      geo.centerY,
      geo.fabricRadius,
    )
    cloth.addColorStop(0, '#fffdf5')
    cloth.addColorStop(0.68, '#fbf3e2')
    cloth.addColorStop(1, '#e9dcc5')
    ctx.fillStyle = cloth
    ctx.fillRect(
      geo.centerX - geo.fabricRadius,
      geo.centerY - geo.fabricRadius,
      geo.fabricRadius * 2,
      geo.fabricRadius * 2,
    )
    const weave = Math.max(3.2, geo.cellSize)
    const startX = geo.centerX - Math.ceil(geo.fabricRadius / weave) * weave
    const startY = geo.centerY - Math.ceil(geo.fabricRadius / weave) * weave
    ctx.lineWidth = Math.max(0.55, weave * 0.12)
    ctx.strokeStyle = 'rgba(255,255,255,.55)'
    for (let x = startX; x <= geo.centerX + geo.fabricRadius; x += weave) {
      ctx.beginPath()
      ctx.moveTo(x - weave * 0.1, geo.centerY - geo.fabricRadius)
      ctx.lineTo(x - weave * 0.1, geo.centerY + geo.fabricRadius)
      ctx.stroke()
    }
    for (let y = startY; y <= geo.centerY + geo.fabricRadius; y += weave) {
      ctx.beginPath()
      ctx.moveTo(geo.centerX - geo.fabricRadius, y - weave * 0.1)
      ctx.lineTo(geo.centerX + geo.fabricRadius, y - weave * 0.1)
      ctx.stroke()
    }
    ctx.lineWidth = Math.max(0.45, weave * 0.08)
    ctx.strokeStyle = 'rgba(131,106,79,.2)'
    for (let x = startX; x <= geo.centerX + geo.fabricRadius; x += weave) {
      ctx.beginPath(); ctx.moveTo(x + weave * 0.12, geo.centerY - geo.fabricRadius); ctx.lineTo(x + weave * 0.12, geo.centerY + geo.fabricRadius); ctx.stroke()
    }
    for (let y = startY; y <= geo.centerY + geo.fabricRadius; y += weave) {
      ctx.beginPath(); ctx.moveTo(geo.centerX - geo.fabricRadius, y + weave * 0.12); ctx.lineTo(geo.centerX + geo.fabricRadius, y + weave * 0.12); ctx.stroke()
    }
    const holes = new Path2D()
    const holeRadius = Math.max(0.32, Math.min(0.72, weave * 0.1))
    for (let y = startY; y <= geo.centerY + geo.fabricRadius; y += weave) {
      for (let x = startX; x <= geo.centerX + geo.fabricRadius; x += weave) {
        if (Math.hypot(x - geo.centerX, y - geo.centerY) > geo.fabricRadius - 1) continue
        holes.moveTo(x + holeRadius, y)
        holes.arc(x, y, holeRadius, 0, Math.PI * 2)
      }
    }
    ctx.fillStyle = 'rgba(91,69,52,.24)'
    ctx.fill(holes)
    ctx.restore()
  }

  private drawStitches(ctx: CanvasRenderingContext2D, geo: BoardGeometry): void {
    if (!this.snapshot) return
    const texture = this.snapshot.level.textureMode === 'procedural'
      ? null
      : this.patternTexture(this.snapshot.level.reveal)
    if (texture) {
      const visible = new Path2D()
      this.snapshot.cells.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
        if (!cell.color || cell.cleared) return
        visible.rect(
          geo.left + colIndex * geo.cellSize,
          geo.top + rowIndex * geo.cellSize,
          geo.cellSize + 0.08,
          geo.cellSize + 0.08,
        )
      }))
      ctx.save()
      ctx.clip(visible)
      ctx.drawImage(texture, geo.left, geo.top, geo.width, geo.height)
      ctx.restore()
      this.drawReachableHighlights(ctx, geo)
      return
    }
    if (this.snapshot.level.density >= 3 || geo.cellSize < 7) {
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
    const crosses = new Map<ThreadColor, Path2D>()
    const highlights = new Path2D()

    this.snapshot.cells.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
      if (!cell.color || cell.cleared) return
      const x = geo.left + (colIndex + 0.5) * geo.cellSize
      const y = geo.top + (rowIndex + 0.5) * geo.cellSize
      const left = x - size / 2
      const top = y - size / 2
      const crossPath = crosses.get(cell.color) ?? new Path2D()
      crossPath.moveTo(left + pad, top + pad)
      crossPath.lineTo(left + size - pad, top + size - pad)
      crossPath.moveTo(left + size - pad, top + pad)
      crossPath.lineTo(left + pad, top + size - pad)
      crosses.set(cell.color, crossPath)
      if (this.snapshot!.reachable.has(cellKey(rowIndex, colIndex))) highlights.rect(left + 0.5, top + 0.5, size - 1, size - 1)
    }))

    ctx.save()
    ctx.lineCap = 'round'
    ctx.translate(0, Math.max(0.3, size * 0.06))
    ctx.globalAlpha = 0.28
    ctx.lineWidth = Math.max(1.1, size * 0.56)
    ctx.strokeStyle = '#332a35'
    crosses.forEach((path) => ctx.stroke(path))
    ctx.translate(0, -Math.max(0.3, size * 0.06))
    ctx.globalAlpha = 1
    ctx.lineWidth = Math.max(1, size * 0.48)
    crosses.forEach((path, color) => {
      ctx.strokeStyle = this.thread(color).dark
      ctx.stroke(path)
    })
    ctx.lineWidth = Math.max(0.8, size * 0.32)
    crosses.forEach((path, color) => {
      ctx.strokeStyle = this.thread(color).hex
      ctx.stroke(path)
    })
    ctx.globalAlpha = 0.7
    ctx.lineWidth = Math.max(0.45, size * 0.08)
    crosses.forEach((path, color) => {
      ctx.strokeStyle = this.thread(color).light
      ctx.stroke(path)
    })
    ctx.globalAlpha = 1
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
    const thread = this.thread(color)
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
    const symbol = this.thread(color).symbol
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
    } else if (symbol === 'square') {
      ctx.strokeRect(x - size * 0.52, y - size * 0.52, size * 1.04, size * 1.04)
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
      const threadStart = returnStart + mission.threadDelayMs
      const returning = elapsed > returnStart
      const dropping = elapsed > dropStart
      const outboundProgress = Math.max(0, Math.min(1, elapsed / mission.travelMs))
      const returnProgress = Math.max(0, Math.min(1, (elapsed - returnStart) / mission.returnMs))
      const dropProgress = Math.max(0, Math.min(1, (elapsed - dropStart) / PORTAL_DROP_MS))
      const pathProgress = returning ? returnProgress : outboundProgress
      const position = returning
        ? this.sampleReturnFlight(mission, returnProgress, geo)
        : this.sampleWalkPath(mission.path, outboundProgress, geo)
      const tangentProgress = Math.min(1, pathProgress + 0.025)
      const fallbackProgress = Math.max(0, pathProgress - 0.025)
      const tangent = returning
        ? this.sampleReturnFlight(mission, tangentProgress, geo)
        : this.sampleWalkPath(mission.path, tangentProgress, geo)
      const fallback = returning
        ? this.sampleReturnFlight(mission, fallbackProgress, geo)
        : this.sampleWalkPath(mission.path, fallbackProgress, geo)
      const direction = tangent.x === position.x && tangent.y === position.y
        ? Math.atan2(position.y - fallback.y, position.x - fallback.x)
        : Math.atan2(tangent.y - position.y, tangent.x - position.x)
      const lane = (mission.workerIndex % 5) - 2
      const spread = lane * Math.min(2.15, geo.cellSize * 0.24)
      const wander = this.reducedMotion ? 0 : Math.sin(elapsed / (94 + mission.workerIndex % 4 * 9) + mission.workerIndex * 1.7) * Math.min(0.7, geo.cellSize * 0.075)
      const formation = returning ? 0 : Math.min(1, pathProgress * 5)
      const lateralOffset = (spread + wander) * formation
      const x = position.x + Math.cos(direction + Math.PI / 2) * lateralOffset
      const y = position.y + Math.sin(direction + Math.PI / 2) * lateralOffset
      const gait = elapsed / (108 + mission.workerIndex % 4 * 8) + mission.workerIndex * 0.73
      ctx.save()
      const sizeVariation = 0.92 + ((mission.workerIndex * 7) % 5) * 0.04
      const effectRadius = Math.max(8.6, geo.cellSize * 1.58 * sizeVariation)
      const radius = Math.max(10.2, geo.cellSize * 1.86 * sizeVariation)
      const contactProgress = Math.max(0, Math.min(1, (elapsed - mission.travelMs) / CONTACT_MS))
      const targetX = geo.left + (mission.col + 0.5) * geo.cellSize
      const targetY = geo.top + (mission.row + 0.5) * geo.cellSize
      const spriteDirection = !returning && elapsed >= mission.travelMs
        ? Math.atan2(targetY - y, targetX - x)
        : direction
      if (elapsed >= returnStart && elapsed < threadStart + mission.threadRecoveryMs) {
        const threadProgress = Math.max(0, Math.min(1, (elapsed - threadStart) / mission.threadRecoveryMs))
        this.drawThreadRecovery(ctx, targetX, targetY, effectRadius, mission.color, threadProgress, mission.workerIndex)
      }
      if (dropping) {
        const easedDrop = dropProgress * dropProgress
        ctx.globalAlpha = 1 - dropProgress
        ctx.translate(x, y + easedDrop * radius * 2.2)
        ctx.scale(1 - dropProgress * 0.58, 1 - dropProgress * 0.58)
        this.drawSpriteDrop(ctx, radius, dropProgress)
        this.drawSprite(ctx, 0, 0, radius, mission.color, gait, spriteDirection, true, 0)
      } else {
        this.drawSprite(ctx, x, y, radius, mission.color, gait, spriteDirection, returning, elapsed >= mission.travelMs ? contactProgress : 0)
        if (!returning && elapsed >= mission.travelMs) {
          this.drawExtraction(ctx, targetX, targetY, x, y, effectRadius, mission.color, contactProgress)
        }
      }
      ctx.restore()
    })
  }

  private drawExtraction(
    ctx: CanvasRenderingContext2D,
    targetX: number,
    targetY: number,
    workerX: number,
    workerY: number,
    radius: number,
    color: ThreadColor,
    progress: number,
  ): void {
    const thread = this.thread(color)
    const lift = 1 - Math.pow(1 - Math.min(1, progress / 0.48), 3)
    const coil = Math.max(0, Math.min(1, (progress - 0.28) / 0.72))
    const pullAngle = Math.atan2(workerY - targetY, workerX - targetX)
    const shake = this.reducedMotion ? 0 : Math.sin(progress * Math.PI * 9) * radius * 0.13 * (1 - coil)
    const sideX = Math.cos(pullAngle + Math.PI / 2)
    const sideY = Math.sin(pullAngle + Math.PI / 2)
    const bundleX = Math.cos(pullAngle) * radius * (0.25 + lift * 0.9) + sideX * shake
    const bundleY = Math.sin(pullAngle) * radius * (0.25 + lift * 0.9) + sideY * shake
    const size = radius * (0.78 - coil * 0.52)
    ctx.save()
    ctx.translate(targetX, targetY)
    ctx.strokeStyle = thread.hex
    ctx.lineWidth = Math.max(1.2, radius * 0.22)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (progress > 0.46) {
      const release = Math.min(1, (progress - 0.46) / 0.54)
      ctx.globalAlpha = Math.sin(release * Math.PI) * 0.85
      ctx.strokeStyle = '#fff7e7'
      ctx.lineWidth = Math.max(1.15, radius * 0.14)
      ctx.beginPath()
      ctx.arc(0, 0, radius * (0.42 + release * 0.72), 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.strokeStyle = thread.hex
    }

    // The two cross-stitch strands visibly lift out of the fabric before coiling.
    ctx.beginPath()
    ctx.moveTo(-size, -size)
    ctx.quadraticCurveTo(sideX * radius * 0.42, sideY * radius * 0.42, bundleX, bundleY)
    ctx.moveTo(size, -size)
    ctx.quadraticCurveTo(-sideX * radius * 0.42, -sideY * radius * 0.42, bundleX, bundleY)
    ctx.moveTo(-size, size)
    ctx.quadraticCurveTo(sideX * radius * 0.3, sideY * radius * 0.3, bundleX, bundleY)
    ctx.moveTo(size, size)
    ctx.quadraticCurveTo(-sideX * radius * 0.3, -sideY * radius * 0.3, bundleX, bundleY)
    ctx.stroke()

    ctx.globalAlpha = 0.95
    ctx.fillStyle = thread.hex
    ctx.strokeStyle = thread.dark
    ctx.lineWidth = Math.max(0.9, radius * 0.1)
    ctx.beginPath()
    ctx.arc(bundleX, bundleY, radius * (0.24 + coil * 0.62), 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    if (coil > 0.08) {
      ctx.strokeStyle = thread.light
      ctx.lineWidth = Math.max(0.75, radius * 0.075)
      ctx.beginPath()
      ctx.arc(bundleX, bundleY, radius * (0.08 + coil * 0.2), -Math.PI * 0.35, Math.PI * (1.2 + coil))
      ctx.stroke()
    }

    // A few fixed fibres sell the release without a particle system.
    ctx.globalAlpha = Math.sin(progress * Math.PI) * 0.8
    ctx.strokeStyle = thread.light
    ctx.lineWidth = Math.max(0.7, radius * 0.065)
    for (let index = 0; index < 3; index += 1) {
      const angle = -2.45 + index * 0.8
      const distance = radius * (0.65 + progress * 0.55)
      ctx.beginPath()
      ctx.moveTo(bundleX + Math.cos(angle) * radius * 0.28, bundleY + Math.sin(angle) * radius * 0.28)
      ctx.lineTo(bundleX + Math.cos(angle) * distance, bundleY + Math.sin(angle) * distance)
      ctx.stroke()
    }
    ctx.restore()
  }

  private drawSpriteDrop(ctx: CanvasRenderingContext2D, radius: number, progress: number): void {
    ctx.save()
    ctx.globalAlpha = 0.45 * (1 - progress)
    ctx.strokeStyle = '#f0c890'
    ctx.lineWidth = Math.max(1, radius * 0.11)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(0, radius * 0.92, radius * (0.42 + progress * 0.34), 0.2, Math.PI * 1.55)
    ctx.stroke()
    ctx.restore()
  }

  private drawThreadRecovery(
    ctx: CanvasRenderingContext2D,
    sourceX: number,
    sourceY: number,
    radius: number,
    color: ThreadColor,
    progress: number,
    workerIndex: number,
  ): void {
    const thread = this.thread(color)
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2
    const targetX = this.width / 2
    const targetY = this.height - 9
    const arcSide = workerIndex % 2 === 0 ? -1 : 1
    const control1X = sourceX + arcSide * (34 + workerIndex % 3 * 9)
    const control1Y = sourceY - (30 + workerIndex % 4 * 7)
    const control2X = targetX - arcSide * (24 + workerIndex % 4 * 8)
    const control2Y = targetY - 72
    const bezierPoint = (value: number): { x: number; y: number } => {
      const inverse = 1 - value
      return {
        x: inverse ** 3 * sourceX + 3 * inverse ** 2 * value * control1X + 3 * inverse * value ** 2 * control2X + value ** 3 * targetX,
        y: inverse ** 3 * sourceY + 3 * inverse ** 2 * value * control1Y + 3 * inverse * value ** 2 * control2Y + value ** 3 * targetY,
      }
    }
    const point = bezierPoint(eased)
    const previous = bezierPoint(Math.max(0, eased - 0.025))
    const direction = Math.atan2(point.y - previous.y, point.x - previous.x)
    const drop = Math.max(0, (progress - 0.82) / 0.18)
    const strandLength = radius * (3.2 - drop * 1.55)
    const sway = this.reducedMotion ? 0 : Math.sin(progress * Math.PI * 10 + workerIndex) * radius * 0.42 * (1 - drop)
    ctx.save()
    ctx.translate(point.x, point.y + drop * radius * 0.9)
    ctx.rotate(direction)
    ctx.scale(1 - drop * 0.62, 1 - drop * 0.62)
    ctx.lineCap = 'round'
    ctx.strokeStyle = thread.dark
    ctx.lineWidth = Math.max(1.5, radius * 0.28)
    ctx.beginPath()
    ctx.moveTo(strandLength * 0.48, 0)
    ctx.bezierCurveTo(strandLength * 0.18, -sway, -strandLength * 0.18, sway, -strandLength * 0.52, -sway * 0.25)
    ctx.stroke()
    ctx.strokeStyle = thread.light
    ctx.lineWidth = Math.max(0.75, radius * 0.09)
    ctx.beginPath()
    ctx.moveTo(strandLength * 0.48, 0)
    ctx.bezierCurveTo(strandLength * 0.18, -sway, -strandLength * 0.18, sway, -strandLength * 0.52, -sway * 0.25)
    ctx.stroke()
    ctx.globalAlpha = 0.55 * (1 - drop)
    ctx.beginPath()
    ctx.arc(0, 0, radius * 0.42, -0.4, Math.PI * 1.35)
    ctx.stroke()
    ctx.restore()
  }

  private sampleWalkPath(path: Array<{ row: number; col: number }>, progress: number, geo: BoardGeometry): { x: number; y: number } {
    const pointAt = (index: number): { x: number; y: number } => {
      if (index === 0) return { x: this.width / 2, y: this.height - 11 }
      const point = path[index]
      return {
        x: geo.left + (point.col + 0.5) * geo.cellSize,
        y: geo.top + (point.row + 0.5) * geo.cellSize,
      }
    }
    if (!path.length) return { x: this.width / 2, y: this.height - 11 }
    if (path.length === 1) return pointAt(0)
    const scaled = progress * (path.length - 1)
    const index = Math.min(path.length - 2, Math.floor(scaled))
    const local = scaled - index
    const from = pointAt(index)
    const to = pointAt(index + 1)
    return {
      x: from.x + (to.x - from.x) * local,
      y: from.y + (to.y - from.y) * local,
    }
  }

  private sampleReturnFlight(mission: Mission, progress: number, geo: BoardGeometry): { x: number; y: number } {
    const start = this.sampleWalkPath(mission.path, 1, geo)
    const portal = { x: this.width / 2, y: this.height - 11 }
    const side = mission.workerIndex % 2 === 0 ? -1 : 1
    const join = {
      x: portal.x + side * (11 + mission.workerIndex % 3 * 4),
      y: portal.y - 45,
    }
    const curveEnd = 0.7
    if (progress >= curveEnd) {
      const local = (progress - curveEnd) / (1 - curveEnd)
      return {
        x: join.x + (portal.x - join.x) * local,
        y: join.y + (portal.y - join.y) * local,
      }
    }
    const local = progress / curveEnd
    const inverse = 1 - local
    const control1 = {
      x: start.x + side * (26 + mission.workerIndex % 4 * 6),
      y: start.y - (29 + mission.workerIndex % 3 * 7),
    }
    const control2 = {
      x: join.x + side * (31 + mission.workerIndex % 3 * 5),
      y: join.y - 34,
    }
    return {
      x: inverse ** 3 * start.x + 3 * inverse ** 2 * local * control1.x + 3 * inverse * local ** 2 * control2.x + local ** 3 * join.x,
      y: inverse ** 3 * start.y + 3 * inverse ** 2 * local * control1.y + 3 * inverse * local ** 2 * control2.y + local ** 3 * join.y,
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
    airborne: boolean,
    pullProgress: number,
  ): void {
    const thread = this.thread(color)
    const body = '#34343d'
    const bodyDark = '#202029'
    const bodyLight = '#64646f'
    const step = this.reducedMotion ? 0 : Math.sin(gait * Math.PI * 2) * (airborne ? 0.28 : 1)
    const tug = this.reducedMotion ? 0 : Math.sin(Math.min(1, pullProgress) * Math.PI)
    const lift = Math.abs(step) * radius * 0.08
    const hover = airborne && !this.reducedMotion ? Math.sin(gait * Math.PI) * radius * 0.08 - radius * 0.18 : 0
    const bodyOffset = -lift + hover + tug * radius * 0.12
    ctx.save()
    ctx.translate(x, y)
    ctx.globalAlpha = airborne ? 0.045 : 0.12 - Math.min(0.035, lift / Math.max(1, radius) * 0.2)
    ctx.fillStyle = '#302d33'
    ctx.beginPath()
    ctx.ellipse(0, radius * 0.72, radius * (0.94 - lift / Math.max(1, radius) * 0.1), radius * 0.25, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.translate(0, bodyOffset)
    ctx.rotate(direction + Math.PI / 2 + tug * 0.13)

    ctx.strokeStyle = bodyDark
    ctx.lineWidth = Math.max(1.1, radius * 0.16)
    ctx.lineCap = 'round'
    ;[-1, 1].forEach((side, index) => {
      const phase = index === 0 ? step : -step
      ctx.beginPath()
      ctx.moveTo(side * radius * 0.42, radius * 0.2)
      if (airborne) {
        ctx.lineTo(side * radius * (0.53 + phase * 0.05), radius * (0.48 + side * 0.06))
      } else {
        ctx.lineTo(side * radius * (0.58 + phase * 0.12), radius * (0.72 - phase * 0.1))
      }
      ctx.stroke()
    })

    ctx.beginPath()
    ctx.moveTo(-radius * 0.35, -radius * 0.62)
    ctx.quadraticCurveTo(-radius * 0.8, -radius * 1.05, -radius * 0.56, -radius * 1.25)
    ctx.moveTo(radius * 0.25, -radius * 0.7)
    ctx.quadraticCurveTo(radius * 0.55, -radius * 1.12, radius * 0.78, -radius * 1.04)
    ctx.stroke()
    ctx.fillStyle = bodyLight
    ctx.beginPath()
    ctx.arc(-radius * 0.56, -radius * 1.25, radius * 0.13, 0, Math.PI * 2)
    ctx.arc(radius * 0.78, -radius * 1.04, radius * 0.13, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.ellipse(0, 0, radius * 0.9, radius * 0.78, -0.1, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#45454f'
    ctx.beginPath()
    ctx.ellipse(0, radius * 0.28, radius * 0.48, radius * 0.31, -0.08, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fffdf5'
    ctx.beginPath()
    ctx.arc(-radius * 0.28, -radius * 0.12, radius * 0.17, 0, Math.PI * 2)
    ctx.arc(radius * 0.24, -radius * 0.15, radius * 0.17, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = thread.hex
    ctx.beginPath()
    ctx.arc(-radius * 0.23, -radius * 0.1, radius * 0.085, 0, Math.PI * 2)
    ctx.arc(radius * 0.29, -radius * 0.13, radius * 0.085, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#9a9ba2'
    ctx.lineWidth = Math.max(1.2, radius * 0.11)
    ctx.beginPath()
    ctx.moveTo(radius * 0.7, radius * 0.25)
    ctx.lineTo(radius * 1.35, -radius * 0.2)
    ctx.stroke()
    ctx.restore()
  }
}
