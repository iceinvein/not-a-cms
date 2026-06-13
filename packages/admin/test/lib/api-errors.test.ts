import { describe, expect, test } from "bun:test"
import { AdminApiError, isForbiddenError, messageForAdminResponse } from "../../src/lib/api"

describe("admin API errors", () => {
  test("formats permission errors with useful copy", () => {
    expect(messageForAdminResponse({ status: 401 } as Response)).toBe("Sign in to continue.")
    expect(messageForAdminResponse({ status: 403 } as Response)).toBe(
      "You do not have permission to perform this action.",
    )
    expect(messageForAdminResponse({ status: 500 } as Response, "Load failed")).toBe("Load failed")
  })

  test("AdminApiError carries the HTTP status", () => {
    const err = new AdminApiError(403, "Forbidden")
    expect(err).toBeInstanceOf(Error)
    expect(err.status).toBe(403)
    expect(err.message).toBe("Forbidden")
  })

  test("isForbiddenError is true only for a 403 AdminApiError", () => {
    expect(isForbiddenError(new AdminApiError(403, "Forbidden"))).toBe(true)
    expect(isForbiddenError(new AdminApiError(500, "Server error"))).toBe(false)
    expect(isForbiddenError(new Error("plain"))).toBe(false)
    expect(isForbiddenError(null)).toBe(false)
  })
})
