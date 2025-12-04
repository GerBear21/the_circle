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
        // Primary - Electric Blue
        primary: {
          DEFAULT: '#2D9CDB',
          hover: '#1B73BA',
          soft: '#56CCF2',
          50: '#E8F4FC',
          100: '#D1E9F9',
          200: '#A3D3F3',
          300: '#75BDED',
          400: '#47A7E7',
          500: '#2D9CDB',
          600: '#1B73BA',
          700: '#1B5E83',
          800: '#123F58',
          900: '#091F2C',
        },
        // Keep brand as alias for compatibility
        brand: {
          50: '#E8F4FC',
          100: '#D1E9F9',
          200: '#A3D3F3',
          300: '#75BDED',
          400: '#47A7E7',
          500: '#2D9CDB',
          600: '#1B73BA',
          700: '#1B5E83',
          800: '#123F58',
          900: '#091F2C',
        },
        // Background
        background: '#F7F8FA',
        // Surface / Cards
        surface: '#FFFFFF',
        // Border / Lines
        border: '#E5E7EB',
        // Text
        'text-primary': '#1F2937',
        'text-secondary': '#6B7280',
        // Accent - Elegant purple highlight
        accent: {
          DEFAULT: '#A78BFA',
          400: '#56CCF2',
          500: '#A78BFA',
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
