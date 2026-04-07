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
    async function fetchStats() {
      try {
        const schemaRes = await fetch(`${apiBase}/api/_schema`)
        if (!schemaRes.ok) throw new Error("Failed to fetch schema")
        const schema = await schemaRes.json()

        const results: CollectionStat[] = await Promise.all(
          schema.collections.map(async (col: { name: string; labels?: { plural?: string } }) => {
            const listRes = await fetch(`${apiBase}/api/${col.name}`)
            const listData = listRes.ok ? await listRes.json() : { data: [] }
            const items = listData.data || []

            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            const recentCount = items.filter((item: any) => item.created_at && item.created_at > oneWeekAgo).length

            return {
              name: col.name,
              label: col.labels?.plural || col.name,
              count: items.length,
              recentCount,
            }
          }),
        )

        setStats(results)
      } catch {
        setStats([])
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [apiBase])

  if (loading) {
    return <div className="text-[#52525b] text-sm">Loading...</div>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {stats.map((stat) => (
        <a
          key={stat.name}
          href={`/content/${stat.name}`}
          className="bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.06)] p-6 hover:border-[rgba(255,255,255,0.12)] transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-[#52525b] bg-[rgba(255,255,255,0.05)] px-2 py-1 rounded-full">
              {stat.recentCount} this week
            </span>
          </div>
          <div className="text-3xl font-bold text-[#fafafa]">{stat.count}</div>
          <div className="text-sm text-[#71717a] mt-1">{stat.label}</div>
        </a>
      ))}

      <div className="bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.06)] border-dashed p-6 flex flex-col items-center justify-center text-[#52525b] hover:text-[#71717a] hover:border-[rgba(255,255,255,0.1)] transition-all cursor-pointer">
        <span className="text-2xl mb-2">+</span>
        <span className="text-sm">New Content</span>
      </div>
    </div>
  )
}
