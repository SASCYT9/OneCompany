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

    /* ── Primary wave — bronze ── */
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(194, 157, 89, 0.6)';
    ctx.lineWidth = 1.5;

    for (let x = 0; x < w; x++) {
      const freq = isPlaying ? 0.04 : 0.015;
      const amp = isPlaying ? (Math.sin(timeRef.current * 0.08) * 20 + 30) : 12;
      const y = cy + Math.sin(x * freq + timeRef.current * 0.04) * amp * Math.exp(-Math.pow((x - w / 2) / (w / 3.5), 2));

      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    /* ── Secondary wave — fainter, offset ── */
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(194, 157, 89, 0.2)';
    ctx.lineWidth = 1;

    for (let x = 0; x < w; x++) {
      const freq = isPlaying ? 0.035 : 0.012;
      const amp = isPlaying ? (Math.cos(timeRef.current * 0.06) * 15 + 20) : 8;
      const y = cy + Math.sin(x * freq + timeRef.current * 0.03 + 1.5) * amp * Math.exp(-Math.pow((x - w / 2) / (w / 3), 2));

      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    timeRef.current++;
  }, [isPlaying]);

  useOptimizedCanvas(canvasRef, renderCallback);

  return <canvas ref={canvasRef} className="ipe-canvas" />;
}
