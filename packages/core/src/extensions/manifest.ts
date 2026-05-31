import type { CollectionHooks } from "../types"

export type ExtensionFieldDefinition = {
  name: string
  type: string
  label?: string
  config?: Record<string, unknown>
}

export type ExtensionBlockDefinition = {
  name: string
  label: string
  group?: string
  icon?: string
  schema?: Record<string, unknown>
  editor?: unknown
  toPortableText?: unknown
  extension?: unknown
}

export type ExtensionAdminPanel = {
  label: string
  href: string
  section?: "main" | "bottom"
  order?: number
  icon?: string
}

export type ExtensionManifest = {
  name: string
  version?: string
  fields?: ExtensionFieldDefinition[]
  blocks?: ExtensionBlockDefinition[]
  hooks?: CollectionHooks
  admin?: {
    panels?: ExtensionAdminPanel[]
  }
}

export function defineExtension<T extends ExtensionManifest>(manifest: T): T {
  return manifest
}

export function resolveExtensionManifests(extensions: unknown[] = []): ExtensionManifest[] {
  return extensions.filter(isExtensionManifest)
}

export function collectExtensionFields(extensions: unknown[] = []): ExtensionFieldDefinition[] {
  return resolveExtensionManifests(extensions).flatMap((extension) => extension.fields ?? [])
}

export function collectExtensionBlocks(extensions: unknown[] = []): ExtensionBlockDefinition[] {
  return resolveExtensionManifests(extensions).flatMap((extension) => extension.blocks ?? [])
}

export function collectExtensionAdminPanels(extensions: unknown[] = []): ExtensionAdminPanel[] {
  return resolveExtensionManifests(extensions)
    .flatMap((extension) => extension.admin?.panels ?? [])
    .toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

function isExtensionManifest(value: unknown): value is ExtensionManifest {
  if (!isRecord(value) || typeof value.name !== "string" || value.name.trim() === "") {
    return false
  }

  if ("fields" in value && !isOptionalArray(value.fields)) return false
  if ("blocks" in value && !isOptionalArray(value.blocks)) return false

  if ("admin" in value && value.admin !== undefined) {
    if (!isRecord(value.admin)) return false
    if ("panels" in value.admin && !isOptionalArray(value.admin.panels)) return false
  }

  return true
}

function isOptionalArray(value: unknown): value is unknown[] | undefined {
  return value === undefined || Array.isArray(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
