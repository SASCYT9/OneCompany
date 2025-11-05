'use client';

import { useMemo } from 'react';
import { ModelViewer } from './ModelViewer';

interface StoreSlideProps {
  storeId: 'kw' | 'fi' | 'eventuri';
  inView: boolean;
}

const storeModelPaths: Record<StoreSlideProps['storeId'], string> = {
  kw: '/models/kw-coilover.glb',
  fi: '/models/fi-exhaust.glb',
  eventuri: '/models/eventuri-intake.glb',
};

type ModelProperties = {
  scale: number;
  position: [number, number, number];
  rotation?: [number, number, number];
};

const modelProperties: Record<StoreSlideProps['storeId'], ModelProperties> = {
  kw: {
    scale: 3.5,
    position: [0, -0.25, 2],
    rotation: [0, 0, 0],
  },
  fi: {
    scale: 1.8,
    position: [0, 0, 3],
    rotation: [0, 0, 0],
  },
  eventuri: {
    scale: 2.2,
    position: [0, 0, 3],
    rotation: [0, 0, 0],
  },
};

export function StoreSlide({ storeId, inView }: StoreSlideProps) {
  const modelPath = useMemo(() => storeModelPaths[storeId], [storeId]);
  const properties = useMemo(() => modelProperties[storeId], [storeId]);

  if (!inView) return null;

  return (
    <group>
      <ModelViewer
        path={modelPath}
        scale={properties.scale}
        position={properties.position}
        rotation={properties.rotation}
        storeId={storeId}
      />
    </group>
  );
}

