import { describe, expect, test } from "bun:test"
import * as editorPkg from "../src/index"

describe("editor package surface", () => {
  test("exports SlashExtension and DefinedBlock runtime helpers", () => {
    expect(typeof editorPkg.SlashExtension).not.toBe("undefined")
    expect(typeof editorPkg.defineBlock).toBe("function")
    expect(typeof editorPkg.DEFAULT_COMMANDS).not.toBe("undefined")
  })
})
