import { createTRPCClient, httpBatchLink, httpLink, type TRPCClient } from "@trpc/client"
import type { AppRouter } from "./router"

export type NotACMSTRPCClient = TRPCClient<AppRouter>

export type CreateNotACMSTRPCClientOptions = {
  apiBase: string
  batch?: boolean
  fetch?: typeof fetch
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>)
}

export function resolveTRPCUrl(apiBase: string): string {
  const normalized = apiBase.replace(/\/+$/, "")
  return normalized.endsWith("/trpc") ? normalized : `${normalized}/trpc`
}

export function createNotACMSTRPCClient(
  options: CreateNotACMSTRPCClientOptions,
): NotACMSTRPCClient {
  const linkOptions = {
    url: resolveTRPCUrl(options.apiBase),
    fetch: options.fetch,
    headers: options.headers,
  }

  return createTRPCClient<AppRouter>({
    links: [options.batch === false ? httpLink(linkOptions) : httpBatchLink(linkOptions)],
  })
}
