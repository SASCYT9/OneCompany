'use client'

import { useGLTF, Float, Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Group } from 'three'

export default function Fi3DScene() {
  const group = useRef<Group>(null!)
  const { scene } = useGLTF('/models/fi-exhaust.glb')

  useFrame((state, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.1
    }
  })

  return (
    <group ref={group} dispose={null}>
      <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.2}>
        <primitive
          object={scene}
          scale={3.5}
          position={[0, -1.5, 0]}
          castShadow
          receiveShadow
        />
        <Sparkles
          count={100}
          scale={5}
          size={6}
          speed={0.4}
          color="#ff4444"
        />
      </Float>
      <ambientLight intensity={0.2} />
      <directionalLight
        position={[5, 10, 7.5]}
        intensity={1}
        castShadow
      />
      <pointLight
        position={[-5, -5, -5]}
        intensity={150}
        color="#ff4444"
      />
      <pointLight
        position={[0, 5, -5]}
        intensity={100}
        color="#ff8888"
      />
    </group>
  )
}

useGLTF.preload('/models/fi-exhaust.glb')

