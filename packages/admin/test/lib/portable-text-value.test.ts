import { describe, expect, test } from "bun:test"
import { portableTextValue } from "../../src/lib/portable-text-value"

describe("portableTextValue", () => {
  const blocks = [{ type: "paragraph", children: [{ type: "text", value: "hi" }] }]

  test("returns an array value unchanged", () => {
    expect(portableTextValue(blocks)).toEqual(blocks)
  })

  test("parses a JSON string into blocks", () => {
    expect(portableTextValue(JSON.stringify(blocks))).toEqual(blocks)
  })

  test("returns undefined for an empty string", () => {
    expect(portableTextValue("")).toBeUndefined()
  })

  test("returns undefined for non-array JSON", () => {
    expect(portableTextValue('{"not":"an array"}')).toBeUndefined()
  })
})
