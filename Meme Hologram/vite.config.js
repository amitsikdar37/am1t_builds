import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    // Deliberately off the default 5173: that port is commonly already taken
    // by another dev server, and a collision there silently serves the wrong
    // app instead of failing. strictPort makes any future clash loud.
    port: 5310,
    strictPort: true,
    host: 'localhost',
  },
  build: {
    target: 'es2020',
  },
})
