export function Sparkline({
  points,
  delta,
  width = 54,
  height = 18,
}: {
  points: number[]
  delta?: string
  width?: number
  height?: number
}) {
  const polyline = buildPolyline(points, width, height)
  return (
    <span className="pulse-sparkline">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <polyline points={polyline} fill="none" />
      </svg>
      {delta ? <span className="pulse-delta">{delta}</span> : null}
    </span>
  )
}

function buildPolyline(points: number[], width: number, height: number): string {
  if (points.length === 0) return ""
  const max = Math.max(...points)
  const min = Math.min(...points)
  const span = max - min || 1
  const step = points.length > 1 ? width / (points.length - 1) : 0
  return points
    .map((p, i) => {
      const x = round(i * step)
      const y = round(height - ((p - min) / span) * height)
      return `${x},${y}`
    })
    .join(" ")
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
