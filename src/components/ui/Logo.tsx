import Link from 'next/link';
import Image from 'next/image';
import clsx from 'clsx';

type LogoProps = {
  className?: string;
  asLink?: boolean;
  variant?: 'light' | 'dark';
  priority?: boolean;
};

const LOGO_SOURCES = {
  light: '/branding/one-company-logo-light.svg',
  dark: '/branding/one-company-logo-dark.svg',
};

export function Logo({
  className = '',
  asLink = false,
  variant = 'light',
  priority = false,
}: LogoProps) {
  const image = (
    <span className={clsx('inline-flex items-center', className)}>
      <Image
        src={LOGO_SOURCES[variant]}
        alt="ONE COMPANY wordmark"
        width={212}
        height={78}
        priority={priority}
        className="h-auto w-auto"
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
