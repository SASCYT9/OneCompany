'use client';

import { useEffect, useState } from 'react';

export default function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const currentProgress = (window.scrollY / totalHeight) * 100;
      setProgress(currentProgress);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* Top progress bar - Liquid Glass */}
      <div 
        className="fixed top-0 left-0 right-0 h-1 z-50 overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.03)',
        }}
      >
        <div 
          className="h-full bg-gradient-to-r from-orange-500 via-red-500 to-blue-500 transition-all duration-500 ease-out relative"
          style={{ 
            width: `${progress}%`,
            boxShadow: '0 0 20px rgba(255,136,0,0.8), 0 0 40px rgba(255,68,68,0.4)',
          }}
        >
          {/* Glass shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
        </div>
      </div>

      {/* Circular progress indicator - Liquid Glass */}
      <div className="fixed bottom-10 right-10 z-50 hidden md:block">
        <div 
          className="relative w-24 h-24 rounded-full p-2"
          style={{
            background: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(40px) saturate(180%)',
            boxShadow: `
              inset 0 1px 0 0 rgba(255,255,255,0.1),
              0 8px 32px rgba(0,0,0,0.4),
              0 0 0 1px rgba(255,255,255,0.08)
            `,
          }}
        >
          <div className="relative w-20 h-20">
            <svg className="transform -rotate-90 w-20 h-20">
            <circle
                cx="40"
                cy="40"
                r="36"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="2.5"
              fill="none"
            />
            <circle
                cx="40"
                cy="40"
                r="36"
              stroke="url(#gradient)"
                strokeWidth="2.5"
              fill="none"
                strokeDasharray={`${2 * Math.PI * 36}`}
                strokeDashoffset={`${2 * Math.PI * 36 * (1 - progress / 100)}`}
                className="transition-all duration-700 ease-out"
                strokeLinecap="round"
                style={{
                  filter: 'drop-shadow(0 0 12px rgba(255,136,0,0.8))',
                }}
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ff8800" />
                  <stop offset="50%" stopColor="#ff4444" />
                  <stop offset="100%" stopColor="#00aaff" />
              </linearGradient>
            </defs>
          </svg>
            <div 
              className="absolute inset-0 flex items-center justify-center text-base font-light tracking-wider"
              style={{
                color: 'rgba(255,255,255,0.9)',
                textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}
            >
            {Math.round(progress)}%
          </div>
        </div>
        
        {/* Glass edge highlight */}
        <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/10 pointer-events-none" />
      </div>
      </div>
    </>
  );
}
