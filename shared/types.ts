export type Category = 'location' | 'service' | 'essen'

/** Score per rater name, only raters who actually rated this visit. */
export type ScoreMap = Record<string, number>

export interface Visit {
  nr: number
  /** ISO date (YYYY-MM-DD) */
  date: string
  brauhaus: string
  slug: string
  bier: string | null
  mitglieder: number | null
  gaeste: number | null
  rechnung: number | null
  biere: number | null
  liter: number | null
  bierpreis: number | null
  kurze: number | null
  planer: string | null
  ratings: Record<Category, ScoreMap>
  averages: Record<Category, number | null> & {
    gesamt: number | null
    /** AVG Rechnung / Gesamt, like in the xlsx */
    preisLeistung: number | null
  }
}

export interface Participant {
  name: string
  slug: string
}

export interface StammtischData {
  generatedAt: string
  visits: Visit[]
  participants: Participant[]
}
