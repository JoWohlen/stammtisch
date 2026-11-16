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
  /** optional badge, e.g. "geplant" */
  badge?: string
  /** 'accent' (default): violet with crown · 'subtle': takes the tile's own colour */
  badgeTone?: 'accent' | 'subtle'
}
