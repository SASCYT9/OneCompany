"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  reducedMotion?: boolean;
};

type RibbonProps = {
  index: number;
  color: string;
  opacity: number;
  reducedMotion: boolean;
};

function AirflowRibbon({ index, color, opacity, reducedMotion }: RibbonProps) {
  const groupRef = useRef<THREE.Group>(null);
  const curve = useMemo(() => {
    const phase = index * 0.78;
    const points = Array.from({ length: 8 }, (_, pointIndex) => {
      const progress = pointIndex / 7;
      return new THREE.Vector3(
        -6.8 + progress * 13.6,
        Math.sin(progress * 5.2 + phase) * 0.32 + (index - 2.5) * 0.38,
        -0.7 - index * 0.13 + Math.cos(progress * 3.8 + phase) * 0.16
      );
    });

    return new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.65);
  }, [index]);

  const geometry = useMemo(
    () => new THREE.TubeGeometry(curve, 96, 0.018 + (index % 2) * 0.009, 5, false),
    [curve, index]
  );
  const elapsedRef = useRef(0);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    if (!groupRef.current || reducedMotion) return;

    elapsedRef.current += delta;
    groupRef.current.rotation.z += delta * (index % 2 === 0 ? 0.0022 : -0.0016);
    groupRef.current.position.y = Math.sin(elapsedRef.current * 0.32 + index) * 0.035;
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          color={color}
          depthWrite={false}
          opacity={opacity}
          toneMapped={false}
          transparent
        />
      </mesh>
    </group>
  );
}

function CarbonHalo({ reducedMotion, isDark }: { reducedMotion: boolean; isDark: boolean }) {
  const haloRef = useRef<THREE.Mesh>(null);
  const elapsedRef = useRef(0);
  const materialColor = isDark ? "#3f4247" : "#7b7e80";

  useFrame((_, delta) => {
    if (!haloRef.current || reducedMotion) return;

    elapsedRef.current += delta;
    haloRef.current.rotation.x += delta * 0.006;
    haloRef.current.rotation.y -= delta * 0.009;
    haloRef.current.rotation.z = Math.sin(elapsedRef.current * 0.18) * 0.08;
  });

  return (
    <mesh ref={haloRef} position={[4.65, 0.08, -1.25]} rotation={[0.38, -0.3, 0.18]}>
      <torusGeometry args={[1.55, 0.022, 8, 96]} />
      <meshBasicMaterial
        color={materialColor}
        depthWrite={false}
        opacity={isDark ? 0.16 : 0.11}
        toneMapped={false}
        transparent
      />
    </mesh>
  );
}

export default function EventuriAirflowScene({ reducedMotion = false }: Props) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => setIsDark(root.classList.contains("dark"));
    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const ribbonColor = isDark ? "#8b9097" : "#34383c";
  const accentColor = isDark ? "#ff5966" : "#d7192a";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[48rem] overflow-hidden opacity-[0.8] dark:opacity-[0.92]"
    >
      <Canvas
        camera={{ fov: 38, position: [0, 0, 8] }}
        dpr={[1, 1.35]}
        frameloop={reducedMotion ? "demand" : "always"}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      >
        <group position={[0, 0.25, 0]}>
          {Array.from({ length: 6 }, (_, index) => (
            <AirflowRibbon
              key={index}
              index={index}
              color={index === 4 ? accentColor : ribbonColor}
              opacity={index === 4 ? (isDark ? 0.26 : 0.19) : isDark ? 0.14 : 0.105}
              reducedMotion={reducedMotion}
            />
          ))}
          <CarbonHalo isDark={isDark} reducedMotion={reducedMotion} />
        </group>
      </Canvas>
    </div>
  );
}
