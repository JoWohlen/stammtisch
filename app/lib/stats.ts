import type { Category, Visit } from '#shared/types'

/** Shared helpers for the statistics in useStammtisch, awards, fun facts and the analysis cards. */

export const CATEGORIES: Category[] = ['location', 'service', 'essen']

/** sum, missing values count as 0 */
export const sum = (xs: (number | null)[]): number => {
  let s = 0
  for (const x of xs) s += x ?? 0
  return s
}

/** arithmetic mean (NaN for an empty list) */
export const mean = (xs: number[]): number => sum(xs) / xs.length

/** groups by key, skipping items whose key is null; keeps first-seen key order */
export function groupBy<T>(xs: T[], key: (x: T) => string | null): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of xs) {
    const k = key(x)
    if (k == null) continue
    const list = m.get(k)
    if (list) list.push(x)
    else m.set(k, [x])
  }
  return m
}

/** people at the table: members + guests */
export const heads = (v: Visit): number => (v.mitglieder ?? 0) + (v.gaeste ?? 0)

const ratersCache = new WeakMap<Visit, ReadonlySet<string>>()

/** names of everyone who rated at least one category of this visit (cached per visit) */
export function raterNames(v: Visit): ReadonlySet<string> {
  let s = ratersCache.get(v)
  if (!s) {
    s = new Set(CATEGORIES.flatMap(c => Object.keys(v.ratings[c])))
    ratersCache.set(v, s)
  }
  return s
}

/** visits sorted chronologically (the xlsx order is not strictly chronological) */
export const byDate = (visits: Visit[]): Visit[] =>
  [...visits].sort((a, b) => a.date.localeCompare(b.date) || a.nr - b.nr)
