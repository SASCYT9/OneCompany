"use client";

import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import AkrapovicLiquidBackground from "./AkrapovicLiquidBackground";

export function AkrapovicScene3D() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-0 h-screen w-full"
      style={{ isolation: "isolate" }}
    >
      <Canvas camera={{ position: [0, 0, 1] }} gl={{ antialias: false, alpha: false }}>
        <AkrapovicLiquidBackground />
      </Canvas>
    </div>
  );
}
