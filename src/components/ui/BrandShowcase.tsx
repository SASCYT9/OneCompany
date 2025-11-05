'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface BrandShowcaseProps {
  storeId: 'kw' | 'fi' | 'eventuri';
  isVisible: boolean;
}

export function BrandShowcase({ storeId, isVisible }: BrandShowcaseProps) {
  const [currentProduct, setCurrentProduct] = useState(0);

  const showcases = {
    kw: {
      title: 'Продукція KW',
      products: [
        {
          name: 'KW V3 Coilover',
          description: 'Повністю регульована підвіска',
          image: '/images/kw/v3-coilover.jpg',
          specs: ['Компресія', 'Відбій', 'Висота']
        },
        {
          name: 'KW V1 Coilover',
          description: 'Оптимальне співвідношення ціна/якість',
          image: '/images/kw/v1-coilover.jpg',
          specs: ['Висота', 'Комфорт', 'Спорт']
        },
        {
          name: 'KW HAS Kit',
          description: 'Гідравлічна система підняття',
          image: '/images/kw/has-kit.jpg',
          specs: ['+40мм', 'Електроніка', 'Універсальність']
        }
      ]
    },
    fi: {
      title: 'Продукція Fi Exhaust',
      products: [
        {
          name: 'Fi Valvetronic System',
          description: 'Титанова система з клапанами',
          image: '/images/fi/valvetronic.jpg',
          specs: ['Титан Grade 1', 'Клапани', '+30HP']
        },
        {
          name: 'Fi Titanium Cat-back',
          description: 'Повна система від каталізатора',
          image: '/images/fi/catback.jpg',
          specs: ['100% Титан', 'Легше -50%', 'Унікальний звук']
        },
        {
          name: 'Fi Exhaust Tips',
          description: 'Преміальні насадки',
          image: '/images/fi/tips.jpg',
          specs: ['Карбон', 'Титан', 'Кастомізація']
        }
      ]
    },
    eventuri: {
      title: 'Продукція Eventuri',
      products: [
        {
          name: 'Eventuri Carbon Intake',
          description: 'Патентована технологія Venturi',
          image: '/images/eventuri/carbon-intake.jpg',
          specs: ['100% Carbon', 'Venturi', '+15HP']
        },
        {
          name: 'Eventuri Filter',
          description: 'Високопотоковий фільтр',
          image: '/images/eventuri/filter.jpg',
          specs: ['Багаторазовий', 'ISO Tested', 'Premium']
        },
        {
          name: 'Eventuri Duct',
          description: 'Карбонові повітроводи',
          image: '/images/eventuri/duct.jpg',
          specs: ['Аеродинаміка', 'Легкі', 'Автоклав']
        }
      ]
    }
  };

  const currentShowcase = showcases[storeId];

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setCurrentProduct((prev) => (prev + 1) % currentShowcase.products.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isVisible, currentShowcase.products.length]);

  if (!isVisible) return null;

  const product = currentShowcase.products[currentProduct];

  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4">
      <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Product Image */}
          <div className="relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-white/5 to-white/10">
            <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm">
              {product.name}
              <br />
              <span className="text-xs">(Зображення буде додано)</span>
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-4">
            <div>
              <h3 className="text-2xl md:text-3xl font-light text-white mb-2">
                {product.name}
              </h3>
              <p className="text-white/60 font-light">
                {product.description}
              </p>
            </div>

            {/* Specs */}
            <div className="flex flex-wrap gap-2">
              {product.specs.map((spec, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-white/10 border border-white/20 rounded-full text-xs text-white/80 font-light"
                >
                  {spec}
                </span>
              ))}
            </div>

            {/* Progress dots */}
            <div className="flex gap-2 pt-2">
              {currentShowcase.products.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentProduct(index)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === currentProduct
                      ? 'w-8 bg-white'
                      : 'w-1.5 bg-white/30 hover:bg-white/50'
                  }`}
                  aria-label={`Продукт ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
