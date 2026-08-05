/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Luxe black + gold palette
        ink: {
          950: '#050505',
          900: '#0a0a0a',
          800: '#111111',
          700: '#1a1a1a',
          600: '#222222',
          500: '#2a2a2a',
        },
        gold: {
          50: '#fbf3df',
          100: '#f6e6b8',
          200: '#ecd180',
          300: '#e0bb4d',
          400: '#d4a93a',
          500: '#c9a227',
          600: '#a98320',
          700: '#80621a',
          800: '#5a4513',
          900: '#3a2c0d',
        },
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Helvetica', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(201, 162, 39, 0.35)',
        soft: '0 8px 24px rgba(0, 0, 0, 0.5)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #f6e6b8 0%, #d4a93a 45%, #a98320 100%)',
        'ink-radial': 'radial-gradient(ellipse at top, rgba(20,20,20,0.6) 0%, rgba(0,0,0,1) 70%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'fade-up': 'fadeUp 0.7s ease-out',
        'pulse-gold': 'pulseGold 2.4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        fadeUp: {
          '0%': { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(201,162,39,0.4)' },
          '50%': { boxShadow: '0 0 0 12px rgba(201,162,39,0)' },
        },
      },
    },
  },
  plugins: [],
};
