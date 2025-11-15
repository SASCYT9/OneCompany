'use client';

import { useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import { motion } from 'framer-motion';
import * as THREE from 'three';

type SuspensionConfig = {
  model: string;
  color: string;
  height: number;
  damping: number;
  price: number;
};

type ModelOption = {
  name: string;
  price: number;
  description: string;
  damping: number;
};

// 3D Car Suspension Model (simplified)
function SuspensionModel({ color, height, damping }: { color: string; height: number; damping: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const springRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.2;
    }
    
    if (springRef.current) {
      // Simulate spring compression based on damping
      const compression = Math.sin(state.clock.elapsedTime * damping) * 0.1;
      springRef.current.position.y = height + compression;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Base platform */}
      <mesh position={[0, -1, 0]}>
        <boxGeometry args={[3, 0.2, 3]} />
        <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Spring/Coilover */}
      <mesh ref={springRef} position={[0, height, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 2, 32]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Damper body */}
      <mesh position={[0, height - 0.5, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 1, 32]} />
        <meshStandardMaterial color="#111111" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Top mount */}
      <mesh position={[0, height + 1.2, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.2, 32]} />
        <meshStandardMaterial color="#ff6b35" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Bottom mount */}
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[1, 0.3, 1]} />
        <meshStandardMaterial color="#ff6b35" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}

// Scene
function Scene({ config }: { config: SuspensionConfig }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[5, 3, 5]} fov={50} />
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.3} penumbra={1} intensity={2} castShadow />
      <pointLight position={[-10, 5, -10]} intensity={0.5} color="#3b82f6" />

      <SuspensionModel
        color={config.color}
        height={config.height}
        damping={config.damping}
      />

      <ContactShadows position={[0, -1, 0]} opacity={0.5} scale={10} blur={2} far={4} />
      <Environment preset="warehouse" />
      <OrbitControls enableZoom={true} enablePan={false} />
    </>
  );
}

// Main Component
export default function ProductConfigurator() {
  const [config, setConfig] = useState<SuspensionConfig>({
    model: 'V3',
    color: '#ff6b35',
    height: 0,
    damping: 2,
    price: 1899,
  });

  const models: ModelOption[] = [
    { name: 'V1', price: 999, description: 'Entry level', damping: 1.5 },
    { name: 'V2', price: 1499, description: 'Street comfort', damping: 2 },
    { name: 'V3', price: 1899, description: 'Track & Street', damping: 2.5 },
    { name: 'Clubsport', price: 3499, description: 'Pure track', damping: 3 },
  ];

  const colors = [
    { name: 'Orange', hex: '#ff6b35' },
    { name: 'Blue', hex: '#3b82f6' },
    { name: 'Red', hex: '#ef4444' },
    { name: 'Gold', hex: '#fbbf24' },
    { name: 'Silver', hex: '#94a3b8' },
  ];

  const updateModel = (model: ModelOption) => {
    setConfig({
      ...config,
      model: model.name,
      price: model.price,
      damping: model.damping,
    });
  };

  return (
    <div className="relative w-full h-screen bg-gradient-to-b from-slate-900 via-black to-slate-900">
      {/* 3D Viewer */}
      <div className="absolute inset-0 md:w-2/3">
        <Canvas shadows>
          <Scene config={config} />
        </Canvas>
      </div>

      {/* Configuration Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        className="absolute right-0 top-0 h-full w-full md:w-1/3 bg-gradient-to-b from-slate-900/95 to-black/95 backdrop-blur-xl border-l border-white/10 overflow-y-auto"
      >
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">KW Configurator</h1>
            <p className="text-slate-400">Customize your suspension setup</p>
          </div>

          {/* Model Selection */}
          <div className="mb-8">
            <label className="text-white font-bold mb-4 block">Select Model</label>
            <div className="space-y-3">
              {models.map((model) => (
                <button
                  key={model.name}
                  onClick={() => updateModel(model)}
                  className={`w-full p-4 rounded-xl border transition-all ${
                    config.model === model.name
                      ? 'bg-amber-500/20 border-amber-500'
                      : 'bg-white/5 border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="text-left">
                      <div className="text-white font-bold">{model.name}</div>
                      <div className="text-slate-400 text-sm">{model.description}</div>
                    </div>
                    <div className="text-amber-400 font-bold">€{model.price}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div className="mb-8">
            <label className="text-white font-bold mb-4 block">Spring Color</label>
            <div className="flex gap-3">
              {colors.map((color) => (
                <button
                  key={color.hex}
                  onClick={() => setConfig({ ...config, color: color.hex })}
                  className={`w-12 h-12 rounded-full border-2 transition-all ${
                    config.color === color.hex ? 'border-white scale-110' : 'border-white/30'
                  }`}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Height Adjustment */}
          <div className="mb-8">
            <label className="text-white font-bold mb-4 block">
              Ride Height: {config.height > 0 ? '+' : ''}{config.height.toFixed(1)} cm
            </label>
            <input
              type="range"
              min="-3"
              max="3"
              step="0.1"
              value={config.height}
              onChange={(e) => setConfig({ ...config, height: parseFloat(e.target.value) })}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-sm text-slate-500 mt-2">
              <span>Lower</span>
              <span>Stock</span>
              <span>Raised</span>
            </div>
          </div>

          {/* Features */}
          <div className="mb-8">
            <label className="text-white font-bold mb-4 block">Included Features</label>
            <div className="space-y-2">
              {[
                'TÜV Certified',
                'Adjustable Rebound',
                'Adjustable Compression',
                'Stainless Steel Construction',
                '2-Year Warranty',
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-2 text-slate-300">
                  <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </div>
              ))}
            </div>
          </div>

          {/* Price & CTA */}
          <div className="sticky bottom-0 bg-gradient-to-t from-black via-black to-transparent pt-6 pb-4">
            <div className="bg-white/5 rounded-xl p-6 border border-white/10 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-400">Total Price</span>
                <span className="text-4xl font-bold text-amber-400">€{config.price}</span>
              </div>
              <div className="text-sm text-slate-500">Free shipping • 2-year warranty</div>
            </div>

            <button className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl shadow-2xl shadow-amber-500/50 hover:shadow-amber-500/80 hover:scale-105 transition-all">
              Add to Cart
            </button>
            
            <button className="w-full mt-3 py-4 bg-white/10 backdrop-blur-sm text-white font-bold rounded-xl border border-white/20 hover:bg-white/20 transition-all">
              Save Configuration
            </button>
          </div>
        </div>
      </motion.div>

      {/* Mobile Toggle */}
      <button className="md:hidden absolute top-4 right-4 z-50 p-4 bg-black/80 backdrop-blur-sm text-white rounded-full border border-white/20">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </div>
  );
}
