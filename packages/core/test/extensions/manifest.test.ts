import { describe, expect, test } from "bun:test"
import {
  collectExtensionAdminPanels,
  collectExtensionBlocks,
  collectExtensionFields,
  defineConfig,
  defineExtension,
  resolveExtensionManifests,
} from "../../src"

describe("extension manifests", () => {
  test("defineExtension preserves third-party declarations", () => {
    const afterCreate = async () => undefined
    const extension = defineExtension({
      name: "commerce",
      version: "0.1.0",
      fields: [{ name: "money", type: "currency", label: "Money" }],
      blocks: [{ name: "pricing-table", label: "Pricing Table", group: "commerce" }],
      hooks: { afterCreate },
      admin: {
        panels: [{ label: "Commerce", href: "/extensions/commerce", section: "main", order: 20 }],
      },
    })

    expect(extension.name).toBe("commerce")
    expect(extension.fields?.[0].type).toBe("currency")
    expect(extension.blocks?.[0].name).toBe("pricing-table")
    expect(extension.hooks?.afterCreate).toBe(afterCreate)
    expect(extension.admin?.panels?.[0].href).toBe("/extensions/commerce")
  })

  test("resolveExtensionManifests filters invalid declarations", () => {
    const extension = defineExtension({ name: "valid" })

    expect(resolveExtensionManifests([extension, null, {}, { name: "" }, { name: "missing", blocks: "bad" }])).toEqual([
      extension,
    ])
  })

  test("collectors flatten fields, blocks, and ordered admin panels", () => {
    const commerce = defineExtension({
      name: "commerce",
      fields: [{ name: "money", type: "currency" }],
      blocks: [{ name: "pricing", label: "Pricing" }],
      admin: { panels: [{ label: "Commerce", href: "/commerce", order: 30 }] },
    })
    const seo = defineExtension({
      name: "seo",
      fields: [{ name: "score", type: "number" }],
      blocks: [{ name: "toc", label: "Table of Contents" }],
      admin: { panels: [{ label: "SEO", href: "/seo", order: 10 }] },
    })

    expect(collectExtensionFields([commerce, seo]).map((field) => field.name)).toEqual(["money", "score"])
    expect(collectExtensionBlocks([commerce, seo]).map((block) => block.name)).toEqual(["pricing", "toc"])
    expect(collectExtensionAdminPanels([commerce, seo]).map((panel) => panel.label)).toEqual(["SEO", "Commerce"])
  })

  test("defineConfig accepts typed extension manifests", () => {
    const extension = defineExtension({ name: "analytics" })
    const config = defineConfig({
      collections: [],
      extensions: [extension],
    })

    expect(config.extensions?.[0].name).toBe("analytics")
  })
})
