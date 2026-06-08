import { describe, expect, test } from "bun:test"
import {
  canAccessCollection,
  filterFieldsByRole,
  filterWritableFields,
  projectDocumentFields,
} from "../../src/roles/field-filter"
import { field } from "../../src/schema/field"

describe("filterFieldsByRole", () => {
  const fields = {
    title: field.text({ required: true }),
    body: field.richText(),
    status: field.select(["draft", "published"]),
    layout: field.select(["default", "sidebar"], { access: { write: ["admin", "editor"] } }),
    customCSS: field.text({ access: { write: ["admin"] } }),
    secret: field.text({ access: { read: ["admin"] } }),
  }

  test("admin sees all fields", () => {
    expect(Object.keys(filterFieldsByRole(fields, "admin"))).toHaveLength(6)
  })

  test("editor sees all except admin-only read fields", () => {
    const visible = filterFieldsByRole(fields, "editor")
    expect(Object.keys(visible)).toHaveLength(5)
    expect(visible.secret).toBeUndefined()
  })

  test("author sees fields without read restrictions", () => {
    const visible = filterFieldsByRole(fields, "author")
    expect(Object.keys(visible)).toHaveLength(5)
    expect(visible.secret).toBeUndefined()
  })

  test("returns all fields when no access rules defined", () => {
    const simple = { title: field.text({ required: true }), body: field.richText() }
    expect(Object.keys(filterFieldsByRole(simple, "author"))).toHaveLength(2)
  })
})

describe("projectDocumentFields", () => {
  const fields = {
    title: field.text({ required: true }),
    secret: field.text({ access: { read: ["admin"] } }),
    seo: field.group({
      description: field.text(),
      notes: field.text({ access: { read: ["admin"] } }),
    }),
  }

  test("removes fields that the role cannot read", () => {
    const doc = {
      id: "doc-1",
      title: "Public",
      secret: "private",
      seo: { description: "Visible", notes: "hidden" },
      created_at: "2026-05-31T00:00:00.000Z",
    }

    expect(projectDocumentFields(doc, fields, "viewer")).toEqual({
      id: "doc-1",
      title: "Public",
      seo: { description: "Visible" },
      created_at: "2026-05-31T00:00:00.000Z",
    })
  })

  test("keeps restricted fields for allowed roles", () => {
    const doc = {
      title: "Public",
      secret: "private",
      seo: { description: "Visible", notes: "kept" },
    }

    expect(projectDocumentFields(doc, fields, "admin")).toEqual(doc)
  })
})

describe("filterWritableFields", () => {
  const fields = {
    title: field.text({ required: true }),
    secret: field.text({ access: { write: ["admin"] } }),
    seo: field.group({
      description: field.text(),
      notes: field.text({ access: { write: ["admin"] } }),
    }),
  }

  test("removes fields that the role cannot write", () => {
    expect(
      filterWritableFields(
        {
          title: "Draft",
          secret: "private",
          seo: { description: "Visible", notes: "hidden" },
        },
        fields,
        "editor",
      ),
    ).toEqual({
      title: "Draft",
      seo: { description: "Visible" },
    })
  })

  test("keeps restricted fields for allowed roles", () => {
    const input = {
      title: "Draft",
      secret: "private",
      seo: { description: "Visible", notes: "kept" },
    }

    expect(filterWritableFields(input, fields, "admin")).toEqual(input)
  })
})

describe("canAccessCollection", () => {
  test("uses secure defaults for collections without explicit access rules", () => {
    const collection = { name: "page", labels: { singular: "Page", plural: "Pages" }, fields: {} }

    expect(canAccessCollection(collection, "viewer", "read")).toBe(true)
    expect(canAccessCollection(collection, "viewer", "create")).toBe(false)
    expect(canAccessCollection(collection, "author", "create")).toBe(true)
    expect(canAccessCollection(collection, "editor", "update")).toBe(true)
    expect(canAccessCollection(collection, "author", "delete")).toBe(false)
    expect(canAccessCollection(collection, "admin", "delete")).toBe(true)
  })

  test("checks action-specific collection rules", () => {
    const collection = {
      name: "page",
      labels: { singular: "Page", plural: "Pages" },
      fields: {},
      access: {
        read: ["admin", "editor"],
        create: ["admin"],
      },
    }

    expect(canAccessCollection(collection, "viewer", "read")).toBe(false)
    expect(canAccessCollection(collection, "editor", "read")).toBe(true)
    expect(canAccessCollection(collection, "editor", "create")).toBe(false)
    expect(canAccessCollection(collection, "admin", "create")).toBe(true)
  })
})
