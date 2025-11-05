'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

interface VideoBackgroundProps {
  src: string;
  inView: boolean;
  intensity?: number; // Яскравість відео (0-1)
}

export function VideoBackground({ src, inView, intensity = 0.85 }: VideoBackgroundProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const video = useMemo(() => {
    if (typeof document === 'undefined') return null;

    const vid = document.createElement('video');
    vid.src = src;
    vid.crossOrigin = 'Anonymous';
    vid.loop = true;
    vid.muted = true;
    vid.playsInline = true;
    vid.preload = 'auto';
    // Покращення якості відео
    vid.setAttribute('playsinline', 'true');
    vid.setAttribute('webkit-playsinline', 'true');
    return vid;
  }, [src]);

  const texture = useMemo(() => {
    if (!video) return null;

    const tex = new THREE.VideoTexture(video);
    if ('colorSpace' in tex) {
      const srgb = (THREE as unknown as { SRGBColorSpace?: string; LinearSRGBColorSpace?: string }).SRGBColorSpace
        ?? (THREE as unknown as { SRGBColorSpace?: string; LinearSRGBColorSpace?: string }).LinearSRGBColorSpace;
      if (srgb) {
        (tex as THREE.Texture & { colorSpace: string }).colorSpace = srgb;
      }
    }
    // Покращена фільтрація для якості
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    tex.anisotropy = 16; // Максимальна анізотропна фільтрація
    return tex;
  }, [video]);

  // Преміальний gradient poster
  const posterTexture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    const w = 128, h = 72; // Збільшений розмір для кращої якості
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    // Більш складний градієнт
    const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(0.5, '#0f0f1e');
    grad.addColorStop(1, '#000000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    
    const tex = new THREE.CanvasTexture(canvas);
    if ('colorSpace' in tex) {
      const srgb = (THREE as unknown as { SRGBColorSpace?: string; LinearSRGBColorSpace?: string }).SRGBColorSpace
        ?? (THREE as unknown as { SRGBColorSpace?: string; LinearSRGBColorSpace?: string }).LinearSRGBColorSpace;
      if (srgb) {
        (tex as THREE.Texture & { colorSpace: string }).colorSpace = srgb;
      }
    }
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    return tex;
  }, []);

  // Attach listeners and try to play when in view
  useEffect(() => {
    if (!video) return;
    const onCanPlay = () => setIsReady(true);
    const onPlaying = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
    };
  }, [video]);

  useEffect(() => {
    if (!video) return;

    return () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [video]);

  useFrame((state) => {
    if (!video) return;

    if (inView && !isPlaying) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch((e) => {
            if (e.name !== 'AbortError') {
              console.error('Video play failed:', e);
            }
          });
      }
    } else if (!inView && isPlaying) {
      video.pause();
      setIsPlaying(false);
    }

    // Покращений cinematic Ken Burns zoom з parallax
    if (meshRef.current) {
      const t = state.clock.getElapsedTime();
      const base = 16 / 9;
      const zoom = 1.03 + Math.sin(t * 0.04) * 0.015; // Більш плавний zoom
      const drift = Math.sin(t * 0.02) * 0.1; // Легкий drift
      
      meshRef.current.scale.set(base * zoom, 1 * zoom, 1);
      meshRef.current.position.x = drift;
    }
  });

  if (!inView) return null;

  const activeMap = isPlaying && texture ? texture : posterTexture ?? undefined;

  return (
    <mesh ref={meshRef} scale={[16, 9, 1]} position={[0, 0, -10]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial 
        map={activeMap} 
        toneMapped={false}
        opacity={intensity}
        transparent={intensity < 1}
      />
    </mesh>
  );
}
