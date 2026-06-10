// packages/admin/test/canvas/parity.ts
import { expect } from "bun:test"
import type { ReactElement } from "react"
import { renderToString } from "react-dom/server"
import { renderSectionHtml } from "../../src/components/continuum/canvas/render-section"

/**
 * Normalize HTML for parity comparison so a React-rendered tree can be compared
 * structurally to the renderer's raw string output. Reconciles the three benign ways the
 * two serializers differ:
 *  - whitespace/newlines between tags (renderer concatenates, React indents),
 *  - self-closing void elements: renderer emits `<img … />` (space + slash), React emits
 *    `<img …/>`; both are normalized to `<img …>`,
 *  - valueless boolean/data attributes: renderer emits `data-author`, React emits
 *    `data-author=""`; the empty value is stripped so both read `data-author`.
 *  - apostrophes: React numeric-encodes `'` to `&#x27;` in text and attribute values,
 *    while the renderer's escapeHtml leaves `'` raw (it escapes only & < > "); both are
 *    decoded to `'` (covers the hero background `url('…')` and any apostrophe in text).
 */
export function normalizeCanvasHtml(html: string): string {
  return html
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/ (data-[\w-]+)=""/g, " $1")
    .replace(/\s*\/>/g, ">")
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim()
}

/**
 * Assert that a living view's presentational component, rendered in static (non-editable)
 * mode for the given attributes, byte-matches the production renderer for the same block.
 * This is the guard against rendering drift between the canvas and the live site.
 *
 * Always call with fully-populated attributes so both sides render every optional element
 * (the renderer omits empty optional elements; static EditableText does too).
 */
export function expectBlockParity(
  staticView: ReactElement,
  blockName: string,
  attrs: Record<string, unknown>,
): void {
  const living = normalizeCanvasHtml(renderToString(staticView))
  const production = normalizeCanvasHtml(renderSectionHtml(blockName, attrs))
  expect(living).toBe(production)
}
