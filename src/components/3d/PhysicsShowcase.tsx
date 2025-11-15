'use client';

import { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier';
import { Environment, ContactShadows, OrbitControls, Text, useGLTF, Float, MeshDistortMaterial, Sphere } from '@react-three/drei';
import { EffectComposer, Bloom, DepthOfField } from '@react-three/postprocessing';
import { motion } from 'framer-motion';
import * as THREE from 'three';

// Interactive 3D Product Card
type ProductSphereProps = {
  position: [number, number, number];
  color: string;
  label: string;
  onClick: () => void;
};

function ProductSphere({ position, color, label, onClick }: ProductSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.3;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5;
      meshRef.current.scale.setScalar(hovered ? 1.2 : 1);
    }
  });

  return (
    <RigidBody position={position} colliders="ball" restitution={0.8}>
      <Float speed={2} rotationIntensity={0.5}>
        <mesh
          ref={meshRef}
          onClick={onClick}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <sphereGeometry args={[1, 64, 64]} />
          <MeshDistortMaterial
            color={color}
            speed={2}
            distort={0.3}
            radius={1}
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>
      </Float>
      <Text
        position={[0, -1.5, 0]}
        fontSize={0.3}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </RigidBody>
  );
}

// Physics Ground
function Ground() {
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <mesh receiveShadow position={[0, -4, 0]}>
        <boxGeometry args={[20, 0.5, 20]} />
        <meshStandardMaterial color="#111111" metalness={0.8} roughness={0.2} />
      </mesh>
    </RigidBody>
  );
}

// Walls for physics
function Walls() {
  return (
    <>
      <RigidBody type="fixed">
        <CuboidCollider args={[10, 5, 0.1]} position={[0, 0, -10]} />
        <CuboidCollider args={[10, 5, 0.1]} position={[0, 0, 10]} />
        <CuboidCollider args={[0.1, 5, 10]} position={[-10, 0, 0]} />
        <CuboidCollider args={[0.1, 5, 10]} position={[10, 0, 0]} />
      </RigidBody>
    </>
  );
}

// Main 3D Scene
function Scene({ onProductClick }: { onProductClick: (product: string) => void }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.3} penumbra={1} intensity={2} castShadow />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#3b82f6" />
      
      <Physics gravity={[0, -9.81, 0]}>
        <Ground />
        <Walls />
        
        {/* 3 Product Spheres */}
        <ProductSphere
          position={[-3, 5, 0]}
          color="#ff6b35"
          label="KW Suspension"
          onClick={() => onProductClick('KW')}
        />
        <ProductSphere
          position={[0, 8, 0]}
          color="#ef4444"
          label="Fi Exhaust"
          onClick={() => onProductClick('Fi')}
        />
        <ProductSphere
          position={[3, 6, 0]}
          color="#3b82f6"
          label="Eventuri"
          onClick={() => onProductClick('Eventuri')}
        />
      </Physics>

      <ContactShadows position={[0, -3.9, 0]} opacity={0.5} scale={20} blur={2} far={4} />
      <Environment preset="city" />
      
      <EffectComposer>
        <Bloom intensity={1.2} luminanceThreshold={0.3} />
        <DepthOfField focusDistance={0.01} focalLength={0.05} bokehScale={3} />
      </EffectComposer>

      <OrbitControls makeDefault />
    </>
  );
}

// Loading fallback
function Loader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-white text-2xl animate-pulse">Loading 3D Physics...</div>
    </div>
  );
}

// Main Component
export default function PhysicsShowcase() {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  return (
    <div className="relative w-full h-screen bg-black">
      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 2, 15], fov: 50 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <Suspense fallback={null}>
          <Scene onProductClick={setSelectedProduct} />
        </Suspense>
      </Canvas>

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="p-8">
          <motion.h1
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl font-bold text-white mb-4"
          >
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Physics
            </span>{' '}
            Showcase
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-slate-400"
          >
            Click on spheres • Drag to rotate • Scroll to zoom
          </motion.p>
        </div>

        {/* Product Info Panel */}
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="absolute top-1/2 right-8 -translate-y-1/2 bg-white/10 backdrop-blur-xl p-8 rounded-2xl border border-white/20 pointer-events-auto max-w-md"
          >
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 right-4 text-white/60 hover:text-white"
            >
              ✕
            </button>
            <h2 className="text-3xl font-bold text-white mb-4">{selectedProduct}</h2>
            <p className="text-white/80 mb-4">
              {selectedProduct === 'KW' && 'Професійні системи підвіски з Німеччини'}
              {selectedProduct === 'Fi' && 'Титанові витяжні системи з Японії'}
              {selectedProduct === 'Eventuri' && 'Карбонові впускні системи з UK'}
            </p>
            <button className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-lg hover:shadow-2xl hover:shadow-amber-500/50 transition-all">
              View Products
            </button>
          </motion.div>
        )}

        {/* Instructions */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-8 text-white/60 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">🖱️</div>
            <span>Drag to rotate</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">🖐️</div>
            <span>Click spheres</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">⚡</div>
            <span>Physics enabled</span>
          </div>
        </div>
      </div>
    </div>
  );
}
