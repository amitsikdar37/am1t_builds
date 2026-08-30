import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5180,
    // Needed so getUserMedia works when previewing from another device on the LAN
    // (localhost is already a secure context).
    host: true,
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    // transformers.js ships its own onnxruntime-web bundles; let Vite pre-bundle it
    // so the worker import resolves to a single copy.
    include: ['@huggingface/transformers'],
  },
  build: {
    target: 'esnext',
  },
});
