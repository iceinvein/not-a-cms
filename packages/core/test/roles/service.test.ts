import { describe, expect, test } from "bun:test"
import { createRoleService, DEFAULT_ROLE_DEFINITIONS } from "../../src/roles/service"

function createMemorySettings(initial: Record<string, string> = {}) {
  const values = { ...initial }
  return {
    get: (key: string) => values[key] ?? null,
    set: (key: string, value: string) => {
      values[key] = value
    },
    getAll: () => values,
    remove: (key: string) => {
      delete values[key]
    },
  }
}

describe("createRoleService", () => {
  test("returns default role definitions when no setting exists", () => {
    const service = createRoleService(createMemorySettings())

    expect(service.listRoles()).toEqual(DEFAULT_ROLE_DEFINITIONS)
  })

  test("persists and reloads custom role definitions", () => {
    const settings = createMemorySettings()
    const service = createRoleService(settings)

    service.saveRoles([
      ...DEFAULT_ROLE_DEFINITIONS,
      { key: "legal", label: "Legal", description: "Reviews regulated content" },
    ])

    expect(createRoleService(settings).listRoles().map((role) => role.key)).toContain("legal")
  })

  test("rejects invalid role keys", () => {
    const service = createRoleService(createMemorySettings())

    expect(() => service.saveRoles([{ key: "Bad Role", label: "Bad" }])).toThrow("Role keys must use")
  })
})
