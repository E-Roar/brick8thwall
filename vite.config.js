import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    basicSsl(),
  ],
  optimizeDeps: {
    rolldownOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  server: {
    https: true,
    host: true,
    strictPort: true,
    port: 3000,
  },
  build: {
    outDir: "./dist",
    emptyOutDir: true,
  },
})
