import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
    server: {
      watch: {
        ignored: ['**/_archive/**', '**/node_modules/**'],
      },
      proxy: {
        '/api/catbox': {
          target: 'https://catbox.moe',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/catbox/, '/user/api.php')
        },
        '/api/lowtrack-proxy': {
          target: 'https://lowtrack.com.br',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/lowtrack-proxy/, '/sales')
        },
        '/api/kwikpay-proxy': {
          target: 'https://mpesaemolatech.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/kwikpay-proxy/, '')
        },
        '/api/payment-proxy': {
          target: 'https://mpesaemolatech.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/payment-proxy/, '')
        }
      }
    },
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-charts': ['recharts'],
            'vendor-motion': ['framer-motion'],
          }
        }
      }
    },
    plugins: [

      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['logo.png', 'vite.svg'],
        manifest: {
          name: 'VELORA',
          short_name: 'VELORA',
          description: 'Plataforma de Pagamentos VELORA',
          theme_color: '#0d0d17',
          background_color: '#0d0d17',
          display: 'standalone',
          icons: [
            {
              src: '/logo.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/logo.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
});
