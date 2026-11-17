import type { ScoreMap, Visit } from '#shared/types'
import { CATEGORIES } from '@/lib/stats'

export { CATEGORIES }

/** population standard deviation of one category's votes, null with fewer than 2 votes */
export function spread(scores: ScoreMap): number | null {
  const xs = Object.values(scores)
  if (xs.length < 2) return null
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length)
}

/** mean spread over the three categories */
export function visitSpread(v: Visit): number | null {
  const s = CATEGORIES.map(c => spread(v.ratings[c])).filter((x): x is number => x != null)
  return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null
}

/** thresholds fit the data: per-visit spread ranges from about 0,2 to 0,8 */
export function consensusLabel(s: number): { title: string, text: string, tone: 'good' | 'mid' | 'bad' } {
  if (s < 0.3) return { title: 'Die Bewertung war sehr einheitlich', text: 'Alle Mitglieder lagen fast gleichauf.', tone: 'good' }
  if (s < 0.45) return { title: 'Die Bewertung war weitgehend einheitlich', text: 'Kleine Abweichungen, aber im Großen und Ganzen waren sich alle einig.', tone: 'good' }
  if (s < 0.6) return { title: 'Die Meinungen gingen etwas auseinander', text: 'Einige Mitglieder haben spürbar anders bewertet als der Rest.', tone: 'mid' }
  return { title: 'Alle Mitglieder haben sehr unterschiedlich abgestimmt', text: 'Bei diesem Besuch lagen die Bewertungen weit auseinander.', tone: 'bad' }
}
