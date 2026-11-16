/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cinema: {
          950: '#090A0F',
          900: '#10121A',
          850: '#161924',
          800: '#1F2332',
          700: '#2E344A',
          accent: '#6366F1', // Indigo accent
          amber: '#F59E0B',  // Focus ring / warning
        },
      },
    },
  },
  plugins: [],
};
