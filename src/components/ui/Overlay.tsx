'use client'

interface SectionProps {
  title: string
  subtitle: string
  description: string
  features: string[]
  color: string
  scrollProgress: number
  index: number
}

const Section = ({ title, subtitle, description, features, color, scrollProgress, index }: SectionProps) => {
  // Calculate if this section is active based on scroll progress
  const sectionStart = (index + 1) / 4 // Account for hero page
  const sectionEnd = (index + 2) / 4
  const isActive = scrollProgress >= sectionStart && scrollProgress < sectionEnd
  const fadeProgress = isActive ? Math.min((scrollProgress - sectionStart) / 0.1, 1) : 0
  const scaleProgress = 0.95 + (fadeProgress * 0.05) // Scale from 0.95 to 1
  
  return (
    <section
      className="h-screen w-screen flex items-center justify-start p-8 md:p-16 lg:p-24 pointer-events-none"
      style={{
        opacity: fadeProgress,
        transform: `translateY(${(1 - fadeProgress) * 40}px) scale(${scaleProgress})`,
        transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s ease-out',
      }}
    >
      {/* Liquid Glass Card */}
      <div 
        className="max-w-3xl rounded-[2.5rem] overflow-hidden relative"
        style={{
          background: 'rgba(0, 0, 0, 0.25)',
          backdropFilter: 'blur(60px) saturate(180%)',
          boxShadow: `
            inset 0 1px 0 0 rgba(255,255,255,0.1),
            0 20px 60px rgba(0,0,0,0.5),
            0 0 0 1px rgba(255,255,255,0.05)
          `,
        }}
      >
        {/* Glass Inner Glow */}
        <div 
          className="absolute inset-0 rounded-[2.5rem] opacity-40"
          style={{
            background: `radial-gradient(circle at top left, ${color}15, transparent 60%)`,
          }}
        />

        {/* Content Container */}
        <div className="relative z-10 p-10 md:p-14 space-y-8">
          {/* Header */}
          <div className="space-y-4">
            <h3 
              className="text-sm md:text-base font-light tracking-[0.3em] uppercase"
              style={{ 
                color: `${color}dd`,
                textShadow: `0 0 20px ${color}40`,
              }}
            >
              {subtitle}
            </h3>
            <h2 
              className="text-6xl md:text-8xl lg:text-9xl font-bold leading-none tracking-tight"
              style={{
                color: '#ffffff',
                textShadow: `0 0 40px ${color}30`,
                WebkitTextStroke: '0.5px rgba(255,255,255,0.1)',
              }}
            >
              {title}
            </h2>
          </div>
        
          {/* Description */}
          <p 
            className="text-xl md:text-2xl font-light leading-relaxed max-w-2xl"
            style={{
              color: 'rgba(255,255,255,0.85)',
              textShadow: '0 2px 10px rgba(0,0,0,0.3)',
            }}
          >
            {description}
          </p>

          {/* Features Grid - Glass Pills */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {features.map((feature, idx) => (
              <div 
                key={idx}
                className="rounded-2xl p-5 relative overflow-hidden group"
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: `
                    inset 0 1px 0 0 rgba(255,255,255,0.08),
                    0 0 0 1px rgba(255,255,255,0.04)
                  `,
                  transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                {/* Hover Glow */}
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: `radial-gradient(circle at center, ${color}10, transparent)`,
                  }}
                />
                
                <p 
                  className="relative z-10 text-base md:text-lg font-medium tracking-wide"
                  style={{ color: 'rgba(255,255,255,0.9)' }}
                >
                  {feature}
                </p>
              </div>
            ))}
          </div>

          {/* CTA Button - Liquid Glass */}
          <div className="pt-6 pointer-events-auto">
            <button 
              className="group relative px-10 py-5 rounded-full font-semibold text-white text-lg transition-all duration-500 overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${color}40, ${color}20)`,
                backdropFilter: 'blur(20px) saturate(180%)',
                boxShadow: `
                  inset 0 1px 0 0 rgba(255,255,255,0.15),
                  0 8px 32px ${color}30,
                  0 0 0 1px ${color}20
                `,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05) translateY(-2px)'
                e.currentTarget.style.boxShadow = `
                  inset 0 1px 0 0 rgba(255,255,255,0.2),
                  0 12px 48px ${color}50,
                  0 0 0 1px ${color}40
                `
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1) translateY(0)'
                e.currentTarget.style.boxShadow = `
                  inset 0 1px 0 0 rgba(255,255,255,0.15),
                  0 8px 32px ${color}30,
                  0 0 0 1px ${color}20
                `
              }}
            >
              <span className="relative z-10 tracking-wide">Explore More</span>
              
              {/* Shimmer Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            </button>
          </div>
        </div>

        {/* Glass Edge Highlight */}
        <div className="absolute inset-0 rounded-[2.5rem] ring-1 ring-inset ring-white/10 pointer-events-none" />
      </div>
    </section>
  )
}

interface OverlayProps {
  scrollProgress: number
}

export const Overlay = ({ scrollProgress }: OverlayProps) => {
  const sections = [
    {
      title: 'KW',
      subtitle: 'Suspension Systems',
      description: 'Precision engineered coilovers that redefine your driving experience. German engineering meets motorsport performance.',
      features: ['Height Adjustable', 'Rebound Damping', 'TÜV Certified', 'Track Ready'],
      color: '#ff8800',
    },
    {
      title: 'Fi',
      subtitle: 'Exhaust Systems',
      description: 'Unleash the true voice of your engine. Valvetronic technology for the ultimate sound experience.',
      features: ['Valvetronic Control', 'Titanium Construction', '+20 HP Gain', 'Lifetime Warranty'],
      color: '#ff4444',
    },
    {
      title: 'Eventuri',
      subtitle: 'Intake Systems',
      description: 'The art of airflow. Carbon fiber intake systems engineered through computational fluid dynamics.',
      features: ['CFD Optimized', 'Carbon Fiber', '+15% Airflow', 'Dyno Proven'],
      color: '#00aaff',
    },
  ]

  return (
    <div className="fixed inset-0 z-[45] pointer-events-none">
      <div className="w-screen h-screen relative">
        {sections.map((section, idx) => (
          <Section
            key={idx}
            {...section}
            index={idx}
            scrollProgress={scrollProgress}
          />
        ))}
      </div>
    </div>
  )
}


