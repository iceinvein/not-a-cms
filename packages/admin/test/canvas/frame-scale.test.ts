import { describe, expect, test } from "bun:test"
import { DESKTOP_BASE_WIDTH, frameLayout } from "../../src/components/continuum/canvas/frame-scale"

describe("frameLayout", () => {
  test("tablet renders at its true 834px width and scales down when the stage is narrower", () => {
    expect(frameLayout(1280, "tablet")).toEqual({ layoutWidth: 834, scale: 1 })
    const narrow = frameLayout(662, "tablet")
    expect(narrow.layoutWidth).toBe(834)
    expect(narrow.scale).toBeCloseTo(662 / 834, 5)
  })

  test("mobile renders at its true 390px width and never upscales past 1", () => {
    expect(frameLayout(662, "mobile")).toEqual({ layoutWidth: 390, scale: 1 })
    const tiny = frameLayout(300, "mobile")
    expect(tiny.layoutWidth).toBe(390)
    expect(tiny.scale).toBeCloseTo(300 / 390, 5)
  })

  test("desktop stays fluid when the stage is at least the desktop base width", () => {
    expect(frameLayout(1700, "desktop")).toEqual({ layoutWidth: 1700, scale: 1 })
    expect(frameLayout(DESKTOP_BASE_WIDTH, "desktop")).toEqual({
      layoutWidth: DESKTOP_BASE_WIDTH,
      scale: 1,
    })
  })

  test("desktop renders at the desktop base width and scales down on a narrow stage", () => {
    const narrow = frameLayout(662, "desktop")
    expect(narrow.layoutWidth).toBe(DESKTOP_BASE_WIDTH)
    expect(narrow.scale).toBeCloseTo(662 / DESKTOP_BASE_WIDTH, 5)
  })

  test("guards against a zero/unknown stage width by not scaling", () => {
    expect(frameLayout(0, "tablet")).toEqual({ layoutWidth: 834, scale: 1 })
    expect(frameLayout(0, "desktop")).toEqual({ layoutWidth: DESKTOP_BASE_WIDTH, scale: 1 })
  })
})
