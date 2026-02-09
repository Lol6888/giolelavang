import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        marian: { DEFAULT: '#0F2C67', light: '#3160B7', dark: '#06142e' },
        gold: { DEFAULT: '#C5A059', light: '#E5C985', dark: '#8A6D30' },
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'serif'],
        sans: ['var(--font-vietnam)', 'sans-serif'],
        // UPDATE QUAN TRỌNG: Chuyển mono sang dùng Montserrat
        mono: ['var(--font-montserrat)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
      },
      backgroundImage: {
        'basilica': "url('https://images.pexels.com/photos/35775048/pexels-photo-35775048.png')",
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ken-burns': 'kenBurns 120s infinite alternate',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        kenBurns: { '0%': { transform: 'scale(1)' }, '100%': { transform: 'scale(1.15)' } }
      }
    },
  },
  plugins: [],
}
export default config