import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { createMagicLinkPayload, LoginForm } from "../../src/components/LoginForm"

describe("LoginForm", () => {
  test("renders configured OAuth providers and hides passkeys when unsupported", () => {
    const html = renderToString(
      <LoginForm
        apiBase="https://cms.example.test"
        initialAuthConfig={{
          magicLink: true,
          oauthProviders: ["github", "google"],
          passkey: false,
        }}
      />,
    )

    expect(html).toContain("Send magic link")
    expect(html).toContain("Continue with GitHub")
    expect(html).toContain("Continue with Google")
    expect(html).not.toContain("Passkey")
  })

  test("sends magic links back to the admin origin", () => {
    expect(createMagicLinkPayload("qa@example.com", "http://localhost:4522/")).toEqual({
      email: "qa@example.com",
      callbackURL: "http://localhost:4522/",
    })
  })
})
