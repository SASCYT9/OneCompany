'use client'

import { useGLTF, Float } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Group } from 'three'
import * as THREE from 'three'

export default function KW3DScene() {
  const group = useRef<Group>(null!)
  const { scene } = useGLTF('/models/kw-coilover.glb')

  useFrame((state, delta) => {
    if (group.current) {
      // Gentle rotation
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
      </Float>
      {/* Lighting specific to this scene */}
      <ambientLight intensity={0.2} />
      <directionalLight
        position={[5, 10, 7.5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight
        position={[-5, -5, -5]}
        intensity={150}
        color="#ff8800"
      />
      <pointLight
        position={[0, 5, -5]}
        intensity={100}
        color="#ffc800"
      />
    </group>
  )
}

useGLTF.preload('/models/kw-coilover.glb')

