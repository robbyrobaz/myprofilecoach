'use client'

import { useEffect, useRef, useState, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

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

// --- Node labels assigned to the first N nodes ---
const NODE_LABELS = [
  'Experience',
  'Hidden Wins',
  'Leadership Scope',
  'Impact Metrics',
  'AI Signals',
  'Skills',
  'Achievements',
  'Career Trajectory',
  'Headline',
  'About Section',
  'Keyword Density',
  'Recruiter Search',
  'Role Bullets',
  'Quantified Results',
  'Industry Alignment',
  'ATS Optimization',
  'Profile Visibility',
  'Endorsements',
  'Job Titles',
  'Revenue Impact',
  'Team Leadership',
  'Certifications',
  'Publications',
  'Cross-Functional',
  'Growth Metrics',
  'Strategic Vision',
  'Stakeholders',
  'Technical Stack',
  'Promotions',
  'Recommendations',
]

// --- Floating label that tracks a node position ---
function NodeLabel({ nodeData, index, label }: { nodeData: THREE.Vector3[]; index: number; label: string }) {
  const ref = useRef<THREE.Group>(null)

  useFrame(() => {
    if (ref.current && nodeData[index]) {
      ref.current.position.copy(nodeData[index])
    }
  })

  return (
    <group ref={ref}>
      <Html
        center
        distanceFactor={8}
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <div
          style={{
            fontSize: '9px',
            fontFamily: 'ui-monospace, monospace',
            fontWeight: 500,
            color: 'rgba(103, 232, 249, 0.7)',
            textShadow: '0 0 8px rgba(34, 211, 238, 0.5), 0 0 20px rgba(99, 102, 241, 0.3)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            transform: 'translateY(-14px)',
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  )
}

// --- 3D Node Network ---
function NodeNetwork() {
  const groupRef = useRef<THREE.Group>(null)
  const linesRef = useRef<THREE.LineSegments>(null)
  const nodesRef = useRef<THREE.InstancedMesh>(null)
  const particlesRef = useRef<THREE.Points>(null)

  const COUNT = 80
  const PARTICLE_COUNT = 250

  // Generate node positions — labeled nodes get slightly more central placement
  const nodeData = useMemo(() => {
    const positions: THREE.Vector3[] = []
    for (let i = 0; i < COUNT; i++) {
      const phi = Math.acos(2 * Math.random() - 1)
      const theta = Math.random() * Math.PI * 2
      // Labeled nodes stay in the mid-range for visibility
      const r = i < NODE_LABELS.length
        ? 2.0 + Math.random() * 1.2
        : 1.5 + Math.random() * 2.5
      positions.push(new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      ))
    }
    return positions
  }, [])

  // Velocity for each node
  const velocities = useMemo(() =>
    nodeData.map(() => new THREE.Vector3(
      (Math.random() - 0.5) * 0.002,
      (Math.random() - 0.5) * 0.002,
      (Math.random() - 0.5) * 0.002,
    )), [nodeData])

  // Particle positions
  const particlePositions = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const phi = Math.acos(2 * Math.random() - 1)
      const theta = Math.random() * Math.PI * 2
      const r = 1 + Math.random() * 5
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      arr[i * 3 + 2] = r * Math.cos(phi)
    }
    return arr
  }, [])

  // Build edge pairs (connect nearby nodes — increased threshold for denser mesh)
  const edgePairs = useMemo(() => {
    const pairs: [number, number][] = []
    for (let i = 0; i < COUNT; i++) {
      for (let j = i + 1; j < COUNT; j++) {
        if (nodeData[i].distanceTo(nodeData[j]) < 3.2) {
          pairs.push([i, j])
        }
      }
    }
    return pairs
  }, [nodeData])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()

    // Rotate the whole group slowly
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.06
      groupRef.current.rotation.x = Math.sin(t * 0.04) * 0.08
    }

    // Move nodes
    for (let i = 0; i < COUNT; i++) {
      const p = nodeData[i]
      const v = velocities[i]
      p.add(v)
      const dist = p.length()
      if (dist > 4.5) {
        v.multiplyScalar(-1)
        p.normalize().multiplyScalar(4.4)
      }
      if (dist < 0.8) {
        v.multiplyScalar(-1)
        p.normalize().multiplyScalar(0.9)
      }
    }

    // Update instanced mesh (nodes — small glowing dots)
    if (nodesRef.current) {
      for (let i = 0; i < COUNT; i++) {
        const pulse = 0.8 + Math.sin(t * 2.5 + i * 0.7) * 0.4
        // Labeled nodes slightly larger
        const baseScale = i < NODE_LABELS.length ? 0.05 : 0.03
        const scale = baseScale + pulse * 0.015
        dummy.position.copy(nodeData[i])
        dummy.scale.setScalar(scale)
        dummy.updateMatrix()
        nodesRef.current.setMatrixAt(i, dummy.matrix)

        const color = new THREE.Color()
        if (i < NODE_LABELS.length) {
          // Labeled nodes: brighter white-cyan
          color.setHSL(0.52 + Math.sin(t * 1.5 + i) * 0.03, 0.6, 0.7 + pulse * 0.15)
        } else {
          // Regular nodes: cyan to electric blue
          color.setHSL(0.55 + Math.sin(t * 2 + i) * 0.05, 0.9, 0.45 + pulse * 0.2)
        }
        nodesRef.current.setColorAt(i, color)
      }
      nodesRef.current.instanceMatrix.needsUpdate = true
      if (nodesRef.current.instanceColor) nodesRef.current.instanceColor.needsUpdate = true
    }

    // Update line positions (thin stretching connections)
    if (linesRef.current) {
      const posAttr = linesRef.current.geometry.getAttribute('position') as THREE.BufferAttribute
      const colorAttr = linesRef.current.geometry.getAttribute('color') as THREE.BufferAttribute

      for (let e = 0; e < edgePairs.length; e++) {
        const [i, j] = edgePairs[e]
        const a = nodeData[i], b = nodeData[j]
        posAttr.setXYZ(e * 2, a.x, a.y, a.z)
        posAttr.setXYZ(e * 2 + 1, b.x, b.y, b.z)

        // Energy pulse — fast traveling wave along edges
        const wave1 = Math.sin(t * 6 + e * 0.5) * 0.5 + 0.5
        const wave2 = Math.sin(t * 4.5 + e * 0.3 + 1.5) * 0.5 + 0.5
        const pulse = Math.max(wave1, wave2)
        const dist = a.distanceTo(b)
        const base = Math.max(0, 1 - dist / 3.2)
        const brightness = base * (0.15 + pulse * 0.35)
        // Connections to labeled nodes glow brighter
        const boost = (i < NODE_LABELS.length || j < NODE_LABELS.length) ? 1.6 : 1.0
        // Vary color per-vertex for traveling light effect
        const shift = Math.sin(t * 8 + e * 0.7) * 0.5 + 0.5
        colorAttr.setXYZ(e * 2,
          (0.1 + shift * 0.15) * brightness * boost,
          (0.5 + shift * 0.2) * brightness * boost,
          brightness * boost,
        )
        colorAttr.setXYZ(e * 2 + 1,
          (0.15 + (1 - shift) * 0.1) * brightness * boost,
          (0.6 + (1 - shift) * 0.15) * brightness * boost,
          brightness * 0.9 * boost,
        )
      }
      posAttr.needsUpdate = true
      colorAttr.needsUpdate = true
    }

    // Animate particles
    if (particlesRef.current) {
      const posAttr = particlesRef.current.geometry.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const x = posAttr.getX(i)
        const y = posAttr.getY(i)
        const z = posAttr.getZ(i)
        const angle = 0.0015
        const cos = Math.cos(angle), sin = Math.sin(angle)
        posAttr.setXYZ(i,
          x * cos - z * sin,
          y + Math.sin(t * 0.4 + i) * 0.0015,
          x * sin + z * cos,
        )
      }
      posAttr.needsUpdate = true
    }
  })

  const linePositions = useMemo(() => new Float32Array(edgePairs.length * 6), [edgePairs])
  const lineColors = useMemo(() => new Float32Array(edgePairs.length * 6), [edgePairs])

  return (
    <group ref={groupRef}>
      {/* Edges — thin stretching lines forming the nest */}
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} count={edgePairs.length * 2} />
          <bufferAttribute attach="attributes-color" args={[lineColors, 3]} count={edgePairs.length * 2} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.8} blending={THREE.AdditiveBlending} />
      </lineSegments>

      {/* Nodes — small glowing spheres */}
      <instancedMesh ref={nodesRef} args={[undefined, undefined, COUNT]}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial transparent opacity={0.9} blending={THREE.AdditiveBlending} />
      </instancedMesh>

      {/* Floating particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} count={PARTICLE_COUNT} />
        </bufferGeometry>
        <pointsMaterial size={0.02} color="#4fc3f7" transparent opacity={0.35} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>

      {/* Node labels */}
      {NODE_LABELS.map((label, i) => (
        <NodeLabel key={label} nodeData={nodeData} index={i} label={label} />
      ))}
    </group>
  )
}

// --- Ambient background (muted 3D mesh behind all pages) ---
export function AmbientBackground() {
  return (
    <div className="fixed inset-0 opacity-15 pointer-events-none" style={{ zIndex: -1 }}>
      <Suspense fallback={null}>
        <Canvas
          camera={{ position: [0, 0, 10], fov: 55 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: 'transparent', pointerEvents: 'none' }}
        >
          <fog attach="fog" args={['#0a0a0f', 8, 18]} />
          <NodeNetwork />
        </Canvas>
      </Suspense>
    </div>
  )
}

// --- Shared full-screen HUD content ---
function HUDOverlay({ title, subtitle, expectedDuration }: { title: string; subtitle?: string; expectedDuration: number }) {
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
    <div className="min-h-screen bg-[#020617] flex flex-col relative overflow-hidden">
      {/* 3D Canvas — full screen, full intensity */}
      <div className="absolute inset-0">
        <Suspense fallback={null}>
          <Canvas
            camera={{ position: [0, 0, 8], fov: 55 }}
            gl={{ antialias: true, alpha: true }}
            style={{ background: '#020617' }}
          >
            <fog attach="fog" args={['#020617', 6, 16]} />
            <NodeNetwork />
          </Canvas>
        </Suspense>
      </div>

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(2,6,23,0.9)_100%)] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-4 pointer-events-none">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-xs text-cyan-300 mb-6 backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          PROFILE INTELLIGENCE ENGINE
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold text-white text-center mb-2 drop-shadow-[0_0_30px_rgba(6,182,212,0.3)]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-base sm:text-lg text-cyan-300/70 text-center mb-2">
            {subtitle}
          </p>
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

// --- Main HUD for initial profile analysis (120s expected) ---
export default function AnalysisHUD({ targetRole }: { targetRole: string }) {
  return <HUDOverlay title="Analyzing Profile" subtitle={targetRole} expectedDuration={120000} />
}

// --- Loading HUD for any stage transition (reusable, shorter durations) ---
export function LoadingHUD({ message, expectedDuration = 30000 }: { message: string; expectedDuration?: number }) {
  return <HUDOverlay title={message} expectedDuration={expectedDuration} />
}
