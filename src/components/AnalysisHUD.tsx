'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

// --- Types ---
interface Node {
  x: number; y: number; vx: number; vy: number
  radius: number; label: string; group: number; active: boolean; pulsePhase: number
}
interface Edge { from: number; to: number; progress: number; active: boolean }

// --- Analysis steps with fancy names ---
const ANALYSIS_STEPS = [
  { label: 'Initializing Neural Parser', duration: 2000 },
  { label: 'Extracting Career Topology', duration: 3000 },
  { label: 'Mapping Semantic Role Graph', duration: 4000 },
  { label: 'Cross-Referencing Recruiter Signals', duration: 3000 },
  { label: 'Analyzing Keyword Density Matrix', duration: 3500 },
  { label: 'Computing AI Visibility Score', duration: 3000 },
  { label: 'Generating Impact Assessment', duration: 4000 },
  { label: 'Finalizing Profile Intelligence', duration: 5000 },
]

// --- Node labels for the spatial graph ---
const NODE_LABELS = [
  'Headline', 'Experience', 'Skills', 'Keywords', 'AI Signals',
  'Education', 'Impact Score', 'Role Match', 'Recruiter Index',
  'Semantic Map', 'Career Arc', 'Industry Fit', 'Leadership',
  'Technical Depth', 'Network Effect', 'Growth Vector',
]

export default function AnalysisHUD({ targetRole }: { targetRole: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const [currentStep, setCurrentStep] = useState(0)
  const [stepProgress, setStepProgress] = useState(0)
  const [overallProgress, setOverallProgress] = useState(0)
  const [stats, setStats] = useState({ nodesScanned: 0, edgesTraced: 0, patternsFound: 0 })
  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])
  const timeRef = useRef(0)

  // Initialize nodes
  useEffect(() => {
    const nodes: Node[] = NODE_LABELS.map((label, i) => ({
      x: 0.15 + Math.random() * 0.7,
      y: 0.15 + Math.random() * 0.7,
      vx: (Math.random() - 0.5) * 0.0003,
      vy: (Math.random() - 0.5) * 0.0003,
      radius: 3 + Math.random() * 4,
      label,
      group: i % 4,
      active: false,
      pulsePhase: Math.random() * Math.PI * 2,
    }))
    nodesRef.current = nodes

    // Create edges between nearby/related nodes
    const edges: Edge[] = []
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x
        const dy = nodes[i].y - nodes[j].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 0.35 || (nodes[i].group === nodes[j].group && dist < 0.5)) {
          edges.push({ from: i, to: j, progress: 0, active: false })
        }
      }
    }
    edgesRef.current = edges
  }, [])

  // Step progression
  useEffect(() => {
    const totalDuration = ANALYSIS_STEPS.reduce((s, st) => s + st.duration, 0)
    let elapsed = 0
    const interval = setInterval(() => {
      elapsed += 50
      // Overall progress (loops slowly if API is slow)
      setOverallProgress(Math.min((elapsed / totalDuration) * 95, 95))

      // Step progress
      let cumulative = 0
      for (let i = 0; i < ANALYSIS_STEPS.length; i++) {
        cumulative += ANALYSIS_STEPS[i].duration
        if (elapsed < cumulative) {
          setCurrentStep(i)
          const stepStart = cumulative - ANALYSIS_STEPS[i].duration
          setStepProgress(((elapsed - stepStart) / ANALYSIS_STEPS[i].duration) * 100)
          break
        }
      }
      if (elapsed >= totalDuration) {
        setCurrentStep(ANALYSIS_STEPS.length - 1)
        setStepProgress(100)
      }

      // Animate stats
      setStats({
        nodesScanned: Math.min(Math.floor(elapsed / 80), 847),
        edgesTraced: Math.min(Math.floor(elapsed / 120), 2341),
        patternsFound: Math.min(Math.floor(elapsed / 400), 156),
      })

      // Activate random nodes/edges
      const nodes = nodesRef.current
      const edges = edgesRef.current
      if (Math.random() < 0.1) {
        const idx = Math.floor(Math.random() * nodes.length)
        nodes[idx].active = true
        setTimeout(() => { nodes[idx].active = false }, 800)
      }
      if (Math.random() < 0.08) {
        const idx = Math.floor(Math.random() * edges.length)
        edges[idx].active = true
        edges[idx].progress = 0
        setTimeout(() => { edges[idx].active = false }, 1200)
      }
    }, 50)

    return () => clearInterval(interval)
  }, [])

  // Canvas animation
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
    const W = rect.width
    const H = rect.height

    ctx.clearRect(0, 0, W, H)
    timeRef.current += 0.016

    const nodes = nodesRef.current
    const edges = edgesRef.current
    const t = timeRef.current

    // Update node positions (gentle drift)
    for (const node of nodes) {
      node.x += node.vx
      node.y += node.vy
      if (node.x < 0.05 || node.x > 0.95) node.vx *= -1
      if (node.y < 0.05 || node.y > 0.95) node.vy *= -1
    }

    // Draw edges
    for (const edge of edges) {
      const a = nodes[edge.from]
      const b = nodes[edge.to]
      const ax = a.x * W, ay = a.y * H
      const bx = b.x * W, by = b.y * H

      if (edge.active) {
        edge.progress = Math.min(edge.progress + 0.02, 1)
        const grd = ctx.createLinearGradient(ax, ay, bx, by)
        grd.addColorStop(0, 'rgba(99, 102, 241, 0.8)')
        grd.addColorStop(edge.progress, 'rgba(99, 102, 241, 0.8)')
        grd.addColorStop(Math.min(edge.progress + 0.01, 1), 'rgba(99, 102, 241, 0)')
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)
        ctx.strokeStyle = grd
        ctx.lineWidth = 1.5
        ctx.stroke()
      } else {
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.07)'
        ctx.lineWidth = 0.5
        ctx.stroke()
      }
    }

    // Draw nodes
    for (const node of nodes) {
      const nx = node.x * W
      const ny = node.y * H
      const pulse = Math.sin(t * 2 + node.pulsePhase) * 0.5 + 0.5

      // Outer glow when active
      if (node.active) {
        const glow = ctx.createRadialGradient(nx, ny, 0, nx, ny, node.radius * 6)
        glow.addColorStop(0, 'rgba(129, 140, 248, 0.3)')
        glow.addColorStop(1, 'rgba(129, 140, 248, 0)')
        ctx.beginPath()
        ctx.arc(nx, ny, node.radius * 6, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()
      }

      // Node dot
      ctx.beginPath()
      ctx.arc(nx, ny, node.radius * (node.active ? 1.5 : 0.8 + pulse * 0.2), 0, Math.PI * 2)
      const alpha = node.active ? 0.9 : 0.2 + pulse * 0.15
      ctx.fillStyle = `rgba(129, 140, 248, ${alpha})`
      ctx.fill()

      // Label
      if (node.active || pulse > 0.7) {
        ctx.font = '10px system-ui, sans-serif'
        ctx.fillStyle = `rgba(203, 213, 225, ${node.active ? 0.9 : 0.3})`
        ctx.textAlign = 'center'
        ctx.fillText(node.label, nx, ny - node.radius * 2 - 4)
      }
    }

    // Scanning line effect
    const scanY = ((t * 30) % H)
    const scanGrad = ctx.createLinearGradient(0, scanY - 2, 0, scanY + 2)
    scanGrad.addColorStop(0, 'rgba(99, 102, 241, 0)')
    scanGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.06)')
    scanGrad.addColorStop(1, 'rgba(99, 102, 241, 0)')
    ctx.fillStyle = scanGrad
    ctx.fillRect(0, scanY - 30, W, 60)

    animFrameRef.current = requestAnimationFrame(draw)
  }, [])

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [draw])

  const completedSteps = ANALYSIS_STEPS.slice(0, currentStep)
  const currentStepData = ANALYSIS_STEPS[currentStep]
  const upcomingSteps = ANALYSIS_STEPS.slice(currentStep + 1, currentStep + 3)

  return (
    <div className="fixed inset-0 z-40 bg-slate-950 flex flex-col">
      {/* Canvas background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.6 }}
      />

      {/* Vignette overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(2,6,23,0.8)_100%)]" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-xs text-indigo-300 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            PROFILE ANALYSIS IN PROGRESS
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Analyzing for <span className="text-indigo-400">{targetRole}</span>
          </h2>
        </div>

        {/* Central HUD panel */}
        <div className="w-full max-w-lg space-y-6">
          {/* Current step */}
          <div className="rounded-xl border border-indigo-500/20 bg-slate-900/80 backdrop-blur-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative w-8 h-8 flex items-center justify-center">
                <svg className="absolute inset-0 w-8 h-8 animate-spin" style={{ animationDuration: '3s' }} viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="14" stroke="rgba(99,102,241,0.2)" strokeWidth="2" />
                  <path d="M16 2 A14 14 0 0 1 30 16" stroke="rgb(99,102,241)" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="text-xs font-bold text-indigo-400">{currentStep + 1}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{currentStepData?.label}</p>
                <div className="mt-1.5 h-1 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
                    style={{ width: `${stepProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Completed steps */}
            <div className="space-y-1 mt-3">
              {completedSteps.map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                  <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  <span>{step.label}</span>
                </div>
              ))}
            </div>

            {/* Upcoming steps */}
            {upcomingSteps.length > 0 && (
              <div className="mt-2 space-y-1">
                {upcomingSteps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                    <div className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
                      <div className="w-1 h-1 rounded-full bg-slate-600" />
                    </div>
                    <span>{step.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Nodes Scanned', value: stats.nodesScanned },
              { label: 'Edges Traced', value: stats.edgesTraced.toLocaleString() },
              { label: 'Patterns Found', value: stats.patternsFound },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-slate-700/50 bg-slate-900/60 backdrop-blur-sm p-3 text-center">
                <p className="text-lg font-mono font-bold text-indigo-400 tabular-nums">{stat.value}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Overall progress bar */}
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>Overall Analysis</span>
              <span className="font-mono tabular-nums">{Math.round(overallProgress)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-violet-500 to-purple-500 transition-all duration-300 relative"
                style={{ width: `${overallProgress}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom edge glow */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

      {/* Shimmer animation style */}
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
