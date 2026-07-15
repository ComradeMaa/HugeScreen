/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/*/src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          base: '#0a0e1a',
          panel: '#161b2a',
          hover: '#1e2440',
        },
        accent: {
          cool: '#7eb8da',
          warm: '#c9a96e',
        },
        positive: '#34d399',
        negative: '#f87171',
      },
      fontFamily: {
        sans: ['Inter', 'PingFang SC', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
