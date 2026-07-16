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
          base: '#2C2C34',
          panel: '#2C2C34',
          hover: '#363640',
        },
        accent: {
          cool: '#00D4FF',
          warm: '#FF8C42',
        },
        positive: '#34d399',
        negative: '#f87171',
        text: '#E8E8EC',
        'text-secondary': '#9E9EA8',
      },
      fontFamily: {
        sans: ['Inter', 'PingFang SC', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
