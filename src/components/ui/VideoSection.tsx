'use client'

import { useEffect, useRef } from 'react'

interface VideoSectionProps {
  videoSrc: string
  isActive: boolean
  opacity: number
  brandColor?: string
}

export const VideoSection = ({ videoSrc, isActive, opacity, brandColor = '#ffffff' }: VideoSectionProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!videoRef.current) return

    if (isActive && opacity > 0.1) {
      videoRef.current.play().catch(err => {
        console.log('Video play prevented:', err)
      })
    } else {
      videoRef.current.pause()
    }
  }, [isActive, opacity])

  return (
    <div 
      className="fixed inset-0 w-full h-full transition-opacity duration-1000"
      style={{ 
        opacity: Math.max(0, Math.min(1, opacity)),
        zIndex: 0
      }}
    >
      {/* Video layer */}
      <video
        ref={videoRef}
        src={videoSrc}
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          filter: 'blur(2px) brightness(0.5)',
        }}
      />
      
      {/* Gradient overlay for brand color tint */}
      <div 
        className="absolute inset-0 mix-blend-overlay"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${brandColor}20 0%, transparent 70%)`
        }}
      />
      
      {/* Vignette effect */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 50%, transparent 0%, rgba(0,0,0,0.4) 100%)'
        }}
      />
      
      {/* Glass texture layer */}
      <div 
        className="absolute inset-0 mix-blend-soft-light opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(45deg, transparent 48%, ${brandColor}10 50%, transparent 52%),
            linear-gradient(-45deg, transparent 48%, ${brandColor}10 50%, transparent 52%)
          `,
          backgroundSize: '20px 20px'
        }}
      />
    </div>
  )
}
