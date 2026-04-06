import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { publicProcedure, router } from "./context"
import type { CollectionDef } from "@not-a-cms/core"
import type { createContentService } from "@not-a-cms/core"

export type CollectionEntry = {
  def: CollectionDef
  table: any
  service: ReturnType<typeof createContentService>
}

function getService(collections: Map<string, CollectionEntry>, name: string) {
  const entry = collections.get(name)
  if (!entry) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Collection "${name}" not found`,
    })
  }
  return entry.service
}

export function createContentRouter(collections: Map<string, CollectionEntry>) {
  return router({
    create: publicProcedure
      .input(z.object({ collection: z.string(), data: z.record(z.unknown()) }))
      .mutation(async ({ input }) => {
        const service = getService(collections, input.collection)
        return service.create(input.data)
      }),

    findById: publicProcedure
      .input(z.object({ collection: z.string(), id: z.string() }))
      .query(async ({ input }) => {
        const service = getService(collections, input.collection)
        return service.findById(input.id)
      }),

    findMany: publicProcedure
      .input(
        z.object({
          collection: z.string(),
          limit: z.number().optional(),
          offset: z.number().optional(),
          where: z.record(z.unknown()).optional(),
        }),
      )
      .query(async ({ input }) => {
        const service = getService(collections, input.collection)
        return service.findMany({ limit: input.limit, offset: input.offset, where: input.where })
      }),

    update: publicProcedure
      .input(z.object({ collection: z.string(), id: z.string(), data: z.record(z.unknown()) }))
      .mutation(async ({ input }) => {
        const service = getService(collections, input.collection)
        return service.update(input.id, input.data)
      }),

    remove: publicProcedure
      .input(z.object({ collection: z.string(), id: z.string() }))
      .mutation(async ({ input }) => {
        const service = getService(collections, input.collection)
        return service.remove(input.id)
      }),
  })
}
