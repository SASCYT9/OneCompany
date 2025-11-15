'use client';

import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGesture } from '@use-gesture/react';
import { useSpring, animated, config } from '@react-spring/three';
import { Environment, ContactShadows, Text, MeshDistortMaterial, Float } from '@react-three/drei';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import { createSeededRandom } from '@/lib/random';

// Interactive 3D Card with Gestures
type Vector3Tuple = [number, number, number];

type InteractiveCardProps = {
  position: [number, number, number];
  color: string;
  text: string;
  onTap: (text: string) => void;
};

function InteractiveCard({ position, color, text, onTap }: InteractiveCardProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [active, setActive] = useState(false);

  // Spring animation
  const [spring, api] = useSpring<{ scale: number; rotation: Vector3Tuple; position: Vector3Tuple }>(() => ({
    scale: 1,
    rotation: [0, 0, 0],
    position: position,
    config: config.wobbly,
  }));

  // Gesture handlers
  const bind = useGesture(
    {
      onDrag: ({ offset: [x, y] }) => {
        api.start({
          rotation: [y / 100, x / 100, 0],
        });
      },
      onHover: ({ hovering }) => {
        api.start({
          scale: hovering ? 1.2 : 1,
        });
      },
      onClick: () => {
        setActive(!active);
        onTap(text);
        api.start({
          scale: active ? 1 : 1.3,
        });
      },
    },
    { drag: { delay: 100 } }
  );

  useFrame((state) => {
    if (meshRef.current && !active) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.3;
    }
  });

  const springProps = spring as Record<string, unknown>;
  const gestureBindings = bind() as Record<string, unknown>;

  return (
    <animated.group {...springProps} {...gestureBindings}>
      <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.3}>
        <mesh ref={meshRef} castShadow>
          <boxGeometry args={[2, 3, 0.2]} />
          <MeshDistortMaterial
            color={color}
            speed={2}
            distort={0.2}
            radius={1}
            roughness={0.3}
            metalness={0.7}
          />
        </mesh>
        <Text
          position={[0, 0, 0.15]}
          fontSize={0.4}
          color="white"
          anchorX="center"
          anchorY="middle"
          maxWidth={1.8}
        >
          {text}
        </Text>
      </Float>
    </animated.group>
  );
}

// Particle System
function Particles() {
  const count = 1000;
  const meshRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const rand = createSeededRandom(3031);
    const data = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      data[i] = (rand() - 0.5) * 20;
    }
    return data;
  }, [count]);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.05;
    }
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#fbbf24" transparent opacity={0.6} />
    </points>
  );
}

// Scene
function Scene({ onCardTap }: { onCardTap: (card: string) => void }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.3} penumbra={1} intensity={1.5} castShadow />
      <pointLight position={[-10, -10, -10]} color="#3b82f6" intensity={0.5} />

      <Particles />

      <InteractiveCard
        position={[-3, 0, 0]}
        color="#ff6b35"
        text="KW Suspension"
        onTap={onCardTap}
      />
      <InteractiveCard
        position={[0, 0, 0]}
        color="#ef4444"
        text="Fi Exhaust"
        onTap={onCardTap}
      />
      <InteractiveCard
        position={[3, 0, 0]}
        color="#3b82f6"
        text="Eventuri"
        onTap={onCardTap}
      />

      <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={15} blur={2} far={3} />
      <Environment preset="sunset" />
    </>
  );
}

// Main Component
export default function GestureInteractive() {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  return (
    <div className="relative w-full h-screen bg-gradient-to-b from-black via-slate-900 to-black">
      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 0, 10], fov: 50 }}
      >
        <Scene onCardTap={setSelectedCard} />
      </Canvas>

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8"
        >
          <h1 className="text-6xl font-bold text-white mb-2">
            <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
              Gesture
            </span>{' '}
            Controls
          </h1>
          <p className="text-xl text-slate-400">
            Drag • Click • Hover — Full touch & mouse support
          </p>
        </motion.div>

        {/* Selected Card Info */}
        {selectedCard && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-xl px-8 py-4 rounded-full border border-white/20"
          >
            <p className="text-white text-lg font-medium">Selected: {selectedCard}</p>
          </motion.div>
        )}

        {/* Controls Info */}
        <div className="absolute top-1/2 right-8 -translate-y-1/2 space-y-4">
          {[
            { icon: '🖱️', text: 'Drag cards' },
            { icon: '👆', text: 'Click to select' },
            { icon: '✨', text: 'Hover to scale' },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-3 bg-white/5 backdrop-blur-sm px-4 py-3 rounded-lg border border-white/10"
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-white/80">{item.text}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
