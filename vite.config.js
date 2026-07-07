import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],

  base: "/",

  server: {
    proxy: {
      '/github-token-exchange': {
        target: 'https://github.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/github-token-exchange/, '/login/oauth/access_token'),
        headers: {
          Accept: 'application/json',
        },
      },
    },
  },
}));
