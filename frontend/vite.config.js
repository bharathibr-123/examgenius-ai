import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// `npm run dev` serves the UI on :5173 and forwards /api to Django on :8000.
// `npm run build` writes the production UI into backend/frontend_dist (served by Django).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
  build: { outDir: "../backend/frontend_dist", emptyOutDir: true, chunkSizeWarningLimit: 1500 },
});
