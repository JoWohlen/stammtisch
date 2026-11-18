import type { Participant, Visit } from '#shared/types'
import { CATEGORIES, mean, raterNames } from './stats'

/** a member's Gesamt for one visit: mean of their own category votes, null if they did not rate */
const ownGesamt = (v: Visit, name: string): number | null => {
  const own = CATEGORIES.map(c => v.ratings[c][name]).filter((x): x is number => x != null)
  return own.length ? mean(own) : null
}

export interface PlanerBias {
  name: string
  slug: string
  /** Ø (own Gesamt − Ø Gesamt of the other raters) on visits this member planned */
  geplant: number
  /** planned visits that went into `geplant` (the member rated them, and so did someone else) */
  geplantN: number
  /** all visits this member planned, rated or not */
  geplantTotal: number
  /** Ø deviation like `geplant`, on visits someone else planned */
  fremd: number
  fremdN: number
  /** geplant − fremd: how much more generous the member is towards their own evenings */
  bonus: number
}

/**
 * Does anyone rate the evenings they planned differently?
 * Comparing raw scores would mix in restaurant quality, so every vote is taken relative to the
 * rest of the table on the same evening. A member who is generally strict or generous shows that
 * in both values; only the difference between them (`bonus`) is about planning.
 */
export function computePlanerBias(visits: Visit[], participants: Participant[]): PlanerBias[] {
  return participants.flatMap((p) => {
    const geplant: number[] = []
    const fremd: number[] = []
    for (const v of visits) {
      const own = ownGesamt(v, p.name)
      if (own == null) continue
      const others = [...raterNames(v)].filter(n => n !== p.name).map(n => ownGesamt(v, n)!)
      if (!others.length) continue
      ;(v.planer === p.name ? geplant : fremd).push(own - mean(others))
    }
    if (!geplant.length || !fremd.length) return []
    const g = mean(geplant)
    const f = mean(fremd)
    const geplantTotal = visits.filter(v => v.planer === p.name).length
    return [{ name: p.name, slug: p.slug, geplant: g, geplantN: geplant.length, geplantTotal, fremd: f, fremdN: fremd.length, bonus: g - f }]
  }).sort((a, b) => b.bonus - a.bonus)
}
