import { defineConfig } from 'vite';
import { resolve } from 'path';

// The viewer is the only thing that ships. Rooting the build at src/viewer puts
// index.html at dist/ root, which is what static hosts expect to serve.
export default defineConfig({
  root: 'src/viewer',
  base: './',
  publicDir: false,
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true },
    },
    chunkSizeWarningLimit: 700,
  },
  server: {
    port: 3000,
    host: true, // expose on the LAN so a real phone can be tested against it
  },
});
