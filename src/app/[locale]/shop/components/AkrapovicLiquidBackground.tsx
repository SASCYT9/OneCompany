'use client';

import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform float uTime;
uniform vec2 uMouse;
uniform vec2 uResolution;
varying vec2 vUv;

// Simplex 2D noise
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 st = vUv;
  float aspect = uResolution.x / uResolution.y;
  st.x *= aspect;
  
  vec2 mouseCoords = uMouse;
  mouseCoords.x *= aspect;

  // Distort coordinates heavily based on mouse to simulate "touching" liquid metal
  float dist = distance(st, mouseCoords);
  float mouseEffect = smoothstep(0.6, 0.0, dist) * 0.15;
  
  // Create a swirling vortex effect near the mouse
  vec2 dir = normalize(st - mouseCoords);
  st -= dir * mouseEffect;

  // Fractional Brownian Motion (fBM) for organic liquid feel
  float n1 = snoise(st * 2.0 + uTime * 0.15);
  float n2 = snoise(st * 4.0 - uTime * 0.2 + n1);
  float n3 = snoise(st * 8.0 + uTime * 0.1 + n2);
  
  float noiseVal = n3;

  // Stealth Wealth Colors: Deep obsidian, dark carbon, and "Burnt Titanium" highlight
  vec3 baseColor = vec3(0.01, 0.01, 0.01); 
  vec3 waveColor = vec3(0.07, 0.08, 0.09); // Subtle blueish dark gray
  
  // The titanium burn (blue -> purple -> gold) that only appears in the highlights/crevices
  vec3 burnColor1 = vec3(0.1, 0.2, 0.8); // Blue
  vec3 burnColor2 = vec3(0.8, 0.1, 0.4); // Purple/Red
  vec3 titaniumGlow = mix(burnColor1, burnColor2, snoise(st * 5.0 + uTime));

  // Base metallic mix
  vec3 finalColor = mix(baseColor, waveColor, smoothstep(-0.8, 0.8, noiseVal));
  
  // Add the titanium glow into the intense peaks of the noise, enhanced by mouse proximity
  float highlight = smoothstep(0.4, 1.0, noiseVal) * smoothstep(0.0, 1.0, mouseEffect * 5.0 + 0.2);
  finalColor = mix(finalColor, titaniumGlow * 0.5, highlight);

  // Deep vignette to keep the edges dark and focus the light
  float vignette = smoothstep(1.5, 0.3, length(vUv - 0.5));
  finalColor *= vignette;

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

export default function AkrapovicLiquidBackground() {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { viewport, size } = useThree();
  const mousePos = useRef({ x: 0.5, y: 0.5 });

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uResolution: { value: new THREE.Vector2(size.width, size.height) },
  }), [size]);

  // Global mouse tracker, so we don't need pointer-events on the canvas
  useMemo(() => {
    if (typeof window !== 'undefined') {
      const handleMouseMove = (e: MouseEvent) => {
        mousePos.current.x = e.clientX / window.innerWidth;
        // Invert Y for webgl coordinates
        mousePos.current.y = 1.0 - (e.clientY / window.innerHeight);
      };
      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
    }
  }, []);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      
      materialRef.current.uniforms.uMouse.value.lerp(
        new THREE.Vector2(mousePos.current.x, mousePos.current.y),
        0.05
      );
    }
  });

  return (
    <mesh ref={meshRef}>
      {/* Cover the entire viewport */}
      <planeGeometry args={[viewport.width, viewport.height, 1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}
