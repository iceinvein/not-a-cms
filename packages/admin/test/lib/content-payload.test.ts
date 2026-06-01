import { describe, expect, test } from "bun:test"
import { buildPayload } from "../../src/lib/content-payload"
import type { AdminFieldDef } from "../../src/lib/content-fields"

const fields: Record<string, AdminFieldDef> = {
  title: { type: "text" },
  status: { type: "select", options: ["draft", "published"] },
  body: { type: "richText" },
}

describe("buildPayload", () => {
  test("omits the status field unless a status is passed", () => {
    const out = buildPayload({ title: "Hi", status: "draft", body: [] }, fields)
    expect(out).not.toHaveProperty("status")
    expect(out.title).toBe("Hi")
  })

  test("includes status when provided", () => {
    const out = buildPayload({ title: "Hi" }, fields, "scheduled")
    expect(out.status).toBe("scheduled")
  })
})
