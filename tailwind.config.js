/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1e40af',
        secondary: '#f59e0b',
        background: '#fafaf9',
        text: '#1f2937',
        accent: '#14b8a6',
      },
      fontFamily: {
        heading: ['Merriweather', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        bible: ['Crimson Text', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
