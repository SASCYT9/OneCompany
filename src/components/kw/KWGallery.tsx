'use client';

import { useState } from 'react';

export function KWGallery() {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);

  const gallery = [
    {
      title: 'Porsche 911 GT3',
      category: 'Clubsport',
      image: '/images/kw/gallery/porsche-gt3.jpg',
      setup: 'KW Clubsport 3-Way',
    },
    {
      title: 'BMW M4 Competition',
      category: 'Variant 3',
      image: '/images/kw/gallery/bmw-m4.jpg',
      setup: 'KW V3 + HLS4',
    },
    {
      title: 'Audi RS6 Avant',
      category: 'Variant 3',
      image: '/images/kw/gallery/audi-rs6.jpg',
      setup: 'KW V3 Inox-Line',
    },
    {
      title: 'Mercedes-AMG GT',
      category: 'Variant 2',
      image: '/images/kw/gallery/amg-gt.jpg',
      setup: 'KW V2 DDC ECU',
    },
    {
      title: 'Lamborghini Huracán',
      category: 'Clubsport',
      image: '/images/kw/gallery/huracan.jpg',
      setup: 'KW Clubsport 2-Way',
    },
    {
      title: 'McLaren 720S',
      category: 'Variant 3',
      image: '/images/kw/gallery/mclaren.jpg',
      setup: 'KW V3 Carbon',
    },
  ];

  return (
    <section className="relative py-24 px-6 bg-gradient-to-b from-black via-slate-900/30 to-black">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-block px-6 py-2 bg-amber-500/20 border border-amber-400/40 rounded-full text-amber-300 text-sm font-medium tracking-widest backdrop-blur-sm mb-6">
            ГАЛЕРЕЯ
          </div>
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
            <span className="bg-gradient-to-r from-amber-200 to-orange-400 bg-clip-text text-transparent">
              Наші
            </span>{' '}
            <span className="text-white/90 font-light">проекти</span>
          </h2>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            Реальні автомобілі з інсталяціями KW Suspension
          </p>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gallery.map((item, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedImage(idx)}
              className="group relative aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer"
            >
              {/* Image Placeholder */}
              <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                <div className="text-6xl opacity-20">🏎️</div>
              </div>

              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300" />

              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-6 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                {/* Category Badge */}
                <span className="inline-block px-3 py-1 bg-amber-500/90 text-white text-xs font-bold rounded-full mb-3">
                  {item.category}
                </span>

                <h3 className="text-2xl font-bold text-white mb-2">{item.title}</h3>
                <p className="text-white/70 text-sm mb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {item.setup}
                </p>

                {/* View Button */}
                <div className="flex items-center gap-2 text-amber-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span>Переглянути</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>

              {/* Hover Border */}
              <div className="absolute inset-0 border-2 border-transparent group-hover:border-amber-500/50 rounded-2xl transition-colors duration-300" />
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 p-8 bg-gradient-to-r from-slate-800/30 to-slate-900/30 rounded-2xl border border-white/10">
          <div className="text-center">
            <div className="text-4xl font-light text-amber-400 mb-2">500+</div>
            <div className="text-white/60 text-sm">Встановлень на місяць</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-light text-amber-400 mb-2">98%</div>
            <div className="text-white/60 text-sm">Задоволених клієнтів</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-light text-amber-400 mb-2">24/7</div>
            <div className="text-white/60 text-sm">Підтримка</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-light text-amber-400 mb-2">15K+</div>
            <div className="text-white/60 text-sm">Моделей авто</div>
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedImage !== null && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-8 cursor-pointer"
        >
          <div className="max-w-6xl w-full">
            <div className="aspect-video bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
              <div className="text-8xl opacity-20">🏎️</div>
            </div>
            <div className="text-center">
              <h3 className="text-3xl font-bold text-white mb-2">
                {gallery[selectedImage].title}
              </h3>
              <p className="text-amber-400">{gallery[selectedImage].setup}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
