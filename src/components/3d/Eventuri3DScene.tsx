'use client'

import { useGLTF, Float } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Group } from 'three'

export default function Eventuri3DScene() {
  const group = useRef<Group>(null!)
  const { scene } = useGLTF('/models/eventuri-intake.glb')

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
        color="#00aaff"
      />
      <pointLight
        position={[0, 5, -5]}
        intensity={100}
        color="#00ffff"
      />
    </group>
  )
}

useGLTF.preload('/models/eventuri-intake.glb')

