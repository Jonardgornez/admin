import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// The server only accepts admin requests over loopback with a localhost Host header,
// so the proxy keeps the browser's Host. In Docker the dev server shares the server
// container's network, so localhost reaches it there too.
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
  server: {
    proxy: apiProxy,
    // File events from a Windows bind mount don't reach the container, so Docker turns on polling.
    watch: { usePolling: process.env.VITE_WATCH_POLLING === 'true' },
  },
  preview: { proxy: apiProxy },
  test: {
    // Node is the default environment. Rendered tests opt into jsdom with a per-file docblock.
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
})
