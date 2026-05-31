import type { SettingsService } from "../settings/service"

export type RoleDefinition = {
  key: string
  label: string
  description?: string
  system?: boolean
}

const ROLE_SETTING_KEY = "access.roles"
const ROLE_KEY_PATTERN = /^[a-z][a-z0-9_-]*$/

export const DEFAULT_ROLE_DEFINITIONS: RoleDefinition[] = [
  { key: "admin", label: "Admin", description: "Full administrative access", system: true },
  { key: "editor", label: "Editor", description: "Can edit and publish content", system: true },
  { key: "author", label: "Author", description: "Can draft assigned content", system: true },
  { key: "viewer", label: "Viewer", description: "Read-only public access", system: true },
]

type RoleSettings = Pick<SettingsService, "get" | "set">

export function createRoleService(settings: RoleSettings) {
  function listRoles(): RoleDefinition[] {
    const stored = settings.get(ROLE_SETTING_KEY)
    if (!stored) return DEFAULT_ROLE_DEFINITIONS

    try {
      const parsed = JSON.parse(stored)
      if (!Array.isArray(parsed)) return DEFAULT_ROLE_DEFINITIONS
      return normalizeRoles(parsed)
    } catch {
      return DEFAULT_ROLE_DEFINITIONS
    }
  }

  function saveRoles(roles: RoleDefinition[]): RoleDefinition[] {
    const normalized = normalizeRoles(roles)
    settings.set(ROLE_SETTING_KEY, JSON.stringify(normalized))
    return normalized
  }

  return { listRoles, saveRoles }
}

function normalizeRoles(input: RoleDefinition[]): RoleDefinition[] {
  const seen = new Set<string>()
  const roles: RoleDefinition[] = []

  for (const role of input) {
    if (!ROLE_KEY_PATTERN.test(role.key)) {
      throw new Error("Role keys must use lowercase letters, numbers, dashes, or underscores")
    }
    if (seen.has(role.key)) {
      throw new Error(`Duplicate role key "${role.key}"`)
    }
    seen.add(role.key)
    roles.push({
      key: role.key,
      label: role.label.trim() || role.key,
      ...(role.description !== undefined && { description: role.description }),
      ...(role.system !== undefined && { system: role.system }),
    })
  }

  return roles
}
