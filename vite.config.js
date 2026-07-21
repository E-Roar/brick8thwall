import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    basicSsl(),
    viteStaticCopy({
      targets: [
        {
          src: 'image-targets/mural.json',
          dest: 'image-targets',
        },
        {
          src: 'image-targets/mural_luminance.png',
          dest: 'image-targets',
        },
      ],
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'assets/*', 'image-targets/*'],
      manifest: {
        name: 'Retro AR Tetris',
        short_name: 'RetroAR',
        description: 'AR Tetris built with 8th Wall and Three.js',
        theme_color: '#8ba870',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,glb,wasm}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB to accommodate WASM engines and GLB
      }
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
