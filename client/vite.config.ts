// vite.config.ts (minimal & safe)
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // 개발 중엔 /api만 백엔드로 프록시
      "/api": { target: "http://localhost:5000", changeOrigin: true },
    },
  },
  build: {
    sourcemap: true,   // 배포 디버깅 편의
    outDir: "dist",
  },
});
