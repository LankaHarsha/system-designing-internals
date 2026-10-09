import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  // hashed bundles go to /bundle so vercel.json can cache them forever without
  // also freezing public/assets (manifest.json, models) under /assets
  build: { assetsDir: 'bundle' },
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
  },
})
