import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Use '/' for development, change to '/SpeechEQ-Arena/' for production GitHub Pages
  // Update '/SpeechEQ-Arena/' to match your repository name
  base: mode === 'production' ? '/SpeechEQ-Arena/' : '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
}))

