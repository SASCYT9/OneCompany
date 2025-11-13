'use client';

import { Navigation } from '@/components/shared/Navigation';
import { FiHero } from '@/components/fi/FiHero';
import { FiProducts } from '@/components/fi/FiProducts';
import { FiTechnology } from '@/components/fi/FiTechnology';
import { FiGallery } from '@/components/fi/FiGallery';
import Footer from '@/components/shared/Footer';

export default function FiPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-red-950/20 to-black">
      <Navigation currentBrand="fi" />
      <FiHero />
      <FiProducts />
      <FiTechnology />
      <FiGallery />
      <Footer />
    </div>
  );
}
