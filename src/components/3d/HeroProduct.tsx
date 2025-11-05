'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Sphere, Cylinder, Torus } from '@react-three/drei';
import * as THREE from 'three';

interface HeroProductProps {
  modelPath?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}

export function HeroProduct({
  modelPath,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}: HeroProductProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Subtle animation
  useFrame((state) => {
    if (!groupRef.current) return;
    
    const time = state.clock.elapsedTime;
    
    // Floating animation
    groupRef.current.position.y = position[1] + Math.sin(time * 0.5) * 0.2;
    
    // Gentle continuous rotation
    groupRef.current.rotation.y = time * 0.15;
    groupRef.current.rotation.x = Math.sin(time * 0.3) * 0.1;
  });

  return (
    <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
      <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
        {/* Центральне колесо (wheel) з диском */}
        <group>
          {/* Rim - диск */}
          <Cylinder args={[1.2, 1.2, 0.4, 32]}>
            <meshStandardMaterial
              color="#c0c0c0"
              metalness={0.95}
              roughness={0.1}
              envMapIntensity={1.5}
            />
          </Cylinder>

          {/* Spokes - спиці диска (5-променевий дизайн) */}
          {[...Array(5)].map((_, i) => {
            const angle = (i / 5) * Math.PI * 2;
            return (
              <group key={i} rotation={[0, 0, angle]}>
                <Cylinder args={[0.08, 0.08, 1]} position={[0.6, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <meshStandardMaterial color="#808080" metalness={0.9} roughness={0.2} />
                </Cylinder>
              </group>
            );
          })}

          {/* Center cap - центральна заглушка */}
          <Cylinder args={[0.3, 0.3, 0.45, 32]}>
            <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.3} />
          </Cylinder>

          {/* Tire - шина */}
          <Torus args={[1.2, 0.3, 16, 32]}>
            <meshStandardMaterial color="#0a0a0a" roughness={0.9} metalness={0.1} />
          </Torus>

          {/* Brake disc - гальмівний диск */}
          <Cylinder args={[0.9, 0.9, 0.05, 32]} position={[0, 0, -0.25]}>
            <meshStandardMaterial color="#b87333" metalness={0.8} roughness={0.4} />
          </Cylinder>

          {/* Brake caliper - супорт */}
          <group position={[0.8, -0.3, -0.25]}>
            <Cylinder args={[0.15, 0.15, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
              <meshStandardMaterial
                color="#ff6b35"
                metalness={0.7}
                roughness={0.3}
                emissive="#ff6b35"
                emissiveIntensity={0.2}
              />
            </Cylinder>
          </group>
        </group>

        {/* Orbital rings - brand colors */}
        {[...Array(3)].map((_, i) => (
          <Torus
            key={i}
            args={[2 + i * 0.5, 0.03, 16, 50]}
            rotation={[Math.PI / 2 + i * 0.2, i * 0.3, 0]}
          >
            <meshStandardMaterial
              color={i === 0 ? "#ff6b35" : i === 1 ? "#4fc3f7" : "#c24fc7"}
              emissive={i === 0 ? "#ff6b35" : i === 1 ? "#4fc3f7" : "#c24fc7"}
              emissiveIntensity={0.5}
              transparent
              opacity={0.3}
              metalness={0.9}
              roughness={0.1}
            />
          </Torus>
        ))}

        {/* Glow points - brand colors */}
        {[...Array(3)].map((_, i) => {
          const angle = (i / 3) * Math.PI * 2;
          const radius = 2.5;
          return (
            <Sphere
              key={i}
              args={[0.1, 16, 16]}
              position={[Math.cos(angle) * radius, Math.sin(angle) * radius, 0]}
            >
              <meshStandardMaterial
                color={i === 0 ? "#ff6b35" : i === 1 ? "#4fc3f7" : "#c24fc7"}
                emissive={i === 0 ? "#ff6b35" : i === 1 ? "#4fc3f7" : "#c24fc7"}
                emissiveIntensity={2}
              />
            </Sphere>
          );
        })}

        {/* Lights */}
        <pointLight position={[0, 0, 2]} intensity={1.5} color="#ffffff" distance={8} />
        <pointLight position={[2, 0, 0]} intensity={1} color="#ff6b35" distance={6} />
        <pointLight position={[-2, 0, 0]} intensity={1} color="#4fc3f7" distance={6} />
      </group>
    </Float>
  );
}
