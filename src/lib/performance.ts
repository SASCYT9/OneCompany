/**
 * Performance detection utilities for 3D rendering
 */

export const detectGPUTier = (): 'high' | 'medium' | 'low' => {
  if (typeof window === 'undefined') return 'medium';

  // Check for mobile devices
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  if (isMobile) return 'low';

  // Check for WebGL2 support
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

  if (!gl) return 'low';

  // Get GPU info
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  if (debugInfo) {
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    
    // High-end GPUs
    if (
      /NVIDIA GeForce RTX|AMD Radeon RX 6|AMD Radeon RX 7|Apple M[1-9]|Apple GPU/i.test(
        renderer
      )
    ) {
      return 'high';
    }

    // Low-end GPUs
    if (/Intel HD Graphics|Intel UHD Graphics/i.test(renderer)) {
      return 'low';
    }
  }

  // Check memory (if available)
  if ('deviceMemory' in navigator) {
    const memory = (navigator as any).deviceMemory;
    if (memory >= 8) return 'high';
    if (memory <= 4) return 'low';
  }

  return 'medium';
};

export const getOptimalSettings = () => {
  const tier = detectGPUTier();

  const settings = {
    high: {
      pixelRatio: 2,
      shadows: true,
      particles: 3000,
      antialias: true,
      postProcessing: true,
    },
    medium: {
      pixelRatio: 1.5,
      shadows: true,
      particles: 1500,
      antialias: true,
      postProcessing: false,
    },
    low: {
      pixelRatio: 1,
      shadows: false,
      particles: 500,
      antialias: false,
      postProcessing: false,
    },
  };

  return settings[tier];
};

export const shouldUseVideoFallback = (): boolean => {
  const tier = detectGPUTier();
  return tier === 'low';
};
