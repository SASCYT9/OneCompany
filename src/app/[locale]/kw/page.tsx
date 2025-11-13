'use client';

import { Navigation } from '@/components/shared/Navigation';
import { KWHero } from '@/components/kw/KWHero';
import { KWProducts } from '@/components/kw/KWProducts';
import { KWTechnology } from '@/components/kw/KWTechnology';
import { KWGallery } from '@/components/kw/KWGallery';
import Footer from '@/components/shared/Footer';

export default function KWPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-black">
      <Navigation currentBrand="kw" />
      <KWHero />
      <KWProducts />
      <KWTechnology />
      <KWGallery />
      <Footer />
    </div>
  );
}
