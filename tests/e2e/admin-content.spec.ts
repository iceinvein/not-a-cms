import type { E2EContext } from "./agent-browser-e2e"

type ContentRecord = {
  id: string
  title: string
  slug: string
  status?: string
}

export async function runAdminContentSmoke(ctx: E2EContext) {
  const stamp = Date.now()
  const slug = `agent-browser-e2e-${stamp}`
  const title = `Agent Browser E2E ${stamp}`
  const bodyText = "This post was created by the agent-browser E2E dogfood smoke."

  const created = await ctx.apiJson<ContentRecord>("/api/blog_post", {
    method: "POST",
    body: JSON.stringify({
      title,
      slug,
      excerpt: "Agent-browser smoke excerpt",
      body: [{ type: "paragraph", children: [{ type: "text", value: bodyText }] }],
      status: "draft",
      tags: ["e2e", "dogfood"],
    }),
  })

  await ctx.agent(["open", `${ctx.adminBase}/content/blog_post/${created.id}`])
  await ctx.agent(["wait", "--load", "networkidle"], { allowFailure: true })
  await ctx.screenshot("03-admin-content-edit.png")
  await ctx.assertPageContains("admin content editor", ["Edit Blog Post", "publish"])

  const published = await ctx.apiJson<ContentRecord>(`/api/blog_post/${created.id}/workflow`, {
    method: "POST",
    body: JSON.stringify({ action: "publish" }),
  })
  if (published.status !== "published") {
    throw new Error(`Expected published status, received ${String(published.status)}`)
  }

  await ctx.agent(["open", `${ctx.siteBase}/blog/${slug}`])
  await ctx.agent(["wait", "--load", "networkidle"], { allowFailure: true })
  await ctx.screenshot("04-public-post.png")
  await ctx.assertPageContains("public published post", [title, bodyText])

  return {
    name: "Admin content publish smoke",
    details: [
      `Created blog_post ${created.id}.`,
      "Opened the authenticated admin content editor with agent-browser.",
      `Published ${slug} through the authenticated server workflow endpoint.`,
      "Rendered the public published post in the browser-agent session.",
    ],
  }
}
