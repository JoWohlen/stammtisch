/** Monotone cubic interpolation (Fritsch–Carlson, like d3.curveMonotoneX): smooth, never overshoots the data. */
export function monotonePath(ps: { x: number, y: number }[]): string {
  const n = ps.length
  if (n < 2) return ''
  const dx = ps.slice(1).map((p, i) => p.x - ps[i]!.x)
  const slope = ps.slice(1).map((p, i) => (p.y - ps[i]!.y) / (dx[i] || 1))
  const m = ps.map((_, i) => {
    if (i === 0) return slope[0]!
    if (i === n - 1) return slope[n - 2]!
    const a = slope[i - 1]!
    const b = slope[i]!
    if (a * b <= 0) return 0
    const w1 = 2 * dx[i]! + dx[i - 1]!
    const w2 = dx[i]! + 2 * dx[i - 1]!
    return (w1 + w2) / (w1 / a + w2 / b)
  })
  let d = `M ${ps[0]!.x} ${ps[0]!.y}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i]! / 3
    d += ` C ${ps[i]!.x + h} ${ps[i]!.y + m[i]! * h} ${ps[i + 1]!.x - h} ${ps[i + 1]!.y - m[i + 1]! * h} ${ps[i + 1]!.x} ${ps[i + 1]!.y}`
  }
  return d
}

/** one visit in a DeviationBarChart */
export interface DeviationBar {
  id: number
  name: string
  /** ISO date, used for the year axis */
  date: string
  value: number
  /** link target */
  to: string
}

/** one dot in a ScatterChart */
export interface ScatterPoint {
  key: string | number
  x: number
  y: number
  /** tooltip lines: title, then details */
  title: string
  lines?: string[]
  to?: string
  /** dot colour, default foreground */
  color?: string
}
