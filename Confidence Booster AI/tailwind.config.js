/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          green: '#00ff66',
          cyan: '#00f0ff',
          pink: '#ff0055',
          amber: '#ffb703',
          dark: '#0a0d12',
          panel: 'rgba(10, 15, 20, 0.75)',
        }
      },
      fontFamily: {
        mono: ['"Share Tech Mono"', 'monospace', 'Courier New'],
        cyber: ['Orbitron', 'sans-serif'],
        impact: ['"Bebas Neue"', 'Impact', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 0.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scanline': 'scanline 6s linear infinite',
        'glitch': 'glitch 0.3s ease infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(1000%)' },
        }
      }
    },
  },
  plugins: [],
}
