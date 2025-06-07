import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: true,
    port: 5175
  },
  build: {
    outDir: 'dist'  // 🔑 ito ang kailangan mo para alam ng Vite saan ilalagay ang build files
  }
})
