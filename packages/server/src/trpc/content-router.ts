import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { protectedProcedure, publicProcedure, router } from "./context"
import { QueryError, ValidationError, WorkflowError, canAccessCollection, filterWritableFields, populateDocuments, projectDocumentFields } from "@not-a-cms/core"
import type { CollectionDef } from "@not-a-cms/core"
import type { createContentService } from "@not-a-cms/core"

export type CollectionEntry = {
  def: CollectionDef
  table: any
  service: ReturnType<typeof createContentService>
}

function getEntry(collections: Map<string, CollectionEntry>, name: string) {
  const entry = collections.get(name)
  if (!entry) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Collection "${name}" not found`,
    })
  }
  return entry
}

function requireCollectionAccess(entry: CollectionEntry, role: string, action: "read" | "create" | "update" | "delete") {
  if (!canAccessCollection(entry.def, role, action)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Forbidden",
    })
  }
}

function mapValidationError(err: unknown): never {
  if (err instanceof ValidationError) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: err.message,
      cause: err,
    })
  }
  if (err instanceof QueryError) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: err.message,
      cause: err,
    })
  }
  if (err instanceof WorkflowError) {
    throw new TRPCError({
      code: err.statusCode === 403 ? "FORBIDDEN" : "BAD_REQUEST",
      message: err.message,
      cause: err,
    })
  }
  throw err
}

export function createContentRouter(collections: Map<string, CollectionEntry>) {
  return router({
    create: protectedProcedure
      .input(z.object({ collection: z.string(), data: z.record(z.unknown()) }))
      .mutation(async ({ input, ctx }) => {
        const entry = getEntry(collections, input.collection)
        const role = ctx.session.role
        requireCollectionAccess(entry, role, "create")
        try {
          const doc = await entry.service.create(filterWritableFields(input.data, entry.def.fields, role))
          return projectDocumentFields(doc, entry.def.fields, role)
        } catch (err) {
          mapValidationError(err)
        }
      }),

    findById: publicProcedure
      .input(z.object({ collection: z.string(), id: z.string(), populate: z.array(z.string()).optional() }))
      .query(async ({ input, ctx }) => {
        const entry = getEntry(collections, input.collection)
        const role = ctx.session?.role ?? "viewer"
        requireCollectionAccess(entry, role, "read")
        try {
          const doc = await entry.service.findById(input.id)
          if (!doc) return null
          const [populated] = await populateDocuments([doc], entry.def, {
            populate: input.populate ?? [],
            role,
            collections,
          })
          return projectDocumentFields(populated, entry.def.fields, role)
        } catch (err) {
          mapValidationError(err)
        }
      }),

    findMany: publicProcedure
      .input(
        z.object({
          collection: z.string(),
          limit: z.number().optional(),
          offset: z.number().optional(),
          where: z.record(z.unknown()).optional(),
          sort: z.string().optional(),
          order: z.enum(["asc", "desc"]).optional(),
          withMeta: z.boolean().optional(),
          populate: z.array(z.string()).optional(),
        }),
      )
      .query(async ({ input, ctx }) => {
        const entry = getEntry(collections, input.collection)
        const role = ctx.session?.role ?? "viewer"
        requireCollectionAccess(entry, role, "read")
        try {
          const query = { limit: input.limit, offset: input.offset, where: input.where, sort: input.sort, order: input.order }
          const docs = await entry.service.findMany(query)
          const populated = await populateDocuments(docs, entry.def, {
            populate: input.populate ?? [],
            role,
            collections,
          })
          const data = populated.map((doc) => projectDocumentFields(doc, entry.def.fields, role))
          if (input.withMeta) {
            const total = await entry.service.count({ where: input.where })
            return { data, total, limit: input.limit ?? null, offset: input.offset ?? 0 }
          }
          return data
        } catch (err) {
          mapValidationError(err)
        }
      }),

    update: protectedProcedure
      .input(z.object({ collection: z.string(), id: z.string(), data: z.record(z.unknown()) }))
      .mutation(async ({ input, ctx }) => {
        const entry = getEntry(collections, input.collection)
        const role = ctx.session.role
        requireCollectionAccess(entry, role, "update")
        try {
          const updated = await entry.service.update(input.id, filterWritableFields(input.data, entry.def.fields, role))
          return projectDocumentFields(updated, entry.def.fields, role)
        } catch (err) {
          mapValidationError(err)
        }
      }),

    remove: protectedProcedure
      .input(z.object({ collection: z.string(), id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const entry = getEntry(collections, input.collection)
        requireCollectionAccess(entry, ctx.session.role, "delete")
        return entry.service.remove(input.id)
      }),
  })
}
