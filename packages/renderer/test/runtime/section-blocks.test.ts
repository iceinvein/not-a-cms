import { describe, expect, test } from "bun:test"
import { renderPortableText } from "../../src/runtime/portable-text-html"

describe("section blocks (F-012)", () => {
  test("renders a hero with eyebrow, headline, subheadline and alignment", () => {
    const html = renderPortableText([
      {
        type: "hero",
        eyebrow: "New",
        headline: "Ship faster",
        subheadline: "The CMS for 2026",
        align: "left",
      },
    ])
    expect(html).toContain("nac-band")
    expect(html).toContain("nac-hero")
    expect(html).toContain("nac-container")
    expect(html).toContain('data-align="left"')
    expect(html).toContain("nac-hero-eyebrow")
    expect(html).toContain("Ship faster")
    expect(html).toContain("The CMS for 2026")
  })

  test("defaults hero alignment to center", () => {
    const html = renderPortableText([{ type: "hero", headline: "Hi" }])
    expect(html).toContain('data-align="center"')
  })

  test("renders a CTA button with a safe href and variant", () => {
    const html = renderPortableText([
      { type: "cta", label: "Get started", url: "/signup", variant: "primary" },
    ])
    expect(html).toContain('class="nac-cta-btn"')
    expect(html).toContain('data-variant="primary"')
    expect(html).toContain('href="/signup"')
    expect(html).toContain("Get started")
  })

  test("CTA sanitizes dangerous urls", () => {
    const html = renderPortableText([{ type: "cta", label: "x", url: "javascript:alert(1)" }])
    expect(html).not.toContain("javascript:")
    expect(html).toContain('href="#"')
  })

  test("renders a feature grid of cards", () => {
    const html = renderPortableText([
      {
        type: "featureGrid",
        items: [
          { title: "Typed", text: "Real columns" },
          { title: "Fast", text: "Astro output" },
        ],
      },
    ])
    expect(html).toContain("nac-features")
    expect(html).toContain("nac-feature-grid")
    expect(html).toContain("Typed")
    expect(html).toContain("Real columns")
    expect(html).toContain("Fast")
    expect(html.match(/class="nac-feature"/g)?.length).toBe(2)
  })

  test("escapes hero content", () => {
    const html = renderPortableText([{ type: "hero", headline: "<script>x</script>" }])
    expect(html).not.toContain("<script>x")
    expect(html).toContain("&lt;script&gt;")
  })

  test("renders a hero background image with an overlay by default", () => {
    const html = renderPortableText([
      { type: "hero", headline: "Hi", backgroundImage: "https://cdn.example.com/bg.jpg" },
    ])
    expect(html).toContain('data-has-bg="true"')
    expect(html).toContain('data-overlay="true"')
    expect(html).toContain("background-image:url('https://cdn.example.com/bg.jpg')")
  })

  test("hero without a background image reports no bg", () => {
    const html = renderPortableText([{ type: "hero", headline: "Hi" }])
    expect(html).toContain('data-has-bg="false"')
  })

  test("hero overlay can be disabled", () => {
    const html = renderPortableText([
      {
        type: "hero",
        headline: "Hi",
        backgroundImage: "https://cdn.example.com/bg.jpg",
        overlay: false,
      },
    ])
    expect(html).toContain('data-overlay="false"')
  })

  test("hero background rejects dangerous urls", () => {
    const html = renderPortableText([
      { type: "hero", headline: "Hi", backgroundImage: "javascript:alert(1)" },
    ])
    expect(html).not.toContain("javascript:")
    expect(html).toContain('data-has-bg="false"')
  })

  test("feature grid honors a column count and renders icons", () => {
    const html = renderPortableText([
      { type: "featureGrid", columns: 4, items: [{ icon: "⚡", title: "Fast", text: "x" }] },
    ])
    expect(html).toContain('data-columns="4"')
    expect(html).toContain("nac-feature-icon")
    expect(html).toContain("⚡")
  })

  test("feature grid defaults to 3 columns and clamps invalid counts", () => {
    expect(renderPortableText([{ type: "featureGrid", items: [] }])).toContain('data-columns="3"')
    expect(renderPortableText([{ type: "featureGrid", columns: 7, items: [] }])).toContain(
      'data-columns="3"',
    )
  })
})

describe("stats section block", () => {
  test("renders a stat grid with value and label", () => {
    const html = renderPortableText([
      {
        type: "stats",
        items: [
          { value: "10k+", label: "Users" },
          { value: "99.9%", label: "Uptime" },
        ],
        columns: 2,
      },
    ])
    expect(html).toContain("nac-band")
    expect(html).toContain("nac-stats")
    expect(html).toContain("nac-container")
    expect(html).toContain('class="nac-stat-grid"')
    expect(html).toContain('data-columns="2"')
    expect(html).toContain("nac-stat-value")
    expect(html).toContain("10k+")
    expect(html).toContain("nac-stat-label")
    expect(html).toContain("Users")
    expect(html).toContain("99.9%")
    expect(html).toContain("Uptime")
    expect(html.match(/class="nac-stat"/g)?.length).toBe(2)
  })

  test("stats defaults to 3 columns and clamps invalid values", () => {
    const html3 = renderPortableText([{ type: "stats", items: [] }])
    expect(html3).toContain('data-columns="3"')
    const htmlClamped = renderPortableText([{ type: "stats", columns: 99, items: [] }])
    expect(htmlClamped).toContain('data-columns="3"')
  })

  test("stats accepts 2 and 4 column counts", () => {
    expect(renderPortableText([{ type: "stats", columns: 2, items: [] }])).toContain(
      'data-columns="2"',
    )
    expect(renderPortableText([{ type: "stats", columns: 4, items: [] }])).toContain(
      'data-columns="4"',
    )
  })

  test("stats escapes html in value and label", () => {
    const html = renderPortableText([
      { type: "stats", items: [{ value: "<b>bold</b>", label: "<script>x</script>" }] },
    ])
    expect(html).not.toContain("<b>bold</b>")
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;b&gt;")
  })

  test("stats handles non-array items gracefully", () => {
    const html = renderPortableText([{ type: "stats", items: null }])
    expect(html).toContain("nac-stats")
    expect(html).not.toContain("nac-stat-value")
  })
})

describe("logoCloud section block", () => {
  test("renders logos in a row with optional eyebrow", () => {
    const html = renderPortableText([
      {
        type: "logoCloud",
        eyebrow: "Trusted by",
        logos: [
          { url: "https://cdn.example.com/logo.png", mediaId: "m_1", alt: "Acme" },
          { url: "https://cdn.example.com/logo2.png", mediaId: "", alt: "Bravo" },
        ],
      },
    ])
    expect(html).toContain("nac-band")
    expect(html).toContain("nac-logo-cloud")
    expect(html).toContain("nac-container")
    expect(html).toContain("nac-eyebrow")
    expect(html).toContain("Trusted by")
    expect(html).toContain('class="nac-logo-row"')
    expect(html).toContain('class="nac-logo"')
    expect(html).toContain("https://cdn.example.com/logo.png")
    expect(html).toContain('alt="Acme"')
    expect(html).toContain('data-media-id="m_1"')
    expect(html.match(/class="nac-logo"/g)?.length).toBe(2)
  })

  test("logoCloud omits eyebrow element when empty", () => {
    const html = renderPortableText([{ type: "logoCloud", eyebrow: "", logos: [] }])
    expect(html).not.toContain("nac-eyebrow")
  })

  test("logoCloud handles non-array logos gracefully", () => {
    const html = renderPortableText([{ type: "logoCloud", logos: null }])
    expect(html).toContain("nac-logo-cloud")
    expect(html).not.toContain('class="nac-logo"')
  })

  test("logoCloud sanitizes dangerous logo urls", () => {
    const html = renderPortableText([
      { type: "logoCloud", logos: [{ url: "javascript:alert(1)", alt: "bad" }] },
    ])
    expect(html).not.toContain("javascript:")
    expect(html).toContain('src="#"')
  })
})

describe("faq section block", () => {
  test("renders band/container structure with optional heading and dl", () => {
    const html = renderPortableText([
      {
        type: "faq",
        heading: "Common questions",
        items: [
          { question: "How does it work?", answer: "Very well." },
          { question: "Is it free?", answer: "Yes, forever." },
        ],
      },
    ])
    expect(html).toContain("nac-band")
    expect(html).toContain("nac-faq")
    expect(html).toContain("nac-container")
    expect(html).toContain('class="nac-section-heading"')
    expect(html).toContain("Common questions")
    expect(html).toContain('<div class="nac-faq">')
    expect(html.match(/<details class="nac-faq-item">/g)?.length).toBe(2)
    expect(html).toContain('<summary class="nac-faq-q">How does it work?</summary>')
    expect(html).toContain('<div class="nac-faq-a">Very well.</div>')
    expect(html).toContain('<summary class="nac-faq-q">Is it free?</summary>')
    expect(html).toContain('<div class="nac-faq-a">Yes, forever.</div>')
  })

  test("faq omits heading element when heading is empty", () => {
    const html = renderPortableText([
      { type: "faq", heading: "", items: [{ question: "Q?", answer: "A." }] },
    ])
    expect(html).not.toContain("nac-section-heading")
  })

  test("faq handles non-array items gracefully", () => {
    const html = renderPortableText([{ type: "faq", items: null }])
    expect(html).toContain("nac-faq")
    expect(html).not.toContain("nac-faq-item")
  })

  test("faq renders empty items list safely", () => {
    const html = renderPortableText([{ type: "faq", items: [] }])
    expect(html).toContain('<div class="nac-faq">')
    expect(html).not.toContain("nac-faq-item")
  })

  test("faq escapes html in question and answer", () => {
    const html = renderPortableText([
      {
        type: "faq",
        items: [{ question: "<script>bad</script>", answer: "<b>bold</b>" }],
      },
    ])
    expect(html).not.toContain("<script>bad</script>")
    expect(html).not.toContain("<b>bold</b>")
    expect(html).toContain("&lt;script&gt;")
    expect(html).toContain("&lt;b&gt;")
  })
})

describe("pricingCards section block", () => {
  test("renders band/container/heading and one card per tier", () => {
    const html = renderPortableText([
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
            features: ["Unlimited projects"],
            ctaLabel: "Upgrade",
            ctaUrl: "/upgrade",
            highlighted: true,
          },
        ],
      },
    ])
    expect(html).toContain("nac-band")
    expect(html).toContain("nac-pricing-cards")
    expect(html).toContain("nac-container")
    expect(html).toContain('class="nac-section-heading"')
    expect(html).toContain("Simple pricing")
    expect(html).toContain('<div class="nac-pricing">')
    expect(html.match(/class="nac-tier"/g)?.length).toBe(2)
    expect(html).toContain('data-highlight="false"')
    expect(html).toContain('data-highlight="true"')
    expect(html).toContain('<h3 class="nac-tier-name">Starter</h3>')
    expect(html).toContain('<h3 class="nac-tier-name">Pro</h3>')
    expect(html).toContain("$0")
    expect(html).toContain("$29")
    expect(html).toContain('<span class="nac-tier-period">/mo</span>')
    expect(html).toContain("<li>Up to 3 projects</li>")
    expect(html).toContain("<li>Community support</li>")
    expect(html).toContain("<li>Unlimited projects</li>")
    expect(html).toContain('href="/signup"')
    expect(html).toContain("Get started")
    expect(html).toContain('href="/upgrade"')
    expect(html).toContain("Upgrade")
  })

  test("pricingCards omits heading element when heading is empty", () => {
    const html = renderPortableText([{ type: "pricingCards", heading: "", tiers: [] }])
    expect(html).not.toContain("nac-section-heading")
  })

  test("pricingCards omits CTA when ctaLabel is absent", () => {
    const html = renderPortableText([
      {
        type: "pricingCards",
        tiers: [
          {
            name: "Free",
            price: "$0",
            period: "",
            features: [],
            ctaLabel: "",
            ctaUrl: "",
            highlighted: false,
          },
        ],
      },
    ])
    expect(html).not.toContain("nac-cta-btn")
  })

  test("pricingCards omits period span when period is empty", () => {
    const html = renderPortableText([
      {
        type: "pricingCards",
        tiers: [
          {
            name: "Free",
            price: "$0",
            period: "",
            features: [],
            ctaLabel: "",
            ctaUrl: "",
            highlighted: false,
          },
        ],
      },
    ])
    expect(html).not.toContain("nac-tier-period")
  })

  test("pricingCards handles non-array tiers gracefully", () => {
    const html = renderPortableText([{ type: "pricingCards", tiers: null }])
    expect(html).toContain("nac-pricing-cards")
    expect(html).not.toContain("nac-tier")
  })

  test("pricingCards handles empty tiers safely", () => {
    const html = renderPortableText([{ type: "pricingCards", tiers: [] }])
    expect(html).toContain('<div class="nac-pricing">')
    expect(html).not.toContain("nac-tier")
  })

  test("pricingCards escapes html in tier text fields", () => {
    const html = renderPortableText([
      {
        type: "pricingCards",
        tiers: [
          {
            name: "<script>x</script>",
            price: "$0",
            period: "",
            features: ["<b>bad</b>"],
            ctaLabel: "",
            ctaUrl: "",
            highlighted: false,
          },
        ],
      },
    ])
    expect(html).not.toContain("<script>x</script>")
    expect(html).not.toContain("<b>bad</b>")
    expect(html).toContain("&lt;script&gt;")
    expect(html).toContain("&lt;b&gt;")
  })

  test("pricingCards sanitizes dangerous CTA urls", () => {
    const html = renderPortableText([
      {
        type: "pricingCards",
        tiers: [
          {
            name: "Bad",
            price: "$0",
            period: "",
            features: [],
            ctaLabel: "Click",
            ctaUrl: "javascript:alert(1)",
            highlighted: false,
          },
        ],
      },
    ])
    expect(html).not.toContain("javascript:")
    expect(html).toContain('href="#"')
  })

  test("pricingCards handles non-array features gracefully", () => {
    const html = renderPortableText([
      {
        type: "pricingCards",
        tiers: [
          {
            name: "Free",
            price: "$0",
            period: "",
            features: null,
            ctaLabel: "",
            ctaUrl: "",
            highlighted: false,
          },
        ],
      },
    ])
    expect(html).toContain("nac-tier")
    expect(html).not.toContain("<li>")
  })
})

describe("splitMedia section block", () => {
  test("renders band/container/split structure with media img, heading, body, and CTA", () => {
    const html = renderPortableText([
      {
        type: "splitMedia",
        media: "https://cdn.example.com/hero.jpg",
        side: "left",
        heading: "Build faster",
        body: "Paragraph text here.",
        ctaLabel: "Get started",
        ctaUrl: "/signup",
      },
    ])
    expect(html).toContain("nac-band")
    expect(html).toContain("nac-split-block")
    expect(html).toContain("nac-container")
    expect(html).toContain('data-side="left"')
    expect(html).toContain('class="nac-split-media"')
    expect(html).toContain("https://cdn.example.com/hero.jpg")
    expect(html).toContain('<h2 class="nac-split-heading">Build faster</h2>')
    expect(html).toContain('<p class="nac-split-text">Paragraph text here.</p>')
    expect(html).toContain('class="nac-cta-btn"')
    expect(html).toContain('data-variant="primary"')
    expect(html).toContain('href="/signup"')
    expect(html).toContain("Get started")
  })

  test("renders side=right correctly", () => {
    const html = renderPortableText([
      {
        type: "splitMedia",
        media: "https://cdn.example.com/img.jpg",
        side: "right",
        heading: "",
        body: "",
        ctaLabel: "",
        ctaUrl: "",
      },
    ])
    expect(html).toContain('data-side="right"')
  })

  test("defaults invalid side value to left", () => {
    const html = renderPortableText([
      {
        type: "splitMedia",
        media: "https://cdn.example.com/img.jpg",
        side: "top",
        heading: "",
        body: "",
        ctaLabel: "",
        ctaUrl: "",
      },
    ])
    expect(html).toContain('data-side="left"')
    expect(html).not.toContain('data-side="top"')
  })

  test("omits heading when heading is empty", () => {
    const html = renderPortableText([
      {
        type: "splitMedia",
        media: "https://cdn.example.com/img.jpg",
        side: "left",
        heading: "",
        body: "Some text.",
        ctaLabel: "",
        ctaUrl: "",
      },
    ])
    expect(html).not.toContain("nac-split-heading")
  })

  test("omits body paragraph when body is empty", () => {
    const html = renderPortableText([
      {
        type: "splitMedia",
        media: "https://cdn.example.com/img.jpg",
        side: "left",
        heading: "Title",
        body: "",
        ctaLabel: "",
        ctaUrl: "",
      },
    ])
    expect(html).not.toContain("nac-split-text")
  })

  test("omits CTA when ctaLabel is empty", () => {
    const html = renderPortableText([
      {
        type: "splitMedia",
        media: "https://cdn.example.com/img.jpg",
        side: "left",
        heading: "Title",
        body: "Text.",
        ctaLabel: "",
        ctaUrl: "",
      },
    ])
    expect(html).not.toContain("nac-cta-btn")
  })

  test("omits media img when media is empty", () => {
    const html = renderPortableText([
      {
        type: "splitMedia",
        media: "",
        side: "left",
        heading: "Title",
        body: "Text.",
        ctaLabel: "",
        ctaUrl: "",
      },
    ])
    expect(html).not.toContain("<img")
  })

  test("sanitizes dangerous media url", () => {
    const html = renderPortableText([
      {
        type: "splitMedia",
        media: "javascript:alert(1)",
        side: "left",
        heading: "Title",
        body: "",
        ctaLabel: "",
        ctaUrl: "",
      },
    ])
    expect(html).not.toContain("javascript:")
    expect(html).toContain('src="#"')
  })

  test("sanitizes dangerous CTA url", () => {
    const html = renderPortableText([
      {
        type: "splitMedia",
        media: "",
        side: "left",
        heading: "",
        body: "",
        ctaLabel: "Click",
        ctaUrl: "javascript:alert(1)",
      },
    ])
    expect(html).not.toContain("javascript:")
    expect(html).toContain('href="#"')
  })

  test("escapes html in heading, body, and ctaLabel", () => {
    const html = renderPortableText([
      {
        type: "splitMedia",
        media: "",
        side: "left",
        heading: "<script>bad</script>",
        body: "<b>bold</b>",
        ctaLabel: "<em>click</em>",
        ctaUrl: "/ok",
      },
    ])
    expect(html).not.toContain("<script>bad")
    expect(html).not.toContain("<b>bold")
    expect(html).not.toContain("<em>click")
    expect(html).toContain("&lt;script&gt;")
    expect(html).toContain("&lt;b&gt;")
    expect(html).toContain("&lt;em&gt;")
  })

  test("empty block (no media/heading/body/CTA) renders safely with band structure", () => {
    const html = renderPortableText([
      {
        type: "splitMedia",
        media: "",
        side: "left",
        heading: "",
        body: "",
        ctaLabel: "",
        ctaUrl: "",
      },
    ])
    expect(html).toContain("nac-band")
    expect(html).toContain("nac-split-block")
    expect(html).toContain("nac-container")
    expect(html).toContain('data-side="left"')
    expect(html).not.toContain("<img")
    expect(html).not.toContain("nac-split-heading")
    expect(html).not.toContain("nac-split-text")
    expect(html).not.toContain("nac-cta-btn")
  })

  test("emits data-media-id attribute when media has an id", () => {
    const html = renderPortableText([
      {
        type: "splitMedia",
        media: { url: "https://cdn.example.com/img.jpg", id: "m_42" },
        side: "left",
        heading: "",
        body: "",
        ctaLabel: "",
        ctaUrl: "",
      },
    ])
    expect(html).toContain('data-media-id="m_42"')
    expect(html).toContain("https://cdn.example.com/img.jpg")
  })
})

describe("testimonial section block", () => {
  test("renders quote, name, role, and avatar", () => {
    const html = renderPortableText([
      {
        type: "testimonial",
        quote: "It changed everything.",
        name: "Jane Doe",
        role: "CTO",
        avatar: "https://cdn.example.com/jane.jpg",
      },
    ])
    expect(html).toContain("nac-band")
    expect(html).toContain("nac-testimonial-block")
    expect(html).toContain("nac-container")
    expect(html).toContain('<figure class="nac-testimonial">')
    expect(html).toContain("nac-quote")
    expect(html).toContain("It changed everything.")
    expect(html).toContain("nac-quote-by")
    expect(html).toContain("nac-quote-avatar")
    expect(html).toContain("https://cdn.example.com/jane.jpg")
    expect(html).toContain("nac-quote-name")
    expect(html).toContain("Jane Doe")
    expect(html).toContain("nac-quote-role")
    expect(html).toContain("CTO")
  })

  test("testimonial omits avatar img when avatar is empty", () => {
    const html = renderPortableText([
      { type: "testimonial", quote: "Great.", name: "Bob", role: "", avatar: "" },
    ])
    expect(html).not.toContain("nac-quote-avatar")
  })

  test("testimonial omits role span when role is empty", () => {
    const html = renderPortableText([
      { type: "testimonial", quote: "Great.", name: "Bob", role: "", avatar: "" },
    ])
    expect(html).not.toContain("nac-quote-role")
  })

  test("testimonial escapes html in all text fields", () => {
    const html = renderPortableText([
      {
        type: "testimonial",
        quote: "<script>bad</script>",
        name: "<b>Name</b>",
        role: "<i>r</i>",
        avatar: "",
      },
    ])
    expect(html).not.toContain("<script>")
    expect(html).not.toContain("<b>Name")
    expect(html).toContain("&lt;script&gt;")
  })

  test("testimonial sanitizes dangerous avatar urls", () => {
    const html = renderPortableText([
      { type: "testimonial", quote: "q", name: "n", role: "", avatar: "javascript:alert(1)" },
    ])
    expect(html).not.toContain("javascript:")
    expect(html).toContain('src="#"')
  })
})

describe("collectionList section block", () => {
  test("renders a card linking to the document path, with cover, title, excerpt, and formatted date", () => {
    const html = renderPortableText(
      [
        {
          type: "collectionList",
          collection: "blog_post",
          layout: "grid",
          showCover: true,
          showExcerpt: true,
          showDate: true,
          heading: "",
          limit: 3,
          filterTag: "",
        },
      ],
      "web",
      {
        apiBase: "http://api",
        collectionData: {
          0: [
            {
              id: "1",
              title: "Post A",
              slug: "a",
              excerpt: "X",
              coverImage: "img1",
              publishedAt: "2026-01-01",
            },
          ],
        },
      },
    )
    expect(html).toContain("nac-collection-block")
    expect(html).toContain("nac-collection")
    expect(html).toContain('href="/blog/a"')
    expect(html).toContain("nac-collection-cover")
    expect(html).toContain("http://api/api/media/img1/file")
    expect(html).toContain("nac-collection-title")
    expect(html).toContain("Post A")
    expect(html).toContain("nac-collection-excerpt")
    expect(html).toContain("X")
    expect(html).toContain("nac-collection-date")
    expect(html).toContain("January 1, 2026")
  })

  test("showCover:false omits the cover image", () => {
    const html = renderPortableText(
      [
        {
          type: "collectionList",
          collection: "blog_post",
          showCover: false,
          showExcerpt: true,
          showDate: true,
        },
      ],
      "web",
      {
        apiBase: "http://api",
        collectionData: {
          0: [
            {
              id: "1",
              title: "Post A",
              slug: "a",
              excerpt: "X",
              coverImage: "img1",
              publishedAt: "2026-01-01",
            },
          ],
        },
      },
    )
    expect(html).not.toContain("nac-collection-cover")
    expect(html).toContain("nac-collection-title")
  })

  test("showExcerpt:false omits the excerpt", () => {
    const html = renderPortableText(
      [
        {
          type: "collectionList",
          collection: "blog_post",
          showCover: true,
          showExcerpt: false,
          showDate: true,
        },
      ],
      "web",
      {
        apiBase: "http://api",
        collectionData: {
          0: [
            {
              id: "1",
              title: "Post A",
              slug: "a",
              excerpt: "X",
              coverImage: "img1",
              publishedAt: "2026-01-01",
            },
          ],
        },
      },
    )
    expect(html).not.toContain("nac-collection-excerpt")
    expect(html).toContain("nac-collection-title")
  })

  test("showDate:false omits the date", () => {
    const html = renderPortableText(
      [
        {
          type: "collectionList",
          collection: "blog_post",
          showCover: true,
          showExcerpt: true,
          showDate: false,
        },
      ],
      "web",
      {
        apiBase: "http://api",
        collectionData: {
          0: [
            {
              id: "1",
              title: "Post A",
              slug: "a",
              excerpt: "X",
              coverImage: "img1",
              publishedAt: "2026-01-01",
            },
          ],
        },
      },
    )
    expect(html).not.toContain("nac-collection-date")
    expect(html).toContain("nac-collection-title")
  })

  test("no collectionData renders an empty band without throwing", () => {
    const html = renderPortableText(
      [{ type: "collectionList", collection: "blog_post", heading: "Posts" }],
      "web",
    )
    expect(html).toContain("nac-collection-block")
    expect(html).toContain("nac-collection")
    expect(html).toContain("Posts")
    expect(html).not.toContain("nac-collection-card")
  })

  test("invalid layout clamps to grid", () => {
    const html = renderPortableText(
      [{ type: "collectionList", collection: "blog_post", layout: "unknown" }],
      "web",
      { apiBase: "http://api", collectionData: { 0: [] } },
    )
    expect(html).toContain('data-layout="grid"')
  })

  test("list layout is honored", () => {
    const html = renderPortableText(
      [{ type: "collectionList", collection: "blog_post", layout: "list" }],
      "web",
      { apiBase: "http://api", collectionData: { 0: [] } },
    )
    expect(html).toContain('data-layout="list"')
  })

  test("cards layout is honored", () => {
    const html = renderPortableText(
      [{ type: "collectionList", collection: "blog_post", layout: "cards" }],
      "web",
      { apiBase: "http://api", collectionData: { 0: [] } },
    )
    expect(html).toContain('data-layout="cards"')
  })

  test("heading is rendered when provided", () => {
    const html = renderPortableText(
      [{ type: "collectionList", collection: "blog_post", heading: "Latest posts" }],
      "web",
      { apiBase: "http://api", collectionData: { 0: [] } },
    )
    expect(html).toContain("nac-section-heading")
    expect(html).toContain("Latest posts")
  })

  test("heading is omitted when empty", () => {
    const html = renderPortableText(
      [{ type: "collectionList", collection: "blog_post", heading: "" }],
      "web",
      { apiBase: "http://api", collectionData: { 0: [] } },
    )
    expect(html).not.toContain("nac-section-heading")
  })

  test("falls back to created_at for date when publishedAt is absent", () => {
    const html = renderPortableText(
      [{ type: "collectionList", collection: "blog_post", showDate: true }],
      "web",
      {
        apiBase: "http://api",
        collectionData: {
          0: [{ id: "1", title: "Post B", slug: "b", created_at: "2025-06-15" }],
        },
      },
    )
    expect(html).toContain("nac-collection-date")
    expect(html).toContain("June 15, 2025")
  })

  test("escapes html in title and excerpt", () => {
    const html = renderPortableText(
      [{ type: "collectionList", collection: "blog_post", showExcerpt: true }],
      "web",
      {
        apiBase: "http://api",
        collectionData: {
          0: [{ id: "1", title: "<script>bad</script>", slug: "b", excerpt: "<b>xss</b>" }],
        },
      },
    )
    expect(html).not.toContain("<script>bad")
    expect(html).not.toContain("<b>xss")
    expect(html).toContain("&lt;script&gt;")
    expect(html).toContain("&lt;b&gt;")
  })
})
