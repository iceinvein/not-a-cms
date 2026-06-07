import { defineTheme } from "./define-theme"

/**
 * The default public theme. Ships a real design layer (warm-neutral palette, a single
 * sharp accent, and a serif/sans font pairing) instead of stock Tailwind defaults, and
 * it is the source of the CSS custom properties the renderer emits (see theme-css.ts),
 * so editing these defaults rebrands the site (F-017).
 */
export const defaultTheme = defineTheme({
  name: "not-a-cms starter",
  version: "1.0.0",
  description: "Warm, paper-like default theme.",
  settings: {
    colors: {
      paper: { type: "color", default: "#faf8f4", label: "Page background" },
      surface: { type: "color", default: "#ffffff", label: "Surface" },
      ink: { type: "color", default: "#1c1917", label: "Headings" },
      body: { type: "color", default: "#44403c", label: "Body text" },
      muted: { type: "color", default: "#78716c", label: "Muted text" },
      border: { type: "color", default: "#e7e2da", label: "Borders" },
      accent: { type: "color", default: "#b4520a", label: "Accent" },
      accentInk: { type: "color", default: "#ffffff", label: "Accent foreground" },
    },
    fonts: {
      display: { type: "text", default: '"Fraunces", Georgia, "Times New Roman", serif', label: "Display font" },
      body: { type: "text", default: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', label: "Body font" },
    },
  },
})
