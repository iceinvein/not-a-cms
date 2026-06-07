/**
 * The brand design layer as a string, so it can be both injected into the public
 * layout's <head> and inlined into the admin's channel-mirror iframe for a faithful
 * preview. The active theme's CSS variables are injected separately (see theme-css.ts),
 * merged over the bundled default; the var() usages here carry defaults as fallbacks
 * for the build/offline case. Do NOT add a :root here, or it would override the
 * injected theme.
 */
export const brandCss = `
html {
  background-color: var(--paper, #faf8f4);
}

body {
  font-family: var(--font-body, "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  -webkit-font-smoothing: antialiased;
  /* Contain the full-bleed section bands' 100vw breakout. */
  overflow-x: hidden;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-display, "Fraunces", Georgia, "Times New Roman", serif);
  letter-spacing: -0.015em;
}

/* Theme the typography plugin so authored content inherits the brand. */
.prose {
  --tw-prose-body: var(--body);
  --tw-prose-headings: var(--ink);
  --tw-prose-links: var(--accent);
  --tw-prose-bold: var(--ink);
  --tw-prose-quotes: var(--ink);
  --tw-prose-quote-borders: var(--accent);
  --tw-prose-hr: var(--border);
  --tw-prose-counters: var(--muted);
  --tw-prose-bullets: var(--border);
}

.prose :where(h1, h2, h3, h4):not(:where([class~="not-prose"] *)) {
  font-family: var(--font-display);
}

/* Marketing section blocks (F-012): full-bleed bands with a centered content column.
 * A band breaks out of the surrounding content column to span the full viewport width,
 * so heroes and feature sections go edge-to-edge while body text stays in the column.
 * The inner .nac-container re-constrains the band's content. */
.nac-band {
  width: 100vw;
  margin-left: calc(50% - 50vw);
}

.nac-container {
  max-width: 64rem;
  margin-inline: auto;
  padding-inline: 1.5rem;
}

.nac-hero {
  padding-block: 4.5rem;
  background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 7%, var(--surface)), var(--surface));
  border-block: 1px solid var(--border);
}

.nac-hero[data-align="center"] {
  text-align: center;
}

.nac-hero-eyebrow {
  margin: 0 0 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
}

.nac-hero-headline {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(2rem, 5vw, 3.25rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
  color: var(--ink);
}

.nac-hero-sub {
  margin: 1rem auto 0;
  max-width: 42ch;
  font-size: 1.2rem;
  color: var(--body);
}

.nac-hero[data-align="left"] .nac-hero-sub {
  margin-left: 0;
}

.nac-cta {
  padding-block: 1.25rem;
  text-align: center;
}

.nac-cta-btn {
  display: inline-block;
  padding: 0.8rem 1.6rem;
  font-weight: 600;
  text-decoration: none;
  border-radius: 8px;
  transition: opacity 0.15s ease;
}

.nac-cta-btn[data-variant="primary"] {
  background: var(--accent);
  color: var(--accent-ink);
}

.nac-cta-btn[data-variant="secondary"] {
  background: var(--ink);
  color: var(--paper);
}

.nac-cta-btn[data-variant="outline"] {
  border: 1.5px solid var(--accent);
  color: var(--accent);
}

.nac-cta-btn:hover {
  opacity: 0.9;
}

.nac-features {
  padding-block: 3rem;
}

.nac-feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem;
}

.nac-feature {
  padding: 1.5rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}

.nac-feature-title {
  margin: 0 0 0.5rem;
  font-family: var(--font-display);
  font-size: 1.25rem;
  color: var(--ink);
}

.nac-feature-text {
  margin: 0;
  color: var(--body);
}

.nac-feature-icon {
  margin-bottom: 0.75rem;
  font-size: 1.75rem;
  line-height: 1;
}

/* Hero background image: cover the band, dim with an overlay, lighten the text. */
.nac-hero[data-has-bg="true"] {
  position: relative;
  background-size: cover;
  background-position: center;
  border-block: none;
}

.nac-hero[data-has-bg="true"][data-overlay="true"]::before {
  content: "";
  position: absolute;
  inset: 0;
  background: rgba(20, 15, 10, 0.55);
}

.nac-hero[data-has-bg="true"] .nac-container {
  position: relative;
  z-index: 1;
}

.nac-hero[data-has-bg="true"] .nac-hero-headline,
.nac-hero[data-has-bg="true"] .nac-hero-sub {
  color: #ffffff;
}

.nac-hero[data-has-bg="true"] .nac-hero-eyebrow {
  color: #fcd9b6;
}

/* Feature grid column counts, collapsing on narrow viewports. */
.nac-feature-grid[data-columns="2"] {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.nac-feature-grid[data-columns="3"] {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.nac-feature-grid[data-columns="4"] {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

@media (max-width: 900px) {
  .nac-feature-grid[data-columns="3"],
  .nac-feature-grid[data-columns="4"] {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .nac-feature-grid[data-columns] {
    grid-template-columns: 1fr;
  }
}

/* Stats section block: a grid of large-number/label pairs for social proof. */
.nac-stats {
  padding-block: 3rem;
  text-align: center;
}

.nac-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 2rem;
}

.nac-stat-grid[data-columns="2"] {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.nac-stat-grid[data-columns="3"] {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.nac-stat-grid[data-columns="4"] {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

@media (max-width: 900px) {
  .nac-stat-grid[data-columns="3"],
  .nac-stat-grid[data-columns="4"] {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .nac-stat-grid[data-columns] {
    grid-template-columns: 1fr;
  }
}

.nac-stat-value {
  font-family: var(--font-display, "Fraunces", Georgia, serif);
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--ink);
}

.nac-stat-label {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

/* Logo cloud section block: a centered row of muted partner/customer logos. */
.nac-logo-cloud {
  padding-block: 2.5rem;
  text-align: center;
}

.nac-eyebrow {
  margin: 0 0 1.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.nac-logo-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 2rem;
}

.nac-logo {
  height: 2rem;
  width: auto;
  opacity: 0.5;
  transition: opacity 0.2s ease;
}

.nac-logo:hover {
  opacity: 1;
}

/* Testimonial section block: centered pull-quote with avatar and attribution. */
.nac-testimonial-block {
  padding-block: 4rem;
  text-align: center;
}

.nac-testimonial {
  margin: 0 auto;
  max-width: 44ch;
}

.nac-quote {
  margin: 0 0 1.5rem;
  font-family: var(--font-display, "Fraunces", Georgia, serif);
  font-size: clamp(1.25rem, 3vw, 1.75rem);
  font-style: italic;
  line-height: 1.4;
  color: var(--ink);
}

.nac-quote-by {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
}

.nac-quote-avatar {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: 0.25rem;
}

.nac-quote-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--ink);
}

.nac-quote-role {
  font-size: 0.8rem;
  color: var(--muted);
}

/* FAQ section block: constrained column of collapsible question/answer pairs. */
.nac-faq-block {
  padding-block: 3rem;
}

.nac-section-heading {
  margin: 0 0 2rem;
  font-family: var(--font-display, "Fraunces", Georgia, serif);
  font-size: clamp(1.5rem, 3.5vw, 2.25rem);
  letter-spacing: -0.02em;
  color: var(--ink);
}

.nac-faq {
  max-width: 52ch;
  margin-inline: auto;
}

.nac-faq-item {
  border-bottom: 1px solid var(--border);
  padding-block: 0.75rem;
  list-style: none;
}

.nac-faq-item:first-child {
  border-top: 1px solid var(--border);
}

.nac-faq-q {
  cursor: pointer;
  font-family: var(--font-display, "Fraunces", Georgia, serif);
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--ink);
  list-style: none;
  padding-block: 0.25rem;
  user-select: none;
}

.nac-faq-q::-webkit-details-marker {
  display: none;
}

.nac-faq-a {
  margin-top: 0.5rem;
  padding-bottom: 0.25rem;
  color: var(--body, var(--muted));
  font-size: 0.95rem;
  line-height: 1.6;
}

/* Pricing cards section block: responsive grid of tier cards with an accented highlight. */
.nac-pricing-cards {
  padding-block: 3.5rem;
  text-align: center;
}

.nac-pricing {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 640px) {
  .nac-pricing {
    grid-template-columns: 1fr;
  }
}

.nac-tier {
  padding: 1.75rem 1.5rem;
  border: 1.5px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  text-align: left;
  transition: transform 0.15s ease;
}

.nac-tier[data-highlight="true"] {
  border-color: var(--accent);
  transform: scale(1.025);
  box-shadow: 0 4px 24px color-mix(in srgb, var(--accent) 15%, transparent);
}

.nac-tier-name {
  margin: 0 0 1rem;
  font-family: var(--font-display, "Fraunces", Georgia, serif);
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--ink);
}

.nac-tier-price {
  margin-bottom: 1.25rem;
  font-family: var(--font-display, "Fraunces", Georgia, serif);
  font-size: clamp(2rem, 4vw, 2.75rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1;
  color: var(--ink);
}

.nac-tier-period {
  font-family: var(--font-body, sans-serif);
  font-size: 0.85rem;
  font-weight: 400;
  letter-spacing: 0;
  color: var(--muted);
  margin-left: 0.15em;
}

.nac-tier-features {
  margin: 0 0 1.5rem;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.nac-tier-features li {
  padding-left: 1.25em;
  position: relative;
  font-size: 0.9rem;
  color: var(--body);
}

.nac-tier-features li::before {
  content: "✓";
  position: absolute;
  left: 0;
  color: var(--accent);
  font-weight: 700;
}

.nac-tier .nac-cta-btn {
  display: block;
  text-align: center;
  width: 100%;
  box-sizing: border-box;
}

/* Split media section block: two-column image-and-text layout with optional side reversal. */
.nac-split-block {
  padding-block: 4rem;
}

.nac-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: center;
}

.nac-split[data-side="right"] {
  direction: rtl;
}

.nac-split[data-side="right"] > * {
  direction: ltr;
}

.nac-split-media img {
  width: 100%;
  height: auto;
  border-radius: 12px;
  object-fit: cover;
  display: block;
}

.nac-split-heading {
  margin: 0 0 1rem;
  font-family: var(--font-display, "Fraunces", Georgia, serif);
  font-size: clamp(1.5rem, 3.5vw, 2.25rem);
  letter-spacing: -0.02em;
  line-height: 1.15;
  color: var(--ink);
}

.nac-split-text {
  margin: 0 0 1.5rem;
  font-size: 1.05rem;
  line-height: 1.7;
  max-width: 52ch;
  color: var(--body);
}

.nac-split-body .nac-cta-btn {
  margin-top: 0.25rem;
}

@media (max-width: 768px) {
  .nac-split {
    grid-template-columns: 1fr;
    direction: ltr;
  }

  .nac-split[data-side="right"] {
    direction: ltr;
  }
}
`
