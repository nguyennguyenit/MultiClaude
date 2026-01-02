/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#1e1e1e',
          fg: '#d4d4d4',
          cursor: '#aeafad',
          selection: '#264f78'
        }
      }
    },
  },
  plugins: [],
}
