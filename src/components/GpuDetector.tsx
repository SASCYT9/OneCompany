'use client';

import { useEffect } from 'react';

/**
 * Detects if GPU/hardware acceleration is available
 * If not (CPU-only rendering), adds 'no-gpu' class to html element
 * This triggers CSS to disable ALL expensive effects
 */
export function GpuDetector() {
  useEffect(() => {
    const detectGpu = () => {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (!gl) {
          // No WebGL = No GPU acceleration
          document.documentElement.classList.add('no-gpu');
          console.log('[GpuDetector] No WebGL support - enabling CPU-safe mode');
          return;
        }

        // Check for software renderer (CPU fallback)
        const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          const vendor = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
          
          console.log('[GpuDetector] GPU:', renderer, '| Vendor:', vendor);
          
          // Detect software renderers
          const softwareRenderers = [
            'SwiftShader',      // Chrome's software renderer
            'llvmpipe',         // Mesa's software renderer (Linux)
            'softpipe',         // Mesa's reference renderer
            'Microsoft Basic',  // Windows software renderer
            'VMware',           // Virtual machine
            'VirtualBox',       // Virtual machine
            'ANGLE',            // Could be software on some systems
            'Software',         // Generic
          ];
          
          const isSoftware = softwareRenderers.some(sw => 
            renderer.toLowerCase().includes(sw.toLowerCase()) ||
            vendor.toLowerCase().includes(sw.toLowerCase())
          );
          
          if (isSoftware) {
            document.documentElement.classList.add('no-gpu');
            console.log('[GpuDetector] Software renderer detected - enabling CPU-safe mode');
            return;
          }
        }

        // Check for very low-end or integrated GPUs by testing performance
        const startTime = performance.now();
        const testCanvas = document.createElement('canvas');
        testCanvas.width = 1000;
        testCanvas.height = 1000;
        const ctx = testCanvas.getContext('2d');
        if (ctx) {
          // Heavy blur operation test
          ctx.filter = 'blur(20px)';
          ctx.fillRect(0, 0, 1000, 1000);
        }
        const duration = performance.now() - startTime;
        
        // If blur takes more than 50ms, GPU is likely disabled or very slow
        if (duration > 50) {
          document.documentElement.classList.add('slow-gpu');
          console.log(`[GpuDetector] Slow rendering detected (${duration.toFixed(1)}ms) - enabling performance mode`);
        }

        // Cleanup
        canvas.remove();
        testCanvas.remove();
        
      } catch (e) {
        // Any error = assume no GPU
        document.documentElement.classList.add('no-gpu');
        console.log('[GpuDetector] Error detecting GPU - enabling CPU-safe mode');
      }
    };

    // Run detection after a short delay to not block initial render
    const timer = setTimeout(detectGpu, 100);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
