'use client';

import { Cloud, Sparkles } from '@react-three/drei';
import { useMemo } from 'react';

interface BrandSpecificEffectsProps {
  storeId: 'kw' | 'fi' | 'eventuri';
  inView: boolean;
}

const ExhaustSmoke = () => (
  <group position={[0, 0, -2]}>
    <Cloud
      opacity={0.3}
      speed={0.2}
      scale={[6, 2, 4]}
      segments={32}
      color="#7bd6ff"
    />
    <Cloud
      opacity={0.2}
      speed={0.25}
      scale={[5, 1.5, 3]}
      segments={20}
      color="#94f0ff"
      position={[0, -1, 0]}
    />
  </group>
);

const CarbonFiberSparks = () => (
  <Sparkles
    count={80}
    scale={[8, 8, 4]}
    size={6}
    speed={0.4}
    noise={0.2}
    color="#ff4444"
  />
);


export function BrandSpecificEffects({ storeId, inView }: BrandSpecificEffectsProps) {
  const effects = useMemo(() => {
    if (!inView) return null;

    switch (storeId) {
      case 'eventuri':
        return <CarbonFiberSparks />;
      case 'fi':
        return <ExhaustSmoke />;
      case 'kw':
        // KW will use a video background, handled separately
        return null; 
      default:
        return null;
    }
  }, [storeId, inView]);

  return <>{effects}</>;
}
