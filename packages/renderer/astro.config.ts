import node from "@astrojs/node"
import tailwind from "@astrojs/tailwind"
import { defineConfig } from "astro/config"

export default defineConfig({
  integrations: [tailwind()],
  output: "server",
  adapter: node({ mode: "standalone" }),
})
