'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'

export const OnePage = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [currentSection, setCurrentSection] = useState(0)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end']
  })

  // Track which section is currently visible
  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (progress) => {
      if (progress < 0.25) setCurrentSection(0)
      else if (progress < 0.5) setCurrentSection(1)
      else if (progress < 0.75) setCurrentSection(2)
      else setCurrentSection(3)
    })
    return () => unsubscribe()
  }, [scrollYProgress])

  const sections = [
    {
      id: 'hero',
      video: '/videos/hero-smoke.mp4',
      title: 'OneCompany',
      subtitle: 'Преміум автомобільні компоненти',
      description: 'Ексклюзивний дистриб\'ютор найкращих світових брендів в Україні',
      color: '#ffffff',
      textColor: 'text-white'
    },
    {
      id: 'kw',
      video: '/videos/kw-suspension.mp4',
      title: 'KW Suspension',
      subtitle: 'Німецька інженерна досконалість',
      description: 'Підвіска преміум-класу для максимального контролю та комфорту',
      color: '#ff6b00',
      textColor: 'text-orange-400'
    },
    {
      id: 'fi',
      video: '/videos/fi-exhaust.mp4',
      title: 'Fi Exhaust',
      subtitle: 'Американська потужність звуку',
      description: 'Титанові вихлопні системи з неперевершеним звучанням',
      color: '#ff0000',
      textColor: 'text-red-400'
    },
    {
      id: 'eventuri',
      video: '/videos/eventuri-intake.mp4',
      title: 'Eventuri',
      subtitle: 'Британські технології впуску',
      description: 'Інноваційні системи впуску повітря для максимальної потужності',
      color: '#0066ff',
      textColor: 'text-blue-400'
    }
  ]

  return (
    <div ref={containerRef} className="relative">
      {/* Video backgrounds */}
      {sections.map((section, index) => {
        const videoRef = useRef<HTMLVideoElement>(null)
        const isActive = currentSection === index
        
        useEffect(() => {
          if (videoRef.current) {
            if (isActive) {
              videoRef.current.play().catch(() => {})
            } else {
              videoRef.current.pause()
            }
          }
        }, [isActive])

        return (
          <div
            key={section.id}
            className="fixed inset-0 w-full h-full transition-opacity duration-1000"
            style={{
              opacity: isActive ? 1 : 0,
              zIndex: 0
            }}
          >
            <video
              ref={videoRef}
              src={section.video}
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                filter: index === 0 ? 'blur(3px) brightness(0.3)' : 'blur(2px) brightness(0.4)',
              }}
            />
            
            {/* Brand color overlay */}
            <div 
              className="absolute inset-0 mix-blend-overlay"
              style={{
                background: index === 0 
                  ? `radial-gradient(ellipse at 30% 50%, #ff6b0030 0%, transparent 50%), radial-gradient(ellipse at 70% 50%, #0066ff30 0%, transparent 50%)`
                  : `radial-gradient(circle at 50% 50%, ${section.color}20 0%, transparent 70%)`
              }}
            />
            
            {/* Glow effect for hero */}
            {index === 0 && (
              <>
                <div 
                  className="absolute inset-0"
                  style={{
                    background: 'radial-gradient(ellipse 800px 400px at 30% 50%, rgba(255,107,0,0.15) 0%, transparent 60%)',
                    filter: 'blur(40px)'
                  }}
                />
                <div 
                  className="absolute inset-0"
                  style={{
                    background: 'radial-gradient(ellipse 800px 400px at 70% 50%, rgba(0,102,255,0.15) 0%, transparent 60%)',
                    filter: 'blur(40px)'
                  }}
                />
              </>
            )}
            
            {/* Vignette */}
            <div 
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(circle at 50% 50%, transparent 0%, rgba(0,0,0,0.5) 100%)'
              }}
            />
          </div>
        )
      })}

      {/* Content sections */}
      <div className="relative z-10">
        {sections.map((section, index) => (
          <section
            key={section.id}
            className="h-screen w-full flex items-center justify-center px-8"
          >
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.5 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="text-center max-w-5xl"
            >
              {/* Glass container - less visible for hero */}
              <div
                className="relative rounded-[2.5rem] p-12 md:p-16"
                style={{
                  background: index === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.03)',
                  backdropFilter: index === 0 ? 'none' : 'blur(60px) saturate(180%)',
                  border: index === 0 ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: index === 0 ? 'none' : `
                    inset 0 1px 1px rgba(255, 255, 255, 0.1),
                    0 8px 32px rgba(0, 0, 0, 0.4),
                    0 0 80px ${section.color}30
                  `
                }}
              >
                {/* Shimmer effect - only for product sections */}
                {index !== 0 && (
                  <div
                    className="absolute inset-0 rounded-[2.5rem] opacity-30"
                    style={{
                      background: `linear-gradient(135deg, transparent 40%, ${section.color}20 50%, transparent 60%)`,
                      backgroundSize: '200% 200%',
                      animation: 'shimmer 3s ease-in-out infinite'
                    }}
                  />
                )}

                {/* Content */}
                <div className="relative z-10">
                  {index === 0 ? (
                    // Hero section - inspired by the image
                    <>
                      <motion.div className="relative">
                        {/* Glow layers behind text */}
                        <div
                          className="absolute inset-0 blur-3xl opacity-60"
                          style={{
                            background: 'linear-gradient(90deg, #ff6b00 0%, transparent 30%, transparent 70%, #0066ff 100%)',
                            transform: 'scale(1.2)'
                          }}
                        />
                        <motion.h1
                          className="relative text-6xl md:text-8xl lg:text-9xl font-black mb-8 lowercase"
                          style={{
                            background: 'linear-gradient(90deg, #ff8c00 0%, #ffaa44 15%, #ffffff 35%, #ffffff 65%, #44aaff 85%, #0088ff 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            letterSpacing: '-0.03em',
                            filter: 'drop-shadow(0 0 60px rgba(255,255,255,0.4)) drop-shadow(0 0 100px rgba(255,107,0,0.3)) drop-shadow(0 0 100px rgba(0,102,255,0.3))'
                          }}
                        >
                          onecompany
                        </motion.h1>
                      </motion.div>
                      <motion.p
                        className="text-xl md:text-2xl lg:text-3xl text-white/95 font-light tracking-wide"
                        style={{
                          textShadow: '0 2px 30px rgba(0,0,0,0.8), 0 0 60px rgba(255,255,255,0.2)'
                        }}
                      >
                        Преміум автотюнінг. Три напрями. Одна філософія.
                      </motion.p>
                    </>
                  ) : (
                    // Product sections
                    <>
                      <motion.h2
                        className={`text-5xl md:text-7xl font-black mb-4 ${section.textColor}`}
                        style={{
                          textShadow: `0 0 60px ${section.color}60, 0 0 30px ${section.color}40`,
                          letterSpacing: '-0.02em'
                        }}
                      >
                        {section.title}
                      </motion.h2>
                      <motion.p
                        className="text-xl md:text-2xl text-white/90 font-light mb-3"
                        style={{
                          textShadow: '0 2px 20px rgba(0,0,0,0.5)'
                        }}
                      >
                        {section.subtitle}
                      </motion.p>
                      <motion.p
                        className="text-base md:text-lg text-white/70 max-w-xl mx-auto mb-8"
                        style={{
                          textShadow: '0 2px 20px rgba(0,0,0,0.5)'
                        }}
                      >
                        {section.description}
                      </motion.p>

                      {/* Feature pills */}
                      <div className="flex flex-wrap gap-3 justify-center mb-8">
                        {['Преміум якість', 'Гарантія', 'Доставка'].map((feature) => (
                          <span
                            key={feature}
                            className="px-6 py-2 rounded-full text-sm font-medium"
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              backdropFilter: 'blur(40px)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: 'white',
                              boxShadow: `inset 0 1px 1px rgba(255, 255, 255, 0.1), 0 4px 16px rgba(0, 0, 0, 0.2)`
                            }}
                          >
                            {feature}
                          </span>
                        ))}
                      </div>

                      {/* Glass CTA button */}
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="px-10 py-4 rounded-full text-base font-semibold relative overflow-hidden group"
                        style={{
                          background: 'rgba(255, 255, 255, 0.1)',
                          backdropFilter: 'blur(40px)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          boxShadow: `
                            inset 0 1px 1px rgba(255, 255, 255, 0.2),
                            0 8px 32px rgba(0, 0, 0, 0.3),
                            0 0 40px ${section.color}30
                          `,
                          color: 'white',
                          textShadow: '0 2px 10px rgba(0,0,0,0.3)'
                        }}
                      >
                        <span className="relative z-10">Дізнатись більше</span>
                        <div
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                          style={{
                            background: `linear-gradient(135deg, ${section.color}40, transparent)`,
                          }}
                        />
                      </motion.button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </section>
        ))}
      </div>

      {/* Scroll indicator (only on hero) */}
      <motion.div
        className="fixed bottom-12 left-1/2 -translate-x-1/2 z-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: currentSection === 0 ? 1 : 0 }}
        transition={{ duration: 0.5 }}
      >
        <div
          className="w-8 h-14 rounded-full flex items-start justify-center p-2"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(40px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.1), 0 8px 32px rgba(0, 0, 0, 0.3)'
          }}
        >
          <motion.div
            className="w-2 h-2 rounded-full bg-white"
            animate={{ y: [0, 24, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              boxShadow: '0 0 20px rgba(255, 255, 255, 0.8)'
            }}
          />
        </div>
      </motion.div>
    </div>
  )
}
