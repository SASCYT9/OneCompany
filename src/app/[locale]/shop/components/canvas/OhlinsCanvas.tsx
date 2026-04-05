'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useOptimizedCanvas } from '@/hooks/useOptimizedCanvas';

type Particle = { x: number; y: number; vx: number; vy: number; size: number; opacity: number };

export default function OhlinsCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const particles: Particle[] = [];
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2, // Float instead of dropping
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.5 + 0.1
      });
    }
    particlesRef.current = particles;
    isInitialized.current = true;
  }, []);

  const renderCallback = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const particles = particlesRef.current;
    
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(229, 179, 38, ${p.opacity})`;
      ctx.fill();
    });
  }, []);

  useOptimizedCanvas(canvasRef, renderCallback);

  return <canvas ref={canvasRef} className="oh-canvas" />;
}
