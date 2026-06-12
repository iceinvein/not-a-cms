/** Allowlist a user-supplied color so it can never break out of a CSS value. */
export function safeCssColor(color: string): string {
  const value = color.trim()
  if (/^#[0-9a-f]{3,8}$/i.test(value)) return value
  if (/^rgba?\([\d\s.,%]+\)$/i.test(value)) return value
  if (/^hsla?\([\d\s.,%]+\)$/i.test(value)) return value
  return "#38bdf8"
}

/** Pick a readable text color (dark or light) for a hex background; light fallback otherwise. */
export function readableTextColor(color: string): string {
  const hex = expandHex(color)
  if (!hex) return "#fafafa"

  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255
  return luminance > 0.62 ? "#0a0a0c" : "#fafafa"
}

function expandHex(color: string): string | null {
  const match = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!match) return null
  const value = match[1]!
  if (value.length === 6) return value
  return value
    .split("")
    .map((char) => char + char)
    .join("")
}
