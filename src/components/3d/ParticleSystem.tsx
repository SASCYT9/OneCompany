'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createSeededRandom } from '@/lib/random';

export function ParticleSystem() {
  const particlesRef = useRef<THREE.Points>(null);

  // Generate particle positions with colors
  const { positions, colors, sizes } = useMemo(() => {
    const particleCount = 5000; // Більше частинок для ефекту
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const rand = createSeededRandom(509);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      
      // Create a larger sphere of particles
  const radius = 20 + rand() * 50;
  const theta = rand() * Math.PI * 2;
  const phi = Math.acos(2 * rand() - 1);
      
      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);
      
      // Преміальні кольори - gradient between orange, blue, purple
      const t = rand();
      if (t < 0.33) {
        // Orange to Red (KW Suspension colors)
        colors[i3] = 1.0;
        colors[i3 + 1] = 0.42 + rand() * 0.2;
        colors[i3 + 2] = 0.21;
      } else if (t < 0.66) {
        // Blue to Cyan (Fi Exhaust colors)
        colors[i3] = 0.31;
        colors[i3 + 1] = 0.76 + rand() * 0.2;
        colors[i3 + 2] = 0.97;
      } else {
        // Purple to Pink (Eventuri colors)
        colors[i3] = 0.76 + rand() * 0.2;
        colors[i3 + 1] = 0.31;
        colors[i3 + 2] = 0.97;
      }
      
      // Variable sizes for depth
      sizes[i] = rand() * 0.2 + 0.1;
    }
    
    return { positions, colors, sizes };
  }, []);

  // Animate particles with more dynamic movement
  useFrame((state) => {
    if (!particlesRef.current) return;
    
    const time = state.clock.elapsedTime;
    
    // Multi-axis rotation for more dynamic feel
    particlesRef.current.rotation.y = time * 0.04;
    particlesRef.current.rotation.x = Math.sin(time * 0.06) * 0.3;
    particlesRef.current.rotation.z = Math.cos(time * 0.08) * 0.2;
    
    // Breathing pulse effect
    const scale = 1 + Math.sin(time * 0.6) * 0.15;
    particlesRef.current.scale.set(scale, scale, scale);
  });

  const particlesGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return geometry;
  }, [positions, colors, sizes]);

  return (
    <points ref={particlesRef} geometry={particlesGeometry}>
      <pointsMaterial
        size={0.15}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

