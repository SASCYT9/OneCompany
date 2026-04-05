import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import Link from 'next/link';
import { CSF_PRODUCT_LINES } from '../../data/csfHomeData';

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
  return buildPageMetadata(resolvedLocale, 'shop/csf/collections', {
    title:
      resolvedLocale === 'ua'
        ? 'Лінійки продукції CSF Racing | One Company'
        : 'CSF Racing Collections | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Радіатори, інтеркулери та системи охолодження CSF Racing.'
        : 'CSF Racing radiators, intercoolers, and cooling systems.',
  });
}

export default async function CSFCollectionsPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const isUa = resolvedLocale === 'ua';

  return (
    <div
      style={{
        background: '#050505',
        color: '#f8f8f8',
        minHeight: '100dvh',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Back */}
      <div style={{ padding: '100px 48px 16px', maxWidth: 1400, margin: '0 auto' }}>
        <Link
          href={`/${resolvedLocale}/shop/csf`}
          style={{
            fontSize: '0.65rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase' as const,
            color: 'rgba(255,255,255,0.4)',
            textDecoration: 'none',
          }}
        >
          ← {isUa ? 'Магазин CSF Racing' : 'CSF Racing Store'}
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
            color: '#3b82f6',
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
            height: 2,
            background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)',
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
        {CSF_PRODUCT_LINES.map((line) => (
          <div
            key={line.id}
            style={{
              background: '#111',
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
                alt={isUa ? line.nameUk : line.name}
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
              <span
                style={{
                  position: 'absolute',
                  top: '1rem',
                  left: '1rem',
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.1em',
                  background: 'rgba(255,255,255,0.9)',
                  color: '#000',
                  padding: '0.25rem 0.75rem',
                  borderRadius: 999,
                }}
              >
                {isUa ? line.badgeUk : line.badge}
              </span>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <h3
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 300,
                  margin: '0 0 0.5rem',
                  color: '#fff',
                }}
              >
                {isUa ? line.nameUk : line.name}
              </h3>
              <p
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 300,
                  color: '#a8a29e',
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
