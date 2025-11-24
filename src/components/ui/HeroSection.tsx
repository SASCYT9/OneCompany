'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import MagneticButton from './MagneticButton'

export const HeroSection = () => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(e => console.log('Video autoplay prevented:', e))
    }
  }, [])

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Video Background with Liquid Glass Effect */}
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          onLoadedData={() => setIsLoaded(true)}
          className="w-full h-full object-cover scale-105"
          style={{ 
            filter: 'blur(2px) brightness(0.5) saturate(1.2)',
          }}
        >
          <source src="/videos/rollsbg-v2.mp4" type="video/mp4" />
        </video>
        
        {/* Liquid Glass Layers - iPhone Style */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/70" 
             style={{ backdropFilter: 'blur(20px)' }} />
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/8 via-transparent via-50% to-blue-500/8" />
        
        {/* Depth Layer */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
      </div>
      {/* Hero Content - Liquid Glass Container */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-12 px-8 max-w-5xl">
          {/* Glass Card Container */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 40, scale: isLoaded ? 1 : 0.95 }}
            transition={{ duration: 1.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative p-12 md:p-16 rounded-[2.5rem] overflow-hidden"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(40px) saturate(180%)',
              boxShadow: `
                inset 0 1px 0 0 rgba(255,255,255,0.1),
                0 8px 32px rgba(0,0,0,0.4),
                0 0 0 1px rgba(255,255,255,0.05)
              `,
            }}
          >
            {/* Shimmer Effect */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent animate-pulse" />
            </div>

            <div className="relative z-10 space-y-8">
              <h1 className="text-7xl md:text-9xl lg:text-[10rem] font-bold leading-none tracking-tight">
                <motion.span
                  initial="hidden"
                  animate={isLoaded ? 'visible' : 'hidden'}
                  variants={{
                    hidden: {},
                    visible: {
                      transition: { staggerChildren: 0.08 }
                    }
                  }}
                  className="inline-block"
                >
                  {['one', 'company'].map((chunk, i) => (
                    <motion.span
                      key={chunk}
                      variants={{
                        hidden: { opacity: 0, y: 24, scale: 0.95 },
                        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } }
                      }}
                      className={i === 0 ? 'mr-3' : ''}
                    >
                      <span className="bg-gradient-to-br from-white via-orange-200 to-blue-200 bg-clip-text text-transparent inline-block"
                        style={{
                          filter: 'drop-shadow(0 0 60px rgba(255,136,0,0.3))',
                          WebkitTextStroke: '1px rgba(255,255,255,0.1)'
                        }}
                      >
                        {chunk}
                      </span>
                    </motion.span>
                  ))}
                </motion.span>
              </h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: isLoaded ? 1 : 0 }}
                transition={{ duration: 1.2, delay: 0.8 }}
                className="text-2xl md:text-4xl font-light text-white/90 tracking-wide"
                style={{
                  textShadow: '0 2px 20px rgba(0,0,0,0.5)',
                }}
              >
                Преміум автотюнінг. Три напрями. Одна філософія.
              </motion.p>
            </div>

            {/* Glass Edge Highlight */}
            <div className="absolute inset-0 rounded-[2.5rem] ring-1 ring-inset ring-white/10 pointer-events-none" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: isLoaded ? 1 : 0, scale: isLoaded ? 1 : 0.9 }}
            transition={{ duration: 1.2, delay: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="pt-4"
          >
            <div className="inline-block pointer-events-auto">
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  boxShadow: `
                    inset 0 1px 0 0 rgba(255,255,255,0.15),
                    0 4px 24px rgba(0,0,0,0.3),
                    0 0 0 1px rgba(255,255,255,0.08)
                  `,
                }}
                className="rounded-full inline-block"
              >
                <MagneticButton
                  className="group relative px-14 py-6 rounded-full text-white text-lg font-medium transition-all duration-700 overflow-hidden"
                >
                <span className="relative z-10 tracking-wide">Почати подорож</span>
                
                {/* Animated Gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 via-red-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                
                {/* Glass Shine Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </MagneticButton>
              </div>
            </div>
          </motion.div>

          {/* Scroll Indicator - Glass Style */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 0.7 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 1.5, delay: 1.8 }}
            className="absolute bottom-16 left-1/2 transform -translate-x-1/2"
          >
            <div className="flex flex-col items-center space-y-3">
              <span className="text-white/50 text-xs uppercase tracking-[0.3em] font-light">Scroll</span>
              <motion.div
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="w-7 h-12 rounded-full flex items-start justify-center p-2"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.1), 0 0 0 1px rgba(255,255,255,0.08)',
                }}
              >
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-1 h-3 bg-gradient-to-b from-white/80 to-white/20 rounded-full"
                  style={{ filter: 'blur(0.5px)' }}
                />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
