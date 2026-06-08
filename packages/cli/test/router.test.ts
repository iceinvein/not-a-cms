import { describe, expect, test } from "bun:test"
import { commands, registerCommand } from "../src/router"

describe("CLI router", () => {
  test("registerCommand adds a command to the registry", () => {
    const initialSize = commands.size
    registerCommand({
      name: "test-cmd",
      description: "A test command",
      run: async () => {},
    })
    expect(commands.size).toBe(initialSize + 1)
    expect(commands.has("test-cmd")).toBe(true)
  })

  test("registered command has correct properties", () => {
    const cmd = commands.get("test-cmd")
    expect(cmd?.name).toBe("test-cmd")
    expect(cmd?.description).toBe("A test command")
    expect(typeof cmd?.run).toBe("function")
  })
})
