import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  server: {
    host: '127.0.0.1',
    port: parseInt(process.env.VITE_PORT || '5173', 10),
    watch: {
      usePolling: true,
      interval: 100,
    },
    // Proxy API and WebSocket traffic to the backend during local development so
    // the client can remain same-origin (ws://localhost:5173/ws) and Vite will
    // forward requests to the server (default backend port: 8000).
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || process.env.VITE_API_PROXY || 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: process.env.VITE_API_URL || process.env.VITE_API_PROXY || 'http://localhost:8000',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
