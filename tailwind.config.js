/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#00E6CA',
          hover: '#00D4B8'
        },
        secondary: {
          DEFAULT: '#00B1E5',
          hover: '#009FCD'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif']
      },
      // Couleurs optimisées pour le mode sombre
      textColor: {
        'dark-primary': 'rgba(235, 235, 245, 0.9)',  // Blanc doux avec opacité
        'dark-secondary': 'rgba(176, 180, 194, 0.86)',  // Gris-bleu adouci
        'dark-muted': 'rgba(148, 153, 165, 0.75)',  // Ton encore plus doux
      },
      boxShadow: {
        'dark-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
        'dark-md': '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.4)'
      },
      borderColor: {
        'dark-border': 'rgba(55, 58, 64, 0.8)'
      },
      backgroundColor: {
        'dark-card': 'rgba(26, 27, 30, 0.95)',
        'dark-highlight': 'rgba(55, 58, 64, 0.5)'
      },
      animation: {
        'pulse-subtle': 'pulse-subtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient-move': 'gradient-move 3s ease infinite',
        'shimmer': 'shimmer 1.5s infinite linear',
      },
      keyframes: {
        'pulse-subtle': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.8 },
        },
        'gradient-move': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backgroundImage: {
        'gradient-shimmer': 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
      },
      backdropFilter: {
        'blur-xs': 'blur(2px)',
      }
    },
  },
  plugins: [],
};