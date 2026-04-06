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
      draft: "bg-gray-100 text-gray-700",
      published: "bg-green-100 text-green-700",
      archived: "bg-yellow-100 text-yellow-700",
      in_review: "bg-blue-100 text-blue-700",
      scheduled: "bg-purple-100 text-purple-700",
    }
    return colors[status || ""] || "bg-gray-100 text-gray-700"
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
      <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-red-600 text-sm">
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
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400">No results for "{searchTerm}"</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 mb-4">No {collectionLabel.toLowerCase()} yet</p>
            <a
              href={`/content/${collection}/new`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              + Create your first one
            </a>
          </div>
        )
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <a
                      href={`/content/${collection}/${item.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-blue-600"
                    >
                      {String(item.title || item.id)}
                    </a>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statusBadge(item.status as string)}`}>
                      {String(item.status || "draft")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(item.updated_at as string)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <a
                      href={`/content/${collection}/${item.id}`}
                      className="text-sm text-blue-600 hover:text-blue-800 mr-3"
                    >
                      Edit
                    </a>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-sm text-red-600 hover:text-red-800"
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
