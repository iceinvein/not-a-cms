import type { ReactNode } from "react"

export function FreshnessRow({
  intensity,
  dormant = false,
  children,
}: {
  intensity: number
  dormant?: boolean
  children: ReactNode
}) {
  const clamped = Math.max(0, Math.min(1, intensity))
  const fresh = clamped > 0.05
  const className = ["pulse-row", fresh ? "pulse-fresh" : "", dormant ? "pulse-dormant" : ""]
    .filter(Boolean)
    .join(" ")
  return (
    <div className={className} style={{ ["--pulse-freshness" as never]: clamped.toFixed(3) }}>
      {children}
    </div>
  )
}
