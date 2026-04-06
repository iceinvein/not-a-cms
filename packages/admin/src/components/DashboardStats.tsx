import { useState, useEffect } from "react"

type CollectionStat = {
  name: string
  label: string
  count: number
  recentCount: number
}

export function DashboardStats({ apiBase = "" }: { apiBase?: string }) {
  const [stats, setStats] = useState<CollectionStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // In a real setup, this would fetch from the API
    // For now, show placeholder stats
    setStats([
      { name: "blog_post", label: "Blog Posts", count: 0, recentCount: 0 },
      { name: "page", label: "Pages", count: 0, recentCount: 0 },
    ])
    setLoading(false)
  }, [])

  if (loading) {
    return <div className="text-gray-400 text-sm">Loading...</div>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {stats.map((stat) => (
        <a
          key={stat.name}
          href={`/content/${stat.name}`}
          className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-2xl">📄</span>
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
              {stat.recentCount} this week
            </span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stat.count}</div>
          <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
        </a>
      ))}

      <div className="bg-white rounded-xl border border-gray-200 border-dashed p-6 flex flex-col items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all cursor-pointer">
        <span className="text-2xl mb-2">+</span>
        <span className="text-sm">New Content</span>
      </div>
    </div>
  )
}
