import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import sitemap from 'vite-plugin-sitemap'

export default defineConfig({
  plugins: [
    react(),
    sitemap({
      hostname: 'https://aura50.io',
      routes: ['/', '/privacy', '/terms', '/cookies'],
      lastmod: new Date().toISOString().split('T')[0],
      priority: {
        '/':        1.0,
        '/privacy': 0.3,
        '/terms':   0.3,
        '/cookies': 0.3,
      },
      changefreq: {
        '/':        'weekly',
        '/privacy': 'monthly',
        '/terms':   'monthly',
        '/cookies': 'monthly',
      },
    }),
  ],
  server: {
    port: 3000,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-three':  ['three', '@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
})
