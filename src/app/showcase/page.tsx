import Link from 'next/link';
import { motion } from 'framer-motion';

const demos = [
  {
    title: 'Product Configurator',
    description: '3D Interactive Product Builder',
    link: '/configurator',
    gradient: 'from-yellow-500 to-amber-600',
    icon: '⚙️',
    features: ['Real-time 3D', 'Color customization', 'Live pricing'],
  },
  {
    title: 'Smooth Scroll',
    description: 'Lenis + Framer Motion + GSAP ScrollTrigger',
    link: '/demo',
    gradient: 'from-amber-500 to-orange-600',
    icon: '📜',
    features: ['Pinned sections', 'Scroll-driven animations', 'Progress tracking'],
  },
  {
    title: '3D Parallax',
    description: 'React Three Fiber + Post-processing',
    link: '/demo-3d',
    gradient: 'from-blue-500 to-cyan-600',
    icon: '🎨',
    features: ['WebGL rendering', 'Transmission materials', 'Bloom effects'],
  },
  {
    title: 'Physics Engine',
    description: 'Rapier Physics + Interactive 3D',
    link: '/physics',
    gradient: 'from-purple-500 to-pink-600',
    icon: '⚡',
    features: ['Real physics', 'Click interactions', 'Collision detection'],
  },
  {
    title: 'Gesture Controls',
    description: 'Touch & Mouse gestures + React Spring',
    link: '/gesture',
    gradient: 'from-green-500 to-emerald-600',
    icon: '🖐️',
    features: ['Drag to rotate', 'Hover effects', 'Click animations'],
  },
  {
    title: 'Cinematic Hero',
    description: 'Glass materials + Atmospheric effects',
    link: '/cinematic',
    gradient: 'from-red-500 to-rose-600',
    icon: '🎬',
    features: ['Glass morphism', 'Auto-rotate', 'Vignette & Noise'],
  },
];

const brands = [
  {
    title: 'KW Suspension',
    link: '/kw',
    gradient: 'from-amber-600 to-orange-700',
    icon: '🔧',
  },
  {
    title: 'Fi Exhaust',
    link: '/fi',
    gradient: 'from-red-600 to-rose-700',
    icon: '🔥',
  },
  {
    title: 'Eventuri',
    link: '/eventuri',
    gradient: 'from-blue-600 to-cyan-700',
    icon: '💨',
  },
];

export default function ShowcasePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900/20 via-black to-blue-900/20" />
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-radial from-amber-500/10 via-transparent to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-radial from-blue-500/10 via-transparent to-transparent blur-3xl" />

        <div className="relative z-10 text-center px-8 max-w-6xl">
          <h1 className="text-8xl md:text-9xl font-light tracking-tight mb-8">
            <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
              one
            </span>
            <span className="text-white">company</span>
          </h1>
          <p className="text-2xl md:text-3xl text-slate-300 mb-6">
            Showcase of Modern Web Technologies
          </p>
          <p className="text-lg text-slate-500 mb-12">
            Next.js 16 • React 19 • Three.js • GSAP • Framer Motion • Lenis • Rapier Physics
          </p>
          
          <div className="flex gap-4 justify-center">
            <a href="#demos" className="px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-full shadow-2xl shadow-amber-500/50 hover:shadow-amber-500/80 hover:scale-105 transition-all">
              View Demos
            </a>
            <a href="#brands" className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white font-bold rounded-full border border-white/20 hover:bg-white/20 hover:scale-105 transition-all">
              View Brands
            </a>
          </div>
        </div>
      </section>

      {/* Demos Section */}
      <section id="demos" className="py-24 px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-6xl font-bold text-white mb-4 text-center">
            Tech <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Demos</span>
          </h2>
          <p className="text-xl text-slate-400 text-center mb-16">
            Interactive showcases of cutting-edge web technologies
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {demos.map((demo, index) => (
              <Link
                key={index}
                href={demo.link}
                className="group relative p-8 bg-gradient-to-br from-white/5 to-white/10 rounded-2xl border border-white/10 hover:border-white/30 transition-all duration-500 hover:scale-105 hover:shadow-2xl"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative z-10">
                  <div className="text-6xl mb-4">{demo.icon}</div>
                  <h3 className="text-3xl font-bold text-white mb-2">{demo.title}</h3>
                  <p className="text-slate-400 mb-6">{demo.description}</p>
                  
                  <ul className="space-y-2 mb-6">
                    {demo.features.map((feature, i) => (
                      <li key={i} className="text-sm text-slate-500 flex items-center gap-2">
                        <span className="text-amber-400">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <div className={`inline-flex items-center gap-2 text-white font-medium bg-gradient-to-r ${demo.gradient} px-6 py-3 rounded-full`}>
                    Launch Demo
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Brands Section */}
      <section id="brands" className="py-24 px-8 bg-gradient-to-b from-transparent to-black/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-6xl font-bold text-white mb-4 text-center">
            Premium <span className="bg-gradient-to-r from-blue-400 to-cyan-500 bg-clip-text text-transparent">Brands</span>
          </h2>
          <p className="text-xl text-slate-400 text-center mb-16">
            Full e-commerce websites for automotive tuning brands
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {brands.map((brand, index) => (
              <Link
                key={index}
                href={brand.link}
                className="group relative p-12 bg-gradient-to-br from-white/5 to-white/10 rounded-2xl border border-white/10 hover:border-white/30 transition-all duration-500 hover:scale-105 hover:shadow-2xl text-center"
              >
                <div className="text-8xl mb-6">{brand.icon}</div>
                <h3 className="text-4xl font-bold text-white mb-4">{brand.title}</h3>
                <div className={`inline-flex items-center gap-2 text-white font-medium bg-gradient-to-r ${brand.gradient} px-8 py-3 rounded-full`}>
                  Visit Site
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="py-24 px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-6xl font-bold text-white mb-16 text-center">
            Technology <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">Stack</span>
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { name: 'Next.js 16', color: 'from-white to-slate-400' },
              { name: 'React 19', color: 'from-cyan-400 to-blue-500' },
              { name: 'Three.js', color: 'from-white to-slate-300' },
              { name: 'GSAP', color: 'from-green-400 to-emerald-500' },
              { name: 'Framer Motion', color: 'from-purple-400 to-pink-500' },
              { name: 'Lenis', color: 'from-orange-400 to-red-500' },
              { name: 'Rapier Physics', color: 'from-yellow-400 to-orange-500' },
              { name: 'Zustand', color: 'from-amber-400 to-yellow-500' },
            ].map((tech, i) => (
              <div
                key={i}
                className="p-6 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 text-center hover:scale-105 transition-transform"
              >
                <div className={`text-2xl font-bold bg-gradient-to-r ${tech.color} bg-clip-text text-transparent`}>
                  {tech.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-8 border-t border-white/10">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-slate-500">
            Created with ❤️ using the latest web technologies • 2025
          </p>
        </div>
      </footer>
    </div>
  );
}
