import SchemaBuilder from "@pothos/core"
import { canAccessCollection, canReadField, projectDocumentFields } from "@not-a-cms/core"
import type { CollectionDef, FieldDef } from "@not-a-cms/core"
import type { createContentService } from "@not-a-cms/core"
import { GraphQLError, GraphQLScalarType, Kind, type ValueNode } from "graphql"

type CollectionEntry = {
  def: CollectionDef
  table: any
  service: ReturnType<typeof createContentService>
}

export type GraphQLContext = {
  role: string
}

type ContentListResult = {
  data: Record<string, unknown>[]
  total: number
  limit: number | null
  offset: number
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function collectionToTypeName(name: string): string {
  return name.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("")
}

export function buildGraphQLSchema(collections: Map<string, CollectionEntry>) {
  const builder = new SchemaBuilder<{
    Context: GraphQLContext
    Scalars: {
      JSON: {
        Input: unknown
        Output: unknown
      }
    }
  }>({})
  type ContentObjectRef = ReturnType<typeof builder.objectRef<Record<string, unknown>>>
  type ContentListRef = ReturnType<typeof builder.objectRef<ContentListResult>>
  const objectRefs = new Map<string, ContentObjectRef>()
  const listRefs = new Map<string, ContentListRef>()

  builder.addScalarType("JSON", jsonScalar)

  for (const [name] of collections) {
    objectRefs.set(name, builder.objectRef<Record<string, unknown>>(collectionToTypeName(name)))
    listRefs.set(name, builder.objectRef<ContentListResult>(`${collectionToTypeName(name)}List`))
  }

  for (const [name, entry] of collections) {
    const objectRef = objectRefs.get(name)!
    const { def } = entry

    builder.objectType(objectRef, {
      fields: (t) => {
        const gqlFields: Record<string, any> = {
          id: t.string({ resolve: (obj) => String(obj.id ?? "") }),
          createdAt: t.string({ nullable: true, resolve: (obj) => obj.created_at as string | null }),
          updatedAt: t.string({ nullable: true, resolve: (obj) => obj.updated_at as string | null }),
        }

        for (const [fieldName, fieldDef] of Object.entries(def.fields)) {
          const camelName = snakeToCamel(fieldName)
          const nullable = !fieldDef.required || fieldDef.access?.read !== undefined

          if (fieldDef.type === "number") {
            gqlFields[camelName] = t.int({
              nullable,
              resolve: (obj, _args, ctx) => canReadField(fieldDef, ctx.role) ? obj[fieldName] as number | null : null,
            })
          } else if (fieldDef.type === "boolean") {
            gqlFields[camelName] = t.boolean({
              nullable,
              resolve: (obj, _args, ctx) => canReadField(fieldDef, ctx.role) && obj[fieldName] != null ? Boolean(obj[fieldName]) : null,
            })
          } else if (isJsonField(fieldDef)) {
            gqlFields[camelName] = t.field({
              type: "JSON",
              nullable,
              resolve: (obj, _args, ctx) => {
                if (!canReadField(fieldDef, ctx.role)) return null
                return projectStructuredValue(obj[fieldName], fieldDef, ctx.role)
              },
            })
          } else {
            gqlFields[camelName] = t.string({
              nullable,
              resolve: (obj, _args, ctx) => {
                if (!canReadField(fieldDef, ctx.role) || obj[fieldName] == null) return null
                const value = obj[fieldName]
                return typeof value === "string" ? value : JSON.stringify(value)
              },
            })
          }

          if (fieldDef.type === "relation" || fieldDef.type === "media") {
            const targetName = fieldDef.type === "relation" ? fieldDef.target : "media"
            const targetEntry = collections.get(targetName)
            const targetRef = objectRefs.get(targetName)
            if (targetEntry && targetRef) {
              gqlFields[`${camelName}Document`] = t.field({
                type: targetRef,
                nullable: true,
                resolve: async (obj, _args, ctx) => {
                  if (!canReadField(fieldDef, ctx.role)) return null
                  if (!canAccessCollection(targetEntry.def, ctx.role, "read")) return null
                  const id = idFromValue(obj[fieldName])
                  if (!id) return null
                  const related = await targetEntry.service.findById(id)
                  return related ? projectDocumentFields(related, targetEntry.def.fields, ctx.role) : null
                },
              })
            }
          }
        }

        return gqlFields
      },
    })
  }

  for (const [name] of collections) {
    const listRef = listRefs.get(name)!
    const objectRef = objectRefs.get(name)!

    builder.objectType(listRef, {
      fields: (t) => ({
        data: t.field({
          type: [objectRef],
          resolve: (obj) => obj.data,
        }),
        total: t.int({ resolve: (obj) => obj.total }),
        limit: t.int({ nullable: true, resolve: (obj) => obj.limit }),
        offset: t.int({ resolve: (obj) => obj.offset }),
      }),
    })
  }

  builder.queryType({
    fields: (t) => {
      const fields: Record<string, any> = {}

      for (const [name, entry] of collections) {
        const { def, service } = entry
        const objectRef = objectRefs.get(name)!
        const listRef = listRefs.get(name)!

        // List query: blogPosts
        const listName = snakeToCamel(name) + "s"
        fields[listName] = t.field({
          type: [objectRef],
          args: {
            limit: t.arg.int({ required: false }),
            offset: t.arg.int({ required: false }),
            where: t.arg.string({ required: false }),
          },
          resolve: async (_root, args, ctx) => {
            if (!canAccessCollection(def, ctx.role, "read")) return []
            const opts: { limit?: number; offset?: number; where?: Record<string, unknown> } = {}
            if (args.limit !== undefined && args.limit !== null) opts.limit = args.limit
            if (args.offset !== undefined && args.offset !== null) opts.offset = args.offset
            opts.where = parseWhereArgument(args.where)
            return service.findMany(opts)
          },
        })

        // List metadata query: blogPostsList
        fields[`${listName}List`] = t.field({
          type: listRef,
          args: {
            limit: t.arg.int({ required: false }),
            offset: t.arg.int({ required: false }),
            where: t.arg.string({ required: false }),
          },
          resolve: async (_root, args, ctx) => {
            const limit = args.limit ?? null
            const offset = args.offset ?? 0
            if (!canAccessCollection(def, ctx.role, "read")) {
              return { data: [], total: 0, limit, offset }
            }

            const where = parseWhereArgument(args.where)
            const opts: { limit?: number; offset?: number; where?: Record<string, unknown> } = {}
            if (limit !== null) opts.limit = limit
            opts.offset = offset
            opts.where = where

            const [data, total] = await Promise.all([
              service.findMany(opts),
              service.count({ where }),
            ])

            return { data, total, limit, offset }
          },
        })

        // Single query: blogPost
        const singleName = snakeToCamel(name)
        fields[singleName] = t.field({
          type: objectRef,
          nullable: true,
          args: {
            id: t.arg.string({ required: true }),
          },
          resolve: async (_root, args, ctx) => {
            if (!canAccessCollection(def, ctx.role, "read")) return null
            return service.findById(args.id)
          },
        })
      }

      return fields
    },
  })

  return builder.toSchema()
}

function idFromValue(value: unknown): string | null {
  if (!value) return null
  if (typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string") {
    return (value as { id: string }).id
  }
  return String(value)
}

const jsonScalar = new GraphQLScalarType({
  name: "JSON",
  description: "Arbitrary JSON value",
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: parseJsonLiteral,
})

function parseJsonLiteral(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value)
    case Kind.NULL:
      return null
    case Kind.LIST:
      return ast.values.map(parseJsonLiteral)
    case Kind.OBJECT: {
      const value: Record<string, unknown> = {}
      for (const field of ast.fields) {
        value[field.name.value] = parseJsonLiteral(field.value)
      }
      return value
    }
    default:
      return undefined
  }
}

function parseWhereArgument(where: string | null | undefined): Record<string, unknown> | undefined {
  if (!where) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(where)
  } catch {
    throw new GraphQLError("Invalid where JSON")
  }
  if (!isPlainRecord(parsed)) {
    throw new GraphQLError("Invalid where JSON: expected an object")
  }
  return parsed
}

function isJsonField(fieldDef: FieldDef): boolean {
  return fieldDef.type === "richText" || fieldDef.type === "array" || fieldDef.type === "group" || fieldDef.type === "pageLayout"
}

function projectStructuredValue(value: unknown, fieldDef: FieldDef, role: string): unknown {
  if (value == null) return null

  if (fieldDef.type === "group") {
    if (!isPlainRecord(value)) return value
    return projectDocumentFields(value, fieldDef.fields, role)
  }

  if (fieldDef.type === "array" && Array.isArray(value)) {
    return value.map((item) => projectStructuredValue(item, fieldDef.items, role))
  }

  return value
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
