import type { Config } from 'tailwindcss';

export default {
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2d5a27',
          foreground: '#f0faf0',
        },
        secondary: {
          DEFAULT: '#e8dcc8',
          foreground: '#5a4a3a',
        },
        muted: {
          DEFAULT: '#ede8df',
          foreground: '#7a6a5a',
        },
        accent: {
          DEFAULT: '#d4c4a0',
          foreground: '#4a3a2a',
        },
        destructive: {
          DEFAULT: '#b33a1a',
          foreground: '#ffffff',
        },
        background: '#faf8f4',
        foreground: '#3a2a1a',
        card: {
          DEFAULT: '#fdfcf8',
          foreground: '#3a2a1a',
        },
        border: '#d8cebb',
        input: '#d8cebb',
        ring: '#2d5a27',
        'hay-gold': {
          DEFAULT: '#c4a035',
          foreground: '#3a2a1a',
        },
        'earth-brown': '#654321',
        wheat: '#d4b88a',
      },
    },
  },
  plugins: [],
} satisfies Config;
