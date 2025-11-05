'use client';

import { useEffect, useRef } from 'react';

interface LightBeamsProps {
  isActive?: boolean;
}

export function LightBeams({ isActive = true }: LightBeamsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Beam configuration
    const beams = [
      { angle: -45, color: '#ff6b35', width: 80, blur: 40 },  // Помаранчевий верх-ліво
      { angle: 45, color: '#4fc3f7', width: 100, blur: 50 },  // Синій верх-право
      { angle: -135, color: '#4fc3f7', width: 90, blur: 45 }, // Синій низ-ліво
      { angle: 135, color: '#b565d8', width: 85, blur: 42 },  // Фіолетовий низ-право
    ];

    let rotation = 0;

    const drawBeams = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const maxLength = Math.max(canvas.width, canvas.height) * 1.5;

      // Draw central sphere glow
      const sphereGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, 200
      );
      sphereGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      sphereGradient.addColorStop(0.3, 'rgba(200, 200, 200, 0.3)');
      sphereGradient.addColorStop(0.6, 'rgba(150, 150, 150, 0.1)');
      sphereGradient.addColorStop(1, 'rgba(100, 100, 100, 0)');

      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = sphereGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 200, 0, Math.PI * 2);
      ctx.fill();

      // Draw rotating beams
      beams.forEach((beam, index) => {
        const totalAngle = beam.angle + rotation + (index * 5);
        const rad = (totalAngle * Math.PI) / 180;

        // Calculate beam endpoints
        const endX = centerX + Math.cos(rad) * maxLength;
        const endY = centerY + Math.sin(rad) * maxLength;

        // Create gradient for beam
        const gradient = ctx.createLinearGradient(centerX, centerY, endX, endY);
        
        // Parse hex color to rgb
        const r = parseInt(beam.color.slice(1, 3), 16);
        const g = parseInt(beam.color.slice(3, 5), 16);
        const b = parseInt(beam.color.slice(5, 7), 16);

        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.9)`);
        gradient.addColorStop(0.1, `rgba(${r}, ${g}, ${b}, 0.7)`);
        gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.4)`);
        gradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 0.15)`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.save();
        
        // Draw beam with blur
        ctx.filter = `blur(${beam.blur}px)`;
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = gradient;
        ctx.lineWidth = beam.width;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Draw additional glow layer
        ctx.filter = `blur(${beam.blur * 1.5}px)`;
        ctx.lineWidth = beam.width * 0.6;
        ctx.globalAlpha = 0.5;
        ctx.stroke();

        ctx.restore();
      });

      // Draw particles along beams
      beams.forEach((beam, beamIndex) => {
        const particleCount = 8;
        for (let i = 0; i < particleCount; i++) {
          const progress = (i / particleCount) + (rotation / 360) % 1;
          const distance = progress * maxLength * 0.8;
          
          const totalAngle = beam.angle + rotation + (beamIndex * 5);
          const rad = (totalAngle * Math.PI) / 180;
          
          const x = centerX + Math.cos(rad) * distance;
          const y = centerY + Math.sin(rad) * distance;
          
          const r = parseInt(beam.color.slice(1, 3), 16);
          const g = parseInt(beam.color.slice(3, 5), 16);
          const b = parseInt(beam.color.slice(5, 7), 16);
          
          const alpha = 1 - progress;
          const size = (1 - progress) * 6;

          ctx.save();
          ctx.filter = `blur(${size * 2}px)`;
          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });

      // Slow rotation
      rotation += 0.1;
    };

    const animate = () => {
      drawBeams();
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}
