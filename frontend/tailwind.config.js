/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0a0a09',
          900: '#11110f',
          800: '#191815',
          700: '#24221e',
          600: '#302d27',
          500: '#3d3931',
        },
        gold: {
          50: '#fcf8ee',
          100: '#f5ead2',
          200: '#ead8ae',
          300: '#ddc58e',
          400: '#cdaa6b',
          500: '#b88d4f',
          600: '#96703c',
          700: '#73552f',
          800: '#4f3a22',
          900: '#322517',
        },
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'Iowan Old Style', 'Baskerville', 'Georgia', 'serif'],
        sans: ['DM Sans', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Helvetica', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 18px 50px -28px rgba(0, 0, 0, 0.9)',
        overlay: '0 20px 70px -36px rgba(0, 0, 0, 0.95)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(115deg, #f5ead2 0%, #ddc58e 48%, #b88d4f 100%)',
        'ink-radial': 'radial-gradient(ellipse at top, rgba(42, 39, 31, 0.72) 0%, rgba(10, 10, 9, 1) 72%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.55s ease-out both',
        'fade-up': 'fadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
        'line-drift': 'lineDrift 2.8s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
        'sweep': 'sweep 3.4s ease-in-out infinite',
        'ring-rotate': 'ringRotate 9s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        fadeUp: {
          '0%': { opacity: 0, transform: 'translateY(10px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        lineDrift: {
          '0%, 100%': { transform: 'scaleX(0.45)', opacity: '0.35' },
          '50%': { transform: 'scaleX(1)', opacity: '0.9' },
        },
        pulseSoft: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.55' },
          '50%': { transform: 'scale(1.45)', opacity: '0' },
        },
        sweep: {
          '0%': { transform: 'translateX(-110%)' },
          '100%': { transform: 'translateX(110%)' },
        },
        ringRotate: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
    },
  },
  plugins: [],
};
