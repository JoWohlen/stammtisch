import type { Component } from 'vue'
import { Handshake, MapPin, Star, Utensils } from '@lucide/vue'
import type { Category, Visit } from '#shared/types'
import { CATEGORIES, mean, raterNames } from '@/lib/stats'

/** Gesamt or one of the three categories, as switched by <AnalyseScoreKeyTabs> */
export type ScoreKey = Category | 'gesamt'

/** `color` tints the category icons in tooltips and tap rows (see <AnalyseScoreRow>) */
export const SCORE_KEYS: { key: ScoreKey, label: string, short: string, icon: Component, color: string }[] = [
  { key: 'gesamt', label: 'Gesamt', short: 'Gesamt', icon: Star, color: 'var(--foreground)' },
  { key: 'location', label: 'Location', short: 'Loc.', icon: MapPin, color: '#2563eb' },
  { key: 'service', label: 'Service', short: 'Serv.', icon: Handshake, color: '#ea580c' },
  { key: 'essen', label: 'Essen/Trinken', short: 'Essen', icon: Utensils, color: '#16a34a' },
]
export const scoreKeyLabel = (k: ScoreKey) => SCORE_KEYS.find(s => s.key === k)!.label

/** a member's own vote on one evening: the category vote, or for Gesamt the mean of their category votes */
export function vote(v: Visit, name: string, key: ScoreKey): number | null {
  if (key !== 'gesamt') return v.ratings[key][name] ?? null
  const own = CATEGORIES.map(c => v.ratings[c][name]).filter((x): x is number => x != null)
  return own.length ? mean(own) : null
}

/** every member's vote on one evening (members who didn't vote in `key` are left out) */
export function votes(v: Visit, key: ScoreKey): { name: string, x: number }[] {
  return [...raterNames(v)].flatMap((name) => {
    const x = vote(v, name, key)
    return x == null ? [] : [{ name, x }]
  })
}

/** population standard deviation */
export function std(xs: number[]): number {
  const m = mean(xs)
  return Math.sqrt(mean(xs.map(x => (x - m) ** 2)))
}

/** Pearson correlation; null with fewer than 3 pairs or when one side never varies */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length)
  if (n < 3) return null
  const mx = mean(xs.slice(0, n))
  const my = mean(ys.slice(0, n))
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx
    const dy = ys[i]! - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null
}

/** least-squares line y = intercept + slope·x, with Pearson r; null with fewer than 3 points */
export function linearFit(xs: number[], ys: number[]): { slope: number, intercept: number, r: number | null } | null {
  if (xs.length < 3) return null
  const mx = mean(xs)
  const my = mean(ys)
  const sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0)
  if (!sxx) return null
  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i]! - my), 0) / sxx
  return { slope, intercept: my - slope * mx, r: pearson(xs, ys) }
}

/**
 * least-squares polynomial y = c[0] + c[1]·x + … + c[degree]·x^degree;
 * null with too few points (fewer than degree + 2) or a singular system.
 * x is centred and scaled internally so higher powers stay well-conditioned.
 */
export function polyFit(xs: number[], ys: number[], degree: number): ((x: number) => number) | null {
  const n = degree + 1
  if (xs.length < n + 1) return null
  const mx = mean(xs)
  const scale = Math.max(...xs.map(x => Math.abs(x - mx))) || 1
  const t = xs.map(x => (x - mx) / scale)
  // normal equations, augmented with the right-hand side
  const A = Array.from({ length: n }, (_, r) => [
    ...Array.from({ length: n }, (_, c) => t.reduce((s, ti) => s + ti ** (r + c), 0)),
    t.reduce((s, ti, i) => s + ys[i]! * ti ** r, 0),
  ])
  // Gauss-Jordan with partial pivoting
  for (let i = 0; i < n; i++) {
    let p = i
    for (let k = i + 1; k < n; k++) if (Math.abs(A[k]![i]!) > Math.abs(A[p]![i]!)) p = k
    ;[A[i], A[p]] = [A[p]!, A[i]!]
    const piv = A[i]![i]!
    if (Math.abs(piv) < 1e-12) return null
    for (let k = 0; k < n; k++) {
      if (k === i) continue
      const f = A[k]![i]! / piv
      for (let c = i; c <= n; c++) A[k]![c]! -= f * A[i]![c]!
    }
  }
  const coef = A.map((row, i) => row[n]! / row[i]!)
  return (x: number) => {
    const u = (x - mx) / scale
    return coef.reduceRight((acc, c) => acc * u + c, 0)
  }
}

/** linear-interpolated quantile of an ascending list */
export function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo)
}

export interface FiveNumbers {
  min: number
  q1: number
  median: number
  q3: number
  max: number
  mean: number
  n: number
}

/** min, quartiles, max and mean for a box plot; null for an empty list */
export function fiveNumbers(xs: number[]): FiveNumbers | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  return { min: s[0]!, q1: quantile(s, 0.25), median: quantile(s, 0.5), q3: quantile(s, 0.75), max: s.at(-1)!, mean: mean(s), n: s.length }
}

/** readable axis ticks covering [lo, hi] */
export function niceTicks(lo: number, hi: number, count = 5): number[] {
  const span = hi - lo || 1
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw)!
  const start = Math.floor(lo / step) * step
  const end = Math.ceil(hi / step) * step
  return Array.from({ length: Math.round((end - start) / step) + 1 }, (_, i) => Number((start + i * step).toFixed(10)))
}
