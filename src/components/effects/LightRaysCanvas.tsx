'use client';

import { useEffect, useRef } from 'react';

interface LightRaysCanvasProps {
  isActive?: boolean;
  rayCount?: number;
  colors?: string[];
  speed?: number;
}

export function LightRaysCanvas({
  isActive = true,
  rayCount = 8,
  colors = ['#ff6b35', '#4fc3f7', '#c24fc7'],
  speed = 0.001,
}: LightRaysCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !isActive) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener('resize', resize);

    let rotation = 0;

    const animate = () => {
      if (!ctx) return;

      // Очистка з fade ефектом
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      rotation += speed;

      // Малюємо промені
      for (let i = 0; i < rayCount; i++) {
        const angle = (Math.PI * 2 * i) / rayCount + rotation;
        const length = Math.min(canvas.width, canvas.height) * 0.8;
        
        // Градієнт для променя
        const gradient = ctx.createLinearGradient(
          centerX,
          centerY,
          centerX + Math.cos(angle) * length,
          centerY + Math.sin(angle) * length
        );

        const color = colors[i % colors.length];
        gradient.addColorStop(0, `${color}00`);
        gradient.addColorStop(0.3, `${color}40`);
        gradient.addColorStop(0.6, `${color}20`);
        gradient.addColorStop(1, `${color}00`);

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(angle);

        // Промінь
        ctx.beginPath();
        ctx.moveTo(0, -30);
        ctx.lineTo(length, -5);
        ctx.lineTo(length, 5);
        ctx.lineTo(0, 30);
        ctx.closePath();

        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.restore();

        // Додаємо particles на кінцях променів
        const particleX = centerX + Math.cos(angle) * length * 0.8;
        const particleY = centerY + Math.sin(angle) * length * 0.8;
        
        const particleGradient = ctx.createRadialGradient(
          particleX, particleY, 0,
          particleX, particleY, 20
        );
        particleGradient.addColorStop(0, `${color}80`);
        particleGradient.addColorStop(1, `${color}00`);

        ctx.beginPath();
        ctx.arc(particleX, particleY, 20, 0, Math.PI * 2);
        ctx.fillStyle = particleGradient;
        ctx.fill();
      }

      // Центральний glow
      const centerGlow = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, 200
      );
      centerGlow.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
      centerGlow.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
      centerGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.beginPath();
      ctx.arc(centerX, centerY, 200, 0, Math.PI * 2);
      ctx.fillStyle = centerGlow;
      ctx.fill();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, rayCount, colors, speed]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}
