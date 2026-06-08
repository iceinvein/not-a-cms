import { Database } from "bun:sqlite"
import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createWordPressDryRunSummary, importWordPressFile } from "../src/commands/import"

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe("import command helpers", () => {
  test("reports dry-run output without writing to the database", async () => {
    const project = makeProject()
    const result = await importWordPressFile({
      cwd: project.cwd,
      filePath: project.wxrPath,
      dryRun: true,
    })

    expect(result.dryRun).toBe(true)
    expect(result.imported).toBe(0)
    expect(result.planned).toBe(3)
    expect(createWordPressDryRunSummary(result)).toContain("Would import 3 item(s)")
    expect(existsSync(project.dbPath)).toBe(false)
  })

  test("imports WordPress posts, pages, and media into configured collections", async () => {
    const project = makeProject()
    const result = await importWordPressFile({
      cwd: project.cwd,
      filePath: project.wxrPath,
      dryRun: false,
    })

    expect(result.imported).toBe(3)

    const db = new Database(project.dbPath)
    const posts = db.query("SELECT title, slug, status FROM blog_post").all() as Array<
      Record<string, string>
    >
    const pages = db.query("SELECT title, slug FROM page").all() as Array<Record<string, string>>
    const media = db.query("SELECT title, url, mime_type FROM media").all() as Array<
      Record<string, string>
    >

    expect(posts).toEqual([{ title: "Hello", slug: "hello", status: "published" }])
    expect(pages).toEqual([{ title: "About", slug: "about" }])
    expect(media).toEqual([
      { title: "Hero", url: "https://example.com/hero.jpg", mime_type: "image/jpeg" },
    ])
  })
})

function makeProject() {
  const cwd = mkdtempSync(join(tmpdir(), "not-a-cms-import-"))
  tempDirs.push(cwd)
  const dbPath = join(cwd, "site.db")
  const wxrPath = join(cwd, "export.xml")
  writeFileSync(
    join(cwd, "not-a-cms.config.ts"),
    `import { defineCollection, defineConfig, field } from "${import.meta.dir}/../../core/src/index.ts"

const blogPost = defineCollection({
  name: "blog_post",
  fields: {
    title: field.text(),
    slug: field.slug({ from: "title" }),
    body: field.richText(),
    status: field.select(["draft", "published"], { default: "draft" }),
  },
})
const page = defineCollection({
  name: "page",
  fields: {
    title: field.text(),
    slug: field.slug({ from: "title" }),
    body: field.richText(),
    status: field.select(["draft", "published"], { default: "draft" }),
  },
})
const media = defineCollection({
  name: "media",
  fields: {
    title: field.text(),
    slug: field.slug({ from: "title" }),
    url: field.text(),
    mimeType: field.text(),
  },
})

export default defineConfig({
  database: { provider: "sqlite", url: "${dbPath}" },
  collections: [blogPost, page, media],
})
`,
  )
  writeFileSync(
    wxrPath,
    `<?xml version="1.0"?>
    <rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
      <channel>
        <item><title>Hello</title><wp:post_name>hello</wp:post_name><wp:post_type>post</wp:post_type><wp:status>publish</wp:status><content:encoded><![CDATA[<p>Hello</p>]]></content:encoded></item>
        <item><title>About</title><wp:post_name>about</wp:post_name><wp:post_type>page</wp:post_type><wp:status>publish</wp:status><content:encoded><![CDATA[<p>About</p>]]></content:encoded></item>
        <item><title>Hero</title><wp:post_name>hero</wp:post_name><wp:post_type>attachment</wp:post_type><wp:attachment_url>https://example.com/hero.jpg</wp:attachment_url><wp:post_mime_type>image/jpeg</wp:post_mime_type></item>
      </channel>
    </rss>`,
  )
  return { cwd, dbPath, wxrPath }
}
