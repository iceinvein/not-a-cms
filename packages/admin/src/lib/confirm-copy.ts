/**
 * Copy for a destructive delete confirmation. Always names the target (a specific item by
 * name, a count of items, or a noun) and states that the action can't be undone, so the
 * generic "Are you sure?" prompts the critique flagged are replaced by something specific.
 */
export function confirmDelete(opts: { name?: string; count?: number; noun?: string }): string {
  const noun = opts.noun ?? "item"

  let target: string
  if (opts.name) {
    target = `"${opts.name}"`
  } else if (opts.count !== undefined) {
    target = `${opts.count} ${noun}${opts.count === 1 ? "" : "s"}`
  } else {
    target = `this ${noun}`
  }

  return `Delete ${target}? This can't be undone.`
}
