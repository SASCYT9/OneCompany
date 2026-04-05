'use client';

import { useRef, useCallback } from 'react';
import { useOptimizedCanvas } from '@/hooks/useOptimizedCanvas';

type Props = {
  isPlaying: boolean;
};

export default function IpeWaveCanvas({ isPlaying }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef<number>(0);

  const renderCallback = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    const w = canvas.width;
    const h = canvas.height;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.strokeStyle = '#e11d48'; // crimson
    ctx.lineWidth = 2;

    for (let x = 0; x < w; x++) {
      // frequency based on 'isPlaying' state to simulate RPM
      const freq = isPlaying ? 0.05 : 0.02;
      const amp = isPlaying ? (Math.sin(timeRef.current * 0.1) * 30 + 50) : 20;
      const y = cy + Math.sin(x * freq + timeRef.current * 0.05) * amp * Math.exp(-Math.pow((x - w / 2) / (w / 4), 2));
      
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    timeRef.current++;
  }, [isPlaying]);

  useOptimizedCanvas(canvasRef, renderCallback);

  return <canvas ref={canvasRef} className="ipe-canvas" />;
}
