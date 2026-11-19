/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1e2924',
        forest: '#1c5b45',
        moss: '#76947b',
        canvas: '#f6f5f0',
        line: '#e8e7df',
        tangerine: '#d88759',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Georgia', 'ui-serif', 'serif'],
      },
      boxShadow: {
        card: '0 2px 14px rgba(37, 46, 39, 0.045)',
      },
    },
  },
  plugins: [],
}
