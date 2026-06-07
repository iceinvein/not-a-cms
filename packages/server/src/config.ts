import type { CMSConfig, LoadConfigOptions } from "@not-a-cms/core"
import type { ServerConfig } from "./index"
import type { StorageConfig } from "./media/storage"

type Env = Record<string, string | undefined>
type ProjectConfig = CMSConfig & {
  components?: ServerConfig["components"]
}

export function resolveConfigLoadOptions(env: Env = process.env): LoadConfigOptions {
  return env.CONFIG_PATH ? { path: env.CONFIG_PATH } : {}
}

export function createServerConfigFromCMSConfig(userConfig: ProjectConfig, env: Env = process.env): ServerConfig {
  const port = parseInt(env.PORT ?? String(userConfig.port ?? 4321), 10)
  const corsOrigins = (env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)

  const testAuthEnabled = env.E2E_TEST_AUTH === "1"
  const e2eMagicLinks = new Map<string, string>()

  return {
    port,
    database: {
      url: userConfig.database?.url ?? env.DATABASE_URL ?? "data.db",
    },
    auth: {
      secret: env.BETTER_AUTH_SECRET ?? "dev-secret-change-me-" + "x".repeat(16),
      baseURL: userConfig.site?.url ?? env.BASE_URL ?? `http://localhost:${port}`,
      trustedOrigins: corsOrigins.length > 0 ? corsOrigins : ["http://localhost:4322", "http://localhost:3000"],
      magicLink: {
        sendMagicLink: async ({ email, url }) => {
          if (testAuthEnabled) e2eMagicLinks.set(email, url)
          console.log(`\n  Magic link for ${email}: ${url}\n`)
        },
      },
      ...resolveOAuth(env),
    },
    email: {
      send: async ({ to, subject, html, text }) => {
        console.log(`\n  Email to ${to}:`)
        console.log(`    Subject: ${subject}`)
        if (text) console.log(`    Text: ${text}`)
        if (html) console.log(`    HTML: ${html}`)
        console.log("")
      },
    },
    storage: resolveServerStorageConfig(userConfig.storage, env),
    collections: userConfig.collections,
    components: userConfig.components ?? [],
    theme: userConfig.theme as ServerConfig["theme"],
    cors: {
      origins: corsOrigins.length > 0 ? corsOrigins : ["http://localhost:4322", "http://localhost:3000"],
    },
    ...(testAuthEnabled
      ? { testAuth: { enabled: true, getMagicLink: (email: string) => e2eMagicLinks.get(email) ?? null } }
      : {}),
  }
}

export function resolveServerStorageConfig(storage: CMSConfig["storage"], env: Env = process.env): StorageConfig | undefined {
  if (storage?.provider === "local") {
    return {
      provider: "local",
      path: storage.path ?? env.MEDIA_STORAGE_PATH ?? env.UPLOADS_DIR ?? "./uploads",
    }
  }

  if (storage?.provider === "s3" || storage?.provider === "r2") {
    return {
      provider: storage.provider,
      path: storage.path ?? env.MEDIA_INDEX_PATH ?? env.STORAGE_INDEX_PATH ?? "./uploads",
      bucket: storage.bucket,
      endpoint: storage.endpoint,
      region: storage.region,
      accessKeyId: storage.accessKeyId,
      secretAccessKey: storage.secretAccessKey,
      publicUrl: storage.publicUrl,
      prefix: storage.prefix,
    }
  }

  return undefined
}

function resolveOAuth(env: Env): Pick<ServerConfig["auth"], "oauth"> {
  const oauth = {
    ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? { github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET } }
      : {}),
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : {}),
  }

  return Object.keys(oauth).length > 0 ? { oauth } : {}
}
