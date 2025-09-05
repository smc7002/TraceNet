// vite.config.ts (minimal & safe)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // During development, proxy only /api to the backend
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
  build: {
    sourcemap: true, // Easier production debugging (consider disabling for release)
    outDir: 'dist',
  },
});
