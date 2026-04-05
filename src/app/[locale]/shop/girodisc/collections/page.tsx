import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import Link from 'next/link';
import { GIRODISC_PRODUCT_LINES } from '../../data/girodiscHomeData';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, 'shop/girodisc/collections', {
    title:
      resolvedLocale === 'ua'
        ? 'Лінійки продукції GiroDisc | One Company'
        : 'GiroDisc Collections | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Гоночні двоскладові диски, колодки та аксесуари GiroDisc.'
        : 'GiroDisc 2-piece racing rotors, performance pads, and hardware.',
  });
}

export default async function GiroDiscCollectionsPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const isUa = resolvedLocale === 'ua';

  return (
    <div
      style={{
        background: '#09090b',
        color: '#f4f4f5',
        minHeight: '100dvh',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Back */}
      <div style={{ padding: '100px 48px 16px', maxWidth: 1400, margin: '0 auto' }}>
        <Link
          href={`/${resolvedLocale}/shop/girodisc`}
          style={{
            fontSize: '0.65rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase' as const,
            color: 'rgba(255,255,255,0.4)',
            textDecoration: 'none',
          }}
        >
          ← {isUa ? 'Магазин GiroDisc' : 'GiroDisc Store'}
        </Link>
      </div>

      {/* Header */}
      <div style={{ padding: '2rem 48px 4rem', maxWidth: 1400, margin: '0 auto', textAlign: 'center' }}>
        <span
          style={{
            fontSize: '0.6rem',
            fontWeight: 700,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.25em',
            color: '#ef4444',
          }}
        >
          {isUa ? 'Каталог' : 'Catalog'}
        </span>
        <h1
          style={{
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 800,
            textTransform: 'uppercase' as const,
            letterSpacing: '-0.02em',
            marginTop: '1rem',
          }}
        >
          {isUa ? 'Лінійки Продукції' : 'Product Lines'}
        </h1>
        <div
          style={{
            width: 50,
            height: 4,
            background: '#ef4444',
            margin: '1.5rem auto',
          }}
        />
      </div>

      {/* Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '1.5rem',
          padding: '0 48px 6rem',
          maxWidth: 1400,
          margin: '0 auto',
        }}
      >
        {GIRODISC_PRODUCT_LINES.map((line) => (
          <div
            key={line.id}
            style={{
              background: '#18181b',
              border: '1px solid rgba(255,255,255,0.05)',
              overflow: 'hidden',
              transition: 'border-color 0.4s',
            }}
          >
            <div style={{ position: 'relative', aspectRatio: '16/10', overflow: 'hidden' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={line.image}
                alt={isUa ? line.nameUk : line.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                loading="lazy"
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to top, rgba(9,9,11,0.9) 0%, transparent 50%)',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: '1rem',
                  left: '1rem',
                  fontSize: '0.625rem',
                  fontWeight: 800,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.1em',
                  background: '#ef4444',
                  color: '#fff',
                  padding: '0.25rem 0.75rem',
                }}
              >
                {isUa ? line.badgeUk : line.badge}
              </span>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <h3
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  margin: '0 0 0.5rem',
                  color: '#fff',
                  textTransform: 'uppercase',
                }}
              >
                {isUa ? line.nameUk : line.name}
              </h3>
              <p
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 300,
                  color: '#a1a1aa',
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {isUa ? line.descriptionUk : line.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
