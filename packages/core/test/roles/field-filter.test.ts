import { test, expect, describe } from "bun:test"
import { filterFieldsByRole } from "../../src/roles/field-filter"
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
