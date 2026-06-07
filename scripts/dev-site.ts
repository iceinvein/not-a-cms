/** Resolve which project config the dev orchestrator should boot. */
export function resolveSiteConfigPath(
  args: string[],
  env: Record<string, string | undefined>,
): string | undefined {
  const fromArg = args.find((a) => a.startsWith("--site="))?.split("=")[1]
  const site = fromArg ?? env.SITE
  if (!site) return env.CONFIG_PATH
  return `dogfood-sites/${site}/not-a-cms.config.ts`
}
