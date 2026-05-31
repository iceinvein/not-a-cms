import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { magicLink } from "better-auth/plugins"
import type { AppDatabase } from "@not-a-cms/core"
import { authSchema } from "./schema"

type MagicLinkSender = (params: { email: string; url: string; token: string }) => Promise<void>

export type OAuthProviderKey = "github" | "google"

export type AuthCapabilities = {
  magicLink: boolean
  oauthProviders: OAuthProviderKey[]
  passkey: boolean
}

export type AuthConfig = {
  db: AppDatabase
  secret: string
  baseURL: string
  trustedOrigins?: string[]
  magicLink: {
    sendMagicLink: MagicLinkSender
    expiresIn?: number
  }
  oauth?: {
    github?: { clientId: string; clientSecret: string }
    google?: { clientId: string; clientSecret: string }
  }
}

export function getAuthCapabilities(config: AuthConfig): AuthCapabilities {
  const oauthProviders: OAuthProviderKey[] = []
  if (config.oauth?.github?.clientId && config.oauth.github.clientSecret) oauthProviders.push("github")
  if (config.oauth?.google?.clientId && config.oauth.google.clientSecret) oauthProviders.push("google")

  return {
    magicLink: true,
    oauthProviders,
    passkey: false,
  }
}

export function createAuth(config: AuthConfig) {
  const auth = betterAuth({
    secret: config.secret,
    baseURL: config.baseURL,
    trustedOrigins: config.trustedOrigins,
    database: drizzleAdapter(config.db, { provider: "sqlite", schema: authSchema }),
    emailAndPassword: { enabled: false },
    plugins: [
      magicLink({
        sendMagicLink: config.magicLink.sendMagicLink,
        expiresIn: config.magicLink.expiresIn ?? 600,
      }),
    ],
    socialProviders: {
      ...(config.oauth?.github && {
        github: {
          clientId: config.oauth.github.clientId,
          clientSecret: config.oauth.github.clientSecret,
        },
      }),
      ...(config.oauth?.google && {
        google: {
          clientId: config.oauth.google.clientId,
          clientSecret: config.oauth.google.clientSecret,
        },
      }),
    },
  })
  return auth
}
