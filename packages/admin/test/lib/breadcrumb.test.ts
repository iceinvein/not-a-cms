import { describe, expect, test } from "bun:test"
import { breadcrumbFromPath, type CrumbCollection } from "../../src/lib/breadcrumb"

const collections: CrumbCollection[] = [
  { name: "blog_post", labels: { singular: "Blog Post", plural: "Blog Posts" } },
]

describe("breadcrumbFromPath", () => {
  test("dashboard root", () => {
    expect(breadcrumbFromPath("/", collections)).toEqual([{ label: "Dashboard", current: true }])
  })

  test("known static route", () => {
    expect(breadcrumbFromPath("/media", collections)).toEqual([{ label: "Media", current: true }])
  })

  test("collection list uses plural label and is current", () => {
    expect(breadcrumbFromPath("/content/blog_post", collections)).toEqual([
      { label: "Blog Posts", href: "/content/blog_post", current: true },
    ])
  })

  test("edit page appends an Edit leaf and the collection becomes a link", () => {
    expect(breadcrumbFromPath("/content/blog_post/abc123", collections)).toEqual([
      { label: "Blog Posts", href: "/content/blog_post", current: false },
      { label: "Edit", current: true },
    ])
  })

  test("new page appends a New leaf", () => {
    expect(breadcrumbFromPath("/content/blog_post/new", collections)).toEqual([
      { label: "Blog Posts", href: "/content/blog_post", current: false },
      { label: "New", current: true },
    ])
  })

  test("unknown collection falls back to its name", () => {
    expect(breadcrumbFromPath("/content/widgets", [])).toEqual([
      { label: "widgets", href: "/content/widgets", current: true },
    ])
  })

  test("automation detail nests under Automations", () => {
    expect(breadcrumbFromPath("/automations/42", collections)).toEqual([
      { label: "Automations", href: "/automations", current: false },
      { label: "Flow", current: true },
    ])
  })

  test("trailing slash is ignored", () => {
    expect(breadcrumbFromPath("/settings/", collections)).toEqual([
      { label: "Settings", current: true },
    ])
  })
})
