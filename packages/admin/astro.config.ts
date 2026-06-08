import node from "@astrojs/node"
import react from "@astrojs/react"
import tailwind from "@astrojs/tailwind"
import { defineConfig } from "astro/config"

export default defineConfig({
  integrations: [react(), tailwind()],
  output: "server",
  adapter: node({ mode: "standalone" }),
  server: { port: 4322 },
  vite: {
    resolve: {
      dedupe: ["react", "react-dom", "react/jsx-runtime"],
    },
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:4321",
          changeOrigin: true,
          configure: (proxy: any) => {
            proxy.on("error", () => {}) // Suppress ECONNREFUSED noise
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
      exclude: ["@not-a-cms/core"],
      include: ["@not-a-cms/editor"],
    },
    ssr: {
      external: ["@not-a-cms/core"],
      noExternal: ["@not-a-cms/editor"],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes("react-dom") ||
              id.includes("/react/") ||
              id.includes("react/jsx-runtime")
            ) {
              return "vendor-react"
            }
            if (id.includes("prosemirror-") || id.includes("@tiptap/pm")) {
              return "vendor-prosemirror"
            }
            if (id.includes("@tiptap/")) {
              return "vendor-tiptap"
            }
            if (id.includes("yjs") || id.includes("y-protocols")) {
              return "vendor-collab"
            }
            if (id.includes("@dnd-kit/")) {
              return "vendor-dnd"
            }
            if (id.includes("/packages/editor/") || id.includes("@not-a-cms/editor")) {
              return "not-a-cms-editor"
            }
          },
        },
      },
    },
  },
})
