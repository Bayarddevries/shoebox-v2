import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { adminApi } from './server/admin-api'

export default defineConfig({
  plugins: [react(), tailwindcss(), adminApi()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'shoebox',
    assetsDir: 'assets',
    sourcemap: false,
  },
  base: '/shoebox-v2/',
})
