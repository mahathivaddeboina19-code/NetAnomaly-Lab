import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite configuration: React plugin + dev server bound to all interfaces
// so the Freebuff cloud preview can reach it.
export default defineConfig({
  plugins: [react()],
  // Relative asset URLs so the production build can be deployed to any static
  // host (root domain or sub-path). Combined with the app's hash router, no
  // server rewrite rules are required.
  base: './',
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
})
