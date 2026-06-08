import { type CollectionEntry, createContentRouter } from "./content-router"
import { router } from "./context"

export function appRouter(collections: Map<string, CollectionEntry>) {
  return router({
    content: createContentRouter(collections),
  })
}

export type AppRouter = ReturnType<typeof appRouter>
