'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MeshDistortMaterial, Stars, Float } from '@react-three/drei'
import * as THREE from 'three'

function DistortSphere() {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.08
      meshRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.05) * 0.1
    }
  })

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.5}>
      <mesh ref={meshRef} scale={2.2}>
        <icosahedronGeometry args={[1, 12]} />
        <MeshDistortMaterial
          color="#8b5cf6"
          emissive="#4c1d95"
          emissiveIntensity={0.4}
          roughness={0.3}
          metalness={0.8}
          distort={0.35}
          speed={1.8}
          transparent
          opacity={0.85}
        />
      </mesh>
    </Float>
  )
}

function InnerGlow() {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const scale = 1.4 + Math.sin(clock.getElapsedTime() * 0.8) * 0.1
      meshRef.current.scale.setScalar(scale)
    }
  })

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial color="#7c3aed" transparent opacity={0.08} />
    </mesh>
  )
}

function ParticleRing() {
  const pointsRef = useRef<THREE.Points>(null)

  const positions = useMemo(() => {
    const count = 200
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const radius = 3.2 + (Math.random() - 0.5) * 0.4
      arr[i * 3] = Math.cos(angle) * radius
      arr[i * 3 + 1] = (Math.random() - 0.5) * 0.3
      arr[i * 3 + 2] = Math.sin(angle) * radius
    }
    return arr
  }, [])

  useFrame(({ clock }) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = clock.getElapsedTime() * 0.05
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#a78bfa"
        size={0.03}
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  )
}

export default function Hero3D() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 5, 5]} intensity={0.5} color="#a78bfa" />
        <pointLight position={[-3, -3, 2]} intensity={0.3} color="#3b82f6" />

        <DistortSphere />
        <InnerGlow />
        <ParticleRing />

        <Stars
          radius={50}
          depth={40}
          count={1500}
          factor={3}
          saturation={0.3}
          fade
          speed={0.5}
        />
      </Canvas>
    </div>
  )
}
