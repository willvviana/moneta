import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // fail instead of silently moving to 5174: the backend's Origin check expects :5173
    proxy: {
      // The browser only talks to :5173 (same site). Vite forwards /api/* to Express,
      // so the session cookie is first-party and no CORS setup is needed in development.
      "/api": "http://localhost:3000",
    },
  },
});
