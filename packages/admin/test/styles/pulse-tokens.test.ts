import { describe, expect, test } from "bun:test"

const css = await Bun.file(`${import.meta.dir}/../../src/styles/global.css`).text()

describe("Pulse motion language in global.css", () => {
  test("declares the motion tokens", () => {
    expect(css).toContain("--pulse-beat-idle")
    expect(css).toContain("--pulse-beat-steady")
    expect(css).toContain("--pulse-beat-brisk")
    expect(css).toContain("--pulse-glow")
  })

  test("declares the keyframes the primitives use", () => {
    expect(css).toContain("@keyframes pulse-beat")
    expect(css).toContain("@keyframes pulse-breathe")
    expect(css).toContain("@keyframes pulse-soft")
  })

  test("styles the primitive classes", () => {
    expect(css).toContain(".pulse-dot")
    expect(css).toContain(".pulse-fresh")
    expect(css).toContain(".pulse-wire")
    expect(css).toContain(".pulse-signal")
  })
})
