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
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        heading: ['Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
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
        // Background — warm off-white
        background: '#FBF8F3',
        // Surface / Cards
        surface: '#FFFFFF',
        // Border / Lines — warm neutral
        border: '#E5DCCB',
        // Text
        'text-primary': '#1F2937',
        'text-secondary': '#6B7280',
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
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
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
