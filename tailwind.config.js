/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cellar: {
          950: '#0b0507',
          900: '#13090c',
          850: '#1b0d12',
          800: '#241118',
          700: '#351822',
        },
        bordeaux: {
          500: '#9f1239',
          600: '#881337',
          700: '#6b0f2b',
          800: '#4c0519',
        },
        gold: {
          400: '#e5c158',
          500: '#d4af37',
          600: '#b59024',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
