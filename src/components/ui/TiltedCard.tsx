'use client';

import React, { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

export const TiltedCard = ({
  children,
  className = "",
  containerClassName = "",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  onClick?: () => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseX = useSpring(x, { stiffness: 500, damping: 100 });
  const mouseY = useSpring(y, { stiffness: 500, damping: 100 });

  const rotateX = useTransform(mouseY, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-10deg", "10deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();

    const width = rect.width;
    const height = rect.height;

    const mouseXFromCenter = e.clientX - rect.left - width / 2;
    const mouseYFromCenter = e.clientY - rect.top - height / 2;

    const xPct = mouseXFromCenter / width;
    const yPct = mouseYFromCenter / height;

    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateY,
        rotateX,
        transformStyle: "preserve-3d",
      }}
      className={`relative h-full w-full cursor-pointer transition-all duration-200 ease-linear ${containerClassName}`}
    >
      <div
        style={{
          transform: "translateZ(20px)",
          transformStyle: "preserve-3d",
        }}
        className={`relative h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50 shadow-2xl backdrop-blur-xl transition-colors hover:bg-zinc-900/80 ${className}`}
      >
        <div 
            className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none"
            style={{
                background: 'linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.05) 25%, transparent 30%)'
            }}
        />
        {children}
      </div>
    </motion.div>
  );
};
