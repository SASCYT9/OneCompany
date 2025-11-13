"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ReactNode } from "react";

interface AnimatedButtonProps {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function AnimatedButton({
  href,
  onClick,
  children,
  variant = "outline",
  size = "md",
  className = "",
}: AnimatedButtonProps) {
  const baseStyles = "inline-block uppercase tracking-widest font-light transition-all duration-300 relative overflow-hidden group";
  
  const variants = {
    primary: "bg-zinc-900 dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-white/90",
    outline: "border border-zinc-400 dark:border-white/30 hover:border-zinc-900 dark:hover:border-white text-zinc-900 dark:text-white hover:bg-zinc-900 dark:hover:bg-white hover:text-white dark:hover:text-black",
    ghost: "text-zinc-900 dark:text-white hover:text-zinc-600 dark:hover:text-white/70",
  };

  const sizes = {
    sm: "px-8 py-3 text-xs",
    md: "px-12 py-4 text-sm",
    lg: "px-16 py-5 text-base",
  };

  const combinedClassName = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`;

  const ButtonContent = () => (
    <>
      {/* Shine effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        initial={{ x: "-200%" }}
        whileHover={{ x: "200%" }}
        transition={{ duration: 0.6 }}
      />
      
      {/* Button text */}
      <span className="relative z-10">{children}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={combinedClassName}>
        <ButtonContent />
      </Link>
    );
  }

  return (
    <motion.button
      onClick={onClick}
      className={combinedClassName}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <ButtonContent />
    </motion.button>
  );
}
