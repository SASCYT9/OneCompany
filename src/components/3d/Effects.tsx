'use client'

import { EffectComposer, Bloom, ChromaticAberration, Vignette, DepthOfField } from '@react-three/postprocessing'
import { Vector2 } from 'three'

export const Effects = () => {
  return (
    <EffectComposer>
      {/* Enhanced Bloom for Liquid Glass Glow */}
      <Bloom
        intensity={3.2}
        luminanceThreshold={0.08}
        luminanceSmoothing={0.9}
        height={1024}
        mipmapBlur={true}
        radius={0.9}
      />
      
      {/* Depth of Field for iPhone-style Bokeh */}
      <DepthOfField
        focusDistance={0.01}
        focalLength={0.05}
        bokehScale={2.5}
        height={700}
      />
      
      {/* Subtle Chromatic Aberration */}
      <ChromaticAberration
        offset={new Vector2(0.0015, 0.0015)}
        radialModulation={true}
        modulationOffset={0.3}
      />
      
      {/* Deeper Vignette for Depth */}
      <Vignette
        offset={0.25}
        darkness={0.85}
        eskil={false}
      />
    </EffectComposer>
  )
}
