/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Nunito', 'sans-serif'],
        body: ['Nunito', 'sans-serif'],
      },
      colors: {
        ink: '#1e1b4b',
        surface: '#ffffff',
        'bg-base': '#f5f3ff',
        violet: { DEFAULT: '#7c3aed', light: '#ede9fe', mid: '#a78bfa', dark: '#5b21b6' },
        pink:   { DEFAULT: '#ec4899', light: '#fce7f3', dark: '#be185d' },
        cyan:   { DEFAULT: '#06b6d4', light: '#cffafe', dark: '#0e7490' },
        lime:   { DEFAULT: '#84cc16', light: '#f7fee7', dark: '#4d7c0f' },
        amber:  { DEFAULT: '#f59e0b', light: '#fef3c7', dark: '#b45309' },
        coral:  { DEFAULT: '#f97316', light: '#fff7ed', dark: '#c2410c' },
        mint:   { DEFAULT: '#10b981', light: '#d1fae5', dark: '#065f46' },
      },
      borderRadius: { pill: '9999px', '4xl': '2rem', '5xl': '2.5rem' },
      boxShadow: {
        card:  '0 4px 20px rgba(124,58,237,0.10)',
        float: '0 8px 32px rgba(0,0,0,0.12)',
        glow:  '0 0 28px rgba(124,58,237,0.30)',
        'glow-pink': '0 0 28px rgba(236,72,153,0.30)',
        'glow-cyan': '0 0 28px rgba(6,182,212,0.30)',
      },
      keyframes: {
        'pop-in':   { '0%':{ transform:'scale(0.7)',opacity:'0' },'65%':{ transform:'scale(1.06)' },'100%':{ transform:'scale(1)',opacity:'1' } },
        'slide-up': { '0%':{ transform:'translateY(16px)',opacity:'0' },'100%':{ transform:'translateY(0)',opacity:'1' } },
        'float':    { '0%,100%':{ transform:'translateY(0)' },'50%':{ transform:'translateY(-7px)' } },
        'wiggle':   { '0%,100%':{ transform:'rotate(-4deg)' },'50%':{ transform:'rotate(4deg)' } },
        'sheet-up': { '0%':{ transform:'translateY(100%)',opacity:'0' },'100%':{ transform:'translateY(0)',opacity:'1' } },
      },
      animation: {
        'pop-in':   'pop-in 0.3s ease forwards',
        'slide-up': 'slide-up 0.25s ease forwards',
        'float':    'float 3.5s ease-in-out infinite',
        'wiggle':   'wiggle 0.4s ease',
        'sheet-up': 'sheet-up 0.3s cubic-bezier(.32,1.1,.6,1) forwards',
      },
    },
  },
  plugins: [],
}
