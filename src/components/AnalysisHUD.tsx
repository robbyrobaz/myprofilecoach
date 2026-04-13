'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

const PHASES = [
  'Initializing Neural Parser',
  'Extracting Career Topology',
  'Mapping Semantic Role Graph',
  'Scanning Recruiter Signal Matrix',
  'Analyzing Keyword Density',
  'Cross-Referencing Industry Patterns',
  'Computing AI Visibility Index',
  'Evaluating Impact Vectors',
  'Building Score Model',
  'Finalizing Intelligence Report',
]

const NODE_LABELS = [
  'Headline', 'Experience', 'Skills', 'Keywords', 'AI Signals',
  'Education', 'Impact', 'Role Match', 'Recruiter Index', 'Semantic Map',
  'Career Arc', 'Industry Fit', 'Leadership', 'Tech Depth', 'Network',
  'Growth', 'Revenue', 'Strategy', 'Credentials', 'Visibility',
]

interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number }

export default function AnalysisHUD({ targetRole }: { targetRole: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef(0)
  const tRef = useRef(0)
  const [phase, setPhase] = useState(0)
  const [progress, setProgress] = useState(0)
  const [stats, setStats] = useState({ nodes: 0, edges: 0, patterns: 0 })

  // Nodes state stored in ref for canvas perf
  const nodesRef = useRef(NODE_LABELS.map((label, i) => {
    const angle = (i / NODE_LABELS.length) * Math.PI * 2
    const r = 0.25 + Math.random() * 0.15
    return {
      x: 0.5 + Math.cos(angle) * r,
      y: 0.5 + Math.sin(angle) * r,
      vx: (Math.random() - 0.5) * 0.0004,
      vy: (Math.random() - 0.5) * 0.0004,
      radius: 2.5 + Math.random() * 2,
      label,
      active: false,
      activeTimer: 0,
    }
  }))

  const edgesRef = useRef<{ a: number; b: number; glow: number }[]>([])
  const particlesRef = useRef<Particle[]>([])

  // Build edges
  useEffect(() => {
    const nodes = nodesRef.current
    const edges: { a: number; b: number; glow: number }[] = []
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x
        const dy = nodes[i].y - nodes[j].y
        if (Math.sqrt(dx * dx + dy * dy) < 0.3) {
          edges.push({ a: i, b: j, glow: 0 })
        }
      }
    }
    edgesRef.current = edges
  }, [])

  // Phase & stats progression
  useEffect(() => {
    let elapsed = 0
    const interval = setInterval(() => {
      elapsed += 60
      const phaseDur = 3200
      const p = Math.min(Math.floor(elapsed / phaseDur), PHASES.length - 1)
      setPhase(p)
      setProgress(Math.min((elapsed / (PHASES.length * phaseDur)) * 96, 96))
      setStats({
        nodes: Math.min(Math.floor(elapsed / 60), 1247),
        edges: Math.min(Math.floor(elapsed / 35), 3891),
        patterns: Math.min(Math.floor(elapsed / 250), 284),
      })

      // Randomly activate nodes
      const nodes = nodesRef.current
      if (Math.random() < 0.15) {
        const idx = Math.floor(Math.random() * nodes.length)
        nodes[idx].active = true
        nodes[idx].activeTimer = 60
      }
      // Randomly glow edges
      const edges = edgesRef.current
      if (Math.random() < 0.12 && edges.length > 0) {
        const idx = Math.floor(Math.random() * edges.length)
        edges[idx].glow = 1
      }
      // Spawn particles along a random active edge
      if (Math.random() < 0.2 && edges.length > 0) {
        const e = edges[Math.floor(Math.random() * edges.length)]
        const a = nodes[e.a], b = nodes[e.b]
        particlesRef.current.push({
          x: a.x, y: a.y,
          vx: (b.x - a.x) * 0.015,
          vy: (b.y - a.y) * 0.015,
          life: 0, maxLife: 70,
        })
      }
    }, 60)
    return () => clearInterval(interval)
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    const W = rect.width, H = rect.height
    ctx.clearRect(0, 0, W, H)
    tRef.current += 0.016

    const t = tRef.current
    const nodes = nodesRef.current
    const edges = edgesRef.current
    const particles = particlesRef.current

    // Move nodes gently
    for (const n of nodes) {
      n.x += n.vx + Math.sin(t * 0.7 + n.x * 10) * 0.00008
      n.y += n.vy + Math.cos(t * 0.6 + n.y * 10) * 0.00008
      if (n.x < 0.08 || n.x > 0.92) n.vx *= -1
      if (n.y < 0.08 || n.y > 0.92) n.vy *= -1
      if (n.activeTimer > 0) n.activeTimer--
      if (n.activeTimer <= 0) n.active = false
    }

    // Draw edges
    for (const e of edges) {
      const a = nodes[e.a], b = nodes[e.b]
      const ax = a.x * W, ay = a.y * H, bx = b.x * W, by = b.y * H
      e.glow = Math.max(0, e.glow - 0.012)

      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
      if (e.glow > 0) {
        ctx.strokeStyle = `rgba(129, 140, 248, ${0.15 + e.glow * 0.6})`
        ctx.lineWidth = 0.8 + e.glow * 1.5
      } else {
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.06)'
        ctx.lineWidth = 0.5
      }
      ctx.stroke()
    }

    // Draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.x += p.vx
      p.y += p.vy
      p.life++
      if (p.life > p.maxLife) { particles.splice(i, 1); continue }
      const alpha = 1 - p.life / p.maxLife
      ctx.beginPath()
      ctx.arc(p.x * W, p.y * H, 2, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(167, 139, 250, ${alpha * 0.8})`
      ctx.fill()
    }

    // Draw nodes
    for (const n of nodes) {
      const nx = n.x * W, ny = n.y * H
      const pulse = Math.sin(t * 2 + nx * 0.01) * 0.5 + 0.5

      if (n.active) {
        // Outer ring pulse
        const ringR = n.radius * 5 + Math.sin(t * 4) * 3
        ctx.beginPath()
        ctx.arc(nx, ny, ringR, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(129, 140, 248, ${0.3 * (n.activeTimer / 60)})`
        ctx.lineWidth = 1
        ctx.stroke()

        // Glow
        const glow = ctx.createRadialGradient(nx, ny, 0, nx, ny, n.radius * 8)
        glow.addColorStop(0, `rgba(129, 140, 248, ${0.25 * (n.activeTimer / 60)})`)
        glow.addColorStop(1, 'rgba(129, 140, 248, 0)')
        ctx.beginPath()
        ctx.arc(nx, ny, n.radius * 8, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()
      }

      // Dot
      const r = n.active ? n.radius * 1.6 : n.radius * (0.7 + pulse * 0.3)
      const alpha = n.active ? 0.9 : 0.15 + pulse * 0.1
      ctx.beginPath()
      ctx.arc(nx, ny, r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(129, 140, 248, ${alpha})`
      ctx.fill()

      // Label — always show for active, dim for others
      const labelAlpha = n.active ? 0.95 : 0.12 + pulse * 0.08
      ctx.font = `${n.active ? '11' : '9'}px system-ui, -apple-system, sans-serif`
      ctx.fillStyle = `rgba(203, 213, 225, ${labelAlpha})`
      ctx.textAlign = 'center'
      ctx.fillText(n.label, nx, ny - n.radius * 2.5 - 4)
    }

    // Horizontal scan line
    const scanY = (t * 25) % H
    const sg = ctx.createLinearGradient(0, scanY - 1, 0, scanY + 1)
    sg.addColorStop(0, 'rgba(99, 102, 241, 0)')
    sg.addColorStop(0.5, 'rgba(99, 102, 241, 0.04)')
    sg.addColorStop(1, 'rgba(99, 102, 241, 0)')
    ctx.fillStyle = sg
    ctx.fillRect(0, scanY - 40, W, 80)

    frameRef.current = requestAnimationFrame(draw)
  }, [])

  useEffect(() => {
    frameRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frameRef.current)
  }, [draw])

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col relative overflow-hidden">
      {/* Full-screen canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(2,6,23,0.85)_100%)]" />

      {/* Top edge line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />

      {/* Content overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-4">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-xs text-indigo-300 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          PROFILE INTELLIGENCE ENGINE
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-bold text-white text-center mb-2">
          Analyzing for{' '}
          <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            {targetRole}
          </span>
        </h1>

        {/* Current phase */}
        <p className="text-sm text-slate-400 mt-3 mb-10 h-5 transition-opacity duration-500">
          {PHASES[phase]}
        </p>

        {/* Stats row */}
        <div className="flex gap-8 sm:gap-12 mb-10">
          {[
            { label: 'Nodes Scanned', value: stats.nodes.toLocaleString() },
            { label: 'Edges Traced', value: stats.edges.toLocaleString() },
            { label: 'Patterns Found', value: stats.patterns.toLocaleString() },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl sm:text-3xl font-mono font-bold text-indigo-400 tabular-nums">{s.value}</p>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-md">
          <div className="h-1 rounded-full bg-slate-800/80 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-violet-500 to-purple-500 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-600 text-center mt-2 font-mono tabular-nums">{Math.round(progress)}%</p>
        </div>
      </div>

      {/* Bottom edge line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
    </div>
  )
}
