import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Hicotea',
        short_name: 'Hicotea',
        description: 'Tus ingresos, gastos y cajitas de ahorro, en orden.',
        lang: 'es',
        start_url: '/inicio',
        display: 'standalone',
        background_color: '#07100C',
        theme_color: '#07100C',
        // Generados con `pnpm iconos` desde los SVG oficiales de Identidad/ (ver scripts/iconos.mjs).
        icons: [
          { src: '/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        // Toda respuesta API, incluso autenticada, permanece fuera de Cache Storage.
        importScripts: ['/sw-privacy.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /^\/api(?:\/|$)/.test(url.pathname),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    // En desarrollo /api va por proxy a uvicorn: así la cookie es del mismo origen.
    // HICOTEA_API_URL permite apuntar a otra instancia (p. ej. una de pruebas en otro puerto).
    proxy: {
      '/api': process.env.HICOTEA_API_URL ?? 'http://localhost:8000',
    },
  },
})
