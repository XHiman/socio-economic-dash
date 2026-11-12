import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  // The app is served under a sub-path next to other systems on the same host.
  base: '/Dashboard/Socio-Economic/',
  server: {
    // Same-origin in dev and prod: the browser only ever talks to <base>api, so no CORS is needed.
    proxy: {
      '/Dashboard/Socio-Economic/api': {
        target: 'http://127.0.0.1:3001',
        rewrite: (p) => p.replace('/Dashboard/Socio-Economic', ''),
      },
    },
  },
  build: {
    sourcemap: false,
    // Libraries change rarely: separate chunks stay cached across app releases and download in parallel.
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'charts', test: /node_modules[\\/](chart\.js|react-chartjs-2|@kurkle)/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
})
