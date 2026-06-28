import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The client connects straight to the server URL (see src/socket/index.ts): VITE_SERVER_URL when set
// (e.g. the deployed Heroku server), otherwise http://localhost:3001 for local dev. No dev proxy is
// needed — the server's CORS allows the dev origin (http://localhost:5173).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
})
