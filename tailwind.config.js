/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}', './index.html'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      fontSize: {
        xs: ['12px', { lineHeight: '1.4' }],
        sm: ['13px', { lineHeight: '1.5' }],
        base: ['14px', { lineHeight: '1.5' }],
        lg: ['16px', { lineHeight: '1.5' }],
        xl: ['18px', { lineHeight: '1.4' }],
        '3xl': ['28px', { lineHeight: '1.2' }],
      },
      fontFamily: {
        mono: 'var(--terminal-font)',
      },
      borderColor: {
        DEFAULT: 'var(--border)',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
        lg: '0 8px 24px rgba(0, 0, 0, 0.5)',
      },
      transitionDuration: {
        DEFAULT: 'var(--transition-fast)',
      },
    },
  },
  plugins: [],
}
