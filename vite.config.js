import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import viteCompression from 'vite-plugin-compression2'

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    basicSsl(),
    viteCompression({ deleteOriginalAssets: true, algorithms: ['gzip'] }),
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
