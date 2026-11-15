import type { Category, StammtischData, Visit } from '#shared/types'
import raw from '../../data/stammtisch.json'

const data = raw as StammtischData

const sum = (xs: (number | null)[]): number => xs.reduce<number>((a, b) => a + (b ?? 0), 0)
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length
const scored = (vs: Visit[]) => vs.filter(v => v.averages.gesamt != null)

function groupBy<T>(xs: T[], key: (x: T) => string | null): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of xs) {
    const k = key(x)
    if (k == null) continue
    m.set(k, [...(m.get(k) ?? []), x])
  }
  return m
}

export interface BestBrauhaus {
  name: string
  slug: string
  besuche: number
  gesamt: number
  location: number
  service: number
  essen: number
}

export interface TopVisit {
  brauhaus: string
  slug: string
  date: string
  gesamt: number
}

export interface BestPlaner {
  name: string
  slug: string
  besuche: number
  gesamt: number
  /** the planner's best visits, highest Gesamt first */
  topBesuche: TopVisit[]
}

function bestBrauhaus(visits: Visit[]): BestBrauhaus | null {
  const ranked = [...groupBy(scored(visits), v => v.slug).values()].map((vs) => {
    const avg = (k: Category | 'gesamt') => mean(vs.map(v => v.averages[k] ?? 0))
    return {
      name: vs[0]!.brauhaus,
      slug: vs[0]!.slug,
      besuche: vs.length,
      gesamt: avg('gesamt'),
      location: avg('location'),
      service: avg('service'),
      essen: avg('essen'),
    }
  }).sort((a, b) => b.gesamt - a.gesamt)
  return ranked[0] ?? null
}

function bestPlaner(visits: Visit[]): BestPlaner | null {
  const slugOf = new Map(data.participants.map(p => [p.name, p.slug]))
  const ranked = [...groupBy(scored(visits), v => v.planer).entries()]
    .map(([name, vs]) => ({
      name,
      slug: slugOf.get(name) ?? name.toLowerCase(),
      besuche: vs.length,
      gesamt: mean(vs.map(v => v.averages.gesamt!)),
      topBesuche: [...vs]
        .sort((a, b) => b.averages.gesamt! - a.averages.gesamt!)
        .slice(0, 3)
        .map(v => ({ brauhaus: v.brauhaus, slug: v.slug, date: v.date, gesamt: v.averages.gesamt! })),
    }))
    .sort((a, b) => b.gesamt - a.gesamt || b.besuche - a.besuche)
  return ranked[0] ?? null
}

const visits = data.visits

const overviewStats = {
  besuche: visits.length,
  teilnehmer: data.participants.length,
  biere: sum(visits.map(v => v.biere)),
  liter: sum(visits.map(v => v.liter)),
  kosten: sum(visits.map(v => v.rechnung)),
  ersterBesuch: visits[0]?.date ?? null,
  letzterBesuch: visits.at(-1)?.date ?? null,
  bestesBrauhaus: bestBrauhaus(visits),
  besterPlaner: bestPlaner(visits),
}

export type OverviewStats = typeof overviewStats

export interface Brauhaus {
  name: string
  slug: string
  /** newest visit first */
  visits: Visit[]
}

const brauhaeuser = new Map<string, Brauhaus>(
  [...groupBy(visits, v => v.slug).entries()].map(([slug, vs]) => [
    slug,
    { name: vs[0]!.brauhaus, slug, visits: [...vs].sort((a, b) => b.date.localeCompare(a.date)) },
  ]),
)

const getBrauhaus = (slug: string): Brauhaus | null => brauhaeuser.get(slug) ?? null

/** All data is static (imported at build time), so no reactivity is needed. */
export function useStammtisch() {
  return { visits, participants: data.participants, overviewStats, getBrauhaus }
}
