import type { CollectionDef } from "./types"
import type { ExtensionManifest } from "./extensions/manifest"
import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

export type CMSConfig = {
  site?: {
    name?: string
    url?: string
    nav?: {
      links?: Array<{ label: string; href: string; external?: boolean }>
      cta?: { label: string; href: string }
    }
    footer?: {
      tagline?: string
      columns?: Array<{ heading: string; links: Array<{ label: string; href: string; external?: boolean }> }>
      social?: Array<{ label: string; href: string }>
      legal?: string
    }
  }
  port?: number
  database?: {
    provider?: "sqlite" | "postgres"
    url: string
  }
  storage?: {
    provider: "local" | "s3" | "r2"
    path?: string
    bucket?: string
    endpoint?: string
    region?: string
    accessKeyId?: string
    secretAccessKey?: string
    publicUrl?: string
    prefix?: string
  }
  auth?: {
    methods?: Array<"passkey" | "magic-link" | "oauth">
    oauth?: {
      github?: { clientId: string; clientSecret: string }
      google?: { clientId: string; clientSecret: string }
    }
    magicLink?: {
      from?: string
    }
  }
  collections: CollectionDef[]
  extensions?: ExtensionManifest[]
  rendering?: Record<string, { mode: "ssg" | "ssr" | "isr"; revalidate?: number }>
  routes?: RouteConfig[]
  theme?: unknown
  channels?: ChannelConfig
}

export type RouteConfig = {
  collection: string
  path: string
  slug?: string
}

export type ChannelConfig = {
  rss?: {
    title?: string
    description?: string
    language?: string
    collection?: string
    itemPath?: string
  }
  email?: {
    title?: string
    preheader?: string
    footerText?: string
    fromName?: string
    subjectPrefix?: string
  }
}

export function defineConfig<T extends CMSConfig>(config: T): T {
  return config
}

export class ConfigLoadError extends Error {
  constructor(
    message: string,
    public readonly code: "CONFIG_NOT_FOUND" | "CONFIG_IMPORT_FAILED" | "CONFIG_INVALID",
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "ConfigLoadError"
  }
}

export type LoadConfigOptions = {
  cwd?: string
  path?: string
}

export function resolveConfigPath(options: LoadConfigOptions = {}): string {
  const cwd = options.cwd ?? process.cwd()
  const configPath = options.path ? resolve(cwd, options.path) : join(cwd, "not-a-cms.config.ts")

  if (!existsSync(configPath)) {
    throw new ConfigLoadError(`No not-a-cms.config.ts found in ${cwd}`, "CONFIG_NOT_FOUND")
  }

  return configPath
}

export async function loadConfig(options: LoadConfigOptions = {}): Promise<CMSConfig> {
  const configPath = resolveConfigPath(options)
  let mod: { default?: unknown }

  try {
    mod = await import(`${pathToFileURL(configPath).href}?v=${Date.now()}`)
  } catch (error) {
    throw new ConfigLoadError(`Failed to load ${configPath}: ${errorMessage(error)}`, "CONFIG_IMPORT_FAILED", {
      cause: error,
    })
  }

  assertCMSConfig(mod.default)
  return mod.default
}

function assertCMSConfig(config: unknown): asserts config is CMSConfig {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new ConfigLoadError("Config default export must be an object", "CONFIG_INVALID")
  }

  if (!Array.isArray((config as { collections?: unknown }).collections)) {
    throw new ConfigLoadError("Config collections must be an array", "CONFIG_INVALID")
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
