import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { createContentService, createDatabase, generateTable, loadConfig } from "@not-a-cms/core"
import { registerCommand } from "../router"

type ExportContentOptions = {
  cwd: string
  outputPath?: string
}

export async function exportContentToJSON(options: ExportContentOptions) {
  const config = await loadConfig({ cwd: options.cwd })
  const db = createDatabase({ url: config.database?.url ?? "data.db" })
  const outputPath = options.outputPath ?? join(options.cwd, "content-export.json")

  const collections: Record<string, Record<string, unknown>[]> = {}
  const counts: Record<string, number> = {}

  for (const collection of config.collections) {
    const service = createContentService(db, collection, generateTable(collection))
    const documents = await service.findMany({ sort: "created_at", order: "asc" })
    collections[collection.name] = documents
    counts[collection.name] = documents.length
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    collections,
  }

  writeFileSync(outputPath, JSON.stringify(payload, null, 2) + "\n")

  return { outputPath, counts }
}

registerCommand({
  name: "export",
  description: "Export content",
  async run(args) {
    const format = args[0] ?? "json"
    const outputArg = args.find((arg) => arg.startsWith("--output="))
    const outputPath = outputArg?.split("=")[1]

    if (format !== "json") {
      console.log(`
  Usage: not-a-cms export json [--output=content-export.json]
`)
      return
    }

    try {
      const result = await exportContentToJSON({
        cwd: process.cwd(),
        outputPath: outputPath ? join(process.cwd(), outputPath) : undefined,
      })
      console.log(`Exported content to ${result.outputPath}`)
      for (const [collection, count] of Object.entries(result.counts)) {
        console.log(`  ${collection}: ${count}`)
      }
    } catch (err: any) {
      console.error("Export failed:", err.message)
      process.exit(1)
    }
  },
})
