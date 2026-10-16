/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 900: '#0f1b2d', 800: '#16263d', 700: '#223552' },
        brand: { 50: '#eef6ff', 100: '#d9eaff', 500: '#2f7bf5', 600: '#1f64d8', 700: '#1a50ae' },
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
