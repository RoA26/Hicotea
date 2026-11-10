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
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Modo offline: las lecturas de la api se sirven de caché si no hay red.
            // Nunca auth; la caché se borra al cerrar sesión (ver Globales.tsx).
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'hicotea-api',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    // En desarrollo /api va por proxy a uvicorn: así la cookie es del mismo origen.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
