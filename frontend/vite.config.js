import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // 👇 DESKTOP PRODUCTION: Optimize for smaller bundle and better performance
    minify: 'terser',
    sourcemap: false,  // Disable source maps in production
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "axios": ["axios"],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    // 👇 DEV: Proxy API to Django for easier development
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
