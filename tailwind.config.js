/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{ts,tsx}',
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './public/**/*.html'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      screens: {
        '2xl': '1440px'
      },
      transitionTimingFunction: {
        'soft-out': 'cubic-bezier(.17,.84,.44,1)',
        'soft-in': 'cubic-bezier(.55,.06,.68,.19)'
      }
    },
  },
  plugins: [],
};
