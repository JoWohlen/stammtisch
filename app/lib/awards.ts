import type { Component } from 'vue'
import { Banknote, Droplets, Flag, Handshake, MapPin, Martini, PartyPopper, PiggyBank, Scale, TrendingUp, Trophy, UserPlus, UsersRound, Utensils } from '@lucide/vue'
import type { Participant, Visit } from '#shared/types'
import { byDate as sortByDate, heads, raterNames } from '@/lib/stats'

export type AwardTone = 'good' | 'bad' | 'neutral'

export interface Award {
  key: string
  label: string
  icon: Component
  tone: AwardTone
  /** explains the tag on hover */
  hint: string
  /** member the award is about, links the tag to their page */
  member?: string
}

const EPS = 1e-9

/** visit numbers that reach the extreme of `get` (ties all win), ignoring missing values */
function extreme(visits: Visit[], get: (v: Visit) => number | null, dir: 'max' | 'min'): Set<number> {
  const xs = visits.flatMap((v) => {
    const x = get(v)
    return x == null ? [] : [{ nr: v.nr, x }]
  })
  if (!xs.length) return new Set()
  const best = dir === 'max' ? Math.max(...xs.map(e => e.x)) : Math.min(...xs.map(e => e.x))
  return new Set(xs.filter(e => Math.abs(e.x - best) < EPS).map(e => e.nr))
}

interface Rule {
  key: string
  label: string
  icon: Component
  tone: AwardTone
  hint: string
  winners: Set<number>
}

/** Tags per visit (by visit nr), derived from all visits. Static data → call once. */
export function computeAwards(visits: Visit[], participants: Participant[]): Map<number, Award[]> {
  const byDate = sortByDate(visits)
  const first = byDate[0]

  // a member joins with their first rating; the founders of the first Stammtisch don't "join"
  const joined = new Map<string, Visit>()
  for (const v of byDate) {
    for (const name of raterNames(v)) if (!joined.has(name)) joined.set(name, v)
  }

  const pricePerHead = (v: Visit) => (v.rechnung != null && heads(v) ? v.rechnung / heads(v) : null)

  const rules: Rule[] = [
    { key: 'nr1', label: 'Die eine Nummer 1', icon: Trophy, tone: 'good', hint: 'Beste Gesamtbewertung aller Besuche', winners: extreme(visits, v => v.averages.gesamt, 'max') },
    { key: 'bier', label: 'Bierbrunnen', icon: Droplets, tone: 'neutral', hint: 'Meiste Liter Bier an einem Abend', winners: extreme(visits, v => v.liter, 'max') },
    { key: 'geld', label: 'Geldgrab', icon: Banknote, tone: 'bad', hint: 'Höchste Rechnung pro Kopf', winners: extreme(visits, pricePerHead, 'max') },
    { key: 'essen+', label: 'Bestes Essen', icon: Utensils, tone: 'good', hint: 'Beste Bewertung für Essen & Trinken', winners: extreme(visits, v => v.averages.essen, 'max') },
    { key: 'essen-', label: 'Schlechtestes Essen', icon: Utensils, tone: 'bad', hint: 'Schlechteste Bewertung für Essen & Trinken', winners: extreme(visits, v => v.averages.essen, 'min') },
    { key: 'loc+', label: 'Beste Location', icon: MapPin, tone: 'good', hint: 'Beste Bewertung für die Location', winners: extreme(visits, v => v.averages.location, 'max') },
    { key: 'loc-', label: 'Schlechteste Location', icon: MapPin, tone: 'bad', hint: 'Schlechteste Bewertung für die Location', winners: extreme(visits, v => v.averages.location, 'min') },
    { key: 'serv+', label: 'Bester Service', icon: Handshake, tone: 'good', hint: 'Beste Bewertung für den Service', winners: extreme(visits, v => v.averages.service, 'max') },
    { key: 'serv-', label: 'Schlechtester Service', icon: Handshake, tone: 'bad', hint: 'Schlechteste Bewertung für den Service', winners: extreme(visits, v => v.averages.service, 'min') },
    { key: 'kurze', label: 'Meiste Kurze', icon: Martini, tone: 'neutral', hint: 'Die meisten Kurzen an einem Abend', winners: extreme(visits, v => v.kurze, 'max') },
    { key: 'pl', label: 'Beste Preis/Leistung', icon: Scale, tone: 'good', hint: 'Niedrigster Wert € pro Kopf / Gesamt', winners: extreme(visits, v => v.averages.preisLeistung, 'min') },
    { key: 'bp+', label: 'Teuerstes Bier', icon: TrendingUp, tone: 'bad', hint: 'Höchster Bierpreis', winners: extreme(visits, v => v.bierpreis, 'max') },
    { key: 'bp-', label: 'Billigstes Bier', icon: PiggyBank, tone: 'good', hint: 'Niedrigster Bierpreis', winners: extreme(visits, v => v.bierpreis, 'min') },
  ]

  const names = participants.map(p => p.name)
  const joinedList = [...joined.entries()]
  const awards = new Map<number, Award[]>()
  for (const v of byDate) {
    const list: Award[] = []
    const push = (a: Award) => list.push(a)

    if (v === first) push({ key: 'first', label: 'Erster Stammtisch', icon: Flag, tone: 'neutral', hint: 'Hier hat alles angefangen' })

    for (const name of names) {
      if (v !== first && joined.get(name) === v) {
        push({ key: `join-${name}`, label: `${name} wird Mitglied`, icon: PartyPopper, tone: 'neutral', hint: `${name}s erster Stammtisch`, member: name })
      }
    }

    // full house: everyone who had joined by this date rated it (newcomers count from their first visit on)
    const present = raterNames(v)
    const members = joinedList.filter(([, j]) => j.date <= v.date).map(([n]) => n)
    if (members.length && members.every(n => present.has(n))) {
      push({ key: 'voll', label: 'Vollständig', icon: UsersRound, tone: 'good', hint: 'Alle Mitglieder waren da' })
    }

    if (v.gaeste) {
      push({ key: 'gaeste', label: v.gaeste === 1 ? '1 Gast' : `${v.gaeste} Gäste`, icon: UserPlus, tone: 'neutral', hint: 'Gäste waren dabei' })
    }

    for (const r of rules) {
      if (r.winners.has(v.nr)) push({ key: r.key, label: r.label, icon: r.icon, tone: r.tone, hint: r.hint })
    }
    awards.set(v.nr, list)
  }
  return awards
}
