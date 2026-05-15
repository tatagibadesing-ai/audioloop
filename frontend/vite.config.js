import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 4004,
    host: true,
  },
  build: {
    // Garante caminhos relativos — necessário para Capacitor (file://)
    outDir: 'dist',
  },
  base: './',
})
