'use client'

import { useEffect, useRef, useState, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
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

// --- Node labels ---
const NODE_LABELS = [
  'Experience', 'Hidden Wins', 'Leadership Scope', 'Impact Metrics',
  'AI Signals', 'Skills', 'Achievements', 'Career Trajectory',
  'Headline', 'About Section', 'Keyword Density', 'Recruiter Search',
  'Role Bullets', 'Quantified Results', 'Industry Alignment', 'ATS Optimization',
  'Profile Visibility', 'Endorsements', 'Job Titles', 'Revenue Impact',
  'Team Leadership', 'Certifications', 'Publications', 'Cross-Functional',
  'Growth Metrics', 'Strategic Vision', 'Stakeholders', 'Technical Stack',
  'Promotions', 'Recommendations',
]

// --- Mouse tracker inside the canvas ---
function MouseTracker({ mouseRef }: { mouseRef: React.RefObject<{ x: number; y: number }> }) {
  useEffect(() => {
    function onMove(e: MouseEvent) {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [mouseRef])
  return null
}

// --- 3D Node Network ---
function NodeNetwork({ mouseRef, intensityRef }: {
  mouseRef: React.RefObject<{ x: number; y: number }>
  intensityRef: React.RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const linesRef = useRef<THREE.LineSegments>(null)
  const nodesRef = useRef<THREE.InstancedMesh>(null)
  const particlesRef = useRef<THREE.Points>(null)

  const lerpedMouse = useRef({ x: 0, y: 0 })
  const lerpedIntensity = useRef(0.4)

  const COUNT = 80
  const PARTICLE_COUNT = 250

  const nodeData = useMemo(() => {
    const positions: THREE.Vector3[] = []
    for (let i = 0; i < COUNT; i++) {
      const phi = Math.acos(2 * Math.random() - 1)
      const theta = Math.random() * Math.PI * 2
      const r = 2.0 + Math.random() * 2.0
      positions.push(new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      ))
    }
    return positions
  }, [])

  const velocities = useMemo(() =>
    nodeData.map(() => new THREE.Vector3(
      (Math.random() - 0.5) * 0.003,
      (Math.random() - 0.5) * 0.003,
      (Math.random() - 0.5) * 0.003,
    )), [nodeData])

  const particlePositions = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const phi = Math.acos(2 * Math.random() - 1)
      const theta = Math.random() * Math.PI * 2
      const r = 1.5 + Math.random() * 4
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      arr[i * 3 + 2] = r * Math.cos(phi)
    }
    return arr
  }, [])

  const edgePairs = useMemo(() => {
    const pairs: [number, number][] = []
    for (let i = 0; i < COUNT; i++) {
      for (let j = i + 1; j < COUNT; j++) {
        if (nodeData[i].distanceTo(nodeData[j]) < 3.0) pairs.push([i, j])
      }
    }
    return pairs
  }, [nodeData])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime()

    // Smooth lerp intensity (0.4 = ambient, 1.0 = active)
    const targetIntensity = intensityRef.current
    lerpedIntensity.current += (targetIntensity - lerpedIntensity.current) * 0.03
    const I = lerpedIntensity.current

    // Smooth lerp mouse
    lerpedMouse.current.x += (mouseRef.current.x - lerpedMouse.current.x) * 0.05
    lerpedMouse.current.y += (mouseRef.current.y - lerpedMouse.current.y) * 0.05

    // Camera distance: closer when active
    const targetZ = 9 - I * 2 // 9 ambient → 7 active
    camera.position.z += (targetZ - camera.position.z) * 0.02

    // Rotate group + mouse parallax
    if (groupRef.current) {
      const rotSpeed = 0.05 + I * 0.05
      groupRef.current.rotation.y = t * rotSpeed + lerpedMouse.current.x * 0.3
      groupRef.current.rotation.x = Math.sin(t * 0.03) * 0.1 + lerpedMouse.current.y * 0.15
    }

    // Move nodes
    const velScale = 1 + I * 2
    for (let i = 0; i < COUNT; i++) {
      const p = nodeData[i]
      const v = velocities[i]
      p.addScaledVector(v, velScale)
      const dist = p.length()
      if (dist > 5.0) { v.multiplyScalar(-1); p.normalize().multiplyScalar(4.9) }
      if (dist < 1.0) { v.multiplyScalar(-1); p.normalize().multiplyScalar(1.1) }
    }

    // Update instanced nodes
    if (nodesRef.current) {
      for (let i = 0; i < COUNT; i++) {
        const pulseSpeed = 2.0 + I * 2
        const pulse = 0.8 + Math.sin(t * pulseSpeed + i * 0.7) * 0.4

        // Bigger nodes — visible even in ambient
        const baseScale = i < NODE_LABELS.length ? 0.08 : 0.04
        const scale = (baseScale + pulse * 0.02) * (0.7 + I * 0.5)
        dummy.position.copy(nodeData[i])
        dummy.scale.setScalar(scale)
        dummy.updateMatrix()
        nodesRef.current.setMatrixAt(i, dummy.matrix)

        const color = new THREE.Color()
        // Brighter in ambient mode
        const brightness = 0.45 + I * 0.3
        if (i < NODE_LABELS.length) {
          color.setHSL(0.52 + Math.sin(t * 1.5 + i) * 0.03, 0.7, brightness + pulse * 0.15)
        } else {
          color.setHSL(0.55 + Math.sin(t * 2 + i) * 0.05, 0.9, brightness + pulse * 0.1)
        }
        nodesRef.current.setColorAt(i, color)
      }
      nodesRef.current.instanceMatrix.needsUpdate = true
      if (nodesRef.current.instanceColor) nodesRef.current.instanceColor.needsUpdate = true
    }

    // Lines with energy flow
    if (linesRef.current) {
      const posAttr = linesRef.current.geometry.getAttribute('position') as THREE.BufferAttribute
      const colorAttr = linesRef.current.geometry.getAttribute('color') as THREE.BufferAttribute

      const waveSpeed = 3 + I * 5
      for (let e = 0; e < edgePairs.length; e++) {
        const [i, j] = edgePairs[e]
        const a = nodeData[i], b = nodeData[j]
        posAttr.setXYZ(e * 2, a.x, a.y, a.z)
        posAttr.setXYZ(e * 2 + 1, b.x, b.y, b.z)

        const wave1 = Math.sin(t * waveSpeed + e * 0.5) * 0.5 + 0.5
        const wave2 = Math.sin(t * (waveSpeed * 0.7) + e * 0.3 + 1.5) * 0.5 + 0.5
        const pulse = Math.max(wave1, wave2)
        const dist = a.distanceTo(b)
        const base = Math.max(0, 1 - dist / 3.0)

        // Much brighter ambient lines
        const brightnessScale = 0.25 + I * 0.4
        const brightness = base * (brightnessScale + pulse * (0.2 + I * 0.3))
        const boost = (i < NODE_LABELS.length || j < NODE_LABELS.length) ? 1.5 : 1.0
        const shift = Math.sin(t * (waveSpeed * 1.2) + e * 0.7) * 0.5 + 0.5

        // Cyan-blue color range
        colorAttr.setXYZ(e * 2,
          (0.1 + shift * 0.15) * brightness * boost,
          (0.55 + shift * 0.2) * brightness * boost,
          brightness * boost,
        )
        colorAttr.setXYZ(e * 2 + 1,
          (0.15 + (1 - shift) * 0.1) * brightness * boost,
          (0.65 + (1 - shift) * 0.15) * brightness * boost,
          brightness * 0.9 * boost,
        )
      }
      posAttr.needsUpdate = true
      colorAttr.needsUpdate = true
    }

    // Particles
    if (particlesRef.current) {
      const posAttr = particlesRef.current.geometry.getAttribute('position') as THREE.BufferAttribute
      const angle = 0.0015 + I * 0.002
      const cos = Math.cos(angle), sin = Math.sin(angle)
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const x = posAttr.getX(i), y = posAttr.getY(i), z = posAttr.getZ(i)
        posAttr.setXYZ(i,
          x * cos - z * sin,
          y + Math.sin(t * 0.5 + i) * (0.001 + I * 0.002),
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
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} count={edgePairs.length * 2} />
          <bufferAttribute attach="attributes-color" args={[lineColors, 3]} count={edgePairs.length * 2} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.9} blending={THREE.AdditiveBlending} />
      </lineSegments>

      <instancedMesh ref={nodesRef} args={[undefined, undefined, COUNT]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial transparent opacity={0.9} blending={THREE.AdditiveBlending} />
      </instancedMesh>

      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} count={PARTICLE_COUNT} />
        </bufferGeometry>
        <pointsMaterial size={0.03} color="#67e8f9" transparent opacity={0.5} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  )
}

// --- CSS labels that track 3D positions (no drei Html) ---
function ScreenLabels({ nodeData, intensityRef }: {
  nodeData: THREE.Vector3[]
  intensityRef: React.RefObject<number>
}) {
  const { camera, size } = useThree()
  const labelsRef = useRef<{ x: number; y: number; opacity: number }[]>(
    NODE_LABELS.map(() => ({ x: 0, y: 0, opacity: 0 }))
  )
  const [, forceUpdate] = useState(0)
  const frameCount = useRef(0)

  useFrame(() => {
    frameCount.current++
    // Only update label positions every 3rd frame for performance
    if (frameCount.current % 3 !== 0) return

    const vec = new THREE.Vector3()
    for (let i = 0; i < NODE_LABELS.length; i++) {
      vec.copy(nodeData[i])
      // Apply parent group rotation - we need to get the world position
      vec.project(camera)
      const x = (vec.x * 0.5 + 0.5) * size.width
      const y = (-vec.y * 0.5 + 0.5) * size.height
      // Hide labels that are behind camera or off-screen
      const onScreen = vec.z < 1 && x > -50 && x < size.width + 50 && y > -50 && y < size.height + 50
      labelsRef.current[i] = { x, y, opacity: onScreen ? 0.6 + intensityRef.current * 0.3 : 0 }
    }
    forceUpdate(n => n + 1)
  })

  return null // Labels rendered via portal in main component
}

// --- HUD Overlay ---
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

// --- Main exported component ---
export default function JarvisBackground() {
  const { state } = useJarvis()
  const mouseRef = useRef({ x: 0, y: 0 })
  const intensityRef = useRef(0.4)

  useEffect(() => {
    intensityRef.current = state.mode === 'active' ? 1.0 : 0.4
  }, [state.mode])

  return (
    <>
      {/* Persistent 3D Canvas — NO fog, NO Html labels */}
      {/* R3F overrides pointer-events on its wrapper div, so we use CSS to force it off */}
      <div className="fixed inset-0 [&_*]:!pointer-events-none" style={{ zIndex: 0, pointerEvents: 'none' }}>
        <Canvas
          camera={{ position: [0, 0, 9], fov: 55 }}
          gl={{ antialias: true, alpha: false }}
          style={{ background: '#050510' }}
          resize={{ scroll: false }}
        >
          <color attach="background" args={['#050510']} />
          <MouseTracker mouseRef={mouseRef} />
          <NodeNetwork mouseRef={mouseRef} intensityRef={intensityRef} />
        </Canvas>
      </div>

      {/* Soft vignette — reduced opacity so mesh is visible */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-1000"
        style={{
          zIndex: 1,
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(5,5,16,0.7) 100%)',
          opacity: state.mode === 'active' ? 0.3 : 0.7,
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
