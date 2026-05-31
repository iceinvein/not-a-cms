import React from "react"
import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { DashboardStats, type DashboardMetrics } from "../../src/components/DashboardStats"

const metrics: DashboardMetrics = {
  collections: [
    {
      name: "blog_post",
      label: "Blog Posts",
      total: 12,
      drafts: 3,
      inReview: 2,
      published: 6,
      scheduled: 1,
    },
    {
      name: "page",
      label: "Pages",
      total: 4,
      drafts: 1,
      inReview: 0,
      published: 3,
      scheduled: 0,
    },
  ],
  media: { total: 5 },
  recentAudit: [
    {
      id: "audit-1",
      action: "content.created",
      summary: "Created homepage",
      collection: "page",
      documentId: "home",
      createdAt: "2026-05-31T07:00:00.000Z",
    },
  ],
}

describe("DashboardStats", () => {
  test("renders real metrics, review links, media, and recent audit", () => {
    const html = renderToString(<DashboardStats initialMetrics={metrics} />).replaceAll("<!-- -->", "")

    expect(html).toContain("Content Health")
    expect(html).toContain("Blog Posts")
    expect(html).toContain("12 total")
    expect(html).toContain("3 drafts")
    expect(html).toContain("2 in review")
    expect(html).toContain("1 scheduled")
    expect(html).toContain("Media")
    expect(html).toContain("5 assets")
    expect(html).toContain("Needs review")
    expect(html).toContain("/content/blog_post?where")
    expect(html).toContain("Created homepage")
  })
})
