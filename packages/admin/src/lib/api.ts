const DEFAULT_API_BASE = "http://localhost:4321"

export type AdminApiFetchOptions = {
  cookie?: string
}

export function getAdminApiBase(): string {
  return (import.meta.env.PUBLIC_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, "")
}

export function adminApiUrl(path: string): string {
  return `${getAdminApiBase()}${path.startsWith("/") ? path : `/${path}`}`
}

export function joinAdminApiUrl(apiBase: string, path: string): string {
  const normalizedBase = apiBase.replace(/\/+$/, "")
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

export function adminTrpcUrl(apiBase = getAdminApiBase()): string {
  const normalizedBase = apiBase.replace(/\/+$/, "")
  return normalizedBase.endsWith("/trpc") ? normalizedBase : `${normalizedBase}/trpc`
}

export function adminApiFetch(
  apiBase: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(joinAdminApiUrl(apiBase, path), { ...init, credentials: "include" })
}

export function messageForAdminResponse(
  response: Response,
  fallback = "The server returned an error.",
): string {
  if (response.status === 401) return "Sign in to continue."
  if (response.status === 403) return "You do not have permission to perform this action."
  return fallback
}

export function createAdminFetchInit(options: AdminApiFetchOptions = {}): RequestInit | undefined {
  if (!options.cookie) return undefined
  return { headers: { cookie: options.cookie } }
}
