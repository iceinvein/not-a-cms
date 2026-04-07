import { useState } from "react"

type Props = {
  collection: string
  documentId: string
  apiBase?: string
  siteBase?: string
}

export function PreviewLink({ collection, documentId, apiBase = "", siteBase = "http://localhost:3000" }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/api/_preview/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection, documentId }),
      })
      if (res.ok) {
        const data = await res.json()
        const url = `${siteBase}/preview/${data.token}`
        setPreviewUrl(url)
      }
    } catch {} finally { setLoading(false) }
  }

  const handleCopy = async () => {
    if (previewUrl) {
      await navigator.clipboard.writeText(previewUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!previewUrl) {
    return (
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full py-2 text-xs font-medium text-[#a1a1aa] border border-[rgba(255,255,255,0.06)] rounded-lg hover:bg-[rgba(255,255,255,0.03)] transition-colors disabled:opacity-50"
      >
        {loading ? "Generating..." : "Generate Preview Link"}
      </button>
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
    </div>
  )
}
