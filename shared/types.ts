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
  /** location from the "Koordinaten" column (Google Maps "lat, lng"), null if missing */
  coords: Coords | null
  /** Stadtteil/Stadtbezirk the coords fall into, null outside Cologne or without coords */
  lage: Lage | null
  /** street address as written in the xlsx */
  adresse: string | null
  /** restaurant website (always with protocol) */
  website: string | null
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

export interface Lage {
  stadtteil: string
  stadtbezirk: string
}

export interface Coords {
  lat: number
  lng: number
}

/** [lng, lat] pairs, closed (first = last) */
export type Ring = [number, number][]

export interface District {
  nummer: string
  name: string
  /** the Stadtbezirk this area belongs to (for a Stadtbezirk: its own name) */
  stadtbezirk: string
  /** each polygon = outer ring + optional holes */
  polygons: Ring[][]
}

/** data/koeln-geo.json, written by scripts/fetch-geo.ts */
export interface KoelnGeo {
  source: string
  stadtteile: District[]
  stadtbezirke: District[]
}
