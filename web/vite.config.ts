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
  },
})
