/**
 * The renderer emits theme custom properties as a `:root { ... }` block. The Visual
 * canvas is not an iframe, so those variables must be scoped to the canvas container
 * instead of the document root, otherwise they would override the admin shell's own
 * variables. The brand stylesheet itself is class-scoped (.nac-*, .prose), so only the
 * variable block needs rescoping.
 */
export function scopeThemeVariables(variables: string, selector: string): string {
  return variables.replace(/:root\b/g, selector)
}
