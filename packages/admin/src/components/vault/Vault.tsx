import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { FileText, ImageIcon, RefreshCw, Tags, Trash2, Upload, Video, X } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "../AdminState"
import { adminApiFetch } from "../../lib/api"
import {
  bulkDeleteMediaItems,
  bulkUpdateMediaTags,
  createMediaFolder,
  deleteMediaItem,
  deleteMediaFolder,
  getMediaContext,
  listMediaFolders,
  listMediaTags,
  listMediaItems,
  moveMediaAssets,
  normalizeTagInput,
  reorderMediaFolder,
  replaceMediaFile,
  setMediaFolderColor,
  setMediaFolderIcon,
  setMediaFolderRoles,
  type AdminMediaItem,
  type MediaFolder,
  type MediaTag,
  updateMediaItem,
  uploadMediaFile,
} from "../../lib/media"
import { clusterAssets, type Cluster } from "../../lib/media/cluster"
import { buildFolderTree, filterByFolder, folderDescendantIds, folderPath } from "../../lib/media/folders"
import { allTags, filterByTags, filterUntagged, tagColor, tagPreviewCounts } from "../../lib/media/tags"
import { rangeBetween } from "../../lib/media/selection"
import { TagManager } from "./TagManager"
import { FolderTree, FOLDER_ICONS, FOLDER_ICON_KEYS, type ActiveFolder } from "./FolderTree"

type UsageReference = {
  collection: string
  documentId: string
  label: string
  field: string
}

type Usage = {
  count: number
  references: UsageReference[]
}

type VaultProps = {
  apiBase?: string
  initialItems?: AdminMediaItem[]
  initialFolders?: MediaFolder[]
  initialCounts?: Record<string, number>
  initialSelected?: AdminMediaItem | null
  initialUsage?: Usage | null
}

type MetadataState = {
  alt: string
  title: string
  caption: string
  focalX: string
  focalY: string
  tags: string[]
}

function toMetadataState(item: AdminMediaItem | null): MetadataState {
  return {
    alt: item?.alt ?? "",
    title: item?.title ?? "",
    caption: item?.caption ?? "",
    focalX: String(item?.focalX ?? 0.5),
    focalY: String(item?.focalY ?? 0.5),
    tags: item?.tags ?? [],
  }
}

export function Vault({
  apiBase = "",
  initialItems = [],
  initialFolders = [],
  initialCounts = {},
  initialSelected = null,
  initialUsage = null,
}: VaultProps) {
  const [items, setItems] = useState<AdminMediaItem[]>(initialItems)
  const [folders, setFolders] = useState<MediaFolder[]>(initialFolders)
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts)
  const [loading, setLoading] = useState(initialItems.length === 0)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [usageLoading, setUsageLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(initialSelected?.id ?? initialItems[0]?.id ?? null)
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [filterMode, setFilterMode] = useState<"and" | "or">("and")
  const [anchorId, setAnchorId] = useState<string | null>(null)
  const [showUntagged, setShowUntagged] = useState(false)
  const [activeFolder, setActiveFolder] = useState<ActiveFolder>("all")
  const [recursive, setRecursive] = useState(false)
  const draggingId = useRef<string | null>(null)
  const [viewerRole, setViewerRole] = useState<string | null>(null)
  const [availableRoles, setAvailableRoles] = useState<{ key: string; label: string }[]>([])
  const [checkedIds, setCheckedIds] = useState<string[]>([])
  const [bulkTag, setBulkTag] = useState("")
  const [usage, setUsage] = useState<Usage | null>(initialUsage)
  const [tagColors, setTagColors] = useState<Record<string, string>>({})
  const [tagList, setTagList] = useState<MediaTag[]>(() =>
    allTags(initialItems).map(({ tag, count }) => ({ name: tag, count, color: tagColor(tag, {}) })),
  )
  const [managingTags, setManagingTags] = useState(false)
  const [metadata, setMetadata] = useState<MetadataState>(() => toMetadataState(initialSelected ?? initialItems[0] ?? null))
  const fileInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  const selectedItem = items.find((item) => item.id === selectedId) ?? initialSelected ?? null
  const folderTree = useMemo(() => buildFolderTree(folders), [folders])
  const folderScoped = useMemo(() => {
    if (recursive && activeFolder !== "all" && activeFolder !== null) {
      const ids = folderDescendantIds(folders, activeFolder)
      return items.filter((item) => item.folderId && ids.has(item.folderId))
    }
    return filterByFolder(items, activeFolder)
  }, [items, activeFolder, recursive, folders])
  const tags = useMemo(() => tagPreviewCounts(folderScoped, activeTags, filterMode), [folderScoped, activeTags, filterMode])
  const untaggedTotal = useMemo(() => filterUntagged(folderScoped).length, [folderScoped])
  const visible = useMemo(
    () => (showUntagged ? filterUntagged(folderScoped) : filterByTags(folderScoped, activeTags, filterMode)),
    [folderScoped, activeTags, showUntagged, filterMode],
  )
  const clusters = useMemo(() => clusterAssets(visible, counts), [visible, counts])
  const orderedIds = useMemo(() => clusters.flatMap((cluster) => cluster.items.map((item) => item.id)), [clusters])

  const applyTagList = (list: MediaTag[]) => {
    setTagList(list)
    setTagColors(Object.fromEntries(list.map((tag) => [tag.name, tag.color])))
  }

  const loadTags = async () => {
    const list = await listMediaTags(apiBase)
    applyTagList(list)
    return list
  }

  const loadFolders = async () => {
    const list = await listMediaFolders(apiBase)
    setFolders(list)
    return list
  }

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const [mediaItems, usageCounts, mediaTags, mediaFolders] = await Promise.all([
        listMediaItems(apiBase),
        fetchUsageCounts(apiBase),
        listMediaTags(apiBase),
        listMediaFolders(apiBase),
      ])
      setItems(mediaItems)
      setCounts(usageCounts)
      setFolders(mediaFolders)
      applyTagList(mediaTags)
      setSelectedId((current) => {
        const nextId = current ?? mediaItems[0]?.id ?? null
        setMetadata(toMetadataState(mediaItems.find((item) => item.id === nextId) ?? null))
        return nextId
      })
      setActiveTags((current) => current.filter((tag) => mediaItems.some((item) => (item.tags ?? []).includes(tag))))
    } catch (err: any) {
      setError(err.message || "Failed to load media")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getMediaContext(apiBase)
      .then((ctx) => {
        setViewerRole(ctx.role)
        setAvailableRoles(ctx.roles)
      })
      .catch(() => {})
    if (initialItems.length > 0) {
      Promise.all([
        loadTags(),
        initialFolders.length === 0 ? loadFolders() : Promise.resolve(initialFolders),
      ]).catch((err: any) => setError(err.message || "Failed to load media facets"))
      return
    }
    void refresh()
  }, [apiBase])

  useEffect(() => {
    if (!selectedItem) return
    setMetadata(toMetadataState(selectedItem))
  }, [selectedItem?.id])

  useEffect(() => {
    if (!selectedItem) {
      setUsage(null)
      return
    }
    if (initialUsage && selectedItem.id === initialSelected?.id) {
      setUsage(initialUsage)
      return
    }

    let cancelled = false
    setUsage(null)
    setUsageLoading(true)
    fetchUsage(apiBase, selectedItem.id)
      .then((nextUsage) => {
        if (!cancelled) setUsage(nextUsage)
      })
      .catch((err: any) => {
        if (!cancelled) setError(err.message || "Failed to load media usage")
      })
      .finally(() => {
        if (!cancelled) setUsageLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [apiBase, selectedItem?.id])

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files?.length) return

    setUploading(true)
    setError(null)
    try {
      const uploaded: AdminMediaItem[] = []
      for (const file of Array.from(files)) {
        uploaded.push(await uploadMediaFile(apiBase, file))
      }
      setItems((current) => [...uploaded, ...current])
      setSelectedId(uploaded[0]?.id ?? selectedId)
      setCounts(await fetchUsageCounts(apiBase))
    } catch (err: any) {
      setError(err.message || "Failed to upload media")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSaveMetadata = async () => {
    if (!selectedItem) return
    setSaving(true)
    setError(null)
    try {
      const updated = await updateMediaItem(apiBase, selectedItem.id, {
        alt: metadata.alt,
        title: metadata.title,
        caption: metadata.caption,
        focalX: Number(metadata.focalX),
        focalY: Number(metadata.focalY),
        tags: metadata.tags,
      })
      const nextItems = items.map((item) => (item.id === updated.id ? updated : item))
      setItems(nextItems)
      setActiveTags((current) => current.filter((tag) => nextItems.some((item) => (item.tags ?? []).includes(tag))))
      await loadTags()
    } catch (err: any) {
      setError(err.message || "Failed to update media")
    } finally {
      setSaving(false)
    }
  }

  const handleReplace = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !selectedItem) return
    setReplacing(true)
    setError(null)
    try {
      const updated = await replaceMediaFile(apiBase, selectedItem.id, file)
      setItems((current) => current.map((item) => item.id === updated.id ? updated : item))
    } catch (err: any) {
      setError(err.message || "Failed to replace media file")
    } finally {
      setReplacing(false)
      if (replaceInputRef.current) replaceInputRef.current.value = ""
    }
  }

  const handleDelete = async () => {
    if (!selectedItem) return
    if ((usage?.count ?? counts[selectedItem.id] ?? 0) > 0 && !confirm("This asset is used in content. Delete it anyway?")) {
      return
    }
    setError(null)
    try {
      await deleteMediaItem(apiBase, selectedItem.id)
      setItems((current) => current.filter((item) => item.id !== selectedItem.id))
      setSelectedId(null)
      setCheckedIds((current) => current.filter((id) => id !== selectedItem.id))
      setUsage(null)
    } catch (err: any) {
      setError(err.message || "Failed to delete media")
    }
  }

  const toggleTag = (tag: string) => {
    setShowUntagged(false)
    setActiveTags((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]))
  }

  const clearFilter = () => {
    setActiveTags([])
    setShowUntagged(false)
  }

  const toggleUntagged = () => {
    setActiveTags([])
    setShowUntagged((value) => !value)
  }

  const toggleChecked = (id: string, shiftKey = false) => {
    if (shiftKey && anchorId) {
      const range = rangeBetween(orderedIds, anchorId, id)
      setCheckedIds((current) => Array.from(new Set([...current, ...range])))
      return
    }
    setAnchorId(id)
    setCheckedIds((current) => (current.includes(id) ? current.filter((checkedId) => checkedId !== id) : [...current, id]))
  }

  const runBulk = async (op: "add" | "remove") => {
    const tag = normalizeTagInput(bulkTag)
    if (!tag || checkedIds.length === 0) return
    setError(null)
    try {
      const updated = await bulkUpdateMediaTags(apiBase, { ids: checkedIds, [op]: [tag] })
      const byId = new Map(updated.map((item) => [item.id, item]))
      const nextItems = items.map((item) => byId.get(item.id) ?? item)
      setItems(nextItems)
      const nextSelected = nextItems.find((item) => item.id === selectedId)
      if (nextSelected) setMetadata(toMetadataState(nextSelected))
      setActiveTags((current) => current.filter((tagName) => nextItems.some((item) => (item.tags ?? []).includes(tagName))))
      setBulkTag("")
      await loadTags()
    } catch (err: any) {
      setError(err.message || "Failed to update tags")
    }
  }

  const handleBulkDelete = async () => {
    if (checkedIds.length === 0) return
    const inUse = checkedIds.filter((id) => (counts[id] ?? 0) > 0).length
    const noun = checkedIds.length === 1 ? "asset" : "assets"
    const message =
      inUse > 0
        ? `Delete ${checkedIds.length} ${noun}? ${inUse} ${inUse === 1 ? "is" : "are"} used in content.`
        : `Delete ${checkedIds.length} ${noun}?`
    if (!confirm(message)) return
    setError(null)
    try {
      const deleted = new Set(await bulkDeleteMediaItems(apiBase, checkedIds))
      setItems((current) => current.filter((item) => !deleted.has(item.id)))
      setCheckedIds((current) => current.filter((id) => !deleted.has(id)))
      if (selectedId && deleted.has(selectedId)) {
        setSelectedId(null)
        setUsage(null)
      }
      setCounts(await fetchUsageCounts(apiBase))
      setActiveTags((current) =>
        current.filter((tag) => items.some((item) => !deleted.has(item.id) && (item.tags ?? []).includes(tag))),
      )
    } catch (err: any) {
      setError(err.message || "Failed to delete selected assets")
    }
  }

  const mergeUpdatedItems = (updated: AdminMediaItem[]) => {
    const byId = new Map(updated.map((item) => [item.id, item]))
    setItems((current) => current.map((item) => byId.get(item.id) ?? item))
    if (selectedId) {
      const nextSelected = byId.get(selectedId)
      if (nextSelected) setMetadata(toMetadataState(nextSelected))
    }
  }

  const handleCreateFolder = async (parentId: string | null) => {
    const name = prompt("Folder name")?.trim()
    if (!name) return
    setError(null)
    try {
      const folder = await createMediaFolder(apiBase, name, parentId)
      await loadFolders()
      setActiveFolder(folder.id)
    } catch (err: any) {
      setError(err.message || "Failed to create folder")
    }
  }

  const handleDeleteFolder = async (id: string) => {
    if (!confirm("Delete this folder? Its assets and subfolders move to the parent.")) return
    setError(null)
    try {
      await deleteMediaFolder(apiBase, id)
      setActiveFolder("all")
      await Promise.all([loadFolders(), refresh()])
    } catch (err: any) {
      setError(err.message || "Failed to delete folder")
    }
  }

  const handleMoveSelected = async (folderId: string | null) => {
    if (checkedIds.length === 0) return
    setError(null)
    try {
      mergeUpdatedItems(await moveMediaAssets(apiBase, checkedIds, folderId))
    } catch (err: any) {
      setError(err.message || "Failed to move selected assets")
    }
  }

  const handleMoveAsset = async (id: string, folderId: string | null) => {
    setError(null)
    try {
      mergeUpdatedItems(await moveMediaAssets(apiBase, [id], folderId))
    } catch (err: any) {
      setError(err.message || "Failed to move asset")
    }
  }

  const handleDropAssets = async (folderId: string | null) => {
    const dragged = draggingId.current
    draggingId.current = null
    if (!dragged) return
    const ids = checkedIds.includes(dragged) ? checkedIds : [dragged]
    setError(null)
    try {
      mergeUpdatedItems(await moveMediaAssets(apiBase, ids, folderId))
    } catch (err: any) {
      setError(err.message || "Failed to move asset")
    }
  }

  const handleReorderFolder = async (id: string, direction: "up" | "down") => {
    setError(null)
    try {
      await reorderMediaFolder(apiBase, id, direction)
      await loadFolders()
    } catch (err: any) {
      setError(err.message || "Failed to reorder folder")
    }
  }

  const handleSetFolderColor = async (id: string, color: string | null) => {
    setError(null)
    try {
      await setMediaFolderColor(apiBase, id, color)
      await loadFolders()
    } catch (err: any) {
      setError(err.message || "Failed to set folder color")
    }
  }

  const handleSetFolderIcon = async (id: string, icon: string | null) => {
    setError(null)
    try {
      await setMediaFolderIcon(apiBase, id, icon)
      await loadFolders()
    } catch (err: any) {
      setError(err.message || "Failed to set folder icon")
    }
  }

  const handleSetFolderRoles = async (id: string, roles: string[] | null) => {
    setError(null)
    try {
      await setMediaFolderRoles(apiBase, id, roles)
      await loadFolders()
    } catch (err: any) {
      setError(err.message || "Failed to set folder permissions")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-[#fafafa]">The Vault</h1>
          <p className="text-sm text-[#71717a]">{items.length} assets clustered by type and usage.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setManagingTags(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.1)] px-3 py-2 text-sm font-medium text-[#d4d4d8] hover:bg-[rgba(255,255,255,0.04)]"
          >
            <Tags className="h-4 w-4" />
            Manage tags
          </button>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.1)] text-[#d4d4d8] hover:bg-[rgba(255,255,255,0.04)]"
            aria-label="Refresh media"
            title="Refresh media"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-[#c9956b] px-4 py-2 text-sm font-medium text-[#0a0a0c] transition-colors hover:bg-[#d4a57c] disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,application/pdf" onChange={handleUpload} className="hidden" />
      <input ref={replaceInputRef} type="file" accept="image/*,video/*,application/pdf" onChange={handleReplace} className="hidden" />

      {error && <ErrorState compact title="Vault action failed" description={error} />}

      {loading ? (
        <LoadingState compact title="Loading the vault" description="Fetching uploaded assets and usage counts." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[210px_minmax(0,1fr)_360px]">
          <aside className="hidden xl:block">
            <FolderTree tree={folderTree} active={activeFolder} onSelect={setActiveFolder} onCreate={handleCreateFolder} onDropAssets={handleDropAssets} onReorder={handleReorderFolder} />
          </aside>
          <div className="space-y-6">
            <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#18181b] p-3 xl:hidden">
              <FolderTree tree={folderTree} active={activeFolder} onSelect={setActiveFolder} onCreate={handleCreateFolder} onDropAssets={handleDropAssets} onReorder={handleReorderFolder} />
            </div>
            <Breadcrumb
              folders={folders}
              active={activeFolder}
              onSelect={setActiveFolder}
              onDelete={handleDeleteFolder}
              recursive={recursive}
              onToggleRecursive={() => setRecursive((value) => !value)}
            />
            {activeFolder !== "all" && activeFolder !== null && (() => {
              const folder = folders.find((entry) => entry.id === activeFolder)
              return folder ? (
                <FolderStylePanel
                  folder={folder}
                  onSetColor={handleSetFolderColor}
                  onSetIcon={handleSetFolderIcon}
                  viewerRole={viewerRole}
                  availableRoles={availableRoles}
                  onSetRoles={handleSetFolderRoles}
                />
              ) : null
            })()}
            {items.length === 0 ? (
              <EmptyState
                title="No media files yet"
                description="Upload images, videos, or documents to reuse them across your content."
                action={(
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#c9956b] px-4 py-2 text-sm font-medium text-[#0a0a0c] hover:bg-[#d4a57c]"
                  >
                    <Upload className="h-4 w-4" />
                    Upload
                  </button>
                )}
              />
            ) : (
              <>
                {(tags.length > 0 || untaggedTotal > 0) && (
                  <TagFilterBar
                    tags={tags}
                    activeTags={activeTags}
                    showUntagged={showUntagged}
                    untaggedCount={untaggedTotal}
                    colors={tagColors}
                    mode={filterMode}
                    onSetMode={setFilterMode}
                    onToggleTag={toggleTag}
                    onToggleUntagged={toggleUntagged}
                    onClear={clearFilter}
                  />
                )}
                {checkedIds.length > 0 && (
                  <BulkActionBar
                    count={checkedIds.length}
                    value={bulkTag}
                    onChange={setBulkTag}
                    onAdd={() => runBulk("add")}
                    onRemove={() => runBulk("remove")}
                    folders={folders}
                    onMove={handleMoveSelected}
                    onDelete={handleBulkDelete}
                    onClear={() => setCheckedIds([])}
                  />
                )}
                {clusters.map((cluster) => (
                  <ClusterSection
                    key={cluster.key}
                    cluster={cluster}
                    counts={counts}
                    selectedId={selectedId}
                    checkedIds={checkedIds}
                    onSelect={setSelectedId}
                    onToggleChecked={toggleChecked}
                    onDragStartItem={(id) => { draggingId.current = id }}
                  />
                ))}
              </>
            )}
          </div>

          <DetailPanel
            item={selectedItem}
            metadata={metadata}
            setMetadata={setMetadata}
            usage={usage}
            usageLoading={usageLoading}
            saving={saving}
            replacing={replacing}
            onSave={handleSaveMetadata}
            onReplace={() => replaceInputRef.current?.click()}
            onDelete={handleDelete}
            folders={folders}
            onMove={handleMoveAsset}
            tagColors={tagColors}
          />
        </div>
      )}

      {managingTags && (
        <TagManager
          apiBase={apiBase}
          tags={tagList}
          onClose={() => setManagingTags(false)}
          onChanged={() => { void refresh() }}
        />
      )}
    </div>
  )
}

function TagFilterBar({
  tags,
  activeTags,
  showUntagged,
  untaggedCount,
  colors,
  mode,
  onSetMode,
  onToggleTag,
  onToggleUntagged,
  onClear,
}: {
  tags: { tag: string; count: number }[]
  activeTags: string[]
  showUntagged: boolean
  untaggedCount: number
  colors: Record<string, string>
  mode: "and" | "or"
  onSetMode: (mode: "and" | "or") => void
  onToggleTag: (tag: string) => void
  onToggleUntagged: () => void
  onClear: () => void
}) {
  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
      active
        ? "border-[#c9956b] bg-[rgba(201,149,107,0.12)] text-[#fafafa]"
        : "border-[rgba(255,255,255,0.1)] text-[#d4d4d8] hover:bg-[rgba(255,255,255,0.04)]"
    }`
  const noFilter = activeTags.length === 0 && !showUntagged

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by tag">
      <button type="button" onClick={onClear} className={chip(noFilter)} aria-pressed={noFilter}>
        All
      </button>
      {activeTags.length >= 2 && (
        <span className="inline-flex overflow-hidden rounded-full border border-[rgba(255,255,255,0.12)] text-xs font-medium" role="group" aria-label="Match mode">
          <button
            type="button"
            onClick={() => onSetMode("and")}
            aria-pressed={mode === "and"}
            title="Match all selected tags"
            className={`px-2.5 py-1 ${mode === "and" ? "bg-[rgba(201,149,107,0.18)] text-[#fafafa]" : "text-[#d4d4d8] hover:bg-[rgba(255,255,255,0.04)]"}`}
          >
            AND
          </button>
          <button
            type="button"
            onClick={() => onSetMode("or")}
            aria-pressed={mode === "or"}
            title="Match any selected tag"
            className={`px-2.5 py-1 ${mode === "or" ? "bg-[rgba(201,149,107,0.18)] text-[#fafafa]" : "text-[#d4d4d8] hover:bg-[rgba(255,255,255,0.04)]"}`}
          >
            OR
          </button>
        </span>
      )}
      {untaggedCount > 0 && (
        <button type="button" onClick={onToggleUntagged} className={chip(showUntagged)} aria-pressed={showUntagged}>
          Untagged
          <span className="text-[#71717a]">{untaggedCount}</span>
        </button>
      )}
      {tags.map(({ tag, count }) => {
        const active = activeTags.includes(tag)
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onToggleTag(tag)}
            className={`${chip(active)}${count === 0 && !active ? " opacity-40" : ""}`}
            aria-pressed={active}
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: tagColor(tag, colors) }} />
            #{tag}
            <span className="text-[#71717a]">{count}</span>
          </button>
        )
      })}
    </div>
  )
}

function Breadcrumb({
  folders,
  active,
  onSelect,
  onDelete,
  recursive,
  onToggleRecursive,
}: {
  folders: MediaFolder[]
  active: ActiveFolder
  onSelect: (id: ActiveFolder) => void
  onDelete: (id: string) => void
  recursive: boolean
  onToggleRecursive: () => void
}) {
  const trail = active === "all" || active === null ? [] : folderPath(folders, active)

  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-[#71717a]" aria-label="Breadcrumb">
      <button type="button" onClick={() => onSelect("all")} className="hover:text-[#fafafa]">All</button>
      {active === null && (
        <>
          <span>/</span>
          <span className="text-[#d4d4d8]">Unsorted</span>
        </>
      )}
      {trail.map((folder, index) => (
        <span key={folder.id} className="flex items-center gap-1">
          <span>/</span>
          <button
            type="button"
            onClick={() => onSelect(folder.id)}
            className={index === trail.length - 1 ? "text-[#d4d4d8]" : "hover:text-[#fafafa]"}
          >
            {folder.name}
          </button>
        </span>
      ))}
      {active !== "all" && active !== null && (
        <>
          <button type="button" onClick={() => onDelete(active)} className="ml-2 text-xs text-[#f87171] hover:text-[#fca5a5]">
            Delete folder
          </button>
          <button
            type="button"
            onClick={onToggleRecursive}
            aria-pressed={recursive}
            className={`ml-2 text-xs ${recursive ? "text-[#c9956b]" : "text-[#71717a] hover:text-[#fafafa]"}`}
          >
            {recursive ? "Subfolders: on" : "Include subfolders"}
          </button>
        </>
      )}
    </nav>
  )
}

function FolderStylePanel({
  folder,
  onSetColor,
  onSetIcon,
  viewerRole,
  availableRoles,
  onSetRoles,
}: {
  folder: MediaFolder
  onSetColor: (id: string, color: string | null) => void
  onSetIcon: (id: string, icon: string | null) => void
  viewerRole: string | null
  availableRoles: { key: string; label: string }[]
  onSetRoles: (id: string, roles: string[] | null) => void
}) {
  const restricted = folder.roles ?? []
  const toggleRole = (key: string) => {
    const next = restricted.includes(key) ? restricted.filter((entry) => entry !== key) : [...restricted, key]
    onSetRoles(folder.id, next.length > 0 ? next : null)
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#18181b] px-3 py-2">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-[#71717a]">Color</span>
        {FOLDER_SWATCHES.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Set folder color ${color}`}
            onClick={() => onSetColor(folder.id, color)}
            className={`h-4 w-4 rounded-full border ${folder.color === color ? "border-[#fafafa]" : "border-transparent"}`}
            style={{ backgroundColor: color }}
          />
        ))}
        <button type="button" onClick={() => onSetColor(folder.id, null)} className="text-xs text-[#71717a] hover:text-[#fafafa]">Reset</button>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-[#71717a]">Icon</span>
        {FOLDER_ICON_KEYS.map((key) => {
          const Glyph = FOLDER_ICONS[key]
          return (
            <button
              key={key}
              type="button"
              aria-label={`Set folder icon ${key}`}
              onClick={() => onSetIcon(folder.id, key)}
              className={`rounded-md p-1 ${folder.icon === key ? "bg-[rgba(201,149,107,0.18)] text-[#fafafa]" : "text-[#d4d4d8] hover:bg-[rgba(255,255,255,0.04)]"}`}
            >
              <Glyph className="h-4 w-4" />
            </button>
          )
        })}
      </div>
      {viewerRole === "admin" && availableRoles.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#71717a]">Permissions</span>
          {availableRoles.filter((role) => role.key !== "admin").map((role) => (
            <label key={role.key} className="flex items-center gap-1 text-xs text-[#d4d4d8]">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-[#c9956b]"
                checked={restricted.includes(role.key)}
                onChange={() => toggleRole(role.key)}
              />
              {role.label}
            </label>
          ))}
          <span className="text-[11px] text-[#52525b]">{restricted.length === 0 ? "All roles" : "Restricted"}</span>
        </div>
      )}
    </div>
  )
}

const FOLDER_SWATCHES = ["#c9956b", "#6b9bc9", "#8bbf7a", "#c97a8b", "#b08bc9", "#c9b06b", "#6bc9b0", "#9b9b6b"]

function BulkActionBar({
  count,
  value,
  onChange,
  onAdd,
  onRemove,
  folders,
  onMove,
  onDelete,
  onClear,
}: {
  count: number
  value: string
  onChange: (value: string) => void
  onAdd: () => void
  onRemove: () => void
  folders: MediaFolder[]
  onMove: (folderId: string | null) => void
  onDelete: () => void
  onClear: () => void
}) {
  return (
    <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-[rgba(201,149,107,0.35)] bg-[#18181b] px-3 py-2">
      <span className="text-sm font-medium text-[#fafafa]">{count} selected</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Tag..."
        className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-transparent px-3 py-1.5 text-sm text-[#fafafa] outline-none placeholder:text-[#52525b] focus:border-[#c9956b]"
      />
      <button type="button" onClick={onAdd} className="rounded-lg bg-[#c9956b] px-3 py-1.5 text-sm font-medium text-[#0a0a0c] hover:bg-[#d4a57c]">
        Add
      </button>
      <button type="button" onClick={onRemove} className="rounded-lg border border-[rgba(255,255,255,0.1)] px-3 py-1.5 text-sm font-medium text-[#fafafa] hover:bg-[rgba(255,255,255,0.04)]">
        Remove
      </button>
      <select
        defaultValue="__placeholder"
        onChange={(event) => {
          const value = event.target.value
          onMove(value === "__unsorted" ? null : value)
          event.currentTarget.value = "__placeholder"
        }}
        className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#18181b] px-2 py-1.5 text-sm text-[#fafafa] outline-none focus:border-[#c9956b]"
        aria-label="Move selected to folder"
      >
        <option value="__placeholder" disabled>Move to...</option>
        <option value="__unsorted">Unsorted</option>
        {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
      </select>
      <button
        type="button"
        onClick={onDelete}
        className="ml-auto inline-flex items-center gap-2 rounded-lg border border-[rgba(239,68,68,0.35)] px-3 py-1.5 text-sm font-medium text-[#f87171] hover:bg-[rgba(239,68,68,0.08)]"
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </button>
      <button type="button" onClick={onClear} className="text-sm text-[#71717a] hover:text-[#fafafa]">
        Clear
      </button>
    </div>
  )
}

function ClusterSection({
  cluster,
  counts,
  selectedId,
  checkedIds,
  onSelect,
  onToggleChecked,
  onDragStartItem,
}: {
  cluster: Cluster
  counts: Record<string, number>
  selectedId: string | null
  checkedIds: string[]
  onSelect: (id: string) => void
  onToggleChecked: (id: string, shiftKey: boolean) => void
  onDragStartItem: (id: string) => void
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-2">
        <div className="flex items-center gap-2">
          {clusterIcon(cluster.key)}
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#d4d4d8]">{cluster.label}</h2>
        </div>
        <span className="text-xs text-[#71717a]">{cluster.items.length} assets</span>
      </div>
      {cluster.items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[rgba(255,255,255,0.08)] px-4 py-6 text-sm text-[#71717a]">No assets in this cluster.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {cluster.items.map((item) => (
            <div
              key={`${cluster.key}-${item.id}`}
              className="group/cell relative"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move"
                event.dataTransfer.setData("text/plain", item.id)
                onDragStartItem(item.id)
              }}
            >
              <label className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md border border-[rgba(255,255,255,0.2)] bg-[#0a0a0c]/70 opacity-0 transition-opacity hover:opacity-100 has-[:checked]:opacity-100 group-hover/cell:opacity-100">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[#c9956b]"
                  checked={checkedIds.includes(item.id)}
                  onChange={() => {}}
                  onClick={(event) => onToggleChecked(item.id, event.shiftKey)}
                  aria-label={`Select ${item.title || item.filename}`}
                />
              </label>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                className={`block w-full overflow-hidden rounded-lg border bg-[#18181b] text-left transition-all hover:border-[rgba(201,149,107,0.45)] ${selectedId === item.id ? "border-[#c9956b]" : "border-[rgba(255,255,255,0.06)]"}`}
              >
                <div className="relative aspect-square bg-[rgba(255,255,255,0.03)]">
                  {item.mimetype.startsWith("image/") ? (
                    <img src={item.url} alt={item.alt || item.filename} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#71717a]">
                      {item.mimetype.startsWith("video/") ? <Video className="h-9 w-9" /> : <FileText className="h-9 w-9" />}
                    </div>
                  )}
                  <span className="absolute right-2 top-2 rounded-full bg-[#0a0a0c]/85 px-2 py-1 text-[11px] font-medium text-[#fafafa]">
                    {counts[item.id] ?? 0} uses
                  </span>
                </div>
                <div className="p-3">
                  <p className="truncate text-xs font-medium text-[#fafafa]">{item.title || item.filename}</p>
                  <p className="text-xs text-[#71717a]">{formatSize(item.size)}</p>
                </div>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function DetailPanel({
  item,
  metadata,
  setMetadata,
  usage,
  usageLoading,
  saving,
  replacing,
  onSave,
  onReplace,
  onDelete,
  folders,
  onMove,
  tagColors,
}: {
  item: AdminMediaItem | null
  metadata: MetadataState
  setMetadata: React.Dispatch<React.SetStateAction<MetadataState>>
  usage: Usage | null
  usageLoading: boolean
  saving: boolean
  replacing: boolean
  onSave: () => void
  onReplace: () => void
  onDelete: () => void
  folders: MediaFolder[]
  onMove: (id: string, folderId: string | null) => void
  tagColors: Record<string, string>
}) {
  if (!item) {
    return (
      <aside className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#18181b] p-4">
        <EmptyState compact title="Select an asset" description="Inspect usage, edit metadata, replace, or delete an asset." />
      </aside>
    )
  }

  return (
    <aside className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#18181b] p-4">
      <div className="space-y-5">
        <div className="overflow-hidden rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]">
          {item.mimetype.startsWith("image/") ? (
            <img src={item.url} alt={item.alt || item.filename} className="max-h-72 w-full object-contain" />
          ) : (
            <div className="flex aspect-video items-center justify-center text-[#71717a]">
              {item.mimetype.startsWith("video/") ? <Video className="h-12 w-12" /> : <FileText className="h-12 w-12" />}
            </div>
          )}
        </div>

        <div>
          <p className="truncate text-sm font-medium text-[#fafafa]">{item.filename}</p>
          <p className="text-xs text-[#71717a]">
            {[formatSize(item.size), item.width && item.height ? `${item.width}x${item.height}` : null].filter(Boolean).join(" / ")}
          </p>
        </div>

        <section className="space-y-2 border-y border-[rgba(255,255,255,0.06)] py-4">
          <h2 className="text-sm font-semibold text-[#fafafa]">
            {usageLoading ? "Loading usage..." : usageLabel(usage?.count ?? 0)}
          </h2>
          {usage && usage.references.length > 0 ? (
            <ul className="space-y-2">
              {usage.references.map((reference) => (
                <li key={`${reference.collection}-${reference.documentId}-${reference.field}`}>
                  <a
                    href={`/content/${encodeURIComponent(reference.collection)}/${encodeURIComponent(reference.documentId)}`}
                    className="block rounded-lg border border-[rgba(255,255,255,0.06)] px-3 py-2 text-sm text-[#d4d4d8] hover:border-[rgba(201,149,107,0.35)] hover:bg-[rgba(255,255,255,0.03)]"
                  >
                    <span className="block truncate text-[#fafafa]">{reference.label}</span>
                    <span className="text-xs text-[#71717a]">{reference.collection} / {reference.field}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#71717a]">No content references this asset.</p>
          )}
        </section>

        <TagsField metadata={metadata} setMetadata={setMetadata} tagColors={tagColors} />

        <label className="grid gap-1.5 text-xs font-medium uppercase tracking-[0.08em] text-[#71717a]">
          Folder
          <select
            value={item.folderId ?? "__unsorted"}
            onChange={(event) => onMove(item.id, event.target.value === "__unsorted" ? null : event.target.value)}
            className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#18181b] px-3 py-2 text-sm normal-case tracking-normal text-[#fafafa] outline-none focus:border-[#c9956b]"
            aria-label="Move asset to folder"
          >
            <option value="__unsorted">Unsorted</option>
            {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </select>
        </label>

        <MetadataFields metadata={metadata} setMetadata={setMetadata} />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-lg bg-[#c9956b] px-4 py-2 text-sm font-medium text-[#0a0a0c] hover:bg-[#d4a57c] disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={onReplace}
            disabled={replacing}
            className="inline-flex items-center justify-center rounded-lg border border-[rgba(255,255,255,0.1)] px-4 py-2 text-sm font-medium text-[#fafafa] hover:bg-[rgba(255,255,255,0.04)] disabled:opacity-50"
          >
            {replacing ? "Replacing..." : "Replace"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-2 rounded-lg border border-[rgba(239,68,68,0.35)] px-4 py-2 text-sm font-medium text-[#f87171] hover:bg-[rgba(239,68,68,0.08)]"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>
    </aside>
  )
}

function TagsField({
  metadata,
  setMetadata,
  tagColors,
}: {
  metadata: MetadataState
  setMetadata: React.Dispatch<React.SetStateAction<MetadataState>>
  tagColors: Record<string, string>
}) {
  const [draft, setDraft] = useState("")

  const addTag = () => {
    const tag = normalizeTagInput(draft)
    setDraft("")
    if (!tag) return
    setMetadata((current) =>
      current.tags.includes(tag) ? current : { ...current, tags: [...current.tags, tag] },
    )
  }

  const removeTag = (tag: string) => {
    setMetadata((current) => ({ ...current, tags: current.tags.filter((existing) => existing !== tag) }))
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-[#71717a]">Tags</h3>
      <div className="flex flex-wrap gap-1.5">
        {metadata.tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 text-xs text-[#d4d4d8]"
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: tagColor(tag, tagColors) }} />
            #{tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-[#71717a] hover:text-[#f87171]"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault()
            addTag()
          }
        }}
        onBlur={addTag}
        placeholder="Add a tag..."
        className="w-full rounded-lg border border-[rgba(255,255,255,0.1)] bg-transparent px-3 py-2 text-sm text-[#fafafa] outline-none placeholder:text-[#52525b] focus:border-[#c9956b]"
      />
    </div>
  )
}

function MetadataFields({
  metadata,
  setMetadata,
}: {
  metadata: MetadataState
  setMetadata: React.Dispatch<React.SetStateAction<MetadataState>>
}) {
  return (
    <div className="space-y-3">
      <label className="grid gap-1.5 text-xs font-medium uppercase tracking-[0.08em] text-[#71717a]">
        Title
        <input
          value={metadata.title}
          onChange={(event) => setMetadata((current) => ({ ...current, title: event.target.value }))}
          className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-transparent px-3 py-2 text-sm normal-case tracking-normal text-[#fafafa] outline-none placeholder:text-[#52525b] focus:border-[#c9956b]"
        />
      </label>
      <label className="grid gap-1.5 text-xs font-medium uppercase tracking-[0.08em] text-[#71717a]">
        Alt text
        <input
          value={metadata.alt}
          onChange={(event) => setMetadata((current) => ({ ...current, alt: event.target.value }))}
          className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-transparent px-3 py-2 text-sm normal-case tracking-normal text-[#fafafa] outline-none placeholder:text-[#52525b] focus:border-[#c9956b]"
        />
      </label>
      <label className="grid gap-1.5 text-xs font-medium uppercase tracking-[0.08em] text-[#71717a]">
        Caption
        <textarea
          value={metadata.caption}
          onChange={(event) => setMetadata((current) => ({ ...current, caption: event.target.value }))}
          rows={3}
          className="resize-none rounded-lg border border-[rgba(255,255,255,0.1)] bg-transparent px-3 py-2 text-sm normal-case tracking-normal text-[#fafafa] outline-none placeholder:text-[#52525b] focus:border-[#c9956b]"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1.5 text-xs font-medium uppercase tracking-[0.08em] text-[#71717a]">
          Focal X
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={metadata.focalX}
            onChange={(event) => setMetadata((current) => ({ ...current, focalX: event.target.value }))}
            className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-transparent px-3 py-2 text-sm normal-case tracking-normal text-[#fafafa] outline-none focus:border-[#c9956b]"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium uppercase tracking-[0.08em] text-[#71717a]">
          Focal Y
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={metadata.focalY}
            onChange={(event) => setMetadata((current) => ({ ...current, focalY: event.target.value }))}
            className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-transparent px-3 py-2 text-sm normal-case tracking-normal text-[#fafafa] outline-none focus:border-[#c9956b]"
          />
        </label>
      </div>
    </div>
  )
}

function clusterIcon(key: Cluster["key"]) {
  const className = "h-4 w-4 text-[#c9956b]"
  if (key === "images") return <ImageIcon className={className} />
  if (key === "video") return <Video className={className} />
  return <FileText className={className} />
}

async function fetchUsageCounts(apiBase: string): Promise<Record<string, number>> {
  const res = await adminApiFetch(apiBase, "/api/media/usage")
  if (!res.ok) throw new Error("Failed to load media usage counts")
  const body = await res.json() as { counts?: Record<string, number> }
  return body.counts ?? {}
}

async function fetchUsage(apiBase: string, id: string): Promise<Usage> {
  const res = await adminApiFetch(apiBase, `/api/media/${encodeURIComponent(id)}/usage`)
  if (!res.ok) throw new Error("Failed to load media usage")
  return await res.json() as Usage
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function usageLabel(count: number) {
  return `Used in ${count} ${count === 1 ? "place" : "places"}`
}
