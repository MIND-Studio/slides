import { defineConfig } from 'vite'

// Slidev loads this from the deck's userRoot (this `slidev/` dir). Vite 6 rejects
// requests whose Host header isn't allow-listed (DNS-rebinding protection). The
// render sidecar is served cross-origin in an <iframe> from the Next studio at
// slides-render.apps.mindpods.org, so the prod host must be allowed. A leading
// dot allows the whole mindpods.org fleet; localhost keeps `npm run slidev` working.
export default defineConfig({
  server: {
    allowedHosts: ['.mindpods.org', 'localhost'],
  },
})
