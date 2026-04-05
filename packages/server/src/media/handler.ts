import type { createLocalStorage } from "./storage"

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export function createMediaHandler(storage: ReturnType<typeof createLocalStorage>) {
  return async function handleMedia(req: Request): Promise<Response | null> {
    const url = new URL(req.url)
    if (!url.pathname.startsWith("/api/media")) return null

    const parts = url.pathname.replace("/api/media", "").split("/").filter(Boolean)
    const subpath = parts[0]

    if (req.method === "POST" && (subpath === "upload" || !subpath)) {
      const formData = await req.formData()
      const file = formData.get("file") as File | null
      if (!file) return json({ error: "No file provided" }, 400)
      const record = await storage.store(file)
      return json(record, 201)
    }

    if (req.method === "GET" && !subpath) {
      return json({ data: storage.list() })
    }

    if (req.method === "GET" && subpath) {
      const record = storage.get(subpath)
      if (!record) return json({ error: "Not found" }, 404)
      return json(record)
    }

    if (req.method === "DELETE" && subpath) {
      const deleted = storage.remove(subpath)
      return json({ deleted })
    }

    return json({ error: "Method not allowed" }, 405)
  }
}
