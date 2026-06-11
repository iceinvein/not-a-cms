// packages/admin/test/canvas/spacing.test.ts
import { describe, expect, test } from "bun:test"
import {
  SPACING_STEPS,
  snapSpacing,
  spacingDataAttr,
  spacingLabel,
} from "../../src/components/continuum/canvas/spacing"

describe("SPACING_STEPS", () => {
  test("is the ordered none..spacious scale", () => {
    expect(SPACING_STEPS).toEqual(["none", "compact", "normal", "spacious"])
  })
})

describe("spacingLabel", () => {
  test("capitalizes the step", () => {
    expect(spacingLabel("none")).toBe("None")
    expect(spacingLabel("spacious")).toBe("Spacious")
  })
})

describe("snapSpacing", () => {
  test("dragging down one step-height increases toward spacious", () => {
    expect(snapSpacing("normal", 30, 28)).toBe("spacious")
  })
  test("dragging up one step-height decreases toward none", () => {
    expect(snapSpacing("normal", -30, 28)).toBe("compact")
  })
  test("no movement keeps the current step", () => {
    expect(snapSpacing("compact", 0, 28)).toBe("compact")
  })
  test("clamps at the ends", () => {
    expect(snapSpacing("spacious", 200, 28)).toBe("spacious")
    expect(snapSpacing("none", -200, 28)).toBe("none")
  })
  test("treats an unknown current step as normal", () => {
    expect(snapSpacing("bogus", 0, 28)).toBe("normal")
  })
})

describe("spacingDataAttr", () => {
  test("emits the attribute only for a real non-default step", () => {
    expect(spacingDataAttr("spacious")).toEqual({ "data-spacing": "spacious" })
    expect(spacingDataAttr("normal")).toEqual({})
    expect(spacingDataAttr(undefined)).toEqual({})
    expect(spacingDataAttr("")).toEqual({})
  })
})
