"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  hoverScale?: number;
}

export default function AnimatedCard({
  children,
  className = "",
  hoverScale = 1.02,
}: AnimatedCardProps) {
  return (
    <motion.div
      className={`relative overflow-hidden group ${className}`}
      whileHover={{ scale: hoverScale }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Gradient border effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-100/10 via-transparent to-zinc-100/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 dark:from-white/10 dark:to-white/5" />
      
      {/* Shine effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-500/10 to-transparent -translate-x-full dark:via-white/10"
        whileHover={{ x: "200%" }}
        transition={{ duration: 0.8 }}
      />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
}
