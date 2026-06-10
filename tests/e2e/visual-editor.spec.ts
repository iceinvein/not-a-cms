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
 * Live smoke: drive the Continuum Visual mode in a real browser to confirm what unit/parity
 * tests cannot prove. Phase 2A: brand-styled living views render with editable holes, typing
 * on a headline mutates the model and survives Save (verified by refetching through the API),
 * the inspector binds to the focused block, and the Visual/Document toggle is lossless.
 * Phase 3A: after the lossless toggle, re-enter Visual mode to verify the targeting/navigation
 * chrome mounts (structure tree, breadcrumb, overlay) and a tree-row click selects that block
 * (inspector and breadcrumb follow). The Phase 3A pass runs last so it cannot perturb the
 * lossless-toggle assertion: a tree click sets a ProseMirror NodeSelection that the later
 * inline-text clicks do not clear, which would otherwise leave the editor in a node-selected
 * state the inline-edit/toggle flow is not written for.
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

  // --- Phase 3A: targeting & navigation chrome ---
  // Re-enter Visual mode on the saved document to verify the select/navigate chrome. This runs
  // after the lossless-toggle assertion above so the tree click below (which leaves a lingering
  // NodeSelection) cannot perturb that flow.
  await ctx.agent(["click", ".cn-mode-toggle button:first-child"])
  await ctx.agent(["wait", "--load", "networkidle"], { allowFailure: true })
  await ctx.agent(["wait", "800"], { allowFailure: true })
  for (const [sel, label] of [
    [".cn-tree", "structure tree"],
    [".cn-breadcrumb", "breadcrumb"],
    [".cn-overlay", "overlay"],
  ] as const) {
    if ((await ctx.agent(["get", "count", sel])).trim() === "0") {
      throw new Error(`Visual mode did not mount the ${label} (${sel})`)
    }
  }
  const treeText = (await ctx.agent(["get", "text", ".cn-tree"])).toLowerCase()
  for (const rowLabel of ["hero", "call to action", "feature grid"]) {
    if (!treeText.includes(rowLabel)) {
      throw new Error(`Structure tree missing a row for "${rowLabel}". Got: "${treeText.trim()}"`)
    }
  }
  // Clicking the CTA tree row selects it: the inspector binds to the CTA's "Variant" field
  // (not the hero-only "Align"), and the breadcrumb reflects the selection. "Call to action"
  // appears only in the tree row here (the rendered CTA shows its button label).
  await ctx.agent(["find", "text", "Call to action", "click"])
  await ctx.agent(["wait", "300"], { allowFailure: true })
  const treeInspector = (await ctx.agent(["get", "text", ".cn-inspector"])).toLowerCase()
  if (!treeInspector.includes("variant")) {
    throw new Error(
      `Tree click did not bind the inspector to the CTA (expected "Variant"). Got: "${treeInspector.trim()}"`,
    )
  }
  const breadcrumbText = (await ctx.agent(["get", "text", ".cn-breadcrumb"])).toLowerCase()
  if (!breadcrumbText.includes("call to action")) {
    throw new Error(`Breadcrumb did not reflect the CTA selection. Got: "${breadcrumbText.trim()}"`)
  }
  await ctx.screenshot("visual-editor-03-tree-select.png")

  return {
    name: "Visual editor inline-editing smoke",
    details: [
      `Seeded blog_post ${created.id} with hero/cta/featureGrid living-view blocks.`,
      "Toggled into Visual mode; brand-styled living views rendered with editable holes.",
      "Typed inline on the hero headline; the change appeared in the canvas DOM.",
      "Inspector bound to the focused hero (Align field present).",
      `Saved and refetched: the hero headline persisted the inline edit (marker ${marker}).`,
      "Toggled back to Document mode losslessly (canvas unmounted).",
      "Re-entered Visual mode: Phase 3A chrome mounted (tree/breadcrumb/overlay) with rows for hero/cta/featureGrid.",
      "Clicked the CTA tree row: inspector bound to Variant and the breadcrumb followed the selection.",
    ],
  }
}
