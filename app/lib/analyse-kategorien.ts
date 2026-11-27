/** sections of the Analyse page, shared by the page tabs and the app menu */
export type Kategorie = 'bewertungen' | 'termine' | 'bier' | 'orte'

export const KATEGORIEN: { key: Kategorie, label: string, short: string, hint: string }[] = [
  { key: 'bewertungen', label: 'Bewertungen', short: 'Noten', hint: 'Wie wir bewerten, wer ähnlich tickt und wie sich das verändert' },
  { key: 'termine', label: 'Termine', short: 'Termine', hint: 'Wer wann da war, Jahreszeiten und wie regelmäßig wir uns treffen' },
  { key: 'bier', label: 'Bier', short: 'Bier', hint: 'Was wir trinken und was es kostet' },
  { key: 'orte', label: 'Orte', short: 'Orte', hint: 'Wo in Köln wir schon waren' },
]

export const KATEGORIE_KEYS = KATEGORIEN.map(k => k.key)

export const isKategorie = (v: unknown): v is Kategorie => KATEGORIE_KEYS.includes(v as Kategorie)

/** route to one section; the first one is the plain page, as the tabs write it */
export const kategorieRoute = (k: Kategorie) => ({
  path: '/analyse',
  query: k === KATEGORIE_KEYS[0] ? {} : { kategorie: k },
})
