import { Archive, CheckCircle2, Download, Send, Trash2, X } from "lucide-react"
import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { adminApiFetch, messageForAdminResponse } from "../lib/api"
import { confirmDelete } from "../lib/confirm-copy"
import { EmptyState, ErrorState } from "./AdminState"
import { ContentListSkeleton } from "./LoadingSkeleton"
import { SearchBar } from "./SearchBar"

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
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [sort, setSort] = useState("updated_at")
  const [order, setOrder] = useState<"asc" | "desc">("desc")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkBusy, setBulkBusy] = useState("")
  const pageSize = 20

  const fetchItems = async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      params.set("limit", String(pageSize))
      params.set("offset", String(offset))
      params.set("sort", sort)
      params.set("order", order)
      if (searchTerm) params.set("search", searchTerm)

      const res = await adminApiFetch(apiBase, `/api/${collection}?${params.toString()}`)
      if (!res.ok) throw new Error(messageForAdminResponse(res, "Could not load content."))
      const data = await res.json()
      setItems(data.data || [])
      setTotal(Number(data.total ?? data.data?.length ?? 0))
      setSelectedIds([])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: refetch is intentionally scoped to these query inputs; fetchItems is recreated each render so listing it would re-run on every render
  useEffect(() => {
    fetchItems()
  }, [collection, searchTerm, offset, sort, order])

  const handleSearch = (term: string) => {
    setOffset(0)
    setSearchTerm(term)
  }

  const changeSort = (field: string) => {
    setOffset(0)
    setSort((current) => {
      if (current === field) {
        setOrder((currentOrder) => (currentOrder === "asc" ? "desc" : "asc"))
        return current
      }
      setOrder(field === "updated_at" ? "desc" : "asc")
      return field
    })
  }

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds],
  )
  const allVisibleSelected = items.length > 0 && selectedIds.length === items.length

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked
        ? Array.from(new Set([...current, id]))
        : current.filter((selectedId) => selectedId !== id),
    )
  }

  const toggleAllVisible = (checked: boolean) => {
    setSelectedIds(checked ? items.map((item) => item.id) : [])
  }

  const postBulk = async (body: Record<string, unknown>) => {
    const res = await adminApiFetch(apiBase, `/api/${collection}/_bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || messageForAdminResponse(res, "Bulk action failed."))
    return data
  }

  const handleBulkWorkflow = async (
    workflowAction: "save_draft" | "submit_review" | "publish" | "archive",
  ) => {
    if (selectedIds.length === 0) return
    setBulkBusy(workflowAction)
    setError("")
    try {
      const result = await postBulk({ action: "workflow", workflowAction, ids: selectedIds })
      const updatedById = new Map<string, ContentItem>(
        (result.updated ?? []).map((item: ContentItem) => [item.id, item]),
      )
      setItems((current) => current.map((item) => updatedById.get(item.id) ?? item))
      setSelectedIds([])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBulkBusy("")
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(confirmDelete({ count: selectedIds.length, noun: "item" }))) return
    setBulkBusy("delete")
    setError("")
    try {
      const result = await postBulk({ action: "delete", ids: selectedIds })
      const deleted = new Set(result.deleted ?? [])
      setItems((current) => current.filter((item) => !deleted.has(item.id)))
      setTotal((current) => Math.max(0, current - deleted.size))
      setSelectedIds([])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBulkBusy("")
    }
  }

  const handleBulkExport = async () => {
    if (selectedIds.length === 0) return
    setBulkBusy("export")
    setError("")
    try {
      const result = await postBulk({ action: "export", ids: selectedIds })
      const blob = new Blob([JSON.stringify(result.data ?? [], null, 2)], {
        type: "application/json",
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${collection}-export.json`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBulkBusy("")
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(confirmDelete({ name }))) return
    try {
      await adminApiFetch(apiBase, `/api/${collection}/${id}`, { method: "DELETE" })
      setItems((prev) => prev.filter((item) => item.id !== id))
      setTotal((current) => Math.max(0, current - 1))
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.floor(offset / pageSize) + 1
  const canGoBack = offset > 0
  const canGoForward = offset + pageSize < total
  const sortLabel = (field: string) => (sort === field ? (order === "asc" ? " ↑" : " ↓") : "")

  const sortableHeader = (field: string, label: string, align: "left" | "right" = "left") => (
    <th
      className={`${align === "right" ? "text-right" : "text-left"} px-6 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider`}
    >
      <button
        type="button"
        onClick={() => changeSort(field)}
        className="uppercase tracking-wider hover:text-[#a1a1aa]"
      >
        {label}
        {sortLabel(field)}
      </button>
    </th>
  )

  if (loading) {
    return (
      <>
        <div className="mb-4">
          <SearchBar
            onSearch={handleSearch}
            placeholder={`Search ${collectionLabel.toLowerCase()}...`}
          />
        </div>
        <ContentListSkeleton />
      </>
    )
  }

  if (error) {
    return (
      <ErrorState
        title={
          error === "Sign in to continue." || error.startsWith("You do not have permission")
            ? "Permission needed"
            : "Could not load content"
        }
        description={error}
        action={
          <button
            type="button"
            onClick={() => fetchItems()}
            className="px-3 py-1.5 text-sm font-medium text-[#fafafa] bg-[rgba(255,255,255,0.08)] rounded-md hover:bg-[rgba(255,255,255,0.12)] transition-colors"
          >
            Try again
          </button>
        }
      />
    )
  }

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SearchBar
          onSearch={handleSearch}
          placeholder={`Search ${collectionLabel.toLowerCase()}...`}
        />
        <p className="text-sm text-[#71717a]">
          {total === 0
            ? "0 items"
            : `${offset + 1}-${Math.min(offset + items.length, total)} of ${total}`}
        </p>
      </div>
      {selectedIds.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#18181b] px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-[#fafafa]">{selectedIds.length} selected</p>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#71717a] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#fafafa]"
              title="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <BulkButton
              busy={bulkBusy === "submit_review"}
              onClick={() => handleBulkWorkflow("submit_review")}
              icon={<Send className="h-4 w-4" />}
            >
              Review
            </BulkButton>
            <BulkButton
              busy={bulkBusy === "publish"}
              onClick={() => handleBulkWorkflow("publish")}
              icon={<CheckCircle2 className="h-4 w-4" />}
            >
              Publish
            </BulkButton>
            <BulkButton
              busy={bulkBusy === "archive"}
              onClick={() => handleBulkWorkflow("archive")}
              icon={<Archive className="h-4 w-4" />}
            >
              Archive
            </BulkButton>
            <BulkButton
              busy={bulkBusy === "export"}
              onClick={handleBulkExport}
              icon={<Download className="h-4 w-4" />}
            >
              Export
            </BulkButton>
            <BulkButton
              danger
              busy={bulkBusy === "delete"}
              onClick={handleBulkDelete}
              icon={<Trash2 className="h-4 w-4" />}
            >
              Delete
            </BulkButton>
          </div>
        </div>
      )}
      {items.length === 0 ? (
        searchTerm ? (
          <div className="bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.06)] p-12 text-center">
            <p className="text-[#71717a] mb-1">No results for "{searchTerm}"</p>
            <p className="text-sm text-[#52525b]">
              Try a different search term or clear the filter.
            </p>
          </div>
        ) : (
          <EmptyState
            title={`No ${collectionLabel.toLowerCase()} yet`}
            description="Create your first entry to start building content."
            action={
              <a
                href={`/content/${collection}/new`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#c6ff3d] text-[#0a0a0c] rounded-md text-sm font-medium hover:bg-[#d4ff6e] transition-colors"
              >
                + Create your first one
              </a>
            }
          />
        )
      ) : (
        <div className="bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.06)] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.06)]">
                <th className="w-12 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    aria-label="Select all visible items"
                    checked={allVisibleSelected}
                    onChange={(event) => toggleAllVisible(event.target.checked)}
                  />
                </th>
                {sortableHeader("title", "Title")}
                {sortableHeader("status", "Status")}
                {sortableHeader("updated_at", "Updated")}
                <th className="text-right px-6 py-3 text-xs font-medium text-[#52525b] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.06)]">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      aria-label={`Select ${String(item.title || item.id)}`}
                      checked={selectedIds.includes(item.id)}
                      onChange={(event) => toggleSelected(item.id, event.target.checked)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <a
                      href={`/content/${collection}/${item.id}`}
                      className="text-sm font-medium text-[#fafafa] hover:text-[#c6ff3d] transition-colors"
                    >
                      {String(item.title || item.id)}
                    </a>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statusBadge(item.status as string)}`}
                    >
                      {String(item.status || "draft")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#52525b]">
                    {formatDate(item.updated_at as string)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <a
                      href={`/content/${collection}/${item.id}`}
                      className="text-sm text-[#71717a] hover:text-[#c6ff3d] mr-3 transition-colors"
                    >
                      Edit
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id, String(item.title || item.id))}
                      className="text-sm text-[#ef4444] hover:text-[#f87171] transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.06)] px-6 py-3">
            <p className="text-sm text-[#71717a]">
              Page {currentPage} of {totalPages}
              {selectedItems.length > 0 ? ` · ${selectedItems.length} selected on this page` : ""}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!canGoBack}
                onClick={() => setOffset((current) => Math.max(0, current - pageSize))}
                className="px-3 py-1.5 text-sm text-[#a1a1aa] border border-[rgba(255,255,255,0.08)] rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[rgba(255,255,255,0.03)]"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!canGoForward}
                onClick={() => setOffset((current) => current + pageSize)}
                className="px-3 py-1.5 text-sm text-[#a1a1aa] border border-[rgba(255,255,255,0.08)] rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[rgba(255,255,255,0.03)]"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function BulkButton({
  children,
  danger = false,
  busy,
  icon,
  onClick,
}: {
  children: ReactNode
  danger?: boolean
  busy: boolean
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        danger
          ? "border-[rgba(239,68,68,0.2)] text-[#ef4444] hover:bg-[rgba(239,68,68,0.08)]"
          : "border-[rgba(255,255,255,0.08)] text-[#a1a1aa] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#fafafa]"
      }`}
    >
      {icon}
      {busy ? "Working..." : children}
    </button>
  )
}
