import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import type { CollectionDef } from "../types"

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

export function generateTable(collection: CollectionDef) {
  const columns: Record<string, ReturnType<typeof text> | ReturnType<typeof integer>> = {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    created_at: text("created_at"),
    updated_at: text("updated_at"),
  }

  for (const [name, fieldDef] of Object.entries(collection.fields)) {
    const snakeName = camelToSnake(name)
    const notNull = fieldDef.required

    switch (fieldDef.type) {
      case "number":
      case "boolean": {
        const col = integer(snakeName)
        columns[snakeName] = notNull ? col.notNull() : col
        break
      }
      case "relation":
      case "media": {
        const colName = `${snakeName}_id`
        const col = text(colName)
        columns[colName] = notNull ? col.notNull() : col
        break
      }
      default: {
        const col = text(snakeName)
        columns[snakeName] = notNull ? col.notNull() : col
        break
      }
    }
  }

  return sqliteTable(collection.name, columns)
}
