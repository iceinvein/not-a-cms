import { test, expect, describe } from "bun:test"
import { slugify } from "../../src/content/slugify"

describe("slugify", () => {
  test("converts to lowercase", () => {
    expect(slugify("Hello World")).toBe("hello-world")
  })

  test("replaces spaces with hyphens", () => {
    expect(slugify("my blog post")).toBe("my-blog-post")
  })

  test("removes special characters", () => {
    expect(slugify("Hello, World! #1")).toBe("hello-world-1")
  })

  test("collapses multiple hyphens", () => {
    expect(slugify("hello---world")).toBe("hello-world")
  })

  test("trims leading and trailing hyphens", () => {
    expect(slugify(" -hello world- ")).toBe("hello-world")
  })

  test("handles empty string", () => {
    expect(slugify("")).toBe("")
  })

  test("handles unicode characters", () => {
    expect(slugify("café résumé")).toBe("cafe-resume")
  })

  test("handles numbers", () => {
    expect(slugify("Top 10 Tips for 2026")).toBe("top-10-tips-for-2026")
  })
})
