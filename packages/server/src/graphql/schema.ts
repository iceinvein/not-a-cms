import SchemaBuilder from "@pothos/core"
import type { CollectionDef, FieldDef } from "@not-a-cms/core"
import type { createContentService } from "@not-a-cms/core"

type CollectionEntry = {
  def: CollectionDef
  table: any
  service: ReturnType<typeof createContentService>
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function collectionToTypeName(name: string): string {
  return name.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("")
}

export function buildGraphQLSchema(collections: Map<string, CollectionEntry>) {
  const builder = new SchemaBuilder<{}>({})

  builder.queryType({
    fields: (t) => {
      const fields: Record<string, any> = {}

      for (const [name, entry] of collections) {
        const typeName = collectionToTypeName(name)
        const { def, service } = entry

        // Register object type
        const objectRef = builder.objectRef<Record<string, unknown>>(typeName)
        builder.objectType(objectRef, {
          fields: (t) => {
            const gqlFields: Record<string, any> = {
              id: t.string({ resolve: (obj) => String(obj.id ?? "") }),
              createdAt: t.string({ nullable: true, resolve: (obj) => obj.created_at as string | null }),
              updatedAt: t.string({ nullable: true, resolve: (obj) => obj.updated_at as string | null }),
            }

            for (const [fieldName, fieldDef] of Object.entries(def.fields)) {
              const snakeName = fieldName.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`)
              const resolverKey = fieldDef.type === "relation" || fieldDef.type === "media" ? `${snakeName}_id` : snakeName
              const camelName = snakeToCamel(fieldName)

              if (fieldDef.type === "number") {
                gqlFields[camelName] = t.int({ nullable: !fieldDef.required, resolve: (obj) => obj[resolverKey] as number | null })
              } else if (fieldDef.type === "boolean") {
                gqlFields[camelName] = t.boolean({ nullable: !fieldDef.required, resolve: (obj) => Boolean(obj[resolverKey]) })
              } else {
                gqlFields[camelName] = t.string({ nullable: !fieldDef.required, resolve: (obj) => obj[resolverKey] != null ? String(obj[resolverKey]) : null })
              }
            }

            return gqlFields
          },
        })

        // List query: blogPosts
        const listName = snakeToCamel(name) + "s"
        fields[listName] = t.field({
          type: [objectRef],
          args: {
            limit: t.arg.int({ required: false }),
            offset: t.arg.int({ required: false }),
            where: t.arg.string({ required: false }),
          },
          resolve: async (_root, args) => {
            const opts: { limit?: number; offset?: number; where?: Record<string, unknown> } = {}
            if (args.limit) opts.limit = args.limit
            if (args.offset) opts.offset = args.offset
            if (args.where) {
              try { opts.where = JSON.parse(args.where) } catch {}
            }
            return service.findMany(opts)
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
          resolve: async (_root, args) => service.findById(args.id),
        })
      }

      return fields
    },
  })

  return builder.toSchema()
}
