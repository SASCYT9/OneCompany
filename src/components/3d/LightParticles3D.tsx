'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface LightParticles3DProps {
  count?: number;
  color?: string;
  speed?: number;
}

export function LightParticles3D({ 
  count = 500,
  color = '#ffffff',
  speed = 0.5
}: LightParticles3DProps) {
  const pointsRef = useRef<THREE.Points>(null);
  
  const [positions, colors, sizes] = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    
    const colorObj = new THREE.Color(color);
    
    for (let i = 0; i < count; i++) {
      // Позиції частинок у сфері
      const radius = 15;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
      
      // Кольори з варіацією
      const variation = Math.random() * 0.3 + 0.7;
      colors[i * 3] = colorObj.r * variation;
      colors[i * 3 + 1] = colorObj.g * variation;
      colors[i * 3 + 2] = colorObj.b * variation;
      
      // Розміри
      sizes[i] = Math.random() * 0.5 + 0.1;
    }
    
    return [positions, colors, sizes];
  }, [count, color]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    
    const time = state.clock.getElapsedTime() * speed;
    
    // Обертання частинок
    pointsRef.current.rotation.y = time * 0.1;
    pointsRef.current.rotation.x = Math.sin(time * 0.05) * 0.1;
    
    // Пульсація розмірів
    const geometry = pointsRef.current.geometry;
    const sizes = geometry.attributes.size.array as Float32Array;
    
    for (let i = 0; i < count; i++) {
      const originalSize = 0.3;
      sizes[i] = originalSize + Math.sin(time * 2 + i * 0.1) * 0.2;
    }
    
    geometry.attributes.size.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
        <bufferAttribute
          attach="attributes-size"
          args={[sizes, 1]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.3}
        vertexColors
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
