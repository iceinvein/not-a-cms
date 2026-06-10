import { describe, expect, test } from "bun:test"
import { cssUrl, sanitizeUrl } from "@not-a-cms/renderer/web"
import { imageSource } from "@not-a-cms/renderer/web"

describe("sanitizeUrl (exported)", () => {
  test("passes through site-relative and http(s) URLs", () => {
    expect(sanitizeUrl("/pricing")).toBe("/pricing")
    expect(sanitizeUrl("https://example.com")).toBe("https://example.com")
  })

  test("rejects javascript: and empty URLs", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("#")
    expect(sanitizeUrl("")).toBe("#")
  })

  test("allows data:image only when opted in", () => {
    const data = "data:image/png;base64,AAAA"
    expect(sanitizeUrl(data)).toBe("#")
    expect(sanitizeUrl(data, { allowDataImage: true })).toBe(data)
  })
})

describe("cssUrl (exported)", () => {
  test("strips characters that could break out of url('...')", () => {
    expect(cssUrl("/img/a.jpg")).toBe("/img/a.jpg")
    expect(cssUrl("a'); color:red; (")).toBe("a color:red")
  })
})

describe("imageSource (exported)", () => {
  test("wraps a bare string URL", () => {
    expect(imageSource("/img/a.jpg")).toEqual({ url: "/img/a.jpg" })
  })

  test("reads url, mediaId then id, and alt from an object", () => {
    expect(imageSource({ url: "/b.png", mediaId: "42", alt: "B" })).toEqual({
      url: "/b.png",
      id: "42",
      alt: "B",
    })
  })
})
