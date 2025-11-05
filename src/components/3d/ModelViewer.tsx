'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMemo, useRef, useEffect } from 'react';

interface ModelViewerProps {
  path: string;
  scale?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  storeId: 'kw' | 'fi' | 'eventuri';
}

// Preload models for faster switching
useGLTF.preload('/models/kw-coilover.glb');
useGLTF.preload('/models/fi-exhaust.glb');
useGLTF.preload('/models/eventuri-intake.glb');

export function ModelViewer({ path, scale = 1, position = [0, 0, 0], rotation = [0, 0, 0], storeId }: ModelViewerProps) {
  const gltf = useGLTF(path);
  const modelRef = useRef<THREE.Group>(null);

  const clonedScene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  useEffect(() => {
    clonedScene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      child.castShadow = true;
      child.receiveShadow = true;

      const material = child.material as THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial | undefined;
      if (!material) return;

      if ('metalness' in material) {
        material.metalness = THREE.MathUtils.clamp(material.metalness ?? 0.6, 0.6, 0.95);
      }
      if ('roughness' in material) {
        material.roughness = THREE.MathUtils.clamp(material.roughness ?? 0.3, 0.05, 0.35);
      }

      // Keep original brand materials; only enhance carbon reflections for Eventuri
      if (storeId === 'eventuri' && material.color) {
        material.metalness = 0.95;
        material.roughness = 0.08;
      }
    });
  }, [clonedScene, storeId]);

  // Disable aggressive auto-rotation to avoid "flying crooked" feeling.
  // Keep models static for a premium, studio-like presentation.
  useFrame(() => {
    // Intentionally no rotation updates
  });

  return (
    <group ref={modelRef} position={position} rotation={rotation} scale={scale}>
      <primitive object={clonedScene} />
    </group>
  );
}
