'use client';

import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Float, Center, OrbitControls, MeshTransmissionMaterial } from '@react-three/drei';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';

// 3D Logo Component
function Logo3D({ scrollProgress }: { scrollProgress: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = scrollProgress * Math.PI * 2;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.2;
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.3;
    }
  });

  return (
    <Center>
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
        <mesh ref={meshRef}>
          <torusKnotGeometry args={[1, 0.3, 128, 16]} />
          <MeshTransmissionMaterial
            backside
            samples={16}
            resolution={512}
            transmission={1}
            roughness={0.2}
            thickness={0.5}
            ior={1.5}
            chromaticAberration={0.5}
            anisotropy={0.3}
            distortion={0.2}
            distortionScale={0.5}
            temporalDistortion={0.1}
            color="#fbbf24"
          />
        </mesh>
      </Float>
    </Center>
  );
}

// 3D Scene Component
function Scene({ scrollProgress }: { scrollProgress: number }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#3b82f6" />
      <Logo3D scrollProgress={scrollProgress} />
      <Environment preset="city" />
      <EffectComposer>
        <Bloom
          intensity={1.5}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          blendFunction={BlendFunction.SCREEN}
        />
        <ChromaticAberration
          offset={new THREE.Vector2(0.002, 0.002)}
          blendFunction={BlendFunction.NORMAL}
        />
      </EffectComposer>
      <OrbitControls enableZoom={false} enablePan={false} />
    </>
  );
}

// Main Component
export default function Modern3DParallax() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Smooth spring animation
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  // Transform values
  const y = useTransform(smoothProgress, [0, 1], ['0%', '100%']);
  const opacity = useTransform(smoothProgress, [0, 0.5, 1], [1, 0.5, 0]);

  // Update 3D scroll progress
  smoothProgress.on('change', (latest) => setScrollProgress(latest));

  return (
    <div ref={containerRef} className="relative bg-black">
      {/* 3D Hero Section */}
      <div className="h-screen sticky top-0">
        <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
          <Scene scrollProgress={scrollProgress} />
        </Canvas>

        {/* Overlay Content */}
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ opacity }}
        >
          <motion.h1
            className="text-8xl font-bold text-white mb-4"
            style={{ y: useTransform(smoothProgress, [0, 1], ['0%', '-200%']) }}
          >
            onecompany
          </motion.h1>
          <motion.p
            className="text-2xl text-slate-400"
            style={{ y: useTransform(smoothProgress, [0, 1], ['0%', '-150%']) }}
          >
            3D Scroll Parallax Experience
          </motion.p>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          style={{ opacity: useTransform(smoothProgress, [0, 0.2], [1, 0]) }}
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-amber-400"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </motion.div>
        </motion.div>
      </div>

      {/* Content Sections */}
      <div className="relative z-10 bg-gradient-to-b from-transparent via-black to-slate-900">
        {/* Section 1 */}
        <section className="min-h-screen flex items-center justify-center px-8">
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, margin: '-100px' }}
            className="max-w-4xl"
          >
            <h2 className="text-6xl font-bold mb-6 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Найновіші технології 2025
            </h2>
            <p className="text-2xl text-slate-300 mb-8">
              React Three Fiber • Framer Motion • GSAP • Lenis
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 bg-white/5 rounded-xl backdrop-blur-sm border border-white/10">
                <div className="text-3xl mb-2">🎨</div>
                <h3 className="text-xl font-bold text-white mb-2">Glass Morphism</h3>
                <p className="text-sm text-white/60">Сучасний UI дизайн з прозорістю</p>
              </div>
              <div className="p-6 bg-white/5 rounded-xl backdrop-blur-sm border border-white/10">
                <div className="text-3xl mb-2">⚡</div>
                <h3 className="text-xl font-bold text-white mb-2">60 FPS</h3>
                <p className="text-sm text-white/60">Плавні анімації на всіх пристроях</p>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Section 2 */}
        <section className="min-h-screen flex items-center justify-center px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-cyan-500 bg-clip-text text-transparent">
              3D WebGL Magic
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-12">
              Використовуємо Three.js та React Three Fiber для створення інтерактивних 3D сцен прямо у браузері
            </p>
            <div className="grid grid-cols-3 gap-8 max-w-4xl mx-auto">
              {['Bloom Effects', 'Transmission', 'Chromatic Aberration'].map((tech, i) => (
                <motion.div
                  key={tech}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.2 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.05 }}
                  className="p-8 bg-white/5 rounded-2xl backdrop-blur-sm border border-white/10 cursor-pointer"
                >
                  <div className="text-4xl mb-4">✨</div>
                  <h3 className="text-lg font-bold text-white">{tech}</h3>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Section 3 */}
        <section className="min-h-screen flex items-center justify-center px-8">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 1 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <motion.h2
              className="text-7xl font-bold mb-8 text-white"
              whileInView={{ scale: [0.8, 1.1, 1] }}
              transition={{ duration: 0.8 }}
            >
              Готові до майбутнього?
            </motion.h2>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="px-12 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xl font-bold rounded-full shadow-2xl shadow-amber-500/50"
            >
              Почати проект
            </motion.button>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
