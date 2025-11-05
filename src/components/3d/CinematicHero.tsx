'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, MeshTransmissionMaterial, useGLTF, Text, OrbitControls, Sky, Cloud } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration, Vignette, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { motion } from 'framer-motion';
import * as THREE from 'three';

// Animated 3D Logo/Object
function AnimatedLogo() {
  const torusRef = useRef<THREE.Mesh>(null);
  const sphereRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    
    if (torusRef.current) {
      torusRef.current.rotation.x = t * 0.3;
      torusRef.current.rotation.y = t * 0.5;
      torusRef.current.position.y = Math.sin(t * 0.5) * 0.5;
    }

    if (sphereRef.current) {
      sphereRef.current.rotation.y = -t * 0.4;
      sphereRef.current.position.y = Math.cos(t * 0.5) * 0.3;
    }
  });

  return (
    <group>
      {/* Outer Torus */}
      <mesh ref={torusRef} position={[0, 0, 0]}>
        <torusGeometry args={[2, 0.5, 32, 100]} />
        <MeshTransmissionMaterial
          backside
          samples={16}
          resolution={512}
          transmission={1}
          roughness={0.1}
          thickness={0.8}
          ior={1.5}
          chromaticAberration={0.8}
          anisotropy={0.5}
          distortion={0.3}
          distortionScale={0.5}
          temporalDistortion={0.2}
          color="#fbbf24"
        />
      </mesh>

      {/* Inner Sphere */}
      <mesh ref={sphereRef} position={[0, 0, 0]}>
        <sphereGeometry args={[1, 64, 64]} />
        <MeshTransmissionMaterial
          backside
          samples={16}
          resolution={512}
          transmission={0.95}
          roughness={0.15}
          thickness={0.5}
          ior={1.8}
          chromaticAberration={1}
          anisotropy={0.3}
          distortion={0.5}
          distortionScale={0.3}
          temporalDistortion={0.15}
          color="#3b82f6"
        />
      </mesh>

      {/* Brand Text */}
      <Text
        position={[0, -3, 0]}
        fontSize={0.8}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        font="/fonts/Inter-Bold.woff"
      >
        onecompany
      </Text>
    </group>
  );
}

// Floating Particles/Spheres
function FloatingSpheres() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: 20 }).map((_, i) => {
        const angle = (i / 20) * Math.PI * 2;
        const radius = 5 + Math.random() * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = (Math.random() - 0.5) * 4;

        return (
          <mesh key={i} position={[x, y, z]}>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshStandardMaterial
              color={i % 3 === 0 ? '#fbbf24' : i % 3 === 1 ? '#ef4444' : '#3b82f6'}
              emissive={i % 3 === 0 ? '#fbbf24' : i % 3 === 1 ? '#ef4444' : '#3b82f6'}
              emissiveIntensity={0.5}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// Scene
function Scene() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <spotLight position={[10, 10, 10]} angle={0.3} penumbra={1} intensity={2} />
      <pointLight position={[-10, -10, -10]} intensity={1} color="#3b82f6" />
      
      <AnimatedLogo />
      <FloatingSpheres />
      
      <Sky
        distance={450000}
        sunPosition={[0, 1, 0]}
        inclination={0}
        azimuth={0.25}
      />
      
      <Environment preset="sunset" />
      
      <EffectComposer>
        <Bloom
          intensity={2}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          blendFunction={BlendFunction.SCREEN}
        />
        <ChromaticAberration
          offset={new THREE.Vector2(0.003, 0.003)}
          blendFunction={BlendFunction.NORMAL}
        />
        <Vignette offset={0.5} darkness={0.5} />
        <Noise opacity={0.02} />
      </EffectComposer>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.5}
        maxPolarAngle={Math.PI / 2}
        minPolarAngle={Math.PI / 2}
      />
    </>
  );
}

// Main Component
export default function CinematicHero() {
  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* 3D Canvas Background */}
      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 0, 8], fov: 60 }}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
        >
          <Scene />
        </Canvas>
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-8">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          <h1 className="text-8xl md:text-9xl font-light tracking-tight mb-6">
            <span className="text-white">Premium</span>
            <br />
            <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
              Performance
            </span>
          </h1>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-2xl md:text-3xl text-white/80 mb-12 max-w-3xl mx-auto"
          >
            Cinematic 3D experience powered by WebGL
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5 }}
            className="flex gap-6 justify-center"
          >
            <button className="px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-full shadow-2xl shadow-amber-500/50 hover:shadow-amber-500/80 hover:scale-105 transition-all">
              Explore 3D
            </button>
            <button className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white font-bold rounded-full border border-white/20 hover:bg-white/20 hover:scale-105 transition-all">
              Learn More
            </button>
          </motion.div>
        </motion.div>

        {/* Feature Cards */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 grid grid-cols-3 gap-6"
        >
          {[
            { icon: '✨', label: 'Glass Effects' },
            { icon: '🌈', label: 'Chromatic' },
            { icon: '💫', label: 'Bloom' },
          ].map((item, i) => (
            <div
              key={i}
              className="bg-white/5 backdrop-blur-md px-6 py-4 rounded-xl border border-white/10"
            >
              <div className="text-3xl mb-2">{item.icon}</div>
              <div className="text-white/80 text-sm">{item.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
