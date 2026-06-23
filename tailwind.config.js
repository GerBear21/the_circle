/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // Unified on Manrope for a clean, modern, lighter look across the whole system.
        sans: ['Manrope', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        heading: ['Manrope', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      letterSpacing: {
        tight: '-0.01em',
        tighter: '-0.02em',
      },
      colors: {
        // Primary - Warm Beige / Brown (RTG)
        primary: {
          DEFAULT: '#9A7545',
          hover: '#7C5A33',
          soft: '#D4B483',
          50: '#FAF6F1',
          100: '#F3EADC',
          200: '#E6D3B3',
          300: '#D4B483',
          400: '#B8935A',
          500: '#9A7545',
          600: '#7C5A33',
          700: '#5E4426',
          800: '#3F2D19',
          900: '#20170C',
        },
        // Keep brand as alias for compatibility
        brand: {
          50: '#FAF6F1',
          100: '#F3EADC',
          200: '#E6D3B3',
          300: '#D4B483',
          400: '#B8935A',
          500: '#9A7545',
          600: '#7C5A33',
          700: '#5E4426',
          800: '#3F2D19',
          900: '#20170C',
        },
        // Background — soft neutral with the faintest warm tint
        background: '#F6F5F2',
        // Surface / Cards
        surface: '#FFFFFF',
        // Border / Lines — light, low-contrast neutral
        border: '#ECEAE4',
        // Text — warm near-black for a modern, high-clarity read
        'text-primary': '#1A1813',
        'text-secondary': '#8A857B',
        'text-muted': '#B4AFA4',
        // Neutral scale (warm-tinted gray) for minimal UI surfaces
        neutral: {
          50: '#FAFAF9',
          100: '#F4F3F1',
          200: '#ECEAE4',
          300: '#DAD7CF',
          400: '#B4AFA4',
          500: '#8A857B',
          600: '#6B675E',
          700: '#4E4B44',
          800: '#33312C',
          900: '#1A1813',
        },
        // Accent - Soft gold/cream highlight
        accent: {
          DEFAULT: '#C9A574',
          400: '#D4B483',
          500: '#C9A574',
        },
        // Success - Approvals
        success: {
          DEFAULT: '#22C55E',
          50: '#F0FDF4',
          100: '#DCFCE7',
          500: '#22C55E',
          600: '#16A34A',
        },
        // Danger - Rejections
        danger: {
          DEFAULT: '#EF4444',
          50: '#FEF2F2',
          100: '#FEE2E2',
          500: '#EF4444',
          600: '#DC2626',
        },
        // Warning - Pending
        warning: {
          DEFAULT: '#F59E0B',
          50: '#FFFBEB',
          100: '#FEF3C7',
          500: '#F59E0B',
          600: '#D97706',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 1px 2px 0 rgb(26 24 19 / 0.04), 0 1px 3px 0 rgb(26 24 19 / 0.03)',
        'card-hover': '0 4px 12px -2px rgb(26 24 19 / 0.08), 0 2px 6px -2px rgb(26 24 19 / 0.05)',
        'soft': '0 1px 2px 0 rgb(26 24 19 / 0.04)',
      },
      minHeight: {
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      },
      maxWidth: {
        '8xl': '88rem',
      },
    },
  },
  plugins: [],
};
