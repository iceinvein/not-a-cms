import { registerCommand } from "../router"
import { existsSync, readFileSync } from "node:fs"
import {
  bootstrapTables,
  createContentService,
  createDatabase,
  createWordPressImportPlan,
  generateTable,
  loadConfig,
  parseWXR,
} from "@not-a-cms/core"

type ImportWordPressOptions = {
  cwd: string
  filePath: string
  dryRun?: boolean
}

type ImportResult = {
  dryRun: boolean
  found: number
  planned: number
  imported: number
  counts: Record<string, number>
}

export async function importWordPressFile(options: ImportWordPressOptions): Promise<ImportResult> {
  if (!options.filePath || !existsSync(options.filePath)) {
    throw new Error(`File not found: ${options.filePath}`)
  }

  const config = await loadConfig({ cwd: options.cwd })
  const xml = readFileSync(options.filePath, "utf-8")
  const parsed = parseWXR(xml)
  const plan = createWordPressImportPlan(parsed, config.collections)
  const found = parsed.posts.length + parsed.pages.length + parsed.media.length + parsed.authors.length + parsed.tags.length + parsed.categories.length

  if (options.dryRun) {
    return {
      dryRun: true,
      found,
      planned: plan.entries.length,
      imported: 0,
      counts: plan.counts,
    }
  }

  const db = createDatabase({ url: config.database?.url ?? "data.db" })
  bootstrapTables(db, config.collections)

  const services = new Map(config.collections.map((collection) => [
    collection.name,
    createContentService(db, collection, generateTable(collection)),
  ]))

  let imported = 0
  for (const entry of plan.entries) {
    const service = services.get(entry.collection)
    if (!service) continue
    await service.create(entry.data)
    imported++
  }

  return {
    dryRun: false,
    found,
    planned: plan.entries.length,
    imported,
    counts: plan.counts,
  }
}

export function createWordPressDryRunSummary(result: ImportResult): string {
  return [
    `Found ${result.found} WordPress item(s)`,
    `${result.dryRun ? "Would import" : "Imported"} ${result.dryRun ? result.planned : result.imported} item(s)`,
    ...Object.entries(result.counts).map(([collection, count]) => `  ${collection}: ${count}`),
  ].join("\n")
}

registerCommand({
  name: "import",
  description: "Import content from other platforms",
  async run(args) {
    const platform = args[0]
    const filePath = args[1]
    const dryRun = args.includes("--dry-run")

    if (platform !== "wordpress") {
      console.log(`
  Usage: not-a-cms import <platform> <file> [--dry-run]

  Platforms:
    wordpress <export.xml>    Import from WordPress WXR export
`)
      return
    }

    try {
      const result = await importWordPressFile({
        cwd: process.cwd(),
        filePath,
        dryRun,
      })

      console.log(createWordPressDryRunSummary(result))
      if (!dryRun) console.log("\nDone.")
    } catch (err: any) {
      console.error("Import failed:", err.message)
      process.exit(1)
    }
  },
})
