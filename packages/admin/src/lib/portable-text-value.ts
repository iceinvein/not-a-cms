/**
 * Coerce a stored field value into a Portable Text block array, or undefined.
 * Accepts an array as-is, parses a JSON string, and rejects anything else.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function portableTextValue(value: unknown): any[] | undefined {
  if (Array.isArray(value)) return value
  if (typeof value !== "string" || !value.trim()) return undefined
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}
