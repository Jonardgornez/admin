import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const apiProxy = {
  '/api': {
    target: 'http://localhost:5000',
    changeOrigin: false,
    ws: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
