import { useState, useEffect } from "react"
import { SearchBar } from "./SearchBar"
import { ContentListSkeleton } from "./LoadingSkeleton"

type ContentItem = {
  id: string
  title?: string
  status?: string
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

type Props = {
  collection: string
  collectionLabel: string
  apiBase?: string
}

export function ContentList({ collection, collectionLabel, apiBase = "" }: Props) {
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")

  const fetchItems = async (search?: string) => {
    setLoading(true)
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : ""
      const res = await fetch(`${apiBase}/api/${collection}${params}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setItems(data.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems(searchTerm || undefined)
  }, [collection, searchTerm])

  const handleSearch = (term: string) => {
    setSearchTerm(term)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return
    try {
      await fetch(`${apiBase}/api/${collection}/${id}`, { method: "DELETE" })
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—"
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const statusBadge = (status?: string) => {
    const colors: Record<string, string> = {
      draft: "bg-[rgba(255,255,255,0.05)] text-[#71717a]",
      published: "bg-[rgba(34,197,94,0.1)] text-[#22c55e]",
      archived: "bg-[rgba(245,158,11,0.1)] text-[#f59e0b]",
      in_review: "bg-[rgba(255,255,255,0.08)] text-[#a1a1aa]",
      scheduled: "bg-[rgba(245,158,11,0.1)] text-[#f59e0b]",
    }
    return colors[status || ""] || "bg-[rgba(255,255,255,0.05)] text-[#71717a]"
  }

  if (loading) {
    return (
      <>
        <div className="mb-4">
          <SearchBar onSearch={handleSearch} placeholder={`Search ${collectionLabel.toLowerCase()}...`} />
        </div>
        <ContentListSkeleton />
      </>
    )
  }

  if (error) {
    return (
      <div className="bg-[rgba(239,68,68,0.1)] rounded-xl border border-[rgba(239,68,68,0.2)] p-4 text-[#ef4444] text-sm">
        {error}
      </div>
    )
  }

  return (
    <>
      <div className="mb-4">
        <SearchBar onSearch={handleSearch} placeholder={`Search ${collectionLabel.toLowerCase()}...`} />
      </div>
      {items.length === 0 ? (
        searchTerm ? (
          <div className="bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.06)] p-12 text-center">
            <p className="text-[#52525b]">No results for "{searchTerm}"</p>
          </div>
        ) : (
          <div className="bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.06)] p-12 text-center">
            <p className="text-[#52525b] mb-4">No {collectionLabel.toLowerCase()} yet</p>
            <a
              href={`/content/${collection}/new`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#fafafa] text-[#0a0a0c] rounded-md text-sm font-medium hover:bg-[#e4e4e7]"
            >
              + Create your first one
            </a>
          </div>
        )
      ) : (
        <div className="bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.06)] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.05)]">
                <th className="text-left px-6 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wider">Title</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wider">Updated</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.06)]">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-[rgba(255,255,255,0.03)] transition-colors">
                  <td className="px-6 py-4">
                    <a
                      href={`/content/${collection}/${item.id}`}
                      className="text-sm font-medium text-[#fafafa] hover:text-[#fafafa]"
                    >
                      {String(item.title || item.id)}
                    </a>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statusBadge(item.status as string)}`}>
                      {String(item.status || "draft")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#71717a]">
                    {formatDate(item.updated_at as string)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <a
                      href={`/content/${collection}/${item.id}`}
                      className="text-sm text-[#a1a1aa] hover:text-[#fafafa] mr-3"
                    >
                      Edit
                    </a>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-sm text-[#52525b] hover:text-[#ef4444]"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
