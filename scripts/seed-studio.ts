#!/usr/bin/env bun
export {}
/**
 * Seed script for the Atelier studio site.
 *
 * Creates and publishes professional content in the project, blog_post, and page
 * collections so the dark landing page renders a composed portfolio.
 *
 * Re-runnable: existing documents with the same slug are skipped.
 *
 * Usage: bun scripts/seed-studio.ts
 */

const API = "http://localhost:4341"
const EMAIL = "founder@atelier.dev"

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function signIn(): Promise<string> {
  console.log(`  Authenticating as ${EMAIL}...`)

  const signInRes = await fetch(`${API}/api/auth/sign-in/magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: API },
    body: JSON.stringify({ email: EMAIL, callbackURL: `${API}/` }),
  })
  if (!signInRes.ok) {
    throw new Error(`Sign-in failed: ${signInRes.status} ${await signInRes.text()}`)
  }

  // Retrieve the magic link via the test endpoint
  const linkRes = await fetch(`${API}/api/_test/magic-link?email=${encodeURIComponent(EMAIL)}`)
  if (!linkRes.ok) {
    throw new Error(`Magic-link fetch failed: ${linkRes.status} ${await linkRes.text()}`)
  }
  const { url: magicUrl } = await linkRes.json() as { url: string }
  if (!magicUrl) throw new Error("No magic link URL returned")

  // Follow the magic link (manual redirect so we can capture the Set-Cookie header)
  const parsed = new URL(magicUrl)
  const verifyRes = await fetch(`${API}${parsed.pathname}${parsed.search}`, {
    redirect: "manual",
    headers: { origin: API },
  })
  const cookie = verifyRes.headers.get("set-cookie")
  if (!cookie) throw new Error("No session cookie returned from verify step")

  console.log("  Authenticated.")
  return cookie
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function apiPost(cookie: string, path: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      origin: API,
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let data: unknown
  try { data = JSON.parse(text) } catch { data = text }
  if (!res.ok) {
    throw new Error(`POST ${path} failed (${res.status}): ${text}`)
  }
  return data as Record<string, unknown>
}

async function publish(cookie: string, collection: string, id: string): Promise<void> {
  await apiPost(cookie, `/api/${collection}/${id}/workflow`, { action: "publish" })
}

/** Create a document and publish it. Returns the created doc. Skips if slug exists. */
async function createAndPublish(
  cookie: string,
  collection: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const slug = payload.slug as string

  // Check if slug already exists
  const checkRes = await fetch(`${API}/api/${collection}?where[slug]=${encodeURIComponent(slug)}`, {
    headers: { Cookie: cookie },
  })
  if (checkRes.ok) {
    const existing = await checkRes.json() as { data: unknown[] }
    if (existing.data && existing.data.length > 0) {
      console.log(`    [SKIP] ${collection}/${slug} already exists`)
      return null
    }
  }

  const doc = await apiPost(cookie, `/api/${collection}`, payload)
  const id = String(doc.id)
  await publish(cookie, collection, id)
  console.log(`    [OK]   ${collection}/${slug} (id: ${id})`)
  return doc
}

// ---------------------------------------------------------------------------
// Portable Text helpers
// ---------------------------------------------------------------------------

function paragraph(text: string) {
  return { type: "paragraph", children: [{ type: "text", value: text }] }
}

function heading(level: number, text: string) {
  return { type: "heading", level, children: [{ type: "text", value: text }] }
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

const projects = [
  {
    title: "Morrow Brand Identity",
    slug: "morrow-brand-identity",
    summary: "A full brand identity system for a Stockholm-based architecture firm, built around geometric clarity and editorial restraint.",
    year: "2025",
    role: "Brand, Print, Digital",
    body: [
      heading(2, "The Brief"),
      paragraph(
        "Morrow Architecture came to us with a strong point of view but a fragmented visual presence. They needed a system that could carry their ideas across pitch decks, construction documents, and public-facing work with equal authority.",
      ),
      heading(2, "Approach"),
      paragraph(
        "We anchored the identity in a single typeface used at three weights. The logomark is a simple geometric device derived from the firm's structural grid method. Colour is monochromatic: off-white, near-black, and one amber accent reserved for structural callouts.",
      ),
      paragraph(
        "The system scales from a business card to a 200-page monograph without alteration. Every component was documented in a 40-page brand manual delivered alongside editable templates.",
      ),
    ],
  },
  {
    title: "Fieldwork Digital Platform",
    slug: "fieldwork-digital-platform",
    summary: "Product design and front-end development for a research-data platform used by environmental scientists across three continents.",
    year: "2024",
    role: "UX, Product Design, Development",
    body: [
      heading(2, "Context"),
      paragraph(
        "Fieldwork is a data-collection platform for scientists working in remote conditions. The challenge: a dense information hierarchy that had to be navigable on a 10-inch tablet in sunlight, with gloves on.",
      ),
      heading(2, "Design Decisions"),
      paragraph(
        "We redesigned the information architecture from the ground up, collapsing six navigation levels into three. Every interactive target was enlarged to 48px minimum. The colour system was tested against direct-sunlight contrast ratios, not just WCAG.",
      ),
      paragraph(
        "The result was a 40% reduction in task-completion time in user testing. The platform now handles 12,000 active field sessions per month.",
      ),
    ],
  },
  {
    title: "Vela Editorial System",
    slug: "vela-editorial-system",
    summary: "A modular editorial design system for a pan-European culture magazine, spanning print, web, and social channels.",
    year: "2025",
    role: "Editorial Design, Type Direction",
    body: [
      heading(2, "The Publication"),
      paragraph(
        "Vela publishes long-form cultural criticism across six European markets. Before our engagement, the design was rebuilt from scratch for each issue. The team needed a living system: opinionated enough to read as Vela, flexible enough for any story.",
      ),
      heading(2, "System Architecture"),
      paragraph(
        "We designed a typographic grid with three layout registers: essay (single-column, generous leading), feature (two-column, image-dominant), and data (tight grid, tabular). Each register has its own spacing rhythm but shares the same baseline.",
      ),
      paragraph(
        "The web system mirrors the print grid using CSS custom properties. A single token change updates spacing across both channels. The first issue built on the new system shipped six days ahead of schedule.",
      ),
    ],
  },
  {
    title: "Sable Packaging System",
    slug: "sable-packaging-system",
    summary: "Structural and graphic design for a zero-waste skincare range, from carton architecture to retail presentation.",
    year: "2024",
    role: "Packaging Design, Art Direction",
    body: [
      heading(2, "The Challenge"),
      paragraph(
        "Sable produces skincare without plastics. The packaging itself had to be the proof of concept: beautiful enough to justify a premium price point, structural enough to survive supply chains, and compostable at end of life.",
      ),
      heading(2, "Outcome"),
      paragraph(
        "We developed a flat-pack carton structure using single-ply board that assembles without adhesive. The graphic language is minimal: blind emboss on natural board, one-colour print. The product range earned a Red Dot commendation in its launch year.",
      ),
      paragraph(
        "The structural files are open-sourced so other small brands can adopt the architecture. Sable now ships to 22 countries.",
      ),
    ],
  },
]

// ---------------------------------------------------------------------------
// Blog posts
// ---------------------------------------------------------------------------

const posts = [
  {
    title: "On Designing for Constraint",
    slug: "designing-for-constraint",
    excerpt: "Limitations are not obstacles to good design. They are its precondition.",
    tags: ["process", "thinking"],
    body: [
      heading(2, "The Myth of the Blank Canvas"),
      paragraph(
        "Designers often speak of constraints as if removing them would unlock better work. In practice the opposite is true. Unconstrained briefs produce meandering work. Constraint forces the question: what matters most?",
      ),
      paragraph(
        "Every project we take on begins with an audit of the real constraints. Not just budget and timeline, but material, context, audience, and legacy. The clearer the constraint map, the faster the studio reaches a resolved position.",
      ),
    ],
  },
  {
    title: "Typography at the Edge",
    slug: "typography-at-the-edge",
    excerpt: "Type decisions are architecture decisions. They determine how information is held, how it breathes, and whether it is trusted.",
    tags: ["typography", "craft"],
    body: [
      heading(2, "Type as Structure"),
      paragraph(
        "We start every engagement by choosing a single typeface and exploring its full range before adding a second. Most well-made typefaces contain more variety than a design needs. The discipline of staying within one family forces genuine typographic decisions rather than decorative ones.",
      ),
      paragraph(
        "Size, weight, spacing, and measure are the variables. Colour is a last resort. If a hierarchy cannot be communicated through those four dimensions, it is not yet a resolved hierarchy.",
      ),
    ],
  },
  {
    title: "The Studio Year: 2025 in Review",
    slug: "studio-year-2025",
    excerpt: "Four projects, two new collaborators, and one belief confirmed: slower is faster.",
    tags: ["studio", "process"],
    body: [
      heading(2, "What We Built"),
      paragraph(
        "2025 was the year we took on fewer projects and went deeper into each one. The Morrow identity ran for seven months. Vela has been a relationship across two years now. We closed no project in less than twelve weeks.",
      ),
      paragraph(
        "The studio added two collaborators: a motion designer whose sensibility sharpens our print work, and a researcher who conducts audience studies we use to pressure-test design decisions. Both changes improved the work immediately.",
      ),
    ],
  },
]

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

const homePage = {
  title: "Home",
  slug: "home",
  body: [
    {
      type: "hero",
      eyebrow: "INDEPENDENT DESIGN STUDIO",
      headline: "We make the visual language of serious work.",
      subheadline:
        "Atelier is a small studio working at the intersection of brand, editorial, and digital. We take on fewer projects so we can go deeper into each one.",
      align: "left",
      backgroundImage: "",
      overlay: true,
    },
    {
      type: "stats",
      columns: 3,
      items: [
        { value: "12", label: "Years of practice" },
        { value: "40+", label: "Projects delivered" },
        { value: "3", label: "Cities, one studio" },
      ],
    },
    {
      type: "collectionList",
      collection: "project",
      limit: 6,
      filterTag: "",
      layout: "cards",
      showCover: false,
      showExcerpt: true,
      showDate: false,
      heading: "Selected work",
    },
    {
      type: "featureGrid",
      columns: 3,
      items: [
        {
          icon: "",
          title: "Brand",
          text: "Identity systems that hold up at every scale. Wordmarks, type direction, colour, motion, and the brand manual that governs it all.",
        },
        {
          icon: "",
          title: "Digital",
          text: "Product design and front-end development for platforms where information density and usability are not a trade-off.",
        },
        {
          icon: "",
          title: "Editorial",
          text: "Publication design for print and screen. Grid systems, typographic hierarchies, and the templates that make consistency sustainable.",
        },
      ],
    },
    {
      type: "testimonial",
      quote:
        "Atelier understood the problem before we did. They delivered a system we have been using without modification for two years.",
      name: "Lena Brandt",
      role: "Partner, Morrow Architecture",
      avatar: "",
    },
    {
      type: "cta",
      label: "Start a project",
      url: "/contact",
      variant: "primary",
    },
  ],
}

const aboutPage = {
  title: "Studio",
  slug: "about",
  body: [
    heading(2, "An independent studio since 2013"),
    paragraph(
      "Atelier was founded on the conviction that smaller means better. A four-person studio can be present at every decision, accountable for every pixel, and honest about every trade-off. We have stayed deliberately small for twelve years.",
    ),
    paragraph(
      "We work with organisations at inflection points: companies redefining their category, publications building for a new medium, product teams who need the design to carry the engineering.",
    ),
    paragraph(
      "Our practice is rooted in print. We believe that editorial discipline, typographic rigour, and the constraint of the physical page make digital work stronger. Every screen we design is legible at arm's length.",
    ),
    {
      type: "stats",
      columns: 3,
      items: [
        { value: "2013", label: "Founded" },
        { value: "4", label: "Core team" },
        { value: "100%", label: "Independent" },
      ],
    },
    {
      type: "featureGrid",
      columns: 3,
      items: [
        {
          icon: "",
          title: "Brand Strategy",
          text: "Positioning, naming, and the conceptual foundation before a mark is drawn.",
        },
        {
          icon: "",
          title: "Visual Identity",
          text: "Logotype, colour, typography, motion, and the system that connects them.",
        },
        {
          icon: "",
          title: "Digital Product",
          text: "From wireframe to coded component. We build what we design.",
        },
      ],
    },
  ],
}

const contactPage = {
  title: "Contact",
  slug: "contact",
  body: [
    heading(2, "Start a conversation"),
    paragraph(
      "We take on three to four new projects per year. If the timing and the problem are right, we would like to hear from you.",
    ),
    paragraph("Write to us: studio@atelier.dev"),
    paragraph(
      "We read every message and respond within two business days. If your brief is under NDA, say so in the first line and we will acknowledge receipt before you share anything confidential.",
    ),
    heading(2, "For press and speaking"),
    paragraph("Press enquiries and speaking invitations: press@atelier.dev"),
  ],
}

const workPage = {
  title: "Work",
  slug: "work",
  body: [
    {
      type: "hero",
      eyebrow: "SELECTED WORK",
      headline: "Work",
      subheadline: "A few recent projects.",
      align: "left",
      backgroundImage: "",
      overlay: true,
    },
    {
      type: "collectionList",
      collection: "project",
      limit: 12,
      filterTag: "",
      layout: "cards",
      showCover: false,
      showExcerpt: true,
      showDate: false,
      heading: "",
    },
  ],
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n  Seeding Atelier studio...\n")

  const cookie = await signIn()

  // Projects
  console.log("\n  Creating projects...")
  for (const project of projects) {
    await createAndPublish(cookie, "project", project)
  }

  // Blog posts
  console.log("\n  Creating journal posts...")
  for (const post of posts) {
    await createAndPublish(cookie, "blog_post", post)
  }

  // Pages
  console.log("\n  Creating pages...")
  await createAndPublish(cookie, "page", homePage)
  await createAndPublish(cookie, "page", aboutPage)
  await createAndPublish(cookie, "page", contactPage)
  await createAndPublish(cookie, "page", workPage)

  console.log("\n  Seed complete.\n")
}

main().catch((err) => {
  console.error("\n  SEED FAILED:", err.message)
  process.exit(1)
})
