import { test, expect, describe } from "bun:test"
import { runHook } from "../../src/content/hooks"
import type { CollectionHooks, HookContext } from "../../src/types"

const ctx: HookContext = { collection: "page", db: null }

describe("runHook", () => {
  test("runs a hook and returns modified doc", async () => {
    const hooks: CollectionHooks = {
      beforeSave: (doc) => ({ ...(doc as Record<string, unknown>), modified: true }),
    }
    const result = await runHook("beforeSave", hooks, { title: "Hello" }, ctx)
    expect(result).toEqual({ title: "Hello", modified: true })
  })

  test("returns original doc if hook returns void", async () => {
    const hooks: CollectionHooks = {
      beforeSave: (_doc) => { /* void */ },
    }
    const result = await runHook("beforeSave", hooks, { title: "Hello" }, ctx)
    expect(result).toEqual({ title: "Hello" })
  })

  test("returns original doc if no hook defined", async () => {
    const hooks: CollectionHooks = {}
    const result = await runHook("beforeSave", hooks, { title: "Hello" }, ctx)
    expect(result).toEqual({ title: "Hello" })
  })

  test("handles async hooks", async () => {
    const hooks: CollectionHooks = {
      afterSave: async (doc) => {
        await Promise.resolve()
        return { ...(doc as Record<string, unknown>), processed: true }
      },
    }
    const result = await runHook("afterSave", hooks, { title: "Hello" }, ctx)
    expect(result).toEqual({ title: "Hello", processed: true })
  })
})
