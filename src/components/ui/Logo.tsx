import Link from 'next/link';
import Image from 'next/image';
import clsx from 'clsx';

type LogoSize = 'default' | 'compact';

type LogoProps = {
  className?: string;
  asLink?: boolean;
  priority?: boolean;
  tone?: 'dark' | 'light';
  size?: LogoSize;
};

const LOGO_SOURCE = '/branding/one-company-logo.svg';
const LOGO_DIMENSIONS: Record<LogoSize, { width: number; height: number }> = {
  default: { width: 212, height: 78 },
  compact: { width: 168, height: 62 },
};

export function Logo({
  className = '',
  asLink = false,
  priority = false,
  tone = 'dark',
  size = 'default',
}: LogoProps) {
  const { width, height } = LOGO_DIMENSIONS[size];
  const image = (
    <span className={clsx('inline-flex items-center', className)}>
      <Image
        src={LOGO_SOURCE}
        alt="ONE COMPANY wordmark"
        width={width}
        height={height}
        priority={priority}
        className="h-auto w-full"
        style={tone === 'light' ? { filter: 'brightness(0) invert(1)' } : undefined}
      />
    </span>
  );

  if (asLink) {
    return (
      <Link
        href="/"
        className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        aria-label="ONE COMPANY home"
      >
        {image}
      </Link>
    );
  }

  return image;
}

export default Logo;
