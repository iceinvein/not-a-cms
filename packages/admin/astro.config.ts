import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import tailwind from "@astrojs/tailwind"

export default defineConfig({
  integrations: [react(), tailwind()],
  output: "server",
  server: { port: 4322 },
  vite: {
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:4321",
          changeOrigin: true,
          configure: (proxy: any) => {
            proxy.on("error", () => {})  // Suppress ECONNREFUSED noise
          },
        },
        "/trpc": {
          target: "http://localhost:4321",
          changeOrigin: true,
          configure: (proxy: any) => {
            proxy.on("error", () => {})
          },
        },
        "/health": {
          target: "http://localhost:4321",
          changeOrigin: true,
          configure: (proxy: any) => {
            proxy.on("error", () => {})
          },
        },
      },
    },
    optimizeDeps: {
      exclude: ["@not-a-cms/core", "@not-a-cms/editor"],
    },
    ssr: {
      external: ["@not-a-cms/core"],
      noExternal: ["@not-a-cms/editor"],
    },
  },
})
