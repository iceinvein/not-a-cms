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
        "/api": "http://localhost:4321",
        "/trpc": "http://localhost:4321",
        "/health": "http://localhost:4321",
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
