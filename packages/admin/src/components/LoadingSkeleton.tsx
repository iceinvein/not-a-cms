export function ContentListSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 flex gap-6">
        <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
        <div className="h-3 w-12 bg-gray-200 rounded animate-pulse" />
        <div className="h-3 w-14 bg-gray-200 rounded animate-pulse" />
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="px-6 py-4 flex items-center gap-6 border-b border-gray-100 last:border-0">
          <div className="flex-1 h-4 bg-gray-100 rounded animate-pulse" />
          <div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse" />
          <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
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
          <div className="h-4 w-12 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
        </div>
        <div>
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </div>
      <div className="w-72 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="flex-1 h-9 bg-gray-100 rounded-lg animate-pulse" />
            <div className="flex-1 h-9 bg-gray-100 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
