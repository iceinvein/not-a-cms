import { router } from "./context"
import { createContentRouter, type CollectionEntry } from "./content-router"

export function appRouter(collections: Map<string, CollectionEntry>) {
  return router({
    content: createContentRouter(collections),
  })
}

export type AppRouter = ReturnType<typeof appRouter>
