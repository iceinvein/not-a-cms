import type { E2EContext } from "./agent-browser-e2e"

type MediaRecord = {
  id: string
  filename: string
  url: string
}

type ContentRecord = {
  id: string
  title: string
  slug: string
}

type PreviewToken = {
  token: string
}

const png1x1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="

export async function runMediaPreviewSmoke(ctx: E2EContext) {
  const stamp = Date.now()
  const filename = `e2e-hero-${stamp}.png`
  const title = `Agent Preview E2E ${stamp}`

  const mediaForm = new FormData()
  mediaForm.append("file", new Blob([Buffer.from(png1x1, "base64")], { type: "image/png" }), filename)
  mediaForm.append("alt", "E2E preview image")
  mediaForm.append("title", "E2E hero")

  const media = await ctx.apiJson<MediaRecord>("/api/media/upload", {
    method: "POST",
    body: mediaForm,
  })

  await ctx.agent(["open", `${ctx.adminBase}/media`])
  await ctx.agent(["wait", "--load", "networkidle"], { allowFailure: true })
  await ctx.screenshot("05-media-library.png")
  await ctx.assertPageContains("media library", ["Media Library", "1 files", "E2E hero"])

  const draft = await ctx.apiJson<ContentRecord>("/api/blog_post", {
    method: "POST",
    body: JSON.stringify({
      title,
      slug: `agent-preview-e2e-${stamp}`,
      excerpt: "Preview smoke excerpt",
      body: [{ type: "paragraph", children: [{ type: "text", value: "Preview content is visible before publish." }] }],
      coverImage: media.id,
      status: "draft",
    }),
  })

  const preview = await ctx.apiJson<PreviewToken>("/api/_preview/generate", {
    method: "POST",
    body: JSON.stringify({
      collection: "blog_post",
      documentId: draft.id,
      regenerate: true,
    }),
  })

  await ctx.agent(["open", `${ctx.siteBase}/preview/${preview.token}?collection=blog_post&documentId=${draft.id}`])
  await ctx.agent(["wait", "--load", "networkidle"], { allowFailure: true })
  await ctx.screenshot("06-preview-render.png")
  await ctx.assertPageContains("draft preview", [title, "This is a preview", "Preview content is visible before publish."])

  return {
    name: "Media upload and preview smoke",
    details: [
      `Uploaded media ${media.filename} (${media.id}).`,
      "Verified the media library in the browser-agent session.",
      `Created draft blog_post ${draft.id} with uploaded media.`,
      "Generated a preview token and rendered the draft preview in the public site.",
    ],
  }
}
