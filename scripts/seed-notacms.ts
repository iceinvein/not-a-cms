#!/usr/bin/env bun
export {}

/**
 * Seed script for the not-a-cms flagship marketing site.
 *
 * Updates the existing home and pricing pages (found by slug) with richer
 * section blocks. Leaves all other pages and content untouched.
 *
 * Re-runnable: always finds pages by slug and PATCHes them in place.
 * Does NOT change status -- published pages stay published.
 *
 * Usage:
 *   E2E_TEST_AUTH=1 bun scripts/seed-notacms.ts
 *
 * Server must already be running:
 *   E2E_TEST_AUTH=1 bun scripts/dev.ts --site=not-a-cms --port=4341 --admin-port=4342 --renderer-port=3002
 */

const API = "http://localhost:4341"
const EMAIL = "founder@not-a-cms.dev"

// ---------------------------------------------------------------------------
// Auth
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

  const linkRes = await fetch(`${API}/api/_test/magic-link?email=${encodeURIComponent(EMAIL)}`)
  if (!linkRes.ok) {
    throw new Error(`Magic-link fetch failed: ${linkRes.status} ${await linkRes.text()}`)
  }
  const { url: magicUrl } = (await linkRes.json()) as { url: string }
  if (!magicUrl) throw new Error("No magic link URL returned")

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
// Helpers
// ---------------------------------------------------------------------------

async function findPageBySlug(
  cookie: string,
  slug: string,
): Promise<{ id: string; status: string; title: string } | null> {
  const res = await fetch(`${API}/api/page?where[slug]=${encodeURIComponent(slug)}`, {
    headers: { Cookie: cookie },
  })
  if (!res.ok) throw new Error(`List pages failed: ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { data: Array<{ id: string; status: string; title: string }> }
  return data.data?.[0] ?? null
}

async function patchPageBody(
  cookie: string,
  id: string,
  body: unknown[],
): Promise<{ id: string; status: string; slug: string }> {
  const res = await fetch(`${API}/api/page/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      origin: API,
    },
    body: JSON.stringify({ body }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`PATCH /api/page/${id} failed (${res.status}): ${text}`)
  return JSON.parse(text) as { id: string; status: string; slug: string }
}

// ---------------------------------------------------------------------------
// Content: Homepage body
// ---------------------------------------------------------------------------

const homeBody: unknown[] = [
  {
    type: "hero",
    eyebrow: "TYPESCRIPT-NATIVE CMS",
    headline: "The CMS that finally replaced WordPress",
    subheadline:
      "Typed JSON content, real-time collaboration, and automations built in. Self-host anywhere and own your data forever.",
    align: "center",
    backgroundImage: "",
    overlay: true,
  },
  {
    type: "stats",
    columns: 4,
    items: [
      { value: "100%", label: "Typed" },
      { value: "Real-time", label: "Live collaboration" },
      { value: "0", label: "Plugins required" },
      { value: "Self-host", label: "Your infra, your data" },
    ],
  },
  {
    type: "featureGrid",
    columns: 4,
    items: [
      {
        icon: "⚡",
        title: "Typed content",
        text: "Every field is a real database column, and rich text is Portable Text JSON you can render to web, email, or RSS without rework.",
      },
      {
        icon: "🔑",
        title: "Passwordless",
        text: "Magic links and OAuth only. No password database to leak, no reset flows to build, no credential stuffing to worry about.",
      },
      {
        icon: "👥",
        title: "Real-time",
        text: "Y.js CRDTs give you live cursors and offline-safe collaboration out of the box. No extra service to run.",
      },
      {
        icon: "🤖",
        title: "Automations",
        text: "WHEN, IF, THEN rules replace your external automation bill. Trigger on publish, schedule sends, chain actions.",
      },
    ],
  },
  {
    type: "testimonial",
    quote:
      "We migrated from WordPress six months ago and have not looked back. The typed content model alone saved us a full week of integration bugs.",
    name: "Maya Okonkwo",
    role: "Engineering Lead, Fieldwork Labs",
    avatar: "",
  },
  {
    type: "collectionList",
    collection: "blog_post",
    limit: 3,
    filterTag: "",
    layout: "grid",
    showCover: true,
    showExcerpt: true,
    showDate: true,
    heading: "From the blog",
  },
  {
    type: "cta",
    label: "Read the blog",
    url: "/blog",
    variant: "primary",
  },
]

// ---------------------------------------------------------------------------
// Content: Pricing page body
// ---------------------------------------------------------------------------

const pricingBody: unknown[] = [
  {
    type: "paragraph",
    children: [
      {
        type: "text",
        value:
          "not-a-cms is open source and free to self-host. Paid tiers add managed hosting and priority support so you can focus on content, not infrastructure.",
      },
    ],
  },
  {
    type: "pricingCards",
    heading: "Simple, honest pricing",
    tiers: [
      {
        name: "Community",
        price: "$0",
        period: "forever",
        features: [
          "Full collaborative editing",
          "Automations and webhooks",
          "Media library",
          "Self-host on your own infra",
        ],
        ctaLabel: "Get started",
        ctaUrl: "/",
        highlighted: false,
      },
      {
        name: "Team",
        price: "$29",
        period: "per editor / mo",
        features: [
          "Everything in Community",
          "Managed cloud hosting",
          "Automatic daily backups",
          "Email support with 24 h SLA",
        ],
        ctaLabel: "Start a trial",
        ctaUrl: "/",
        highlighted: true,
      },
      {
        name: "Enterprise",
        price: "Custom",
        period: "",
        features: [
          "Everything in Team",
          "SSO and audit logs",
          "Dedicated support channel",
          "Custom SLA and contract",
        ],
        ctaLabel: "Contact us",
        ctaUrl: "/about",
        highlighted: false,
      },
    ],
  },
  {
    type: "faq",
    heading: "Common questions",
    items: [
      {
        question: "Is Community really free forever?",
        answer:
          "Yes. The core engine is MIT-licensed and you can self-host it at no cost indefinitely. We charge only for the managed cloud service.",
      },
      {
        question: "What counts as an editor seat?",
        answer:
          "Any user who can create or edit content. Read-only collaborators and API service accounts do not count toward your seat total.",
      },
      {
        question: "Can I migrate from WordPress?",
        answer:
          "Yes. We provide an importer that converts WordPress XML exports to Portable Text. Most sites migrate in under an hour.",
      },
      {
        question: "Where is my data stored?",
        answer:
          "On the Team plan, data is stored in an EU or US region of your choice. On Community, data lives wherever you run the server.",
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n  Seeding not-a-cms marketing site (update home + pricing)...\n")

  const cookie = await signIn()

  // --- Home page ---
  console.log("\n  Updating home page...")
  const homePage = await findPageBySlug(cookie, "home")
  if (!homePage) throw new Error("Home page not found by slug 'home'")
  console.log(`    Found id=${homePage.id}, status=${homePage.status}`)
  const updatedHome = await patchPageBody(cookie, homePage.id, homeBody)
  console.log(`    PATCH done. status after=${updatedHome.status}`)
  if (updatedHome.status !== "published") {
    throw new Error(
      `SAFETY: home page is no longer published after PATCH (status=${updatedHome.status}). Investigate before proceeding.`,
    )
  }
  console.log("    [OK] home -- still published")

  // --- Pricing page ---
  console.log("\n  Updating pricing page...")
  const pricingPage = await findPageBySlug(cookie, "pricing")
  if (!pricingPage) throw new Error("Pricing page not found by slug 'pricing'")
  console.log(`    Found id=${pricingPage.id}, status=${pricingPage.status}`)
  const updatedPricing = await patchPageBody(cookie, pricingPage.id, pricingBody)
  console.log(`    PATCH done. status after=${updatedPricing.status}`)
  if (updatedPricing.status !== "published") {
    throw new Error(
      `SAFETY: pricing page is no longer published after PATCH (status=${updatedPricing.status}). Investigate before proceeding.`,
    )
  }
  console.log("    [OK] pricing -- still published")

  console.log("\n  Seed complete.\n")
}

main().catch((err) => {
  console.error("\n  SEED FAILED:", err.message)
  process.exit(1)
})
