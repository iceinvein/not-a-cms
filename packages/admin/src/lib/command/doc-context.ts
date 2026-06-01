export type DocContext = { collection?: string; documentId?: string }

export function parseDocContext(pathname: string): DocContext {
  const segments = pathname.replace(/\/+$/, "").split("/").filter(Boolean)
  if (segments[0] !== "content" || !segments[1]) return {}
  const collection = segments[1]
  const third = segments[2]
  if (!third || third === "new") return { collection }
  return { collection, documentId: third }
}
