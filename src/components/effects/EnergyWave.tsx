'use client';

import { useEffect, useRef } from 'react';

interface EnergyWaveProps {
  isActive?: boolean;
  colors?: {
    start: string;
    middle: string;
    end: string;
  };
}

export function EnergyWave({ 
  isActive = true,
  colors = {
    start: '#ff6b35',  // Помаранчевий
    middle: '#ffffff', // Білий
    end: '#4fc3f7'     // Синій
  }
}: EnergyWaveProps) {
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

    let time = 0;
    const waveSpeed = 0.015;
    const waveWidth = 400;

    const animate = () => {
      if (!ctx) return;

      // Очищення
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      time += waveSpeed;

      // Позиція хвилі (рухається зліва направо і повторюється)
      const waveX = ((time % 2) - 0.5) * (canvas.width + waveWidth);

      // Малюємо енергетичну хвилю
      drawEnergyWave(ctx, waveX, canvas.width, canvas.height, waveWidth, colors);

      animationRef.current = requestAnimationFrame(animate);
    };

    // Затримка перед першою хвилею
    setTimeout(() => {
      animate();
    }, 1000);

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, colors]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}

function drawEnergyWave(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  width: number,
  height: number,
  waveWidth: number,
  colors: { start: string; middle: string; end: string }
) {
  const centerY = height / 2;
  const amplitude = height * 0.15; // Висота хвилі
  const frequency = 0.008; // Частота хвилі

  // Створюємо градієнт для хвилі (помаранчевий → білий → синій)
  const gradient = ctx.createLinearGradient(
    centerX - waveWidth / 2,
    0,
    centerX + waveWidth / 2,
    0
  );

  gradient.addColorStop(0, `${colors.start}00`);
  gradient.addColorStop(0.2, `${colors.start}80`);
  gradient.addColorStop(0.4, `${colors.middle}FF`);
  gradient.addColorStop(0.6, `${colors.end}FF`);
  gradient.addColorStop(0.8, `${colors.end}80`);
  gradient.addColorStop(1, `${colors.end}00`);

  // Малюємо верхню хвилю
  ctx.beginPath();
  ctx.moveTo(centerX - waveWidth / 2, centerY);

  for (let x = centerX - waveWidth / 2; x <= centerX + waveWidth / 2; x += 2) {
    const distance = x - centerX;
    const normalizedDistance = distance / (waveWidth / 2);
    
    // Згасання на краях
    const fadeOut = Math.cos(normalizedDistance * Math.PI / 2);
    
    const y = centerY - Math.sin(x * frequency) * amplitude * fadeOut;
    ctx.lineTo(x, y);
  }

  // Малюємо нижню хвилю (дзеркальну)
  for (let x = centerX + waveWidth / 2; x >= centerX - waveWidth / 2; x -= 2) {
    const distance = x - centerX;
    const normalizedDistance = distance / (waveWidth / 2);
    const fadeOut = Math.cos(normalizedDistance * Math.PI / 2);
    
    const y = centerY + Math.sin(x * frequency) * amplitude * fadeOut;
    ctx.lineTo(x, y);
  }

  ctx.closePath();

  // Застосовуємо градієнт та blur
  ctx.fillStyle = gradient;
  ctx.filter = 'blur(20px)';
  ctx.fill();
  ctx.filter = 'none';

  // Додаємо свічення
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = gradient;
  ctx.filter = 'blur(40px)';
  ctx.fill();
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';

  // Додаємо яскраві частинки вздовж хвилі
  const particleCount = 20;
  for (let i = 0; i < particleCount; i++) {
    const t = i / particleCount;
    const x = centerX - waveWidth / 2 + t * waveWidth;
    const distance = x - centerX;
    const normalizedDistance = distance / (waveWidth / 2);
    const fadeOut = Math.cos(normalizedDistance * Math.PI / 2);
    
    const y = centerY - Math.sin(x * frequency) * amplitude * fadeOut;
    
    // Колір частинки залежить від позиції
    let particleColor;
    if (t < 0.33) {
      particleColor = colors.start;
    } else if (t < 0.66) {
      particleColor = colors.middle;
    } else {
      particleColor = colors.end;
    }

    const particleGradient = ctx.createRadialGradient(x, y, 0, x, y, 15);
    particleGradient.addColorStop(0, `${particleColor}FF`);
    particleGradient.addColorStop(1, `${particleColor}00`);

    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fillStyle = particleGradient;
    ctx.fill();
  }
}
