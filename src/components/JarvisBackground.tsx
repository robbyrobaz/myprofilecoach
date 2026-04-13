'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, useMemo, Suspense } from 'react'
import { useJarvis } from './JarvisContext'

// --- Phase labels ---
const PHASES = [
  'Initializing Neural Parser',
  'Extracting Career Topology',
  'Mapping Semantic Role Graph',
  'Scanning Recruiter Signal Matrix',
  'Analyzing Keyword Density',
  'Cross-Referencing Industry Patterns',
  'Computing AI Visibility Index',
  'Evaluating Impact Vectors',
  'Calibrating Score Model',
  'Synthesizing Intelligence Report',
]

// --- HUD Overlay (pure CSS, no Three.js) ---
function HUDOverlay({ title, subtitle, expectedDuration }: {
  title: string; subtitle?: string; expectedDuration: number
}) {
  const [phase, setPhase] = useState(0)
  const [progress, setProgress] = useState(0)
  const [stats, setStats] = useState({ nodes: 0, edges: 0, patterns: 0 })

  useEffect(() => {
    let elapsed = 0
    const interval = setInterval(() => {
      elapsed += 80
      const raw = elapsed / expectedDuration
      const eased = 1 - Math.pow(1 - Math.min(raw, 1), 2.5)
      setProgress(eased * 99)

      const phaseDur = expectedDuration / PHASES.length
      setPhase(Math.min(Math.floor(elapsed / phaseDur), PHASES.length - 1))

      setStats({
        nodes: Math.min(Math.floor(elapsed / 50), 1847),
        edges: Math.min(Math.floor(elapsed / 28), 5291),
        patterns: Math.min(Math.floor(elapsed / 180), 412),
      })
    }, 80)
    return () => clearInterval(interval)
  }, [expectedDuration])

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center px-4 pointer-events-none">
      <div className="absolute inset-0 bg-[#050510]/60" />

      <div className="relative z-10 flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-xs text-cyan-300 mb-6 backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          PROFILE INTELLIGENCE ENGINE
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold text-white text-center mb-2 drop-shadow-[0_0_30px_rgba(6,182,212,0.3)]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-base sm:text-lg text-cyan-300/70 text-center mb-2">{subtitle}</p>
        )}

        <p className="text-sm text-cyan-400/60 mt-3 mb-10 h-5 font-mono tracking-wider">
          {PHASES[phase]}
        </p>

        <div className="flex gap-8 sm:gap-14 mb-10">
          {[
            { label: 'Nodes Scanned', value: stats.nodes.toLocaleString() },
            { label: 'Edges Traced', value: stats.edges.toLocaleString() },
            { label: 'Patterns Found', value: stats.patterns.toLocaleString() },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl sm:text-3xl font-mono font-bold text-cyan-400 tabular-nums drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]">
                {s.value}
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="w-full max-w-sm">
          <div className="h-[3px] rounded-full bg-slate-800/80 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #06b6d4, #0ea5e9, #22d3ee)',
                boxShadow: '0 0 12px rgba(6, 182, 212, 0.6)',
              }}
            />
          </div>
          <p className="text-xs text-slate-600 text-center mt-2 font-mono tabular-nums">{Math.round(progress)}%</p>
        </div>
      </div>

      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
    </div>
  )
}

// Lazy-load the heavy Three.js canvas — page renders instantly without it
const LazyCanvas = dynamic(() => import('./JarvisCanvas'), { ssr: false })

// --- Main exported component ---
export default function JarvisBackground() {
  const { state } = useJarvis()

  return (
    <>
      {/* 3D canvas loads async — page is usable immediately */}
      <div className="fixed inset-0 [&_*]:!pointer-events-none" style={{ zIndex: 0, pointerEvents: 'none' }}>
        <LazyCanvas mode={state.mode} />
      </div>

      {/* Soft vignette */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-1000"
        style={{
          zIndex: 1,
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(5,5,16,0.7) 100%)',
          opacity: state.mode === 'active' ? 0.3 : 0.85,
        }}
      />

      {/* HUD overlay when active */}
      {state.mode === 'active' && (
        <HUDOverlay
          title={state.title}
          subtitle={state.subtitle}
          expectedDuration={state.expectedDuration}
        />
      )}
    </>
  )
}
