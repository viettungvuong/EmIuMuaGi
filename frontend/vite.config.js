import { defineConfig, searchForWorkspaceRoot } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/",
  server: {
    // The UI text lives in ../locales, shared with the mobile app
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), "../locales"] },
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
        ws: true, // the link parser talks over a WebSocket
      },
    },
  },
});
