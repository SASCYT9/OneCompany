import React from 'react';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline';
  as?: 'button' | 'a';
  href?: string;
};

export function GlassButton({ variant = 'primary', as = 'button', href, className = '', children, ...rest }: Props) {
  const base = variant === 'primary' ? 'cta-primary' : 'cta-outline';
  if (as === 'a' && href) {
    return (
      <a href={href} className={`${base} ${className}`}>{children}</a>
    );
  }
  return (
    <button className={`${base} ${className}`} {...rest}>{children}</button>
  );
}

export default GlassButton;
