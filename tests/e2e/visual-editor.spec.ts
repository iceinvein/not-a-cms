import type { E2EContext } from "./agent-browser-e2e"

type ContentRecord = {
  id: string
  title: string
  slug: string
  status?: string
  body?: unknown
}

type PTBlock = { type: string; [key: string]: unknown }

/**
 * Parse a document body that may come back as a Portable Text array or a JSON string.
 */
function bodyBlocks(value: unknown): PTBlock[] {
  if (Array.isArray(value)) return value as PTBlock[]
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? (parsed as PTBlock[]) : []
    } catch {
      return []
    }
  }
  return []
}

/**
 * Phase 2A live smoke: drive the Continuum Visual mode in a real browser to confirm the
 * inline living-view editing loop works end-to-end (which unit/parity tests cannot prove):
 * brand-styled living views render with editable holes, typing on a headline mutates the
 * model and survives Save (verified by refetching the document through the API), the
 * inspector binds to the focused block, and the Visual/Document toggle is lossless.
 */
export async function runVisualEditorSmoke(
  ctx: E2EContext,
): Promise<{ name: string; details: string[] }> {
  const stamp = Date.now()
  const slug = `visual-editor-e2e-${stamp}`
  const title = `Visual Editor E2E ${stamp}`
  const heroHeadline = `Ship pages fast ${stamp}`
  const ctaLabel = "Get started"
  const featureTitle = "Blazing fast"

  // Seed a document whose body contains the three Phase 2A living-view blocks.
  const created = await ctx.apiJson<ContentRecord>("/api/blog_post", {
    method: "POST",
    body: JSON.stringify({
      title,
      slug,
      excerpt: "Visual editor smoke",
      status: "draft",
      tags: ["e2e", "visual-editor"],
      body: [
        {
          type: "hero",
          eyebrow: "Beta",
          headline: heroHeadline,
          subheadline: "No forms, just the page",
          align: "center",
          backgroundImage: "",
          overlay: true,
        },
        { type: "cta", label: ctaLabel, url: "/pricing", variant: "primary" },
        {
          type: "featureGrid",
          columns: 3,
          items: [
            { icon: "*", title: featureTitle, text: "Sub-second renders" },
            { icon: "+", title: "Secure", text: "Locked down" },
          ],
        },
      ],
    }),
  })

  await ctx.agent(["open", `${ctx.adminBase}/content/blog_post/${created.id}`])
  await ctx.agent(["wait", "--load", "networkidle"], { allowFailure: true })
  await ctx.agent(["wait", "800"], { allowFailure: true })
  await ctx.assertPageContains("continuum editor", ["publish"])

  // Toggle into Visual mode. Target the toggle button by CSS (the document title contains
  // "Visual"/"Document", so a text locator would be ambiguous): first button = Visual.
  await ctx.agent(["click", ".cn-mode-toggle button:first-child"])
  await ctx.agent(["wait", "--load", "networkidle"], { allowFailure: true })
  await ctx.agent(["wait", "800"], { allowFailure: true })
  await ctx.screenshot("visual-editor-01-canvas.png")

  // The canvas must mount and render the brand-styled living views with editable holes.
  const canvasCount = (await ctx.agent(["get", "count", ".cn-visual"])).trim()
  if (canvasCount === "0") {
    throw new Error("Visual mode did not mount the .cn-visual canvas")
  }
  const canvasHtml = await ctx.agent(["get", "html", ".cn-visual"])
  const lower = canvasHtml.toLowerCase()
  const mustContain = [
    "nac-hero-headline",
    heroHeadline,
    "nac-cta-btn",
    ctaLabel,
    "nac-feature-title",
    featureTitle,
    "contenteditable",
  ]
  for (const needle of mustContain) {
    if (!canvasHtml.includes(needle) && !lower.includes(needle.toLowerCase())) {
      throw new Error(`Visual canvas HTML missing expected fragment: "${needle}"`)
    }
  }

  // Inline edit: focus the hero headline hole and type a marker; the DOM text must update.
  const marker = `EDITEDXYZ${stamp}`
  // `type <sel> <text>` focuses the element (firing onFocus, which selects the block for the
  // inspector) and types per-character via Playwright. The session-level `keyboard` command
  // dispatches the whole string as one CDP key event, which this build rejects.
  await ctx.agent(["click", ".nac-hero-headline"])
  await ctx.agent(["type", ".nac-hero-headline", marker])
  await ctx.agent(["wait", "300"], { allowFailure: true })
  const headlineText = await ctx.agent(["get", "text", ".nac-hero-headline"])
  if (!headlineText.includes(marker)) {
    throw new Error(`Inline edit did not appear in the headline DOM. Got: "${headlineText.trim()}"`)
  }

  // Focusing the hole selects the block, so the inspector binds to the hero's settings.
  // Field labels are uppercased by CSS (text-transform), so the rendered text is "ALIGN";
  // compare case-insensitively. The inspector must show the hero's non-inline fields and
  // must NOT show the inline text fields (headline/eyebrow/subheadline are edited on canvas).
  const inspectorText = await ctx.agent(["get", "text", ".cn-inspector"])
  const inspectorLower = inspectorText.toLowerCase()
  if (!inspectorLower.includes("align")) {
    throw new Error(
      `Inspector did not bind to the hero (expected "Align"). Got: "${inspectorText.trim()}"`,
    )
  }
  if (inspectorLower.includes("headline") || inspectorLower.includes("eyebrow")) {
    throw new Error(`Inspector leaked an inline text field. Got: "${inspectorText.trim()}"`)
  }

  // Save, then refetch through the API to prove the inline edit reached the model.
  await ctx.agent(["find", "text", "Save", "click"])
  await ctx.agent(["wait", "1500"], { allowFailure: true })
  const refetched = await ctx.apiJson<ContentRecord>(`/api/blog_post/${created.id}`)
  const hero = bodyBlocks(refetched.body).find((b) => b.type === "hero")
  const savedHeadline = String(hero?.headline ?? "")
  if (!savedHeadline.includes(marker)) {
    throw new Error(
      `Saved hero headline did not include the inline edit. Saved: "${savedHeadline}" (expected to contain "${marker}")`,
    )
  }

  // Toggle back to Document mode losslessly: the canvas unmounts, the form editor returns.
  // Second toggle button = Document.
  await ctx.agent(["click", ".cn-mode-toggle button:last-child"])
  await ctx.agent(["wait", "--load", "networkidle"], { allowFailure: true })
  await ctx.agent(["wait", "500"], { allowFailure: true })
  await ctx.screenshot("visual-editor-02-document.png")
  const canvasCountAfter = (await ctx.agent(["get", "count", ".cn-visual"])).trim()
  if (canvasCountAfter !== "0") {
    throw new Error(
      `Document mode should unmount the canvas, but .cn-visual count is ${canvasCountAfter}`,
    )
  }

  return {
    name: "Visual editor inline-editing smoke",
    details: [
      `Seeded blog_post ${created.id} with hero/cta/featureGrid living-view blocks.`,
      "Toggled into Visual mode; brand-styled living views rendered with editable holes.",
      "Typed inline on the hero headline; the change appeared in the canvas DOM.",
      "Inspector bound to the focused hero (Align field present).",
      `Saved and refetched: the hero headline persisted the inline edit (marker ${marker}).`,
      "Toggled back to Document mode losslessly (canvas unmounted).",
    ],
  }
}
