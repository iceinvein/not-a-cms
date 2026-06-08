import type { IconName } from "../../components/ui/Icon"
import type { DocContext } from "./doc-context"

export type CommandScope = "jump" | "do" | "find" | "ask"

export type CommandRunContext = {
  apiBase: string
  siteBase: string
  context: DocContext
  navigate: (href: string) => void
  notify: (message: string, kind?: "success" | "error") => void
}

export type Command = {
  id: string
  scope: CommandScope
  title: string
  icon: IconName
  /** Right-aligned hint: a keycap label or a breadcrumb. */
  hint?: string
  /** Secondary line under the title. */
  sub?: string
  /** Extra text folded into matching. */
  keywords?: string
  /** Navigation target for jump commands. */
  href?: string
  /** Action for do commands. */
  run?: (ctx: CommandRunContext) => void | Promise<void>
}

type CrumbCollection = {
  name: string
  label?: string
  labels?: { singular: string; plural: string }
}

function collectionLabel(c: CrumbCollection): string {
  return c.labels?.plural ?? c.label ?? c.name
}

export function buildJumpCommands(collections: CrumbCollection[]): Command[] {
  const commands: Command[] = [
    { id: "jump-dashboard", scope: "jump", title: "Dashboard", icon: "dashboard", href: "/" },
  ]

  for (const c of collections) {
    commands.push({
      id: `jump-${c.name}`,
      scope: "jump",
      title: collectionLabel(c),
      icon: "collection",
      href: `/content/${c.name}`,
      keywords: c.name,
    })
  }

  commands.push(
    { id: "jump-media", scope: "jump", title: "Media", icon: "media", href: "/media" },
    {
      id: "jump-automations",
      scope: "jump",
      title: "Automations",
      icon: "collection",
      href: "/automations",
    },
    { id: "jump-webhooks", scope: "jump", title: "Webhooks", icon: "webhooks", href: "/webhooks" },
    { id: "jump-settings", scope: "jump", title: "Settings", icon: "settings", href: "/settings" },
  )

  return commands
}

export function buildDoCommands(context: DocContext): Command[] {
  const { collection, documentId } = context
  if (!collection || !documentId) return []

  return [
    {
      id: "publish",
      scope: "do",
      title: "Publish this document now",
      icon: "command",
      hint: "Cmd+Enter",
      sub: "Pushes to web, email, and RSS",
      keywords: "publish ship release",
      run: async (ctx) => {
        const res = await fetch(`${ctx.apiBase}/api/${collection}/${documentId}/workflow`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "publish" }),
        })
        if (!res.ok) return ctx.notify("Failed to publish", "error")
        ctx.notify("Published", "success")
        ctx.navigate(`/content/${collection}/${documentId}`)
      },
    },
    {
      id: "schedule",
      scope: "do",
      title: "Schedule this document",
      icon: "command",
      sub: "Open the editor scheduling control",
      keywords: "schedule later publish date",
      run: (ctx) => ctx.navigate(`/content/${collection}/${documentId}?action=schedule`),
    },
    {
      id: "submit_review",
      scope: "do",
      title: "Submit for review",
      icon: "command",
      keywords: "review approve",
      run: async (ctx) => {
        const res = await fetch(`${ctx.apiBase}/api/${collection}/${documentId}/workflow`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "submit_review" }),
        })
        ctx.notify(
          res.ok ? "Submitted for review" : "Failed to submit",
          res.ok ? "success" : "error",
        )
      },
    },
    {
      id: "preview",
      scope: "do",
      title: "Open preview in a new tab",
      icon: "command",
      sub: "Generates a shareable preview link",
      keywords: "preview open channel view",
      run: async (ctx) => {
        const res = await fetch(`${ctx.apiBase}/api/_preview/generate`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collection, documentId, regenerate: false }),
        })
        if (!res.ok) return ctx.notify("Failed to create preview", "error")
        const { token } = await res.json()
        const params = new URLSearchParams({ collection, documentId })
        window.open(`${ctx.siteBase}/preview/${token}?${params.toString()}`, "_blank", "noopener")
      },
    },
  ]
}

function score(query: string, command: Command): number {
  if (!query) return 0
  const q = query.toLowerCase()
  const haystack = `${command.title} ${command.keywords ?? ""}`.toLowerCase()

  const idx = haystack.indexOf(q)
  if (idx === 0) return 1000
  if (idx > 0) return 700 - idx

  let hi = 0
  for (let qi = 0; qi < q.length; qi++) {
    hi = haystack.indexOf(q[qi], hi)
    if (hi === -1) return -1
    hi++
  }
  return 300
}

export function rankCommands(query: string, commands: Command[]): Command[] {
  if (!query) return commands

  return commands
    .map((command) => ({ command, s: score(query, command) }))
    .filter((entry) => entry.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((entry) => entry.command)
}
