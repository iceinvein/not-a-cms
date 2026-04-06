type RegistryComponentDef = {
  name: string
  label: string
  category?: string
  icon?: string
  props: Record<string, {
    type: "text" | "number" | "boolean" | "media" | "select" | "group"
    default?: unknown
    label?: string
    options?: string[]
    fields?: Record<string, any>
  }>
}

export function createComponentRegistry(components: RegistryComponentDef[]) {
  const byName = new Map<string, RegistryComponentDef>()
  for (const c of components) {
    byName.set(c.name, c)
  }

  return {
    get(name: string): RegistryComponentDef | undefined {
      return byName.get(name)
    },

    list(): RegistryComponentDef[] {
      return [...byName.values()]
    },

    listByCategory(): Record<string, RegistryComponentDef[]> {
      const groups: Record<string, RegistryComponentDef[]> = {}
      for (const c of byName.values()) {
        const cat = c.category ?? "uncategorized"
        if (!groups[cat]) groups[cat] = []
        groups[cat].push(c)
      }
      return groups
    },
  }
}

export type ComponentRegistry = ReturnType<typeof createComponentRegistry>
export type { RegistryComponentDef }
