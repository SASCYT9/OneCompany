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
        color: '#ffffff',
        minHeight: '100dvh',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Back */}
      <div style={{ padding: '100px 48px 16px', maxWidth: 1400, margin: '0 auto' }}>
        <Link
          href={`/${resolvedLocale}/shop/csf`}
          style={{
            fontSize: '0.75rem',
            letterSpacing: '0.05em',
            textTransform: 'uppercase' as const,
            color: 'rgba(255,255,255,0.4)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          ← {isUa ? 'Магазин CSF Racing' : 'CSF Racing Store'}
        </Link>
      </div>

      {/* Header */}
      <div style={{ padding: '2rem 48px 4rem', maxWidth: 1400, margin: '0 auto', textAlign: 'center' }}>
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 500,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.1em',
            color: '#a1a1aa',
          }}
        >
          {isUa ? 'Каталог' : 'Catalog'}
        </span>
        <h1
          style={{
            fontSize: 'clamp(2.5rem, 5vw, 4rem)',
            fontWeight: 400,
            letterSpacing: '-0.02em',
            marginTop: '1rem',
            color: '#ffffff',
          }}
        >
          {isUa ? 'Лінійки Продукції' : 'Product Lines'}
        </h1>
        <div
          style={{
            width: 40,
            height: 1,
            background: 'rgba(255,255,255,0.2)',
            margin: '2rem auto',
          }}
        />
      </div>

      {/* Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '2rem',
          padding: '0 48px 8rem',
          maxWidth: 1400,
          margin: '0 auto',
        }}
      >
        {CSF_PRODUCT_LINES.map((line) => (
          <div
            key={line.id}
            style={{
              background: '#0A0A0A',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 4,
              overflow: 'hidden',
              transition: 'all 0.3s ease',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ position: 'relative', aspectRatio: '16/10', overflow: 'hidden', background: '#111' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={line.image}
                alt={isUa ? line.nameUk : line.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9, transition: 'transform 0.6s ease' }}
                loading="lazy"
                className="csf-collection-img"
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to top, rgba(10,10,10,1) 0%, transparent 40%)',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: '1.25rem',
                  right: '1.25rem',
                  fontSize: '0.65rem',
                  fontWeight: 500,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.05em',
                  background: 'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(8px)',
                  color: '#ffffff',
                  padding: '0.25rem 0.75rem',
                  borderRadius: 20,
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {isUa ? line.badgeUk : line.badge}
              </span>
            </div>
            <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
              <h3
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 500,
                  margin: '0 0 0.5rem',
                  color: '#ffffff',
                }}
              >
                {isUa ? line.nameUk : line.name}
              </h3>
              <p
                style={{
                  fontSize: '0.9rem',
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
