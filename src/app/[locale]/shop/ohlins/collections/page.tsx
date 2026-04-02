import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import Link from 'next/link';
import { OHLINS_PRODUCT_LINES } from '../../data/ohlinsHomeData';

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
  return buildPageMetadata(resolvedLocale, 'shop/ohlins/collections', {
    title:
      resolvedLocale === 'ua'
        ? 'Лінійки продукції Öhlins | One Company'
        : 'Öhlins Collections | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Спортивні та трекові підвіски Öhlins: Road & Track, Advanced Track Day, Dedicated Track.'
        : 'Sport and track suspensions by Öhlins: Road & Track, Advanced Track Day, Dedicated Track.',
  });
}

export default async function OhlinsCollectionsPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const isUa = resolvedLocale === 'ua';

  return (
    <div
      style={{
        background: '#050505',
        color: '#f8f8f8',
        minHeight: '100vh',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Back */}
      <div style={{ padding: '100px 48px 16px', maxWidth: 1400, margin: '0 auto' }}>
        <Link
          href={`/${resolvedLocale}/shop/ohlins`}
          style={{
            fontSize: '0.65rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase' as const,
            color: 'rgba(255,255,255,0.4)',
            textDecoration: 'none',
          }}
        >
          ← {isUa ? 'Магазин Öhlins' : 'Öhlins Store'}
        </Link>
      </div>

      {/* Header */}
      <div style={{ padding: '2rem 48px 4rem', maxWidth: 1400, margin: '0 auto', textAlign: 'center' }}>
        <span
          style={{
            fontSize: '0.6rem',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.25em',
            color: '#eab308',
          }}
        >
          {isUa ? 'Каталог' : 'Catalog'}
        </span>
        <h1
          style={{
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 200,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.06em',
            marginTop: '1rem',
          }}
        >
          {isUa ? 'Колекції Підвісок' : 'Suspension Collections'}
        </h1>
        <div
          style={{
            width: 50,
            height: 2,
            background: 'linear-gradient(90deg, transparent, #eab308, transparent)',
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
        {OHLINS_PRODUCT_LINES.map((line) => (
          <div
            key={line.id}
            style={{
              background: '#0a0a0a',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 8,
              overflow: 'hidden',
              transition: 'border-color 0.4s',
            }}
          >
            <div style={{ position: 'relative', aspectRatio: '16/10', overflow: 'hidden' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={line.image}
                alt={line.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                loading="lazy"
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to top, rgba(5,5,5,0.9) 0%, transparent 50%)',
                }}
              />
            </div>
            <div style={{ padding: '1.5rem' }}>
              <h3
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  margin: '0 0 0.5rem',
                  color: '#fff',
                }}
              >
                {line.name}
              </h3>
              <div style={{ width: 30, height: 2, background: '#eab308', marginBottom: '1rem' }} />
              <p
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 300,
                  color: '#a8a29e',
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {line.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
