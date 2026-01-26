import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@assets": path.resolve(__dirname, "../attached_assets"), // 👈 MAPS @assets TO YOUR FOLDER
    },
  },
  server: {
    fs: {
      // 👈 PERMISSION TO SERVE FILES OUTSIDE 'client'
      allow: [
        // Search up for workspace root
        path.resolve(__dirname, '..'),
      ],
    },
  },
})