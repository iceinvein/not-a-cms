import { describe, expect, test } from "bun:test"
import { createComponentRegistry } from "@not-a-cms/core"
import { createComponentHandler } from "../../src/builder/component-handler"

const registry = createComponentRegistry([
  {
    name: "hero",
    label: "Hero Section",
    category: "sections",
    icon: "layout",
    props: {
      headline: { type: "text", default: "Welcome", label: "Headline" },
    },
  },
  {
    name: "cta",
    label: "Call to Action",
    category: "actions",
    props: {
      label: { type: "text", default: "Click me" },
    },
  },
])

const handler = createComponentHandler(registry)

describe("component handler", () => {
  test("GET /api/_components returns all components", async () => {
    const req = new Request("http://localhost/api/_components")
    const res = await handler(req)
    expect(res).not.toBeNull()
    const data = await res!.json()
    expect(data).toHaveLength(2)
    expect(data[0].name).toBe("hero")
  })

  test("GET /api/_components?grouped=true returns by category", async () => {
    const req = new Request("http://localhost/api/_components?grouped=true")
    const res = await handler(req)
    const data = await res!.json()
    expect(data.sections).toHaveLength(1)
    expect(data.actions).toHaveLength(1)
  })

  test("GET /api/_components/:name returns single component", async () => {
    const req = new Request("http://localhost/api/_components/hero")
    const res = await handler(req)
    const data = await res!.json()
    expect(data.name).toBe("hero")
  })

  test("GET /api/_components/:name returns 404 for unknown", async () => {
    const req = new Request("http://localhost/api/_components/unknown")
    const res = await handler(req)
    expect(res!.status).toBe(404)
  })

  test("returns null for non-matching paths", async () => {
    const req = new Request("http://localhost/api/other")
    const res = await handler(req)
    expect(res).toBeNull()
  })
})
