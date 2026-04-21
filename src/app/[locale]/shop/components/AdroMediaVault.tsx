'use client';

import { useRef } from 'react';
import type { SupportedLocale } from '@/lib/seo';

const MEDIA_ITEMS = [
  { type: 'video', id: 'pyEBZ8jJvZg', title: 'ADRO BMW M4 WIDEBODY' },
  { type: 'image', src: '/images/shop/adro/adro-hero-m4.jpg', title: 'BMW M4 G82 AEROKIT' },
  { type: 'video', id: 'LNXs4OI_yNA', title: 'ADRO PORSCHE 992 GT3' },
  { type: 'image', src: '/images/shop/adro/adro-supra-kit.png', title: 'TOYOTA SUPRA GR' },
  { type: 'video', id: 'nUIh8Ja2A_0', title: 'ADRO GR86 DEVELOPMENT' },
  { type: 'image', src: '/images/shop/adro/adro-m4-side.png', title: 'M4 SIDE PROFILE' },
  { type: 'video', id: 'axNzJedJv1w', title: 'ADRO SHOWCASE' },
  { type: 'image', src: '/images/shop/adro/adro-hero-tesla.jpg', title: 'TESLA MODEL 3 HIGHLAND' },
  { type: 'video', id: 'YPos3tan_xs', title: 'ADRO CINEMATICS' },
  { type: 'image', src: '/images/shop/adro/adro-gt3-kit.png', title: 'GT3 TRACK VALIDATION' },
  { type: 'video', id: 'TCK_wHUhwRw', title: 'CFD AERODYNAMICS' },
  { type: 'image', src: '/images/shop/adro/adro-hero-718.jpg', title: 'PORSCHE 718 CAYMAN' },
];

export default function AdroMediaVault({ locale }: { locale: SupportedLocale }) {
  const isUa = locale === 'ua';
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 600;
      scrollRef.current.scrollBy({ left: dir === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className="adro-vault">
      <div className="adro-vault-header" data-adro-reveal>
        <div className="adro-vault-header-info">
          <h2>{isUa ? 'Медіа Архів' : 'Media Vault'}</h2>
          <p>{isUa ? 'Оригінальні матеріали та кінематографіка ADRO.' : 'Original assets and ADRO cinematics.'}</p>
        </div>
        <div className="adro-vault-controls">
          <button onClick={() => handleScroll('left')} className="adro-vault-btn">&larr;</button>
          <button onClick={() => handleScroll('right')} className="adro-vault-btn">&rarr;</button>
        </div>
      </div>

      <div className="adro-vault-scroller" ref={scrollRef}>
        <div className="adro-vault-track">
          {MEDIA_ITEMS.map((item, i) => (
            <div key={i} className={`adro-vault-item adro-vault-item--${item.type}`}>
              {item.type === 'video' ? (
                <iframe
                  loading="lazy"
                  src={`https://www.youtube-nocookie.com/embed/${item.id}?autoplay=0&controls=1&rel=0&modestbranding=1`}
                  title={item.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.src} alt={item.title} loading="lazy" />
              )}
              <div className="adro-vault-item-overlay">
                <span>{item.title}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
