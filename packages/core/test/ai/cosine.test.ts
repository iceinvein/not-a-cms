import { describe, expect, test } from "bun:test"
import { cosine } from "../../src/ai/cosine"

describe("cosine", () => {
  test("returns 1 for identical vectors", () => {
    expect(cosine(new Float32Array([1, 0, 1]), new Float32Array([1, 0, 1]))).toBeCloseTo(1, 5)
  })

  test("returns 0 for orthogonal vectors", () => {
    expect(cosine(new Float32Array([1, 0]), new Float32Array([0, 1]))).toBeCloseTo(0, 5)
  })

  test("returns 0 for a zero vector instead of NaN", () => {
    expect(cosine(new Float32Array([0, 0]), new Float32Array([1, 1]))).toBe(0)
  })
})
