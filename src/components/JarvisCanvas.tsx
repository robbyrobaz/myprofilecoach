'use client'

import { useEffect, useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const COUNT = 80
const PARTICLE_COUNT = 250
const EDGE_DIST = 3.2

const NODE_LABELS = [
  'Neural Link', 'Career Graph', 'Skill Vector', 'Impact Score',
  'Keyword Mesh', 'Role Tensor', 'Signal Node', 'Pattern Engine',
  'Recruiter Index', 'Visibility Map', 'Achievement Net', 'Context Layer',
  'Semantic Core', 'Influence Path', 'Growth Vector', 'Query Matrix',
  'Profile Rank', 'Match Score', 'Data Stream', 'Insight Pulse',
  'Authority Node', 'Network Edge', 'Talent Graph', 'Parse Engine',
  'Relevance Map', 'Industry Scan', 'Position Lock', 'Boost Signal',
  'Merit Index', 'Topology Link',
]

function makeTextTexture(label: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 256, 64)
  ctx.font = '600 22px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#67e8f9'
  ctx.fillText(label, 128, 32)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

function MouseTracker({ mouseRef }: { mouseRef: React.RefObject<{ x: number; y: number }> }) {
  useEffect(() => {
    function onMove(e: MouseEvent) {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [mouseRef])
  return null
}

function NodeNetwork({ mouseRef, intensityRef }: {
  mouseRef: React.RefObject<{ x: number; y: number }>
  intensityRef: React.RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const linesRef = useRef<THREE.LineSegments>(null)
  const nodesRef = useRef<THREE.InstancedMesh>(null)
  const particlesRef = useRef<THREE.Points>(null)

  const lerpedMouse = useRef({ x: 0, y: 0 })
  const lerpedIntensity = useRef(0.04)

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
        if (nodeData[i].distanceTo(nodeData[j]) < EDGE_DIST) pairs.push([i, j])
      }
    }
    return pairs
  }, [nodeData])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Sprite labels for first 30 nodes
  const labelSprites = useMemo(() => {
    return NODE_LABELS.map((label, i) => {
      const tex = makeTextTexture(label)
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const sprite = new THREE.Sprite(mat)
      sprite.scale.set(1.2, 0.3, 1)
      return sprite
    })
  }, [])
  const labelsGroupRef = useRef<THREE.Group>(null)

  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime()

    const targetIntensity = intensityRef.current
    lerpedIntensity.current += (targetIntensity - lerpedIntensity.current) * 0.03
    const I = lerpedIntensity.current

    lerpedMouse.current.x += (mouseRef.current.x - lerpedMouse.current.x) * 0.05
    lerpedMouse.current.y += (mouseRef.current.y - lerpedMouse.current.y) * 0.05

    const targetZ = 9 - I * 2
    camera.position.z += (targetZ - camera.position.z) * 0.02

    if (groupRef.current) {
      const rotSpeed = 0.05 + I * 0.05
      groupRef.current.rotation.y = t * rotSpeed + lerpedMouse.current.x * 0.3
      groupRef.current.rotation.x = Math.sin(t * 0.03) * 0.1 + lerpedMouse.current.y * 0.15
    }

    const velScale = 1 + I * 2
    for (let i = 0; i < COUNT; i++) {
      const p = nodeData[i]
      const v = velocities[i]
      p.addScaledVector(v, velScale)
      const dist = p.length()
      if (dist > 5.0) { v.multiplyScalar(-1); p.normalize().multiplyScalar(4.9) }
      if (dist < 1.0) { v.multiplyScalar(-1); p.normalize().multiplyScalar(1.1) }
    }

    // Nodes
    if (nodesRef.current) {
      const color = new THREE.Color()
      for (let i = 0; i < COUNT; i++) {
        const pulse = 0.8 + Math.sin(t * (2 + I * 2) + i * 0.7) * 0.4
        const scale = (0.008 + pulse * 0.003) * (0.6 + I * 0.3)
        dummy.position.copy(nodeData[i])
        dummy.scale.setScalar(scale)
        dummy.updateMatrix()
        nodesRef.current.setMatrixAt(i, dummy.matrix)

        const brightness = 0.12 + I * 0.63
        color.setHSL(0.52 + Math.sin(t * 1.5 + i) * 0.04, 0.7, brightness + pulse * 0.12)
        nodesRef.current.setColorAt(i, color)
      }
      nodesRef.current.instanceMatrix.needsUpdate = true
      if (nodesRef.current.instanceColor) nodesRef.current.instanceColor.needsUpdate = true
    }

    // Lines
    if (linesRef.current) {
      const posAttr = linesRef.current.geometry.getAttribute('position') as THREE.BufferAttribute
      const colorAttr = linesRef.current.geometry.getAttribute('color') as THREE.BufferAttribute
      const waveSpeed = 3 + I * 5

      for (let e = 0; e < edgePairs.length; e++) {
        const [i, j] = edgePairs[e]
        const a = nodeData[i], b = nodeData[j]
        posAttr.setXYZ(e * 2, a.x, a.y, a.z)
        posAttr.setXYZ(e * 2 + 1, b.x, b.y, b.z)

        const pulse = Math.max(
          Math.sin(t * waveSpeed + e * 0.5) * 0.5 + 0.5,
          Math.sin(t * waveSpeed * 0.7 + e * 0.3 + 1.5) * 0.5 + 0.5,
        )
        const base = Math.max(0, 1 - a.distanceTo(b) / EDGE_DIST)
        const brightness = base * (0.03 + I * 0.58 + pulse * (0.05 + I * 0.4))
        const boost = (i < 30 || j < 30) ? 1.5 : 1.0
        const shift = Math.sin(t * waveSpeed * 1.2 + e * 0.7) * 0.5 + 0.5

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

    // Labels — positioned above their node, opacity tied to intensity
    if (labelsGroupRef.current) {
      for (let i = 0; i < labelSprites.length; i++) {
        const sprite = labelSprites[i]
        const pos = nodeData[i]
        sprite.position.set(pos.x, pos.y + 0.15, pos.z)
        const flicker = 0.7 + Math.sin(t * 1.5 + i * 2.1) * 0.3
        ;(sprite.material as THREE.SpriteMaterial).opacity = I * 0.7 * flicker
      }
    }

    // Particles
    if (particlesRef.current) {
      const posAttr = particlesRef.current.geometry.getAttribute('position') as THREE.BufferAttribute
      const angle = 0.0015 + I * 0.002
      const cos = Math.cos(angle), sin = Math.sin(angle)
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const x = posAttr.getX(i), z = posAttr.getZ(i)
        posAttr.setXYZ(i,
          x * cos - z * sin,
          posAttr.getY(i) + Math.sin(t * 0.5 + i) * 0.001,
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
        <pointsMaterial size={0.008} color="#67e8f9" transparent opacity={0.15} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>

      <group ref={labelsGroupRef}>
        {labelSprites.map((sprite, i) => (
          <primitive key={i} object={sprite} />
        ))}
      </group>
    </group>
  )
}

export default function JarvisCanvas({ mode }: { mode: 'ambient' | 'active' }) {
  const mouseRef = useRef({ x: 0, y: 0 })
  const intensityRef = useRef(0.25)

  useEffect(() => {
    intensityRef.current = mode === 'active' ? 0.75 : 0.04
  }, [mode])

  return (
    <Canvas
      camera={{ position: [0, 0, 9], fov: 55 }}
      gl={{ antialias: false, alpha: false, powerPreference: 'low-power' }}
      style={{ background: '#050510' }}
      resize={{ scroll: false }}
      frameloop="always"
      dpr={[1, 1.5]}
    >
      <color attach="background" args={['#050510']} />
      <MouseTracker mouseRef={mouseRef} />
      <NodeNetwork mouseRef={mouseRef} intensityRef={intensityRef} />
    </Canvas>
  )
}
