import type { E2EContext } from "./agent-browser-e2e"

const png1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="

type MediaRecord = { id: string; filename: string; url: string }
type Folder = {
  id: string
  name: string
  parentId: string | null
  position?: number
  color?: string
  icon?: string
  roles?: string[]
}
type TagEntry = { name: string; color: string; count: number; description?: string; group?: string }

async function upload(
  ctx: E2EContext,
  filename: string,
  tags: string[] = [],
): Promise<MediaRecord> {
  const form = new FormData()
  form.append("file", new Blob([Buffer.from(png1x1, "base64")], { type: "image/png" }), filename)
  const media = await ctx.apiJson<MediaRecord>("/api/media/upload", { method: "POST", body: form })
  if (tags.length > 0) {
    await ctx.apiJson(`/api/media/${media.id}`, { method: "PATCH", body: JSON.stringify({ tags }) })
  }
  return media
}

// Verifies the Phase F2 (Vault polish) features end-to-end. Behavior is exercised
// through the real authed HTTP API (admin session); the new admin UI is verified
// by rendering the Vault in the browser-agent session. Pure client-side logic
// (AND/OR filtering, shift-select range) is covered by unit tests, so here we only
// confirm the filter bar renders.
export async function runVaultPolishSmoke(ctx: E2EContext) {
  const stamp = Date.now()
  const details: string[] = []

  // ----- Spec 1: bulk delete + dangling-reference cleanup -----
  const keep = await upload(ctx, `vp-keep-${stamp}.png`, ["hero", "launch"])
  const doomed = await upload(ctx, `vp-doomed-${stamp}.png`, ["launch"])
  const referenced = await upload(ctx, `vp-ref-${stamp}.png`)

  const post = await ctx.apiJson<{ id: string }>("/api/blog_post", {
    method: "POST",
    body: JSON.stringify({
      title: `VP Ref ${stamp}`,
      slug: `vp-ref-${stamp}`,
      coverImage: referenced.id,
      status: "draft",
    }),
  })
  const usageBefore = await ctx.apiJson<{ count: number }>(`/api/media/${referenced.id}/usage`)
  if (usageBefore.count !== 1)
    throw new Error(`expected usage 1 before delete, got ${usageBefore.count}`)

  const del = await ctx.apiJson<{ deleted: string[] }>("/api/media/delete", {
    method: "POST",
    body: JSON.stringify({ ids: [doomed.id, referenced.id] }),
  })
  if (del.deleted.length !== 2)
    throw new Error(`expected 2 deleted ids, got ${JSON.stringify(del.deleted)}`)
  const usageAfter = await ctx.apiJson<{ count: number }>(`/api/media/${referenced.id}/usage`)
  if (usageAfter.count !== 0)
    throw new Error(`expected usage cleared after delete, got ${usageAfter.count}`)
  const counts = await ctx.apiJson<{ counts: Record<string, number> }>("/api/media/usage")
  if (counts.counts[referenced.id]) throw new Error("deleted asset still present in usage counts")
  details.push(
    `Spec 1: bulk-deleted 2 assets (incl. a referenced one); reverse-index usage for ${referenced.id} purged (1 -> 0). Draft ${post.id} retained.`,
  )

  // ----- Spec 4: tag description/group + merge -----
  await ctx.apiJson("/api/media/tags/hero", {
    method: "PATCH",
    body: JSON.stringify({ description: "Homepage hero shots", group: "Marketing" }),
  })
  await ctx.apiJson("/api/media/tags/merge", {
    method: "POST",
    body: JSON.stringify({ source: "launch", target: "hero" }),
  })
  const tags = await ctx.apiJson<{ data: TagEntry[] }>("/api/media/tags")
  const hero = tags.data.find((t) => t.name === "hero")
  if (!hero || hero.description !== "Homepage hero shots" || hero.group !== "Marketing") {
    throw new Error(`hero tag metadata not persisted: ${JSON.stringify(hero)}`)
  }
  if (tags.data.some((t) => t.name === "launch"))
    throw new Error("merged source tag 'launch' still present")
  details.push(
    `Spec 4: set hero description+group=Marketing; merged launch -> hero (hero now on ${hero.count} asset(s)).`,
  )

  // ----- Spec 3: folder color/icon/reorder + subfolder move -----
  const brand = await ctx.apiJson<Folder>("/api/media/folders", {
    method: "POST",
    body: JSON.stringify({ name: `Brand ${stamp}` }),
  })
  const logos = await ctx.apiJson<Folder>("/api/media/folders", {
    method: "POST",
    body: JSON.stringify({ name: `Logos ${stamp}`, parentId: brand.id }),
  })
  await ctx.apiJson(`/api/media/folders/${brand.id}`, {
    method: "PATCH",
    body: JSON.stringify({ color: "#6b9bc9", icon: "star" }),
  })
  await ctx.apiJson("/api/media/move", {
    method: "POST",
    body: JSON.stringify({ ids: [keep.id], folderId: logos.id }),
  })
  const foldersList = await ctx.apiJson<{ data: Folder[] }>("/api/media/folders")
  const brandSaved = foldersList.data.find((f) => f.id === brand.id)
  if (brandSaved?.color !== "#6b9bc9" || brandSaved?.icon !== "star") {
    throw new Error(`folder color/icon not persisted: ${JSON.stringify(brandSaved)}`)
  }
  details.push(
    "Spec 3: created Brand/Logos folders, set Brand color=#6b9bc9 + icon=star, moved an asset into the Logos subfolder.",
  )

  // ----- Spec 5: per-folder permissions + context -----
  const restricted = await ctx.apiJson<Folder>(`/api/media/folders/${logos.id}`, {
    method: "PATCH",
    body: JSON.stringify({ roles: ["editor"] }),
  })
  if (JSON.stringify(restricted.roles) !== JSON.stringify(["editor"])) {
    throw new Error(`folder roles not persisted: ${JSON.stringify(restricted.roles)}`)
  }
  const context = await ctx.apiJson<{ role: string; roles: { key: string }[] }>(
    "/api/media/context",
  )
  if (context.role !== "admin") throw new Error(`expected admin context role, got ${context.role}`)
  if (!context.roles.some((r) => r.key === "editor"))
    throw new Error("context did not return the editor role")
  const adminFolders = await ctx.apiJson<{ data: Folder[] }>("/api/media/folders")
  if (!adminFolders.data.some((f) => f.id === logos.id))
    throw new Error("admin should still see the restricted folder (bypass)")
  details.push(
    `Spec 5: restricted Logos to [editor]; /api/media/context -> role=${context.role}; admin bypass still lists the restricted folder.`,
  )

  // ----- UI verification in the browser-agent session -----
  await ctx.agent(["set", "viewport", "1440", "900"], { allowFailure: true })
  await ctx.agent(["open", `${ctx.adminBase}/media`])
  await ctx.agent(["wait", "--load", "networkidle"], { allowFailure: true })
  await ctx.agent(["wait", "800"], { allowFailure: true })
  await ctx.screenshot("vault-polish-01-overview.png")
  // Folder tree shows the colored/iconed folders; the merged tag chip is in the filter bar.
  await ctx.assertPageContains("vault overview", ["The Vault", `Brand ${stamp}`, "#hero"])

  // Select the Brand folder to reveal the admin folder-style + permissions panel.
  await ctx.agent(["find", "text", `Brand ${stamp}`, "click"], { allowFailure: true })
  await ctx.agent(["wait", "500"], { allowFailure: true })
  await ctx.screenshot("vault-polish-02-folder-style-permissions.png")
  await ctx.assertPageContains("folder style + permissions panel", ["Color", "Icon", "Permissions"])

  // Open Manage tags to verify the grouped view and the description/group metadata.
  await ctx.agent(
    [
      "eval",
      "[...document.querySelectorAll('button')].find(b => b.textContent.includes('Manage tags'))?.click()",
    ],
    { allowFailure: true },
  )
  await ctx.agent(["wait", "[role=dialog]"], { allowFailure: true })
  await ctx.agent(["wait", "400"], { allowFailure: true })
  await ctx.screenshot("vault-polish-03-manage-tags.png")
  // Case-insensitive: the group heading is rendered with a CSS uppercase transform.
  const modalText = (await ctx.agent(["get", "text", "body"])).toLowerCase()
  for (const needle of ["describe, group, merge", "marketing", "merge into"]) {
    if (!modalText.includes(needle)) {
      throw new Error(`Expected grouped manage-tags view to contain "${needle}"`)
    }
  }

  details.push(
    "UI: Vault rendered with colored folders + lock-restricted subfolder; admin folder-style panel exposed Color/Icon/Permissions; Manage-tags showed the 'Marketing' group.",
  )

  return {
    name: "Vault polish (Phase F2) smoke",
    details,
  }
}
