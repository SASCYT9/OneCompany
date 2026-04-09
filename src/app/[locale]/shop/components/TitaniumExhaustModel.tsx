'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

export function TitaniumExhaustModel(props: any) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene, materials } = useGLTF('/3d/akrapovic_v2.glb') as any;

  // Apply custom premium shaders to the real model
  useMemo(() => {
    Object.values(materials).forEach((mat: any) => {
      // Ensure double-sided rendering for exhaust pipes
      mat.side = THREE.DoubleSide;
      
      if (mat.name === 'Titanium') {
        mat.metalness = 1.0;
        mat.roughness = 0.25;
        mat.color.set('#1a1a1a');
        mat.iridescence = 1.0;
        mat.iridescenceIOR = 1.6;
        mat.iridescenceThicknessRange = [100, 400];
        mat.clearcoat = 0.3;
      }
      else if (mat.name === 'Carbon') {
        mat.metalness = 0.4;
        mat.roughness = 0.7;
        mat.color.set('#050505'); // Deep dark for stealth wealth
        mat.clearcoat = 1.0;
        mat.clearcoatRoughness = 0.1;
      }
      else if (mat.name === 'InnerMetal') {
        mat.metalness = 0.8;
        mat.roughness = 0.9;
        mat.color.set('#000000');
      }
    });
  }, [materials]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      // Subtle floating and rotation even without scrolling
      groupRef.current.rotation.x += delta * 0.1;
      groupRef.current.rotation.y += delta * 0.15;
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.1;
    }
  });

  return (
    <group ref={groupRef} {...props} dispose={null}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload('/3d/akrapovic_v2.glb');

