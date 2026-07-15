import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefdfd',
          100: '#d5f8f8',
          400: '#35e0e0',
          500: '#1fb8b8',
          600: '#178f8f',
          700: '#146f6f',
          900: '#0a2e2e',
        },
        severity: {
          advisory: '#f4d13f',
          warning: '#ff9a3c',
          severe: '#ff4d4d',
        },
        surface: {
          light: '#ffffff',
          dark: '#0b0f12',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl: '0.875rem',
      },
    },
  },
  plugins: [],
} satisfies Config;
