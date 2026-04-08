import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        obsidian: {
          DEFAULT: '#030303',
          deep: '#000000',
          light: '#0a0a0c',
          panel: '#0d0d12',
          border: 'rgba(255, 255, 255, 0.06)',
        },
        smoke: {
          DEFAULT: '#1a1a1a',
          light: '#2a2a2a',
        },
        charcoal: {
          DEFAULT: '#0a0a0a',
          warm: '#121210',
        },
        bronze: {
          DEFAULT: '#c29d59',
          light: '#d4b77e',
          dark: '#a8864a',
          glow: 'rgba(194, 157, 89, 0.15)',
          border: 'rgba(194, 157, 89, 0.3)',
        },
        /* Brand-specific accent overrides */
        brabus: {
          red: '#e63946',
          dark: '#1a0000',
        },
        akrapovic: {
          titanium: '#8a9ba5',
          carbon: '#2d2d2d',
        },
        urban: {
          silver: '#b8b8b8',
          carbon: '#1a1a1e',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-stack-sans)'],
        display: ['var(--font-stack-display)'],
        mono: ['var(--font-mono)', 'monospace'],
        condensed: ['var(--font-stack-condensed)', 'var(--font-stack-display)', 'sans-serif'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'pulse-bronze': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(194, 157, 89, 0.4)' },
          '50%': { boxShadow: '0 0 20px 4px rgba(194, 157, 89, 0.15)' },
        },
        'slide-reveal': {
          from: { transform: 'translateY(24px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-up': {
          from: { transform: 'translateY(16px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'scale-in': {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        'line-grow': {
          from: { width: '0%' },
          to: { width: '100%' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'pulse-bronze': 'pulse-bronze 2s ease-in-out infinite',
        'slide-reveal': 'slide-reveal 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-up': 'fade-up 0.5s ease-out forwards',
        'scale-in': 'scale-in 0.4s ease-out forwards',
        'line-grow': 'line-grow 0.8s ease-out forwards',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
