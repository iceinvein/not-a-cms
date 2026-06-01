import { describe, expect, test } from "bun:test"
import { createRestHandler } from "../src/rest/handler"

describe("email preview REST endpoint", () => {
  test("renders portable text blocks as a full MJML email document", async () => {
    const handler = createRestHandler(new Map(), undefined, undefined, undefined, undefined, {
      authorize: () => true,
      getRole: () => "admin",
    })

    const res = await handler(new Request("http://localhost/api/_email-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Hi",
        blocks: [
          {
            type: "paragraph",
            children: [{ type: "text", value: "Hello" }],
          },
        ],
      }),
    }))

    expect(res?.status).toBe(200)
    const body = await res?.json() as { html?: string }
    expect(body.html).toContain("<html")
    expect(body.html).toContain("Hello")
  })
})
