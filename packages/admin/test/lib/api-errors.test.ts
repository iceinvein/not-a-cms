import { describe, expect, test } from "bun:test"
import { messageForAdminResponse } from "../../src/lib/api"

describe("admin API errors", () => {
  test("formats permission errors with useful copy", () => {
    expect(messageForAdminResponse({ status: 401 } as Response)).toBe("Sign in to continue.")
    expect(messageForAdminResponse({ status: 403 } as Response)).toBe("You do not have permission to perform this action.")
    expect(messageForAdminResponse({ status: 500 } as Response, "Load failed")).toBe("Load failed")
  })
})
