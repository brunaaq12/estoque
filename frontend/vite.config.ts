import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5173,
    // Em dev, proxia /api e /auth para o Worker local (wrangler dev na 8787)
    proxy:
      mode === "development"
        ? {
            "/api": "http://localhost:8787",
            "/auth": "http://localhost:8787",
          }
        : undefined,
  },
  build: {
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query"],
          ui: ["lucide-react", "sonner"],
          xlsx: ["xlsx"],
        },
      },
    },
  },
}));
