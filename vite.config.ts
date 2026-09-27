import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the static build works when hosted under any path
  // (e.g. as a shared Artifact).
  base: './',
  plugins: [react(), tailwindcss()],
})
