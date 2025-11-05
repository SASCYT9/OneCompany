'use client';

import Link from 'next/link';
import { HTMLAttributes } from 'react';

interface PremiumButtonProps extends HTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
  variant?: 'neon' | 'minimal' | 'glass';
  icon?: React.ReactNode;
}

export function PremiumButton({
  href,
  children,
  variant = 'neon',
  icon,
  className = '',
  ...props
}: PremiumButtonProps) {
  const baseClasses = 'group relative inline-flex items-center gap-3 px-8 py-4 font-thin text-lg transition-all duration-500 overflow-hidden pointer-events-auto';

  const variantClasses = {
    neon: `
      text-white border border-cyan-400/50
      hover:border-cyan-400
      hover:shadow-[0_0_20px_rgba(79,195,247,0.6)]
      before:absolute before:inset-0 
      before:bg-gradient-to-r before:from-cyan-500/0 before:via-cyan-500/20 before:to-cyan-500/0
      before:translate-x-[-100%] before:transition-transform before:duration-700
      hover:before:translate-x-[100%]
    `,
    minimal: `
      text-white/80 hover:text-white
      after:absolute after:bottom-0 after:left-0 after:h-[1px] 
      after:w-0 after:bg-gradient-to-r after:from-transparent after:via-white after:to-transparent
      after:transition-all after:duration-500
      hover:after:w-full
    `,
    glass: `
      text-white backdrop-blur-md bg-white/5
      border border-white/10
      hover:bg-white/10 hover:border-white/20
      shadow-lg hover:shadow-2xl
    `,
  };

  return (
    <Link
      href={href}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {/* Background glow effect */}
      {variant === 'neon' && (
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 blur-xl" />
        </div>
      )}

      {/* Content */}
      <span className="relative z-10 flex items-center gap-3">
        {icon && <span className="transition-transform duration-300 group-hover:scale-110">{icon}</span>}
        <span className="relative">
          {children}
          {/* Underline animation for minimal variant */}
          {variant === 'minimal' && (
            <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-white transition-all duration-300 group-hover:w-full" />
          )}
        </span>
      </span>

      {/* Arrow indicator */}
      <span className="relative z-10 transform transition-transform duration-300 group-hover:translate-x-1">
        →
      </span>
    </Link>
  );
}
