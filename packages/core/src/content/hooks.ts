import type { CollectionHooks, ContentHook, HookContext } from "../types"

type HookName = keyof CollectionHooks

export async function runHook(
  hookName: HookName,
  hooks: CollectionHooks | undefined,
  doc: Record<string, unknown>,
  ctx: HookContext,
): Promise<Record<string, unknown>> {
  const hook = hooks?.[hookName] as ContentHook<unknown> | undefined
  if (!hook) return doc
  const result = await hook(doc, ctx)
  return (result as Record<string, unknown>) ?? doc
}
