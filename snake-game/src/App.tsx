import { useEffect, useRef, useState, useCallback } from 'react'
import './App.css'

// ─── Types ───────────────────────────────────────────────────────────
interface Point { x: number; y: number }
interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number;
}
interface PowerUp {
  pos: Point; type: PowerUpType; spawnTime: number; pulsePhase: number;
}
type PowerUpType = 'ghost' | 'speed' | 'magnet' | 'multiplier' | 'shield'
type FoodType = 'normal' | 'golden' | 'rainbow'
type GameMode = 'classic' | 'zen' | 'speed' | 'portal'
type GameState = 'menu' | 'playing' | 'paused' | 'gameover'
type Theme = 'neon' | 'retro' | 'matrix' | 'sunset'
interface Food { pos: Point; type: FoodType; pulsePhase: number }
interface Portal { a: Point; b: Point; hue: number }
interface HighScore { score: number; mode: string; date: string }

// ─── Constants ───────────────────────────────────────────────────────
const GRID = 20
const BASE_SPEED = 120
const THEMES: Record<Theme, {
  bg: string; snake: string; snakeGlow: string; food: string;
  grid: string; text: string; accent: string; trail: string;
  snakeHead: string; wallColor: string;
}> = {
  neon: {
    bg: '#0a0a1a', snake: '#00ffaa', snakeGlow: '#00ffaa',
    food: '#ff0066', grid: 'rgba(0,255,170,0.04)', text: '#00ffaa',
    accent: '#ff0066', trail: '#00ffaa', snakeHead: '#00ffd5',
    wallColor: '#00ffaa',
  },
  retro: {
    bg: '#1a1a2e', snake: '#e94560', snakeGlow: '#e94560',
    food: '#ffd700', grid: 'rgba(233,69,96,0.04)', text: '#e94560',
    accent: '#ffd700', trail: '#e94560', snakeHead: '#ff6b81',
    wallColor: '#e94560',
  },
  matrix: {
    bg: '#000a00', snake: '#00ff41', snakeGlow: '#00ff41',
    food: '#39ff14', grid: 'rgba(0,255,65,0.03)', text: '#00ff41',
    accent: '#39ff14', trail: '#00ff41', snakeHead: '#7dff6f',
    wallColor: '#00ff41',
  },
  sunset: {
    bg: '#1a0a2e', snake: '#ff6b35', snakeGlow: '#ff6b35',
    food: '#ffd23f', grid: 'rgba(255,107,53,0.04)', text: '#ff6b35',
    accent: '#ffd23f', trail: '#ff6b35', snakeHead: '#ff9a76',
    wallColor: '#ff6b35',
  },
}

const POWERUP_COLORS: Record<PowerUpType, string> = {
  ghost: '#aa88ff', speed: '#ffaa00', magnet: '#ff44aa',
  multiplier: '#44aaff', shield: '#44ffaa',
}
const POWERUP_ICONS: Record<PowerUpType, string> = {
  ghost: '👻', speed: '⚡', magnet: '🧲', multiplier: '✨', shield: '🛡️',
}
const POWERUP_DURATION = 5000

// ─── Audio Engine ────────────────────────────────────────────────────
class AudioEngine {
  private ctx: AudioContext | null = null
  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext()
    return this.ctx
  }
  playTone(freq: number, duration: number, type: OscillatorType = 'square', vol = 0.1) {
    try {
      const ctx = this.getCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type; osc.frequency.value = freq
      gain.gain.setValueAtTime(vol, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(); osc.stop(ctx.currentTime + duration)
    } catch { /* silent */ }
  }
  eat() { this.playTone(880, 0.1, 'square', 0.08); setTimeout(() => this.playTone(1100, 0.1, 'square', 0.06), 50) }
  powerUp() { this.playTone(523, 0.1, 'sine', 0.1); setTimeout(() => this.playTone(659, 0.1, 'sine', 0.08), 80); setTimeout(() => this.playTone(784, 0.15, 'sine', 0.06), 160) }
  die() { this.playTone(200, 0.3, 'sawtooth', 0.1); setTimeout(() => this.playTone(150, 0.3, 'sawtooth', 0.08), 100); setTimeout(() => this.playTone(100, 0.5, 'sawtooth', 0.06), 200) }
  combo() { this.playTone(1200, 0.08, 'sine', 0.07) }
  portal() { this.playTone(440, 0.2, 'sine', 0.06); setTimeout(() => this.playTone(660, 0.2, 'sine', 0.05), 100) }
}

const audio = new AudioEngine()

// ─── Helpers ─────────────────────────────────────────────────────────
function loadHighScores(): HighScore[] {
  try { return JSON.parse(localStorage.getItem('snake_highscores') || '[]') } catch { return [] }
}
function saveHighScore(score: number, mode: string) {
  const scores = loadHighScores()
  scores.push({ score, mode, date: new Date().toLocaleDateString() })
  scores.sort((a, b) => b.score - a.score)
  localStorage.setItem('snake_highscores', JSON.stringify(scores.slice(0, 10)))
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameState, setGameState] = useState<GameState>('menu')
  const [score, setScore] = useState(0)
  const [highScores, setHighScores] = useState<HighScore[]>(loadHighScores())
  const [gameMode, setGameMode] = useState<GameMode>('classic')
  const [theme, setTheme] = useState<Theme>('neon')
  const [showScores, setShowScores] = useState(false)
  const [soundOn, setSoundOn] = useState(true)

  const gameRef = useRef<{
    snake: Point[]; dir: Point; nextDir: Point; food: Food[];
    powerUps: PowerUp[]; particles: Particle[]; portals: Portal[];
    activePowerUps: Map<PowerUpType, number>; score: number;
    combo: number; comboTimer: number; speed: number; lastMove: number;
    screenShake: number; gridW: number; gridH: number;
    gameMode: GameMode; theme: Theme; soundOn: boolean;
    frameCount: number; trail: Array<{x: number; y: number; alpha: number}>;
    matrixDrops: Array<{x: number; y: number; speed: number; chars: string[]}>;
  } | null>(null)

  const animFrameRef = useRef<number>(0)

  const cellSize = useCallback(() => {
    const w = window.innerWidth
    const h = window.innerHeight
    return Math.floor(Math.min(w, h - 80) / GRID)
  }, [])

  const initGame = useCallback(() => {
    const cs = cellSize()
    const gridW = Math.floor(window.innerWidth / cs)
    const gridH = Math.floor((window.innerHeight - 80) / cs)
    const midX = Math.floor(gridW / 2)
    const midY = Math.floor(gridH / 2)

    const snake: Point[] = []
    for (let i = 0; i < 3; i++) snake.push({ x: midX - i, y: midY })

    const state = {
      snake, dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 },
      food: [] as Food[], powerUps: [] as PowerUp[], particles: [] as Particle[],
      portals: [] as Portal[], activePowerUps: new Map<PowerUpType, number>(),
      score: 0, combo: 0, comboTimer: 0, speed: BASE_SPEED,
      lastMove: -1, screenShake: 0, gridW, gridH,
      gameMode, theme, soundOn,
      frameCount: 0, trail: [] as Array<{x: number; y: number; alpha: number}>,
      matrixDrops: [] as Array<{x: number; y: number; speed: number; chars: string[]}>,
    }

    gameRef.current = state
    spawnFood(state)
    if (gameMode === 'portal') spawnPortals(state)

    // Init matrix rain for matrix theme
    if (theme === 'matrix') {
      for (let i = 0; i < 30; i++) {
        state.matrixDrops.push({
          x: Math.random() * gridW * cs,
          y: Math.random() * gridH * cs,
          speed: 1 + Math.random() * 3,
          chars: Array.from({length: 10}, () => String.fromCharCode(0x30A0 + Math.random() * 96)),
        })
      }
    }

    setScore(0)
    setGameState('playing')
  }, [cellSize, gameMode, theme, soundOn])

  function spawnFood(state: typeof gameRef.current extends infer T ? NonNullable<T> : never) {
    const occupied = new Set(state.snake.map(p => `${p.x},${p.y}`))
    state.food.forEach(f => occupied.add(`${f.pos.x},${f.pos.y}`))
    let pos: Point
    let attempts = 0
    do {
      pos = { x: Math.floor(Math.random() * state.gridW), y: Math.floor(Math.random() * state.gridH) }
      attempts++
    } while (occupied.has(`${pos.x},${pos.y}`) && attempts < 200)

    const r = Math.random()
    const type: FoodType = r < 0.1 ? 'golden' : r < 0.18 ? 'rainbow' : 'normal'
    state.food.push({ pos, type, pulsePhase: Math.random() * Math.PI * 2 })

    // Keep 2-3 food on screen
    if (state.food.length < 2 && Math.random() < 0.5) spawnFood(state)
  }

  function spawnPowerUp(state: typeof gameRef.current extends infer T ? NonNullable<T> : never) {
    if (state.powerUps.length >= 2) return
    const occupied = new Set([
      ...state.snake.map(p => `${p.x},${p.y}`),
      ...state.food.map(f => `${f.pos.x},${f.pos.y}`),
    ])
    let pos: Point
    let attempts = 0
    do {
      pos = { x: Math.floor(Math.random() * state.gridW), y: Math.floor(Math.random() * state.gridH) }
      attempts++
    } while (occupied.has(`${pos.x},${pos.y}`) && attempts < 200)

    const types: PowerUpType[] = ['ghost', 'speed', 'magnet', 'multiplier', 'shield']
    const type = types[Math.floor(Math.random() * types.length)]
    state.powerUps.push({ pos, type, spawnTime: Date.now(), pulsePhase: Math.random() * Math.PI * 2 })
  }

  function spawnPortals(state: typeof gameRef.current extends infer T ? NonNullable<T> : never) {
    state.portals = []
    for (let i = 0; i < 2; i++) {
      const a = { x: Math.floor(Math.random() * state.gridW), y: Math.floor(Math.random() * state.gridH) }
      const b = { x: Math.floor(Math.random() * state.gridW), y: Math.floor(Math.random() * state.gridH) }
      state.portals.push({ a, b, hue: i * 120 + 180 })
    }
  }

  function emitParticles(state: typeof gameRef.current extends infer T ? NonNullable<T> : never,
    x: number, y: number, color: string, count: number, spread = 3) {
    const cs = cellSize()
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.5 + Math.random() * spread
      state.particles.push({
        x: x * cs + cs / 2, y: y * cs + cs / 2,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 30 + Math.random() * 30, maxLife: 60,
        color, size: 2 + Math.random() * 4,
      })
    }
  }

  // ─── Game Loop ─────────────────────────────────────────────────────
  const gameLoop = useCallback((timestamp: number) => {
    const state = gameRef.current
    const canvas = canvasRef.current
    if (!state || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cs = cellSize()
    canvas.width = state.gridW * cs
    canvas.height = state.gridH * cs

    const t = THEMES[state.theme]
    state.frameCount++

    // ─── Update Logic ──────────────────────────────────
    // Initialize lastMove on first frame to prevent instant multi-step
    if (state.lastMove < 0) {
      state.lastMove = timestamp
    }
    if (timestamp - state.lastMove >= state.speed) {
      state.lastMove = timestamp
      state.dir = { ...state.nextDir }

      const head = state.snake[0]
      let newHead = { x: head.x + state.dir.x, y: head.y + state.dir.y }

      // Zen mode: wrap around
      if (state.gameMode === 'zen') {
        newHead.x = ((newHead.x % state.gridW) + state.gridW) % state.gridW
        newHead.y = ((newHead.y % state.gridH) + state.gridH) % state.gridH
      }

      // Portal mode: check portals
      if (state.gameMode === 'portal') {
        for (const portal of state.portals) {
          if (newHead.x === portal.a.x && newHead.y === portal.a.y) {
            newHead = { ...portal.b }
            emitParticles(state, portal.a.x, portal.a.y, `hsl(${portal.hue},100%,60%)`, 15, 5)
            emitParticles(state, portal.b.x, portal.b.y, `hsl(${portal.hue},100%,60%)`, 15, 5)
            if (state.soundOn) audio.portal()
          } else if (newHead.x === portal.b.x && newHead.y === portal.b.y) {
            newHead = { ...portal.a }
            emitParticles(state, portal.b.x, portal.b.y, `hsl(${portal.hue},100%,60%)`, 15, 5)
            emitParticles(state, portal.a.x, portal.a.y, `hsl(${portal.hue},100%,60%)`, 15, 5)
            if (state.soundOn) audio.portal()
          }
        }
      }

      // Wall collision (classic/speed/portal)
      if (state.gameMode !== 'zen') {
        if (newHead.x < 0 || newHead.x >= state.gridW || newHead.y < 0 || newHead.y >= state.gridH) {
          if (!state.activePowerUps.has('shield')) {
            handleDeath(state); return
          }
          newHead.x = ((newHead.x % state.gridW) + state.gridW) % state.gridW
          newHead.y = ((newHead.y % state.gridH) + state.gridH) % state.gridH
          state.activePowerUps.delete('shield')
        }
      }

      // Self collision
      const isGhost = state.activePowerUps.has('ghost')
      if (!isGhost) {
        for (let i = 0; i < state.snake.length; i++) {
          if (state.snake[i].x === newHead.x && state.snake[i].y === newHead.y) {
            if (!state.activePowerUps.has('shield')) {
              handleDeath(state); return
            }
            state.activePowerUps.delete('shield')
            break
          }
        }
      }

      // Add trail
      state.trail.push({ x: head.x, y: head.y, alpha: 1 })
      if (state.trail.length > 20) state.trail.shift()

      state.snake.unshift(newHead)

      // Check food
      let ate = false
      const isMagnet = state.activePowerUps.has('magnet')
      for (let i = state.food.length - 1; i >= 0; i--) {
        const f = state.food[i]
        const dist = Math.abs(f.pos.x - newHead.x) + Math.abs(f.pos.y - newHead.y)
        if (dist === 0 || (isMagnet && dist <= 2)) {
          ate = true
          const multiplier = state.activePowerUps.has('multiplier') ? 3 : 1
          let pts = 10 * multiplier
          if (f.type === 'golden') pts = 50 * multiplier
          if (f.type === 'rainbow') pts = 25 * multiplier

          // Combo system
          state.comboTimer = 60
          state.combo++
          if (state.combo > 1) {
            pts += state.combo * 5
            if (state.soundOn) audio.combo()
          }

          state.score += pts
          setScore(state.score)

          const foodColor = f.type === 'golden' ? '#ffd700' : f.type === 'rainbow' ? `hsl(${state.frameCount * 5 % 360},100%,60%)` : t.food
          emitParticles(state, f.pos.x, f.pos.y, foodColor, f.type === 'golden' ? 25 : 12)

          if (state.soundOn) audio.eat()

          state.food.splice(i, 1)
          spawnFood(state)

          // Random power-up spawn
          if (Math.random() < 0.25) spawnPowerUp(state)

          // Speed increase
          if (state.gameMode === 'speed') {
            state.speed = Math.max(40, state.speed - 3)
          } else {
            state.speed = Math.max(60, BASE_SPEED - state.snake.length * 1.5)
          }
          break
        }
      }
      if (!ate) state.snake.pop()

      // Combo decay
      if (state.comboTimer > 0) {
        state.comboTimer--
      } else {
        state.combo = 0
      }

      // Check power-up pickup
      for (let i = state.powerUps.length - 1; i >= 0; i--) {
        const p = state.powerUps[i]
        if (p.pos.x === newHead.x && p.pos.y === newHead.y) {
          state.activePowerUps.set(p.type, Date.now() + POWERUP_DURATION)
          state.powerUps.splice(i, 1)
          emitParticles(state, p.pos.x, p.pos.y, POWERUP_COLORS[p.type], 20, 4)
          if (state.soundOn) audio.powerUp()
          state.screenShake = 8
        }
      }

      // Expire power-ups
      const now = Date.now()
      for (const [key, expiry] of state.activePowerUps) {
        if (now > expiry) state.activePowerUps.delete(key)
      }

      // Despawn old power-ups
      state.powerUps = state.powerUps.filter(p => now - p.spawnTime < 10000)
    }

    // ─── Render ──────────────────────────────────────────
    // Screen shake
    ctx.save()
    if (state.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * state.screenShake
      const shakeY = (Math.random() - 0.5) * state.screenShake
      ctx.translate(shakeX, shakeY)
      state.screenShake *= 0.85
      if (state.screenShake < 0.5) state.screenShake = 0
    }

    // Background
    ctx.fillStyle = t.bg
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Grid
    ctx.strokeStyle = t.grid
    ctx.lineWidth = 0.5
    for (let x = 0; x <= state.gridW; x++) {
      ctx.beginPath(); ctx.moveTo(x * cs, 0); ctx.lineTo(x * cs, state.gridH * cs); ctx.stroke()
    }
    for (let y = 0; y <= state.gridH; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * cs); ctx.lineTo(state.gridW * cs, y * cs); ctx.stroke()
    }

    // Matrix rain effect
    if (state.theme === 'matrix') {
      ctx.font = '12px monospace'
      ctx.fillStyle = 'rgba(0,255,65,0.06)'
      for (const drop of state.matrixDrops) {
        for (let j = 0; j < drop.chars.length; j++) {
          ctx.fillText(drop.chars[j], drop.x, drop.y + j * 14)
        }
        drop.y += drop.speed
        if (drop.y > canvas.height + 200) {
          drop.y = -140
          drop.x = Math.random() * canvas.width
        }
      }
    }

    // Walls (classic, speed, portal modes)
    if (state.gameMode !== 'zen') {
      ctx.strokeStyle = t.wallColor
      ctx.lineWidth = 3
      ctx.shadowColor = t.wallColor
      ctx.shadowBlur = 10
      ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2)
      ctx.shadowBlur = 0
    }

    // Portals
    for (const portal of state.portals) {
      const pulse = Math.sin(state.frameCount * 0.08) * 0.3 + 0.7
      for (const p of [portal.a, portal.b]) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(p.x * cs + cs / 2, p.y * cs + cs / 2, cs * 0.6 * pulse, 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(${portal.hue + state.frameCount * 2 % 360},100%,60%,0.8)`
        ctx.lineWidth = 3
        ctx.shadowColor = `hsl(${portal.hue},100%,60%)`
        ctx.shadowBlur = 20
        ctx.stroke()

        // Inner spiral
        ctx.beginPath()
        for (let a = 0; a < Math.PI * 4; a += 0.1) {
          const r = (a / (Math.PI * 4)) * cs * 0.4 * pulse
          const px = p.x * cs + cs / 2 + Math.cos(a + state.frameCount * 0.1) * r
          const py = p.y * cs + cs / 2 + Math.sin(a + state.frameCount * 0.1) * r
          if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
        }
        ctx.strokeStyle = `hsla(${portal.hue + 60},100%,70%,0.4)`
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.restore()
      }
    }

    // Trail
    for (let i = 0; i < state.trail.length; i++) {
      const tr = state.trail[i]
      tr.alpha -= 0.05
      if (tr.alpha <= 0) continue
      ctx.fillStyle = t.trail.replace(')', `,${tr.alpha * 0.3})`)
        .replace('rgb', 'rgba')
      if (t.trail.startsWith('#')) {
        const hex = t.trail
        const r2 = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        ctx.fillStyle = `rgba(${r2},${g},${b},${tr.alpha * 0.3})`
      }
      ctx.fillRect(tr.x * cs + 2, tr.y * cs + 2, cs - 4, cs - 4)
    }
    state.trail = state.trail.filter(tr => tr.alpha > 0)

    // Food
    for (const food of state.food) {
      const pulse = Math.sin(state.frameCount * 0.1 + food.pulsePhase) * 0.15 + 0.85
      const fx = food.pos.x * cs + cs / 2
      const fy = food.pos.y * cs + cs / 2
      const fSize = cs * 0.4 * pulse

      ctx.save()
      if (food.type === 'golden') {
        ctx.shadowColor = '#ffd700'
        ctx.shadowBlur = 15 + Math.sin(state.frameCount * 0.15) * 5
        ctx.fillStyle = '#ffd700'
        // Star shape
        ctx.beginPath()
        for (let i = 0; i < 5; i++) {
          const angle = (i * Math.PI * 2) / 5 - Math.PI / 2 + state.frameCount * 0.03
          const outerX = fx + Math.cos(angle) * fSize
          const outerY = fy + Math.sin(angle) * fSize
          if (i === 0) ctx.moveTo(outerX, outerY); else ctx.lineTo(outerX, outerY)
          const innerAngle = angle + Math.PI / 5
          const innerX = fx + Math.cos(innerAngle) * fSize * 0.4
          const innerY = fy + Math.sin(innerAngle) * fSize * 0.4
          ctx.lineTo(innerX, innerY)
        }
        ctx.closePath(); ctx.fill()
      } else if (food.type === 'rainbow') {
        ctx.shadowColor = `hsl(${state.frameCount * 5 % 360},100%,60%)`
        ctx.shadowBlur = 12
        ctx.fillStyle = `hsl(${state.frameCount * 5 % 360},100%,60%)`
        ctx.beginPath(); ctx.arc(fx, fy, fSize, 0, Math.PI * 2); ctx.fill()
        // Rainbow ring
        ctx.strokeStyle = `hsl(${(state.frameCount * 5 + 120) % 360},100%,60%)`
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(fx, fy, fSize + 3, 0, Math.PI * 2); ctx.stroke()
      } else {
        ctx.shadowColor = t.food
        ctx.shadowBlur = 10
        ctx.fillStyle = t.food
        ctx.beginPath(); ctx.arc(fx, fy, fSize, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()
    }

    // Power-ups
    for (const pu of state.powerUps) {
      const pulse = Math.sin(state.frameCount * 0.12 + pu.pulsePhase) * 0.2 + 0.8
      const px = pu.pos.x * cs + cs / 2
      const py = pu.pos.y * cs + cs / 2
      ctx.save()
      ctx.shadowColor = POWERUP_COLORS[pu.type]
      ctx.shadowBlur = 15

      // Outer ring
      ctx.strokeStyle = POWERUP_COLORS[pu.type]
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(px, py, cs * 0.5 * pulse, 0, Math.PI * 2)
      ctx.stroke()

      // Icon
      ctx.shadowBlur = 0
      ctx.font = `${cs * 0.5}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(POWERUP_ICONS[pu.type], px, py + 1)
      ctx.restore()
    }

    // Snake
    const isGhost = state.activePowerUps.has('ghost')
    const isShield = state.activePowerUps.has('shield')
    for (let i = state.snake.length - 1; i >= 0; i--) {
      const seg = state.snake[i]
      const isHead = i === 0
      const progress = 1 - i / state.snake.length

      ctx.save()
      const alpha = isGhost ? 0.5 : 1
      const baseColor = isHead ? t.snakeHead : t.snake

      // Glow
      ctx.shadowColor = isShield ? '#44ffaa' : t.snakeGlow
      ctx.shadowBlur = isHead ? 20 : 8 + progress * 6

      // Body gradient
      const hex = baseColor
      const r2 = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)

      ctx.fillStyle = `rgba(${r2},${g},${b},${alpha})`

      const pad = isHead ? 1 : 2 + (1 - progress) * 2
      const radius = isHead ? cs * 0.15 : cs * 0.1

      // Rounded rect
      const rx = seg.x * cs + pad
      const ry = seg.y * cs + pad
      const rw = cs - pad * 2
      const rh = cs - pad * 2
      ctx.beginPath()
      ctx.moveTo(rx + radius, ry)
      ctx.lineTo(rx + rw - radius, ry)
      ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius)
      ctx.lineTo(rx + rw, ry + rh - radius)
      ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh)
      ctx.lineTo(rx + radius, ry + rh)
      ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius)
      ctx.lineTo(rx, ry + radius)
      ctx.quadraticCurveTo(rx, ry, rx + radius, ry)
      ctx.closePath()
      ctx.fill()

      // Eyes on head
      if (isHead) {
        ctx.shadowBlur = 0
        const ex = seg.x * cs + cs / 2
        const ey = seg.y * cs + cs / 2
        const eyeOffset = cs * 0.2
        const eyeSize = cs * 0.1

        let e1x = ex, e1y = ey, e2x = ex, e2y = ey
        if (state.dir.x === 1) { e1x += eyeOffset; e1y -= eyeOffset * 0.6; e2x += eyeOffset; e2y += eyeOffset * 0.6 }
        else if (state.dir.x === -1) { e1x -= eyeOffset; e1y -= eyeOffset * 0.6; e2x -= eyeOffset; e2y += eyeOffset * 0.6 }
        else if (state.dir.y === -1) { e1x -= eyeOffset * 0.6; e1y -= eyeOffset; e2x += eyeOffset * 0.6; e2y -= eyeOffset }
        else { e1x -= eyeOffset * 0.6; e1y += eyeOffset; e2x += eyeOffset * 0.6; e2y += eyeOffset }

        ctx.fillStyle = '#fff'
        ctx.beginPath(); ctx.arc(e1x, e1y, eyeSize, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(e2x, e2y, eyeSize, 0, Math.PI * 2); ctx.fill()

        ctx.fillStyle = '#000'
        const pupilOff = eyeSize * 0.3
        ctx.beginPath(); ctx.arc(e1x + state.dir.x * pupilOff, e1y + state.dir.y * pupilOff, eyeSize * 0.5, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(e2x + state.dir.x * pupilOff, e2y + state.dir.y * pupilOff, eyeSize * 0.5, 0, Math.PI * 2); ctx.fill()
      }

      // Shield aura
      if (isShield && isHead) {
        ctx.strokeStyle = 'rgba(68,255,170,0.5)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(seg.x * cs + cs / 2, seg.y * cs + cs / 2, cs * 0.7 + Math.sin(state.frameCount * 0.1) * 3, 0, Math.PI * 2)
        ctx.stroke()
      }

      ctx.restore()
    }

    // Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i]
      p.x += p.vx; p.y += p.vy
      p.vx *= 0.96; p.vy *= 0.96
      p.life--
      const alpha = p.life / p.maxLife
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.shadowColor = p.color
      ctx.shadowBlur = 8
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      if (p.life <= 0) state.particles.splice(i, 1)
    }

    // HUD: Combo indicator
    if (state.combo > 1) {
      ctx.save()
      const comboAlpha = Math.min(1, state.comboTimer / 30)
      ctx.globalAlpha = comboAlpha
      ctx.font = `bold ${20 + state.combo * 2}px 'Courier New', monospace`
      ctx.fillStyle = t.accent
      ctx.shadowColor = t.accent
      ctx.shadowBlur = 15
      ctx.textAlign = 'center'
      ctx.fillText(`${state.combo}x COMBO!`, canvas.width / 2, 40)
      ctx.restore()
    }

    // Active power-up indicators (top right)
    let puY = 10
    for (const [type, expiry] of state.activePowerUps) {
      const remaining = Math.max(0, (expiry - Date.now()) / POWERUP_DURATION)
      ctx.save()
      ctx.fillStyle = POWERUP_COLORS[type]
      ctx.globalAlpha = 0.9
      ctx.font = `${cs * 0.6}px serif`
      ctx.textAlign = 'right'
      ctx.fillText(POWERUP_ICONS[type], canvas.width - 15, puY + 20)
      // Progress bar
      ctx.fillStyle = POWERUP_COLORS[type]
      ctx.globalAlpha = 0.3
      ctx.fillRect(canvas.width - 70, puY + 8, 40, 8)
      ctx.globalAlpha = 0.9
      ctx.fillRect(canvas.width - 70, puY + 8, 40 * remaining, 8)
      ctx.restore()
      puY += 30
    }

    ctx.restore() // end screen shake

    animFrameRef.current = requestAnimationFrame(gameLoop)
  }, [cellSize])

  function handleDeath(state: typeof gameRef.current extends infer T ? NonNullable<T> : never) {
    if (state.soundOn) audio.die()
    state.screenShake = 15

    // Death particles
    const t = THEMES[state.theme]
    for (const seg of state.snake) {
      emitParticles(state, seg.x, seg.y, t.snake, 5, 4)
    }

    // Save high score
    saveHighScore(state.score, state.gameMode)
    setHighScores(loadHighScores())
    setGameState('gameover')
  }

  // ─── Input Handling ────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const state = gameRef.current
      if (!state) return

      if (e.key === 'Escape') {
        if (gameState === 'playing') setGameState('paused')
        else if (gameState === 'paused') setGameState('playing')
        return
      }
      if (gameState !== 'playing') return

      const { dir } = state
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W':
          if (dir.y !== 1) state.nextDir = { x: 0, y: -1 }; break
        case 'ArrowDown': case 's': case 'S':
          if (dir.y !== -1) state.nextDir = { x: 0, y: 1 }; break
        case 'ArrowLeft': case 'a': case 'A':
          if (dir.x !== 1) state.nextDir = { x: -1, y: 0 }; break
        case 'ArrowRight': case 'd': case 'D':
          if (dir.x !== -1) state.nextDir = { x: 1, y: 0 }; break
      }
      e.preventDefault()
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [gameState])

  // Touch / swipe controls
  useEffect(() => {
    let touchStart: Point | null = null
    const handleTouchStart = (e: TouchEvent) => {
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart || !gameRef.current || gameState !== 'playing') return
      const dx = e.changedTouches[0].clientX - touchStart.x
      const dy = e.changedTouches[0].clientY - touchStart.y
      const { dir } = gameRef.current
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 30 && dir.x !== -1) gameRef.current.nextDir = { x: 1, y: 0 }
        else if (dx < -30 && dir.x !== 1) gameRef.current.nextDir = { x: -1, y: 0 }
      } else {
        if (dy > 30 && dir.y !== -1) gameRef.current.nextDir = { x: 0, y: 1 }
        else if (dy < -30 && dir.y !== 1) gameRef.current.nextDir = { x: 0, y: -1 }
      }
      touchStart = null
    }
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [gameState])

  // Animation frame management
  useEffect(() => {
    if (gameState === 'playing') {
      animFrameRef.current = requestAnimationFrame(gameLoop)
    }
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [gameState, gameLoop])

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      if (!gameRef.current) return
      const cs2 = cellSize()
      gameRef.current.gridW = Math.floor(window.innerWidth / cs2)
      gameRef.current.gridH = Math.floor((window.innerHeight - 80) / cs2)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [cellSize])

  const themeColors = THEMES[theme]

  // ─── Menu Screen ───────────────────────────────────────────────────
  if (gameState === 'menu' || gameState === 'gameover') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4" style={{ background: themeColors.bg }}>
        {/* Animated background grid */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(${themeColors.grid} 1px, transparent 1px), linear-gradient(90deg, ${themeColors.grid} 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }} />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-6 max-w-lg w-full">
          {/* Title */}
          <div className="text-center">
            <h1 className="text-6xl font-bold mb-2 tracking-wider" style={{
              color: themeColors.text,
              textShadow: `0 0 20px ${themeColors.text}, 0 0 40px ${themeColors.text}40, 0 0 80px ${themeColors.text}20`,
              fontFamily: "'Courier New', monospace",
            }}>
              NEON SNAKE
            </h1>
            <p className="text-lg opacity-60" style={{ color: themeColors.text, fontFamily: "'Courier New', monospace" }}>
              // the ultimate serpent experience
            </p>
          </div>

          {gameState === 'gameover' && (
            <div className="text-center p-4 rounded-lg border" style={{
              borderColor: themeColors.accent + '60',
              background: themeColors.accent + '10',
            }}>
              <p className="text-3xl font-bold mb-1" style={{ color: themeColors.accent }}>GAME OVER</p>
              <p className="text-4xl font-bold" style={{ color: themeColors.text,
                textShadow: `0 0 10px ${themeColors.text}` }}>
                {score}
              </p>
              <p className="text-sm opacity-60 mt-1" style={{ color: themeColors.text }}>POINTS</p>
            </div>
          )}

          {/* Game Mode Selection */}
          <div className="w-full">
            <p className="text-sm opacity-60 mb-2 text-center" style={{ color: themeColors.text, fontFamily: "'Courier New', monospace" }}>
              SELECT MODE
            </p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'classic', name: 'CLASSIC', desc: 'Walls kill' },
                { id: 'zen', name: 'ZEN', desc: 'No walls' },
                { id: 'speed', name: 'SPEED RUSH', desc: 'Gets faster' },
                { id: 'portal', name: 'PORTAL', desc: 'Teleporters!' },
              ] as const).map(m => (
                <button key={m.id} onClick={() => setGameMode(m.id)}
                  className="p-3 rounded-lg border-2 transition-all duration-200 hover:scale-105"
                  style={{
                    borderColor: gameMode === m.id ? themeColors.text : themeColors.text + '30',
                    background: gameMode === m.id ? themeColors.text + '15' : 'transparent',
                    color: themeColors.text,
                    boxShadow: gameMode === m.id ? `0 0 15px ${themeColors.text}30` : 'none',
                    fontFamily: "'Courier New', monospace",
                  }}>
                  <div className="font-bold text-sm">{m.name}</div>
                  <div className="text-xs opacity-50">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Theme Selection */}
          <div className="w-full">
            <p className="text-sm opacity-60 mb-2 text-center" style={{ color: themeColors.text, fontFamily: "'Courier New', monospace" }}>
              THEME
            </p>
            <div className="flex gap-2 justify-center">
              {(['neon', 'retro', 'matrix', 'sunset'] as Theme[]).map(th => (
                <button key={th} onClick={() => setTheme(th)}
                  className="px-4 py-2 rounded-lg border-2 transition-all duration-200 hover:scale-105 uppercase text-sm font-bold"
                  style={{
                    borderColor: theme === th ? THEMES[th].text : THEMES[th].text + '40',
                    background: theme === th ? THEMES[th].text + '20' : THEMES[th].bg,
                    color: THEMES[th].text,
                    boxShadow: theme === th ? `0 0 15px ${THEMES[th].text}30, inset 0 0 15px ${THEMES[th].text}10` : 'none',
                    fontFamily: "'Courier New', monospace",
                  }}>
                  {th}
                </button>
              ))}
            </div>
          </div>

          {/* Sound toggle */}
          <button onClick={() => setSoundOn(!soundOn)}
            className="text-sm opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: themeColors.text, fontFamily: "'Courier New', monospace" }}>
            SOUND: {soundOn ? 'ON 🔊' : 'OFF 🔇'}
          </button>

          {/* Play Button */}
          <button onClick={initGame}
            className="px-12 py-4 rounded-xl text-2xl font-bold tracking-widest transition-all duration-300 hover:scale-110 active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${themeColors.text}20, ${themeColors.accent}20)`,
              border: `2px solid ${themeColors.text}`,
              color: themeColors.text,
              boxShadow: `0 0 30px ${themeColors.text}30, inset 0 0 30px ${themeColors.text}10`,
              fontFamily: "'Courier New', monospace",
            }}>
            {gameState === 'gameover' ? '↻ RETRY' : '▶ PLAY'}
          </button>

          {/* High Scores */}
          <button onClick={() => setShowScores(!showScores)}
            className="text-sm opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: themeColors.text, fontFamily: "'Courier New', monospace" }}>
            {showScores ? '▼ HIDE SCORES' : '▶ HIGH SCORES'}
          </button>
          {showScores && highScores.length > 0 && (
            <div className="w-full rounded-lg border p-3" style={{
              borderColor: themeColors.text + '30', background: themeColors.text + '05',
            }}>
              <table className="w-full text-sm" style={{ color: themeColors.text, fontFamily: "'Courier New', monospace" }}>
                <thead>
                  <tr className="opacity-50">
                    <th className="text-left py-1">#</th>
                    <th className="text-left py-1">SCORE</th>
                    <th className="text-left py-1">MODE</th>
                    <th className="text-right py-1">DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {highScores.slice(0, 5).map((hs, i) => (
                    <tr key={i} style={{ opacity: 1 - i * 0.15 }}>
                      <td className="py-1">{i + 1}</td>
                      <td className="py-1 font-bold">{hs.score}</td>
                      <td className="py-1 uppercase">{hs.mode}</td>
                      <td className="py-1 text-right">{hs.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Controls info */}
          <div className="text-center opacity-40 text-xs" style={{ color: themeColors.text, fontFamily: "'Courier New', monospace" }}>
            <p>ARROW KEYS / WASD to move • ESC to pause</p>
            <p>Swipe on mobile • Eat food, grab power-ups, survive!</p>
          </div>
        </div>
      </div>
    )
  }

  // ─── Paused Overlay ────────────────────────────────────────────────
  if (gameState === 'paused') {
    return (
      <div className="relative">
        <canvas ref={canvasRef} className="block" style={{ filter: 'blur(4px) brightness(0.5)' }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
          <h2 className="text-5xl font-bold tracking-widest" style={{
            color: themeColors.text,
            textShadow: `0 0 20px ${themeColors.text}`,
            fontFamily: "'Courier New', monospace",
          }}>
            PAUSED
          </h2>
          <div className="flex gap-4">
            <button onClick={() => setGameState('playing')}
              className="px-8 py-3 rounded-lg border-2 font-bold transition-all hover:scale-105"
              style={{ borderColor: themeColors.text, color: themeColors.text, fontFamily: "'Courier New', monospace" }}>
              RESUME
            </button>
            <button onClick={() => setGameState('menu')}
              className="px-8 py-3 rounded-lg border-2 font-bold transition-all hover:scale-105"
              style={{ borderColor: themeColors.accent, color: themeColors.accent, fontFamily: "'Courier New', monospace" }}>
              MENU
            </button>
          </div>
        </div>
        {/* Score bar */}
        <div className="absolute bottom-0 left-0 right-0 h-16 flex items-center justify-between px-6"
          style={{ background: themeColors.bg + 'ee' }}>
          <div style={{ color: themeColors.text, fontFamily: "'Courier New', monospace" }}>
            <span className="text-sm opacity-60">SCORE </span>
            <span className="text-2xl font-bold">{score}</span>
          </div>
          <div style={{ color: themeColors.text, fontFamily: "'Courier New', monospace" }} className="uppercase text-sm opacity-60">
            {gameMode} • {theme}
          </div>
        </div>
      </div>
    )
  }

  // ─── Playing Screen ────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen" style={{ background: themeColors.bg }}>
      <canvas ref={canvasRef} className="block flex-1" />
      {/* Bottom HUD bar */}
      <div className="h-16 flex items-center justify-between px-4 shrink-0"
        style={{ background: themeColors.bg, borderTop: `1px solid ${themeColors.text}20` }}>
        <div style={{ color: themeColors.text, fontFamily: "'Courier New', monospace" }}>
          <span className="text-sm opacity-60">SCORE </span>
          <span className="text-2xl font-bold" style={{ textShadow: `0 0 10px ${themeColors.text}60` }}>{score}</span>
        </div>
        <div className="flex items-center gap-4">
          <div style={{ color: themeColors.text, fontFamily: "'Courier New', monospace" }} className="uppercase text-xs opacity-40">
            {gameMode}
          </div>
          <button onClick={() => setGameState('paused')}
            className="px-3 py-1 rounded border text-xs transition-all hover:scale-105"
            style={{ borderColor: themeColors.text + '40', color: themeColors.text, fontFamily: "'Courier New', monospace" }}>
            ESC
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
