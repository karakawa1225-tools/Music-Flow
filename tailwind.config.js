/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        mf: {
          bg: '#0D0D12',
          surface: '#16161E',
          elevated: '#1C1C28',
          border: '#2A2A3A',
          muted: '#8B8B9E',
          text: '#F2F2F7',
          accent: '#7C4DFF',
          'accent-hover': '#8E66FF',
          'accent-soft': 'rgba(124, 77, 255, 0.18)',
          danger: '#FF5C7A'
        }
      },
      fontFamily: {
        sans: ['"Manrope"', 'system-ui', 'sans-serif'],
        display: ['"Outfit"', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.35)',
        soft: '0 4px 24px rgba(0, 0, 0, 0.25)'
      },
      borderRadius: {
        mf: '12px'
      }
    }
  },
  plugins: []
}
