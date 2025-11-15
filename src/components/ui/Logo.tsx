import Link from 'next/link';
import Image from 'next/image';
import clsx from 'clsx';

type LogoProps = {
  className?: string;
  asLink?: boolean;
  priority?: boolean;
  tone?: 'dark' | 'light';
};

const LOGO_SOURCE = '/branding/one-company-logo.svg';

export function Logo({
  className = '',
  asLink = false,
  priority = false,
  tone = 'dark',
}: LogoProps) {
  const image = (
    <span className={clsx('inline-flex items-center', className)}>
      <Image
        src={LOGO_SOURCE}
        alt="ONE COMPANY wordmark"
        width={212}
        height={78}
        priority={priority}
        className="h-auto w-auto"
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
