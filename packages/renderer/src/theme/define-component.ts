type ComponentPropDef = {
  type: "text" | "number" | "boolean" | "media" | "select" | "group"
  default?: unknown
  label?: string
  options?: string[]
  fields?: Record<string, ComponentPropDef>
}

type ComponentDefinition = {
  name: string
  label: string
  category?: string
  icon?: string
  props: Record<string, ComponentPropDef>
  // The actual Astro/React component reference will be provided by the theme
}

export function defineComponent(def: ComponentDefinition): ComponentDefinition {
  return def
}

export type { ComponentDefinition, ComponentPropDef }
