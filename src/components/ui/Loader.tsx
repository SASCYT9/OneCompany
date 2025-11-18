'use client'

import { Html, useProgress } from '@react-three/drei'

export const Loader = () => {
  const { progress } = useProgress()

  return (
    <Html center>
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="relative w-32 h-32">
          <svg className="transform -rotate-90 w-32 h-32">
            <circle
              cx="64"
              cy="64"
              r="60"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="64"
              cy="64"
              r="60"
              stroke="url(#loadGradient)"
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 60}`}
              strokeDashoffset={`${2 * Math.PI * 60 * (1 - progress / 100)}`}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
            <defs>
              <linearGradient id="loadGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff8800" />
                <stop offset="50%" stopColor="#ff4444" />
                <stop offset="100%" stopColor="#00aaff" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
        <p className="text-white text-lg font-light tracking-wider">
          Loading Experience...
        </p>
      </div>
    </Html>
  )
}
