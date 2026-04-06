import { registerCommand } from "../router"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

registerCommand({
  name: "import",
  description: "Import content from other platforms",
  async run(args) {
    const platform = args[0]
    const filePath = args[1]

    if (platform !== "wordpress") {
      console.log(`
  Usage: not-a-cms import <platform> <file>

  Platforms:
    wordpress <export.xml>    Import from WordPress WXR export
`)
      return
    }

    if (!filePath || !existsSync(filePath)) {
      console.error(`File not found: ${filePath}`)
      process.exit(1)
    }

    const configPath = join(process.cwd(), "not-a-cms.config.ts")
    if (!existsSync(configPath)) {
      console.error("No not-a-cms.config.ts found")
      process.exit(1)
    }

    try {
      const config = await import(configPath)
      const dbUrl = config.default?.database?.url ?? "data.db"

      const { createDatabase, bootstrapTables, createContentService, generateTable, parseWXR } = await import("@not-a-cms/core")
      const db = createDatabase({ url: dbUrl })
      const collections = config.default?.collections ?? []
      bootstrapTables(db, collections)

      const xml = readFileSync(filePath, "utf-8")
      const result = parseWXR(xml)

      console.log(`Found ${result.posts.length} item(s) in WordPress export`)

      const postCollection = collections.find((c: any) => c.name === "blog_post") ?? collections[0]
      const pageCollection = collections.find((c: any) => c.name === "page")

      if (!postCollection) {
        console.error("No collections defined")
        process.exit(1)
      }

      let imported = 0
      for (const post of result.posts) {
        const targetCollection = post.type === "page" && pageCollection ? pageCollection : postCollection
        const table = generateTable(targetCollection)
        const service = createContentService(db, targetCollection, table)

        await service.create({
          title: post.title,
          slug: post.slug,
          body: JSON.stringify(post.body),
          status: post.status,
        })
        imported++
        console.log(`  Imported: ${post.title} (${post.type})`)
      }

      console.log(`\nDone. Imported ${imported} item(s).`)
    } catch (err: any) {
      console.error("Import failed:", err.message)
      process.exit(1)
    }
  },
})
