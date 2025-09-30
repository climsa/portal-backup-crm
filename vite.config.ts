import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path' // Impor modul 'path' dari Node.js

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Atur alias '@' agar menunjuk ke folder 'src'
      "@": path.resolve(__dirname, "./src"),
      crypto: 'node:crypto',
    },
  },
  // If issues persist, we can tweak optimizer includes/excludes here.
})
