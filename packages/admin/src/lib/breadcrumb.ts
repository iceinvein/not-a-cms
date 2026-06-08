export type Crumb = { label: string; href?: string; current: boolean }

export type CrumbCollection = {
  name: string
  label?: string
  labels?: { singular: string; plural: string }
}

const STATIC_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/media": "Media",
  "/automations": "Automations",
  "/webhooks": "Webhooks",
  "/settings": "Settings",
}

function collectionLabel(name: string, collections: CrumbCollection[]): string {
  const match = collections.find((c) => c.name === name)
  return match?.labels?.plural ?? match?.label ?? name
}

export function breadcrumbFromPath(pathname: string, collections: CrumbCollection[] = []): Crumb[] {
  const path = pathname.replace(/\/+$/, "") || "/"

  if (path in STATIC_LABELS) {
    return [{ label: STATIC_LABELS[path], current: true }]
  }

  const segments = path.split("/").filter(Boolean)

  if (segments[0] === "content" && segments[1]) {
    const collection = segments[1]
    const base: Crumb = {
      label: collectionLabel(collection, collections),
      href: `/content/${collection}`,
      current: segments.length === 2,
    }
    if (segments.length === 2) return [base]
    const leaf = segments[2] === "new" ? "New" : "Edit"
    return [base, { label: leaf, current: true }]
  }

  if (segments[0] === "automations" && segments[1]) {
    return [
      { label: "Automations", href: "/automations", current: false },
      { label: "Flow", current: true },
    ]
  }

  const first = segments[0] ?? ""
  return [{ label: first.charAt(0).toUpperCase() + first.slice(1), current: true }]
}
