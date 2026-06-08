export function ContentListSkeleton() {
  return (
    <div className="bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.06)] overflow-hidden">
      <div className="border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.05)] px-6 py-3 flex gap-6">
        <div className="h-3 w-16 bg-[rgba(255,255,255,0.06)] rounded animate-pulse" />
        <div className="h-3 w-12 bg-[rgba(255,255,255,0.06)] rounded animate-pulse" />
        <div className="h-3 w-14 bg-[rgba(255,255,255,0.06)] rounded animate-pulse" />
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="px-6 py-4 flex items-center gap-6 border-b border-[rgba(255,255,255,0.04)] last:border-0"
        >
          <div className="flex-1 h-4 bg-[rgba(255,255,255,0.06)] rounded animate-pulse" />
          <div className="h-5 w-16 bg-[rgba(255,255,255,0.06)] rounded-full animate-pulse" />
          <div className="h-4 w-20 bg-[rgba(255,255,255,0.06)] rounded animate-pulse" />
        </div>
      ))}
    </div>
  )
}

export function ContentEditorSkeleton() {
  return (
    <div className="flex gap-8">
      <div className="flex-1 space-y-6">
        <div>
          <div className="h-4 w-12 bg-[rgba(255,255,255,0.06)] rounded animate-pulse mb-2" />
          <div className="h-10 bg-[rgba(255,255,255,0.06)] rounded-lg animate-pulse" />
        </div>
        <div>
          <div className="h-4 w-16 bg-[rgba(255,255,255,0.06)] rounded animate-pulse mb-2" />
          <div className="h-64 bg-[rgba(255,255,255,0.06)] rounded-lg animate-pulse" />
        </div>
      </div>
      <div className="w-72 space-y-6">
        <div className="bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.06)] p-4 space-y-4">
          <div className="h-4 w-16 bg-[rgba(255,255,255,0.06)] rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="flex-1 h-9 bg-[rgba(255,255,255,0.06)] rounded-lg animate-pulse" />
            <div className="flex-1 h-9 bg-[rgba(255,255,255,0.06)] rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
