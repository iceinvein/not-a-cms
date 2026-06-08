import { useState } from "react"
import { adminApiFetch } from "../lib/api"

type Props = {
  collection: string
  documentId: string
  apiBase?: string
  siteBase?: string
}

export function PreviewLink({
  collection,
  documentId,
  apiBase = "",
  siteBase = "http://localhost:3000",
}: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState<"generate" | "regenerate" | "revoke" | null>(null)
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState("")

  const previewPath = (token: string) => {
    const params = new URLSearchParams({ collection, documentId })
    return `${siteBase}/preview/${token}?${params.toString()}`
  }

  const handleGenerate = async (regenerate = false) => {
    setLoading(regenerate ? "regenerate" : "generate")
    setMessage("")
    try {
      const res = await adminApiFetch(apiBase, "/api/_preview/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection, documentId, regenerate }),
      })
      if (res.ok) {
        const data = await res.json()
        setPreviewUrl(previewPath(data.token))
        setMessage(regenerate ? "Preview link regenerated" : "Preview link ready")
      }
    } catch {
      setMessage("Failed to generate preview")
    } finally {
      setLoading(null)
    }
  }

  const handleRevoke = async () => {
    setLoading("revoke")
    setMessage("")
    try {
      const res = await adminApiFetch(apiBase, "/api/_preview/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection, documentId }),
      })
      if (!res.ok) throw new Error("Failed to revoke preview")
      setPreviewUrl(null)
      setCopied(false)
      setMessage("Preview link revoked")
    } catch {
      setMessage("Failed to revoke preview")
    } finally {
      setLoading(null)
    }
  }

  const handleCopy = async () => {
    if (previewUrl) {
      await navigator.clipboard.writeText(previewUrl)
      setCopied(true)
      setMessage("Copied preview link")
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!previewUrl) {
    return (
      <div className="space-y-2">
        <button
          onClick={() => handleGenerate(false)}
          disabled={loading !== null}
          className="w-full py-2 text-xs font-medium text-[#a1a1aa] border border-[rgba(255,255,255,0.06)] rounded-lg hover:bg-[rgba(255,255,255,0.03)] transition-colors disabled:opacity-50"
        >
          {loading === "generate" ? "Generating..." : "Generate Preview Link"}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleGenerate(true)}
            disabled={loading !== null}
            className="py-1.5 text-xs font-medium text-[#71717a] border border-[rgba(255,255,255,0.06)] rounded-lg hover:bg-[rgba(255,255,255,0.03)] transition-colors disabled:opacity-50"
          >
            {loading === "regenerate" ? "Regenerating..." : "Regenerate"}
          </button>
          <button
            onClick={handleRevoke}
            disabled={loading !== null}
            className="py-1.5 text-xs font-medium text-[#71717a] border border-[rgba(255,255,255,0.06)] rounded-lg hover:bg-[rgba(255,255,255,0.03)] transition-colors disabled:opacity-50"
          >
            {loading === "revoke" ? "Revoking..." : "Revoke"}
          </button>
        </div>
        {message && <p className="text-xs text-[#71717a]">{message}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          readOnly
          value={previewUrl}
          className="flex-1 px-2 py-1.5 text-xs border border-[rgba(255,255,255,0.06)] rounded-lg bg-[rgba(255,255,255,0.05)] text-[#71717a] truncate"
        />
        <button
          onClick={handleCopy}
          className="px-3 py-1.5 text-xs font-medium border border-[rgba(255,255,255,0.06)] text-[#a1a1aa] rounded-lg hover:bg-[rgba(255,255,255,0.03)] transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <a
        href={previewUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center w-full py-1.5 text-xs font-medium text-[#fafafa] border border-[rgba(255,255,255,0.06)] rounded-lg hover:bg-[rgba(255,255,255,0.03)] transition-colors"
      >
        Open Preview
      </a>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleGenerate(true)}
          disabled={loading !== null}
          className="py-1.5 text-xs font-medium text-[#a1a1aa] border border-[rgba(255,255,255,0.06)] rounded-lg hover:bg-[rgba(255,255,255,0.03)] transition-colors disabled:opacity-50"
        >
          {loading === "regenerate" ? "Regenerating..." : "Regenerate"}
        </button>
        <button
          onClick={handleRevoke}
          disabled={loading !== null}
          className="py-1.5 text-xs font-medium text-[#f59e0b] border border-[rgba(245,158,11,0.2)] rounded-lg hover:bg-[rgba(245,158,11,0.06)] transition-colors disabled:opacity-50"
        >
          {loading === "revoke" ? "Revoking..." : "Revoke"}
        </button>
      </div>
      {message && <p className="text-xs text-[#71717a]">{message}</p>}
    </div>
  )
}
