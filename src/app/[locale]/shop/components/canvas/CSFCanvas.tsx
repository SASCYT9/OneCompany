'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useOptimizedCanvas } from '@/hooks/useOptimizedCanvas';

type Particle = { x: number; y: number; vx: number; vy: number; size: number; opacity: number };

export default function CSFCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const isInitialized = useRef(false);

  // Initialize particles once
  useEffect(() => {
    if (isInitialized.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const particles: Particle[] = [];
    // using window dimensions safely here because it's client-side
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: Math.random() * 0.2 + 0.1,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.3 + 0.05,
      });
    }
    particlesRef.current = particles;
    isInitialized.current = true;
  }, []);

  const renderCallback = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const particles = particlesRef.current;
    
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y > canvas.height) { p.y = -5; p.x = Math.random() * canvas.width; }
      if (p.x < 0 || p.x > canvas.width) { p.x = Math.random() * canvas.width; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(56, 189, 248, ${p.opacity})`;
      ctx.fill();
    });
  }, []);

  useOptimizedCanvas(canvasRef, renderCallback);

  return <canvas ref={canvasRef} className="csf-canvas" />;
}
