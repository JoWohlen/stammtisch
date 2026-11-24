import type { Component } from 'vue'
import { CakeSlice, Flag, Medal, PartyPopper, TreePine, Trophy } from '@lucide/vue'
import type { Visit } from '#shared/types'
import type { Award } from '@/lib/awards'

/** something worth mentioning about one Stammtisch on the Timeline */
export interface TimelineEvent {
  key: string
  icon: Component
  label: string
  /** link, e.g. to a new member's page */
  to?: string
  /** podium colour for the top 3, otherwise neutral */
  tone: 'gold' | 'silber' | 'bronze' | 'neutral'
}

export interface TimelineEntry {
  visit: Visit
  /** running number in date order (1 = first Stammtisch) */
  nth: number
  events: TimelineEvent[]
}

export interface TimelineYear {
  year: string
  entries: TimelineEntry[]
}

const PODIUM = [
  { tone: 'gold', label: 'Bester Stammtisch', icon: Trophy },
  { tone: 'silber', label: 'Zweitbester Stammtisch', icon: Medal },
  { tone: 'bronze', label: 'Drittbester Stammtisch', icon: Medal },
] as const

/**
 * Every Stammtisch from the first to the latest, grouped by year, with its highlights:
 * the first one, the three best (Ø Gesamt), and as in the awards: the Weihnachtsessen
 * (the last Stammtisch in December), Jubiläen and new members.
 */
export function buildTimeline(
  visits: Visit[],
  getAwards: (v: Visit) => Award[],
  memberPath: (name: string) => string | null,
): TimelineYear[] {
  const byDate = [...visits].sort((a, b) => a.date.localeCompare(b.date) || a.nr - b.nr)

  // best first; on a tie the earlier evening wins
  const podium = byDate.filter(v => v.averages.gesamt != null)
    .sort((a, b) => b.averages.gesamt! - a.averages.gesamt! || a.date.localeCompare(b.date))
    .slice(0, PODIUM.length)

  const entries = byDate.map((v, i): TimelineEntry => {
    const events: TimelineEvent[] = []
    const awards = getAwards(v)
    if (awards.some(a => a.type === 'first')) events.push({ key: 'first', icon: Flag, label: 'Erster Stammtisch', tone: 'neutral' })
    const place = podium.indexOf(v)
    if (place >= 0) events.push({ key: 'podium', ...PODIUM[place]! })
    if (awards.some(a => a.type === 'weihnachten')) events.push({ key: 'xmas', icon: TreePine, label: 'Weihnachtsessen', tone: 'neutral' })
    for (const a of awards) {
      if (a.type === 'jubilaeum') events.push({ key: a.key, icon: CakeSlice, label: `Jubiläum: ${a.detail}`, tone: 'neutral' })
      if (a.type === 'join') {
        events.push({ key: a.key, icon: PartyPopper, label: a.label, to: (a.member && memberPath(a.member)) || undefined, tone: 'neutral' })
      }
    }
    return { visit: v, nth: i + 1, events }
  })

  const years = new Map<string, TimelineEntry[]>()
  for (const e of entries) {
    const y = e.visit.date.slice(0, 4)
    years.set(y, [...(years.get(y) ?? []), e])
  }
  return [...years].map(([year, list]) => ({ year, entries: list }))
}
