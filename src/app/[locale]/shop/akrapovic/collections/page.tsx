import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import Link from 'next/link';
import { AKRAPOVIC_PRODUCT_LINES } from '../../data/akrapovicHomeData';

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
  return buildPageMetadata(resolvedLocale, 'shop/akrapovic/collections', {
    title:
      resolvedLocale === 'ua'
        ? 'Колекції Akrapovič | One Company'
        : 'Akrapovič Collections | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Каталог вихлопних систем Akrapovič: Evolution Line, Slip-On, Link Pipe, Downpipe та аксесуари.'
        : 'Akrapovič exhaust catalog: Evolution Line, Slip-On, Link Pipe, Downpipe and accessories.',
  });
}

export default async function AkrapovicCollectionsPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const isUa = resolvedLocale === 'ua';

  return (
    <div
      style={{
        background: '#0d0d0b',
        color: '#fafaf9',
        minHeight: '100vh',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Back */}
      <div style={{ padding: '100px 48px 16px', maxWidth: 1400, margin: '0 auto' }}>
        <Link
          href={`/${resolvedLocale}/shop/akrapovic`}
          style={{
            fontSize: '0.65rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase' as const,
            color: 'rgba(255,255,255,0.35)',
            textDecoration: 'none',
          }}
        >
          ← {isUa ? 'Akrapovič Store' : 'Akrapovič Store'}
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
            color: '#d97706',
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
          {isUa ? 'Лінійки Продукції' : 'Product Lines'}
        </h1>
        <div
          style={{
            width: 50,
            height: 1,
            background: '#d97706',
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
        {AKRAPOVIC_PRODUCT_LINES.map((line) => (
          <div
            key={line.id}
            style={{
              background: '#161614',
              border: '1px solid #252520',
              borderRadius: 12,
              overflow: 'hidden',
              transition: 'all 0.3s',
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
              <span
                style={{
                  position: 'absolute',
                  top: '1rem',
                  left: '1rem',
                  fontSize: '0.5rem',
                  fontWeight: 600,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.2em',
                  border: '1px solid #d97706',
                  color: '#d97706',
                  padding: '0.2rem 0.6rem',
                }}
              >
                {isUa ? line.badgeUk : line.badge}
              </span>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <h3
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 400,
                  letterSpacing: '0.04em',
                  margin: '0 0 0.5rem',
                }}
              >
                {isUa ? line.nameUk : line.name}
              </h3>
              <p
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 300,
                  color: '#a8a29e',
                  lineHeight: 1.7,
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
