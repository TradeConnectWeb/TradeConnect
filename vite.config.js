import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 5175,
    proxy: {
      // 🔁 Ito ang importante para gumana ang fetch('/firebase-config')
      '/firebase-config': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist'
  }
});
