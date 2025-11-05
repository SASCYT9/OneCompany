'use client';

import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';

// Register GSAP plugin
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface CinematicCameraProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function CinematicCamera({ containerRef }: CinematicCameraProps) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const { camera } = useThree();
  const targetPosition = useRef(new THREE.Vector3(0, 0, 10));
  const targetRotation = useRef(new THREE.Euler(0, 0, 0));

  useEffect(() => {
    if (!cameraRef.current || !containerRef.current) return;

    const cam = cameraRef.current;
    
    // МАКСИМАЛЬНО КРУТА кінематографічна Timeline з точним snap
    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1.2, // Швидша реакція для точності
        snap: {
          snapTo: 1 / 4, // Snap до кожного з 5 слайдів (0, 0.25, 0.5, 0.75, 1)
          duration: { min: 0.2, max: 0.6 },
          delay: 0.1,
          ease: 'power2.inOut',
        },
        markers: false,
        invalidateOnRefresh: true,
        anticipatePin: 1,
      },
    });

    // Screen 0: Logo intro - далекий план
    timeline
      .to('#logo-text', {
        opacity: 1,
        scale: 1,
        duration: 1.5,
      })
      .to(targetPosition.current, {
        x: 0,
        y: 0,
        z: 12,
        duration: 2,
      }, '<')
      
    // Screen 0 → 1: KW Suspension - Orange/Red theme
    // Camera різко заїжджає, крутиться навколо
    timeline
      .to('#logo-text', {
        opacity: 0,
        scale: 1.5,
        duration: 1,
      })
      .to(targetPosition.current, {
        x: -4,
        y: 2,
        z: 6,
        duration: 2.5,
      }, '<')
      .to(targetRotation.current, {
        y: Math.PI * 0.3,
        x: -0.2,
        duration: 2.5,
      }, '<')
      
    // Screen 1 → 2: Fi Exhaust - Blue/Cyan theme
    // Camera обертається з іншого боку, агресивний рух
    timeline
      .to(targetPosition.current, {
        x: 5,
        y: -1,
        z: 4,
        duration: 2.5,
      })
      .to(targetRotation.current, {
        y: -Math.PI * 0.4,
        x: 0.15,
        z: 0.1,
        duration: 2.5,
      }, '<')
      
    // Screen 2 → 3: Eventuri - Purple/Pink theme
    // Camera плавно заїжджає зверху, елегантний рух
    timeline
      .to(targetPosition.current, {
        x: 0,
        y: 4,
        z: 5,
        duration: 2.5,
      })
      .to(targetRotation.current, {
        y: 0,
        x: -0.4,
        z: 0,
        duration: 2.5,
      }, '<')
      
    // Screen 3 → 4: Final reveal - всі магазини
    // Camera відїжджає назад, широкий план
    timeline
      .to(targetPosition.current, {
        x: 0,
        y: 1,
        z: 10,
        duration: 3,
      })
      .to(targetRotation.current, {
        y: 0,
        x: -0.1,
        z: 0,
        duration: 3,
      }, '<')

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, [containerRef]);

  // Smooth camera follow
  useFrame(() => {
    if (!cameraRef.current) return;

    // Lerp camera position and rotation for smooth movement
    cameraRef.current.position.lerp(targetPosition.current, 0.05);
    cameraRef.current.rotation.x = THREE.MathUtils.lerp(
      cameraRef.current.rotation.x,
      targetRotation.current.x,
      0.05
    );
    cameraRef.current.rotation.y = THREE.MathUtils.lerp(
      cameraRef.current.rotation.y,
      targetRotation.current.y,
      0.05
    );
    
    // Always look at the origin (where the product is)
    cameraRef.current.lookAt(0, 0, 0);
  });

  return <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 0, 10]} fov={50} />;
}
