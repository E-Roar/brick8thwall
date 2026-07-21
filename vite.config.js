import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    basicSsl(),
    viteStaticCopy({
      targets: [
        {
          src: 'image-targets',
          dest: '.',
        },
      ],
    }),
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
