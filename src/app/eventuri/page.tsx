'use client';

import { Navigation } from '@/components/shared/Navigation';
import { EventuriHero } from '@/components/eventuri/EventuriHero';
import { EventuriProducts } from '@/components/eventuri/EventuriProducts';
import { EventuriTechnology } from '@/components/eventuri/EventuriTechnology';
import { EventuriGallery } from '@/components/eventuri/EventuriGallery';
import { Footer } from '@/components/shared/Footer';

export default function EventuriPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-950/20 to-black">
      <Navigation currentBrand="eventuri" />
      <EventuriHero />
      <EventuriProducts />
      <EventuriTechnology />
      <EventuriGallery />
      <Footer brand="eventuri" />
    </div>
  );
}
