import { describe, expect, test } from "bun:test"
import { getSessionFromRequest } from "../../src/auth/middleware"

describe("getSessionFromRequest", () => {
  test("uses persistent role resolver before falling back to auth user role", async () => {
    const auth = {
      api: {
        getSession: async () => ({
          user: { id: "user-1", email: "editor@example.test", role: "viewer" },
        }),
      },
    }

    const session = await getSessionFromRequest(auth, new Request("http://localhost"), {
      getRoleForUser: async (user) => user.id === "user-1" ? "admin" : null,
    })

    expect(session).toEqual({
      userId: "user-1",
      email: "editor@example.test",
      role: "admin",
    })
  })
})
