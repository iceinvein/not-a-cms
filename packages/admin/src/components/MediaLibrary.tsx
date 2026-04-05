import { useState, useRef } from "react"

type MediaItem = {
  id: string
  filename: string
  url: string
  mimetype: string
  size: number
  uploadedAt: string
}

export function MediaLibrary({ apiBase = "" }: { apiBase?: string }) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return

    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        // In production, upload to the server's media endpoint
        const item: MediaItem = {
          id: crypto.randomUUID(),
          filename: file.name,
          url: URL.createObjectURL(file),
          mimetype: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        }
        setItems((prev) => [item, ...prev])
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {uploading ? "Uploading..." : "+ Upload Files"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,application/pdf"
          onChange={handleUpload}
          className="hidden"
        />
        <span className="text-sm text-gray-500">{items.length} files</span>
      </div>

      {items.length === 0 ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-12 text-center cursor-pointer hover:border-blue-400 transition-colors"
        >
          <div className="text-4xl mb-3">🖼️</div>
          <p className="text-gray-500 mb-1">No media files yet</p>
          <p className="text-sm text-gray-400">Click to upload or drag files here</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow group"
            >
              <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                {item.mimetype.startsWith("image/") ? (
                  <img
                    src={item.url}
                    alt={item.filename}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl">📎</span>
                )}
              </div>
              <div className="p-3">
                <p className="text-xs font-medium text-gray-900 truncate">{item.filename}</p>
                <p className="text-xs text-gray-400">{formatSize(item.size)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
