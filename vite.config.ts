import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployed under https://bingual.app/runecast/ for preview.
// Change `base` to '/' if hosting at a domain root or wrapping in a native shell.
export default defineConfig({
  base: '/runecast/',
  plugins: [react()],
  server: { host: true, port: 5199 },
})
