'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useOptimizedCanvas } from '@/hooks/useOptimizedCanvas';

type FlowLine = { x: number; y: number; length: number; speed: number; opacity: number };

export default function AdroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const linesRef = useRef<FlowLine[]>([]);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const lines: FlowLine[] = [];
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    for (let i = 0; i < 30; i++) {
      lines.push({
        x: Math.random() * w,
        y: Math.random() * h,
        length: Math.random() * 200 + 50,
        speed: Math.random() * 5 + 2,
        opacity: Math.random() * 0.3 + 0.05
      });
    }
    linesRef.current = lines;
    isInitialized.current = true;
  }, []);

  const renderCallback = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const lines = linesRef.current;
    
    lines.forEach(l => {
      l.x += l.speed;
      if (l.x > canvas.width) {
        l.x = -l.length;
        l.y = Math.random() * canvas.height;
      }
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(l.x + l.length, l.y);
      ctx.strokeStyle = `rgba(6, 182, 212, ${l.opacity})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }, []);

  useOptimizedCanvas(canvasRef, renderCallback);

  return <canvas ref={canvasRef} className="adro-canvas" />;
}
