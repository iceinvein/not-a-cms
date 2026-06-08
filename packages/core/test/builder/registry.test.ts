import { describe, expect, test } from "bun:test"
import { createComponentRegistry } from "../../src/builder/registry"

const heroComponent = {
  name: "hero",
  label: "Hero Section",
  category: "sections",
  icon: "layout",
  props: {
    headline: { type: "text" as const, default: "Welcome", label: "Headline" },
    subheadline: { type: "text" as const, label: "Subheadline" },
    backgroundImage: { type: "media" as const, label: "Background" },
  },
}

const ctaComponent = {
  name: "cta",
  label: "Call to Action",
  category: "actions",
  props: {
    label: { type: "text" as const, default: "Click me", label: "Button Label" },
    url: { type: "text" as const, label: "URL" },
  },
}

describe("createComponentRegistry", () => {
  test("registers components and retrieves by name", () => {
    const registry = createComponentRegistry([heroComponent, ctaComponent])
    expect(registry.get("hero")).toEqual(heroComponent)
    expect(registry.get("cta")).toEqual(ctaComponent)
  })

  test("list() returns all registered components", () => {
    const registry = createComponentRegistry([heroComponent, ctaComponent])
    const all = registry.list()
    expect(all).toHaveLength(2)
    expect(all.map((c) => c.name)).toEqual(["hero", "cta"])
  })

  test("listByCategory() groups components", () => {
    const registry = createComponentRegistry([heroComponent, ctaComponent])
    const grouped = registry.listByCategory()
    expect(grouped.sections).toHaveLength(1)
    expect(grouped.actions).toHaveLength(1)
    expect(grouped.sections[0].name).toBe("hero")
  })

  test("get() returns undefined for unknown component", () => {
    const registry = createComponentRegistry([heroComponent])
    expect(registry.get("unknown")).toBeUndefined()
  })

  test("empty registry works", () => {
    const registry = createComponentRegistry([])
    expect(registry.list()).toEqual([])
    expect(registry.listByCategory()).toEqual({})
  })
})
