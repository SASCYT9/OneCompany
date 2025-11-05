'use client';

import Link from 'next/link';
import { useState } from 'react';

interface StoreCardProps {
  name: string;
  url: string;
  description: string;
  tagline: string;
  color: string;
  category: string;
}

export function StoreCard({ name, url, description, tagline, color, category }: StoreCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block h-[550px] pointer-events-auto"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main card container */}
      <div className="relative h-full overflow-hidden rounded-3xl border border-white/10 bg-black/50 backdrop-blur-2xl transition-all duration-700 hover:border-white/30 hover:scale-[1.03] card-glow">
        
        {/* Animated gradient background - більш яскравий */}
        <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-30 transition-opacity duration-700 blur-3xl gradient-shift`} />
        
        {/* Animated border gradient - neon effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
          <div className={`absolute inset-[-3px] bg-gradient-to-br ${color} rounded-3xl blur-lg -z-10`} style={{
            animation: isHovered ? 'neonPulse 2s ease-in-out infinite' : 'none'
          }} />
        </div>

        {/* Premium mesh overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.03),transparent_50%)] pointer-events-none" />

        {/* Content */}
        <div className="relative h-full flex flex-col p-10">
          
          {/* Category badge with glow */}
          <div className="mb-8">
            <span className={`px-5 py-2 rounded-full bg-gradient-to-r ${color} bg-opacity-10 backdrop-blur-md border border-white/20 text-xs font-medium text-white uppercase tracking-[0.3em] shadow-lg transition-all duration-300 group-hover:shadow-2xl group-hover:scale-105`}>
              {category}
            </span>
          </div>

          {/* Tagline with neon */}
          <div className="mb-6">
            <p className={`text-base font-light uppercase tracking-[0.4em] bg-gradient-to-r ${color} bg-clip-text text-transparent transition-all duration-500 group-hover:tracking-[0.5em] neon-pulse`}>
              {tagline}
            </p>
          </div>

          {/* Store name - більш імпозантний */}
          <h3 className="text-6xl font-extralight text-white mb-6 transition-all duration-500 group-hover:scale-110 group-hover:tracking-wider leading-tight">
            {name}
          </h3>

          {/* Description - більш читабельний */}
          <p className="text-xl font-light text-white/70 mb-10 leading-relaxed max-w-md transition-all duration-500 group-hover:text-white/90">
            {description}
          </p>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Enter button - більш ефектний */}
          <div className="relative mb-4">
            <div className={`flex items-center gap-4 text-white transition-all duration-700 ${isHovered ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'}`}>
              <div className={`h-[2px] flex-1 bg-gradient-to-r ${color} transition-all duration-700 shadow-lg ${isHovered ? 'w-full shadow-2xl' : 'w-0'}`} />
              <span className="text-xl font-light uppercase tracking-[0.3em] whitespace-nowrap">Відкрити магазин</span>
              <span className="text-3xl transform transition-all duration-500 group-hover:translate-x-3 group-hover:scale-125">→</span>
            </div>
          </div>

          {/* Premium features indicators */}
          <div className={`transition-all duration-700 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2 text-white/50">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-lg shadow-emerald-500/50" />
                <span className="font-light tracking-wide">Live Store</span>
              </div>
              <div className="flex items-center gap-2 text-white/50">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shadow-lg shadow-blue-500/50" />
                <span className="font-light tracking-wide">Premium Quality</span>
              </div>
            </div>
          </div>
        </div>

        {/* Hover scan effect - більш помітний */}
        <div className={`absolute inset-0 transition-opacity duration-1000 pointer-events-none ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          <div className={`absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-transparent animate-scan`} />
        </div>

        {/* Corner accent - більш драматичний */}
        <div className="absolute top-0 right-0 w-48 h-48 overflow-hidden rounded-tr-3xl">
          <div className={`absolute top-0 right-0 w-full h-full bg-gradient-to-br ${color} opacity-20 blur-3xl transform rotate-45 translate-x-24 -translate-y-24 transition-all duration-700 group-hover:translate-x-12 group-hover:-translate-y-12 group-hover:opacity-40`} />
        </div>

        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-3xl">
          <div className={`h-full bg-gradient-to-r ${color} transition-all duration-700 ${isHovered ? 'w-full opacity-100' : 'w-0 opacity-0'}`} />
        </div>
      </div>
    </Link>
  );
}

