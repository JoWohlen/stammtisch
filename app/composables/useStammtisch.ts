import type { Category, Coords, Lage, StammtischData, Visit } from '#shared/types'
import raw from '../../data/stammtisch.json'
import { AWARD_DEFS, computeAwards, computeMemberAwards, type Award } from '@/lib/awards'
import { computeFunFacts } from '@/lib/funfacts'
import { distance } from '@/lib/geo'
import { CATEGORIES, groupBy, heads, mean, sum } from '@/lib/stats'

const data = raw as StammtischData

const scored = (vs: Visit[]) => vs.filter(v => v.averages.gesamt != null)

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

/** the single best evening (highest Gesamt; ties → the earlier visit) */
export interface BestVisit {
  nr: number
  name: string
  slug: string
  date: string
  gesamt: number
  location: number | null
  service: number | null
  essen: number | null
}

function bestVisit(visits: Visit[]): BestVisit | null {
  const v = [...scored(visits)].sort((a, b) => b.averages.gesamt! - a.averages.gesamt! || a.date.localeCompare(b.date))[0]
  if (!v) return null
  const { location, service, essen, gesamt } = v.averages
  return { nr: v.nr, name: v.brauhaus, slug: v.slug, date: v.date, gesamt: gesamt!, location, service, essen }
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

/** Ø Gesamt of the last `months` calendar months (ending with the month of the newest visit) vs the same span before */
export interface ScoreTrend {
  months: number
  aktuell: number
  vorher: number | null
  /** 'flat' only when both windows are exactly equal */
  richtung: 'up' | 'down' | 'flat'
}

function scoreTrend(visits: Visit[], months = 6): ScoreTrend | null {
  const last = visits.at(-1)
  if (!last) return null
  const idx = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1
  const end = idx(last.date)
  const avg = (from: number, to: number) => {
    const vs = scored(visits).filter(v => idx(v.date) > from && idx(v.date) <= to)
    return vs.length ? mean(vs.map(v => v.averages.gesamt!)) : null
  }
  const aktuell = avg(end - months, end)
  if (aktuell == null) return null
  const vorher = avg(end - 2 * months, end - months)
  const d = vorher == null ? 0 : aktuell - vorher
  return { months, aktuell, vorher, richtung: d > 0 ? 'up' : d < 0 ? 'down' : 'flat' }
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
  bestesBrauhaus: bestVisit(visits),
  besterPlaner: bestPlaner(visits),
  trend: scoreTrend(visits),
}

export type OverviewStats = typeof overviewStats

/** how to find a Brauhaus; each field from the newest visit that has it */
export interface Ort {
  adresse: string | null
  website: string | null
  coords: Coords | null
  lage: Lage | null
}

export interface Brauhaus {
  name: string
  slug: string
  /** newest visit first */
  visits: Visit[]
  ort: Ort
}

const brauhaeuser = new Map<string, Brauhaus>(
  [...groupBy(visits, v => v.slug).entries()].map(([slug, vs]) => {
    const sorted = [...vs].sort((a, b) => b.date.localeCompare(a.date))
    const pick = <K extends keyof Ort>(k: K): Ort[K] => (sorted.find(v => v[k] != null)?.[k] ?? null) as Ort[K]
    const ort: Ort = { adresse: pick('adresse'), website: pick('website'), coords: pick('coords'), lage: pick('lage') }
    return [slug, { name: vs[0]!.brauhaus, slug, visits: sorted, ort }]
  }),
)

const getBrauhaus = (slug: string): Brauhaus | null => brauhaeuser.get(slug) ?? null

export interface Nachbar {
  name: string
  slug: string
  /** straight-line distance in meters */
  meter: number
}

/** other Brauhäuser within `radius` meters (straight line), closest first */
function getNachbarn(slug: string, radius = 1000): Nachbar[] {
  const from = brauhaeuser.get(slug)?.ort.coords
  if (!from) return []
  return [...brauhaeuser.values()]
    .flatMap((b) => {
      const to = b.ort.coords
      if (b.slug === slug || !to) return []
      const meter = distance(from, to)
      return meter <= radius ? [{ name: b.name, slug: b.slug, meter }] : []
    })
    .sort((a, b) => a.meter - b.meter)
}

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

const awards = computeAwards(visits, data.participants)
const getAwards = (v: Visit): Award[] => awards.get(v.nr) ?? []
const memberAwards = computeMemberAwards(visits, data.participants)
const getMemberAwards = (name: string): Award[] => memberAwards.get(name) ?? []

/** one place an award was handed out, for the list on /awards */
export interface AwardMention {
  key: string
  /** Brauhaus or member name */
  title: string
  to: string
  /** ISO date of the visit (Brauhaus awards only) */
  date?: string
  /** specific label when it differs from the award's name, e.g. "Lisa wird Mitglied" */
  note?: string
  detail?: string
}

/** award type → every mention, newest visit first / participant order */
const awardMentions = new Map<string, AwardMention[]>(AWARD_DEFS.map(d => [d.type, []]))
for (const v of [...visits].sort((a, b) => b.date.localeCompare(a.date) || b.nr - a.nr)) {
  for (const a of getAwards(v)) {
    awardMentions.get(a.type)!.push({
      key: `${v.nr}-${a.key}`,
      title: v.brauhaus,
      to: `/brauhaus/${v.slug}?besuch=${v.nr}`,
      date: v.date,
      note: a.label !== AWARD_DEFS.find(d => d.type === a.type)!.label ? a.label : undefined,
      detail: a.detail,
    })
  }
}
for (const p of data.participants) {
  for (const a of getMemberAwards(p.name)) {
    awardMentions.get(a.type)!.push({ key: a.key, title: p.name, to: `/teilnehmer/${p.slug}`, detail: a.detail })
  }
}
const getAwardMentions = (type: string): AwardMention[] => awardMentions.get(type) ?? []

const funFacts = computeFunFacts(visits, data.participants)

/** All data is static (imported at build time), so no reactivity is needed. */
const memberSlugs = new Map(data.participants.map(p => [p.name, p.slug]))
/** route to a member's page, or null for names without one */
const memberPath = (name: string | null | undefined): string | null => {
  const slug = name ? memberSlugs.get(name) : undefined
  return slug ? `/teilnehmer/${slug}` : null
}

export function useStammtisch() {
  return { visits, participants: data.participants, overviewStats, brauhausRanking, brauhaeuser: [...brauhaeuser.values()], getBrauhaus, getNachbarn, getTeilnehmer, getAwards, getMemberAwards, getAwardMentions, funFacts, memberPath }
}
