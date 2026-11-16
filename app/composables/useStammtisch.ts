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
  /** ISO date of the most recent visit */
  lastDate: string
  /** scores of the most recent visit only (equal to the means for single visits) */
  latest: Record<Category | 'gesamt', number>
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

/** every rated Brauhaus, highest Ø Gesamt first (repeat visits = mean of their visits) */
function rankBrauhaeuser(visits: Visit[]): BestBrauhaus[] {
  return [...groupBy(scored(visits), v => v.slug).values()].map((vs) => {
    const avg = (k: Category | 'gesamt') => mean(vs.map(v => v.averages[k] ?? 0))
    const last = vs.reduce((a, b) => (b.date > a.date ? b : a))
    const lastScore = (k: Category | 'gesamt') => last.averages[k] ?? 0
    return {
      name: vs[0]!.brauhaus,
      slug: vs[0]!.slug,
      besuche: vs.length,
      gesamt: avg('gesamt'),
      location: avg('location'),
      service: avg('service'),
      essen: avg('essen'),
      lastDate: last.date,
      latest: { gesamt: lastScore('gesamt'), location: lastScore('location'), service: lastScore('service'), essen: lastScore('essen') },
    }
  }).sort((a, b) => b.gesamt - a.gesamt)
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
const brauhausRanking = rankBrauhaeuser(visits)

const overviewStats = {
  besuche: visits.length,
  teilnehmer: data.participants.length,
  biere: sum(visits.map(v => v.biere)),
  liter: sum(visits.map(v => v.liter)),
  kosten: sum(visits.map(v => v.rechnung)),
  ersterBesuch: visits[0]?.date ?? null,
  letzterBesuch: visits.at(-1)?.date ?? null,
  bestesBrauhaus: brauhausRanking[0] ?? null,
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

const CATEGORIES: Category[] = ['location', 'service', 'essen']

/** One visit seen through one member: their own votes (null = did not rate that category). */
export interface MemberVote {
  visit: Visit
  location: number | null
  service: number | null
  essen: number | null
  /** mean of the member's own category votes */
  gesamt: number
  /** the member planned this visit */
  geplant: boolean
}

export interface Teilnehmer {
  name: string
  slug: string
  /** every visit the member rated (rating = attendance), oldest first */
  votes: MemberVote[]
  stats: {
    besuche: number
    /** ISO date of the very first Stammtisch */
    start: string
    /** all visits since the very first Stammtisch */
    besucheSeitStart: number
    /** ISO date of the member's first visit */
    ersterBesuch: string
    /** all visits since the member's first visit */
    besucheSeitBeitritt: number
    /** sums of the member's per-head shares (value / (mitglieder + gaeste)) */
    biere: number
    liter: number
    kosten: number
  }
  /** group scores of the visits this member planned; null if they never planned one */
  planer: {
    besuche: number
    gesamt: number
    location: number
    service: number
    essen: number
    /** highest Gesamt first */
    visits: Visit[]
  } | null
}

const heads = (v: Visit): number => (v.mitglieder ?? 0) + (v.gaeste ?? 0)
const perHead = (v: Visit, n: number | null): number => (n != null && heads(v) > 0 ? n / heads(v) : 0)

function buildTeilnehmer(name: string, slug: string): Teilnehmer | null {
  const votes: MemberVote[] = visits.flatMap((visit) => {
    const own = CATEGORIES.map(c => visit.ratings[c][name] ?? null)
    const rated = own.filter((x): x is number => x != null)
    if (!rated.length) return []
    const [location, service, essen] = own as [number | null, number | null, number | null]
    return [{ visit, location, service, essen, gesamt: mean(rated), geplant: visit.planer === name }]
  })
  const first = votes[0]
  if (!first) return null

  const mine = votes.map(x => x.visit)
  const ersterBesuch = first.visit.date
  const geplant = scored(visits.filter(v => v.planer === name))
  const avg = (k: Category | 'gesamt') => mean(geplant.map(v => v.averages[k] ?? 0))

  return {
    name,
    slug,
    votes,
    stats: {
      besuche: votes.length,
      start: visits[0]!.date,
      besucheSeitStart: visits.length,
      ersterBesuch,
      besucheSeitBeitritt: visits.filter(v => v.date >= ersterBesuch).length,
      biere: sum(mine.map(v => perHead(v, v.biere))),
      liter: sum(mine.map(v => perHead(v, v.liter))),
      kosten: sum(mine.map(v => perHead(v, v.rechnung))),
    },
    planer: geplant.length
      ? {
          besuche: geplant.length,
          gesamt: avg('gesamt'),
          location: avg('location'),
          service: avg('service'),
          essen: avg('essen'),
          visits: [...geplant].sort((a, b) => b.averages.gesamt! - a.averages.gesamt!),
        }
      : null,
  }
}

const teilnehmer = new Map(
  data.participants.flatMap((p) => {
    const t = buildTeilnehmer(p.name, p.slug)
    return t ? [[p.slug, t] as const] : []
  }),
)

const getTeilnehmer = (slug: string): Teilnehmer | null => teilnehmer.get(slug) ?? null

/** All data is static (imported at build time), so no reactivity is needed. */
export function useStammtisch() {
  return { visits, participants: data.participants, overviewStats, brauhausRanking, getBrauhaus, getTeilnehmer }
}
