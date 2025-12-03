/**
 * OG Image Generator for onecompany
 * Run: npx ts-node scripts/generate-og-image.ts
 * Or: npx tsx scripts/generate-og-image.ts
 * 
 * This will generate a proper 1200x630 OG image with:
 * - Black background
 * - White logo centered
 * - Tagline text
 */

import { createCanvas, loadImage } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';

async function generateOgImage() {
  const WIDTH = 1200;
  const HEIGHT = 630;
  
  // Create canvas
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  
  // Background - dark gradient
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, '#0a0a0a');
  gradient.addColorStop(0.5, '#111111');
  gradient.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  
  // Add subtle grid pattern
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < WIDTH; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < HEIGHT; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  
  // Add glow orbs
  const drawOrb = (x: number, y: number, radius: number, color: string, opacity: number) => {
    const orbGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    orbGradient.addColorStop(0, color.replace(')', `, ${opacity})`).replace('rgb', 'rgba'));
    orbGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = orbGradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  };
  
  drawOrb(200, 100, 300, 'rgb(139, 92, 246)', 0.15); // Purple top-left
  drawOrb(1000, 530, 250, 'rgb(249, 115, 22)', 0.1); // Orange bottom-right
  
  // Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.roundRect(20, 20, WIDTH - 40, HEIGHT - 40, 20);
  ctx.stroke();
  
  // Load and draw logo
  try {
    const logoPath = path.join(__dirname, '../Design/png/ONE COMPANY_logo-02.png');
    const logo = await loadImage(logoPath);
    
    // Calculate logo size (max 400px wide, maintain aspect ratio)
    const maxLogoWidth = 420;
    const logoScale = maxLogoWidth / logo.width;
    const logoWidth = logo.width * logoScale;
    const logoHeight = logo.height * logoScale;
    
    // Center logo
    const logoX = (WIDTH - logoWidth) / 2;
    const logoY = (HEIGHT - logoHeight) / 2 - 60;
    
    ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
  } catch (e) {
    // Fallback: draw text if logo fails
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('ONE COMPANY', WIDTH / 2, HEIGHT / 2 - 40);
  }
  
  // Tagline
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '300 24px Arial';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '4px';
  ctx.fillText('PREMIUM AUTO & MOTO TUNING', WIDTH / 2, HEIGHT / 2 + 80);
  
  // Stats
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '16px Arial';
  ctx.fillText('200+ Brands  •  18 Years  •  Official Importer Ukraine', WIDTH / 2, HEIGHT / 2 + 120);
  
  // Brand names at bottom
  const brands = ['Akrapovič', 'Brabus', 'HRE', 'KW', 'Brembo', 'Mansory'];
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.font = '12px Arial';
  ctx.fillText(brands.join('   •   '), WIDTH / 2, HEIGHT - 50);
  
  // Save the image
  const outputPath = path.join(__dirname, '../public/branding/og-image.png');
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  
  console.log(`✅ OG Image generated: ${outputPath}`);
  console.log(`   Size: ${WIDTH}x${HEIGHT}px`);
}

generateOgImage().catch(console.error);
