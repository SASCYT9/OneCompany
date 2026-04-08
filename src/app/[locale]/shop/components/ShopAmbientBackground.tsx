'use client';

import React from 'react';
import './shop-ambient-bg.css';

/**
 * Premium "Stealth Wealth" Ambient Background.
 * Provides a global texture (SVG noise) and slow-moving luxury glows
 * to eliminate the "empty void" feeling of pure black backgrounds.
 */
export default function ShopAmbientBackground() {
  return (
    <div className="shop-ambient-wrapper">
      {/* Texture overlay (film grain / carbon feel) */}
      <div className="shop-ambient-noise" />
      
      {/* Animated glowing orbs for 3D depth */}
      <div className="shop-ambient-glow glow-1" />
      <div className="shop-ambient-glow glow-2" />
      <div className="shop-ambient-glow glow-3" />
    </div>
  );
}
