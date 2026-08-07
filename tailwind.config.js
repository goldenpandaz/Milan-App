/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        plata: {
          50: '#FAFAFB',
          100: '#F1F2F4',
          200: '#E2E4E8',
          300: '#C9CCD3',
          400: '#AEB2BB',
          500: '#8E939D',
          600: '#6E7480',
          700: '#565C67',
          800: '#3D424B',
          900: '#252831',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

