"use client";

import React, { useRef, useEffect } from "react";
import { Renderer, Program, Mesh, Triangle } from "ogl";

interface IlmbergerCarbonShaderProps extends React.HTMLAttributes<HTMLDivElement> {
  speed?: number;
  density?: number;
  interactive?: boolean;
}

const IlmbergerCarbonShader: React.FC<IlmbergerCarbonShaderProps> = ({
  speed = 0.5,
  density = 480.0,
  interactive = true,
  ...props
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const renderer = new Renderer({ antialias: true, alpha: true });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0); // transparent base

    const vertexShader = `
      attribute vec2 position;
      attribute vec2 uv;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;
      uniform float uTime;
      uniform vec3 uResolution;
      uniform vec2 uMouse;
      uniform float uTheme; // 0 for dark, 1 for light
      uniform float uDensity;
      varying vec2 vUv;

      void main() {
          vec2 fragCoord = vUv * uResolution.xy;
          vec2 uv = (fragCoord - 0.5 * uResolution.xy) / min(uResolution.x, uResolution.y);
          
          // 45 degree rotation mat
          float theta = 0.785398;
          mat2 rot = mat2(cos(theta), -sin(theta), sin(theta), cos(theta));
          vec2 gUv = rot * (uv * uDensity);
          
          vec2 cell = floor(gUv);
          vec2 localUv = fract(gUv);
          
          // 2x2 Twill weave pattern checker
          float pattern = mod(cell.x + cell.y, 4.0);
          vec2 fiberDir = vec2(0.0);
          float threadType = 0.0;
          
          if (pattern < 2.0) {
              fiberDir = vec2(1.0, 0.0);
              threadType = 0.0;
          } else {
              fiberDir = vec2(0.0, 1.0);
              threadType = 1.0;
          }
          
          // Micro-fiber texture simulation
          float micro = sin(localUv.x * 24.0) * sin(localUv.y * 24.0) * 0.12;
          
          // Compute normal map of the woven thread curves
          vec3 normal = vec3(0.0, 0.0, 1.0);
          if (threadType == 0.0) {
              normal.y = sin((localUv.y - 0.5) * 3.14159) * 0.35;
              normal.x = micro;
          } else {
              normal.x = sin((localUv.x - 0.5) * 3.14159) * 0.35;
              normal.y = micro;
          }
          normal = normalize(normal);
          
          // Rotate normal back to global screen coordinates
          vec2 normalRot = mat2(cos(-theta), -sin(-theta), sin(-theta), cos(-theta)) * normal.xy;
          normal = normalize(vec3(normalRot, normal.z));
          
          // Light vectors (interactive and auto)
          vec2 m = (uMouse - 0.5) * 2.0;
          vec3 lightPos = vec3(m.x * 1.5, m.y * 1.5, 0.85);
          vec3 viewPos = vec3(0.0, 0.0, 1.25);
          
          vec3 fragPos = vec3(uv, 0.0);
          vec3 lightDir = normalize(lightPos - fragPos);
          vec3 viewDir = normalize(viewPos - fragPos);
          vec3 halfDir = normalize(lightDir + viewDir);
          
          // Theme-aware base colors
          vec3 baseColor = (uTheme == 0.0) ? vec3(0.05, 0.055, 0.065) : vec3(0.72, 0.70, 0.67);
          vec3 ambient = baseColor;
          
          // Diffuse shading & edge shadows
          float diff = max(dot(normal, lightDir), 0.0);
          float edgeShadow = sin(localUv.x * 3.14159) * sin(localUv.y * 3.14159);
          edgeShadow = clamp(pow(edgeShadow, 0.32), 0.15, 1.0);
          
          // Anisotropic Specular (shimmering perpendicular to fibers)
          vec2 fiberDirGlobal = mat2(cos(-theta), -sin(-theta), sin(-theta), cos(-theta)) * fiberDir;
          vec3 T = normalize(vec3(fiberDirGlobal, 0.0));
          float dotLT = dot(lightDir, T);
          float dotVT = dot(viewDir, T);
          float specAniso = sqrt(1.0 - dotLT * dotLT) * sqrt(1.0 - dotVT * dotVT) - dotLT * dotVT;
          specAniso = max(specAniso, 0.0);
          float specIntensity = (uTheme == 0.0) ? 0.32 : 0.45;
          float spec = pow(specAniso, 28.0) * specIntensity;
          
          // Clear coat specular highlights (epoxy gloss)
          float dotNH = max(dot(vec3(0.0, 0.0, 1.0), halfDir), 0.0);
          float specClear = pow(dotNH, 128.0) * 0.12;
          
          // Synthesis
          vec3 col = baseColor + (diff * baseColor * 0.2);
          float threadStripe = (threadType == 0.0) ? 1.0 : 0.88;
          vec3 finalColor = col * threadStripe * edgeShadow;
          
          // Add anisotropic spec + clear coat spec
          finalColor += vec3(spec + specClear);
          
          // Subtle ambient shimmer loop
          float autoSweep = sin(uv.x * 2.5 - uv.y * 1.5 + uTime * 0.6) * 0.012;
          finalColor += vec3(autoSweep);
          
          gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uResolution: {
          value: new Float32Array([
            gl.canvas.width,
            gl.canvas.height,
            gl.canvas.width / gl.canvas.height,
          ]),
        },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uTheme: { value: 0 },
        uDensity: { value: density },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });

    function resize() {
      renderer.setSize(container.offsetWidth, container.offsetHeight);
      const resUniform = program.uniforms.uResolution.value as Float32Array;
      resUniform[0] = gl.canvas.width;
      resUniform[1] = gl.canvas.height;
      resUniform[2] = gl.canvas.width / gl.canvas.height;
    }
    window.addEventListener("resize", resize);
    resize();

    function handleMouseMove(event: MouseEvent) {
      const rect = container.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = 1 - (event.clientY - rect.top) / rect.height;
      const m = program.uniforms.uMouse.value as Float32Array;
      m[0] = x;
      m[1] = y;
    }

    function handleTouchMove(event: TouchEvent) {
      if (event.touches.length > 0) {
        const touch = event.touches[0];
        const rect = container.getBoundingClientRect();
        const x = (touch.clientX - rect.left) / rect.width;
        const y = 1 - (touch.clientY - rect.top) / rect.height;
        const m = program.uniforms.uMouse.value as Float32Array;
        m[0] = x;
        m[1] = y;
      }
    }

    if (interactive) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("touchmove", handleTouchMove);
    }

    // Sync theme dynamically
    const updateThemeUniform = () => {
      const isLight = document.documentElement.classList.contains("light");
      program.uniforms.uTheme.value = isLight ? 1.0 : 0.0;
    };
    updateThemeUniform();

    const observer = new MutationObserver(updateThemeUniform);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    let animationId: number;
    function update(t: number) {
      animationId = requestAnimationFrame(update);
      program.uniforms.uTime.value = t * 0.001 * speed;
      renderer.render({ scene: mesh });
    }
    animationId = requestAnimationFrame(update);

    container.appendChild(gl.canvas);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      observer.disconnect();
      if (interactive) {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("touchmove", handleTouchMove);
      }
      if (gl.canvas.parentElement) {
        gl.canvas.parentElement.removeChild(gl.canvas);
      }
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [speed, density, interactive]);

  return <div ref={containerRef} className="w-full h-full" {...props} />;
};

export default IlmbergerCarbonShader;
