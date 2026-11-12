// import tailwindcss from '@tailwindcss/vite'
// import react from '@vitejs/plugin-react'
// import { defineConfig } from 'vitest/config'

// const apiProxy = {
//   '/api': {
//     target: 'http://localhost:5000',
//     changeOrigin: false,
//     ws: true,
//   },
// }

// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [react(), tailwindcss()],
//   server: { proxy: apiProxy },
//   preview: { proxy: apiProxy },
//   test: {
//     // Node is the default environment. Rendered tests opt into jsdom with a per-file docblock.
//     include: ['src/**/*.test.{ts,tsx}'],
//     setupFiles: ['src/test/setup.ts'],
//   },
// })



import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const apiProxy = {
  '/api': {
    target: 'http://server:5000',
    changeOrigin: false,
    ws: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    host: '0.0.0.0',
    proxy: apiProxy,
  },

  preview: {
    proxy: apiProxy,
  },

  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
})
