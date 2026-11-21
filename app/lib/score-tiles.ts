export type Metric = 'gesamt' | 'location' | 'service' | 'essen'

/** One coloured tile in a ScoreTileGrid. */
export interface ScoreTile {
  key: string
  name: string
  /** link target */
  to: string
  /** ISO date shown on the tile and used by the "Datum" sort */
  date: string
  /** null = no score in this metric (shown as "–", sorted last) */
  scores: Record<Metric, number | null>
  /** optional extra facts shown under the name, e.g. "Kölsch", "14 Personen" */
  details?: string[]
  /** visit number for repeat visits, shown as a small repeat icon + number after the name */
  repeat?: number
  /** optional badge, e.g. "geplant" */
  badge?: string
  /** 'accent' (default): dark pill with crown, next to the name · 'subtle': outlined, in the details line */
  badgeTone?: 'accent' | 'subtle'
}
