import { describe, expect, test } from "bun:test"
import { toPortableText } from "../../src/portable-text/to-portable-text"
import { fromPortableText } from "../../src/portable-text/from-portable-text"

describe("custom block round-trip", () => {
  test("callout (inline content) survives to PT and back", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "callout",
          attrs: { variant: "info" },
          content: [{ type: "text", text: "Heads up" }],
        },
      ],
    }
    const pt = toPortableText(doc as any)
    expect(pt).toEqual([
      { type: "callout", variant: "info", children: [{ type: "text", value: "Heads up" }] },
    ])
    const back = fromPortableText(pt)
    expect(back.content[0]).toMatchObject({
      type: "callout",
      attrs: { variant: "info" },
      content: [{ type: "text", text: "Heads up" }],
    })
  })

  test("atom field-block (no content) preserves its attributes", () => {
    const doc = {
      type: "doc",
      content: [{ type: "author", attrs: { authorId: "u_42", role: "Founder" } }],
    }
    const pt = toPortableText(doc as any)
    expect(pt).toEqual([{ type: "author", authorId: "u_42", role: "Founder" }])
    const back = fromPortableText(pt)
    expect(back.content[0]).toEqual({ type: "author", attrs: { authorId: "u_42", role: "Founder" } })
  })

  test("known blocks are unaffected", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
    }
    expect(toPortableText(doc as any)).toEqual([
      { type: "paragraph", children: [{ type: "text", value: "hi" }] },
    ])
  })

  test("stats block preserves items array and columns", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "stats",
          attrs: {
            items: [
              { value: "10k+", label: "Users" },
              { value: "99.9%", label: "Uptime" },
            ],
            columns: 2,
          },
        },
      ],
    }
    const pt = toPortableText(doc as any)
    expect(pt).toEqual([
      {
        type: "stats",
        items: [
          { value: "10k+", label: "Users" },
          { value: "99.9%", label: "Uptime" },
        ],
        columns: 2,
      },
    ])
    const back = fromPortableText(pt)
    expect(back.content[0]).toEqual({
      type: "stats",
      attrs: {
        items: [
          { value: "10k+", label: "Users" },
          { value: "99.9%", label: "Uptime" },
        ],
        columns: 2,
      },
    })
  })

  test("logoCloud block preserves eyebrow and logos array", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "logoCloud",
          attrs: {
            eyebrow: "Trusted by",
            logos: [
              { url: "https://cdn.example.com/logo.png", mediaId: "m_1", alt: "Acme" },
            ],
          },
        },
      ],
    }
    const pt = toPortableText(doc as any)
    expect(pt).toEqual([
      {
        type: "logoCloud",
        eyebrow: "Trusted by",
        logos: [{ url: "https://cdn.example.com/logo.png", mediaId: "m_1", alt: "Acme" }],
      },
    ])
    const back = fromPortableText(pt)
    expect(back.content[0]).toEqual({
      type: "logoCloud",
      attrs: {
        eyebrow: "Trusted by",
        logos: [{ url: "https://cdn.example.com/logo.png", mediaId: "m_1", alt: "Acme" }],
      },
    })
  })

  test("testimonial block preserves all scalar fields", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "testimonial",
          attrs: {
            quote: "It changed everything.",
            name: "Jane Doe",
            role: "CTO",
            avatar: "https://cdn.example.com/jane.jpg",
          },
        },
      ],
    }
    const pt = toPortableText(doc as any)
    expect(pt).toEqual([
      {
        type: "testimonial",
        quote: "It changed everything.",
        name: "Jane Doe",
        role: "CTO",
        avatar: "https://cdn.example.com/jane.jpg",
      },
    ])
    const back = fromPortableText(pt)
    expect(back.content[0]).toEqual({
      type: "testimonial",
      attrs: {
        quote: "It changed everything.",
        name: "Jane Doe",
        role: "CTO",
        avatar: "https://cdn.example.com/jane.jpg",
      },
    })
  })

  test("faq block preserves heading and items array", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "faq",
          attrs: {
            heading: "Common questions",
            items: [
              { question: "How does it work?", answer: "Very well." },
              { question: "Is it fast?", answer: "Yes." },
            ],
          },
        },
      ],
    }
    const pt = toPortableText(doc as any)
    expect(pt).toEqual([
      {
        type: "faq",
        heading: "Common questions",
        items: [
          { question: "How does it work?", answer: "Very well." },
          { question: "Is it fast?", answer: "Yes." },
        ],
      },
    ])
    const back = fromPortableText(pt)
    expect(back.content[0]).toEqual({
      type: "faq",
      attrs: {
        heading: "Common questions",
        items: [
          { question: "How does it work?", answer: "Very well." },
          { question: "Is it fast?", answer: "Yes." },
        ],
      },
    })
  })

  test("splitMedia block preserves all six attrs", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "splitMedia",
          attrs: {
            media: "https://cdn.example.com/hero.jpg",
            side: "right",
            heading: "Build faster",
            body: "Paragraph text here.",
            ctaLabel: "Get started",
            ctaUrl: "/signup",
          },
        },
      ],
    }
    const pt = toPortableText(doc as any)
    expect(pt).toEqual([
      {
        type: "splitMedia",
        media: "https://cdn.example.com/hero.jpg",
        side: "right",
        heading: "Build faster",
        body: "Paragraph text here.",
        ctaLabel: "Get started",
        ctaUrl: "/signup",
      },
    ])
    const back = fromPortableText(pt)
    expect(back.content[0]).toEqual({
      type: "splitMedia",
      attrs: {
        media: "https://cdn.example.com/hero.jpg",
        side: "right",
        heading: "Build faster",
        body: "Paragraph text here.",
        ctaLabel: "Get started",
        ctaUrl: "/signup",
      },
    })
  })

  test("pricingCards block preserves heading and tiers with nested features and highlighted bool", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "pricingCards",
          attrs: {
            heading: "Simple pricing",
            tiers: [
              {
                name: "Starter",
                price: "$0",
                period: "/mo",
                features: ["Up to 3 projects", "Community support"],
                ctaLabel: "Get started",
                ctaUrl: "/signup",
                highlighted: false,
              },
              {
                name: "Pro",
                price: "$29",
                period: "/mo",
                features: ["Unlimited projects", "Priority support"],
                ctaLabel: "Upgrade",
                ctaUrl: "/upgrade",
                highlighted: true,
              },
            ],
          },
        },
      ],
    }
    const pt = toPortableText(doc as any)
    expect(pt).toEqual([
      {
        type: "pricingCards",
        heading: "Simple pricing",
        tiers: [
          {
            name: "Starter",
            price: "$0",
            period: "/mo",
            features: ["Up to 3 projects", "Community support"],
            ctaLabel: "Get started",
            ctaUrl: "/signup",
            highlighted: false,
          },
          {
            name: "Pro",
            price: "$29",
            period: "/mo",
            features: ["Unlimited projects", "Priority support"],
            ctaLabel: "Upgrade",
            ctaUrl: "/upgrade",
            highlighted: true,
          },
        ],
      },
    ])
    const back = fromPortableText(pt)
    expect(back.content[0]).toEqual({
      type: "pricingCards",
      attrs: {
        heading: "Simple pricing",
        tiers: [
          {
            name: "Starter",
            price: "$0",
            period: "/mo",
            features: ["Up to 3 projects", "Community support"],
            ctaLabel: "Get started",
            ctaUrl: "/signup",
            highlighted: false,
          },
          {
            name: "Pro",
            price: "$29",
            period: "/mo",
            features: ["Unlimited projects", "Priority support"],
            ctaLabel: "Upgrade",
            ctaUrl: "/upgrade",
            highlighted: true,
          },
        ],
      },
    })
  })
})
