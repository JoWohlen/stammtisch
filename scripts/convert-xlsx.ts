/**
 * Converts data/Stammtisch.xlsx into data/stammtisch.json.
 * Runs automatically before dev/build/generate (see package.json).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import type { Category, Participant, ScoreMap, StammtischData, Visit } from '../shared/types'

const root = fileURLToPath(new URL('..', import.meta.url))
const SRC = `${root}data/Stammtisch.xlsx`
const OUT = `${root}data/stammtisch.json`

const ALIASES: Record<string, string> = { Florian: 'Flo' }
const RATING_SHEETS: Record<Category, string> = {
  location: 'Location',
  service: 'Service',
  essen: 'Essen_Trinken',
}

type Cell = string | number | boolean | null
type Row = Cell[]

const clean = (v: Cell): string => String(v ?? '').trim()
const person = (v: Cell): string | null => {
  const s = clean(v)
  if (!s || s === '-') return null
  return ALIASES[s] ?? s
}
const num = (v: Cell): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const round2 = (x: number | null): number | null => (x == null ? null : Math.round(x * 100) / 100)

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Excel serial date → ISO date string (1900 date system). */
const excelDate = (serial: number): string =>
  new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().slice(0, 10)

/** Returns the header row and the data rows below it (rows with a non-empty "Brauhaus"). */
function readTable(wb: XLSX.WorkBook, sheet: string): { header: string[], rows: Row[] } {
  const ws = wb.Sheets[sheet]
  if (!ws) throw new Error(`Sheet "${sheet}" not found`)
  const all = XLSX.utils.sheet_to_json<Row>(ws, { header: 1, defval: null, raw: true })
  const h = all.findIndex(r => clean(r[0]) === 'Brauhaus')
  if (h < 0) throw new Error(`No "Brauhaus" header row in sheet "${sheet}"`)
  const header = all[h]!.map(clean)
  const rows = all.slice(h + 1).filter(r => clean(r[0]) !== '' && !clean(r[0]).startsWith('#'))
  return { header, rows }
}

/** Index of the n-th (0-based) column with this header name. */
function col(header: string[], name: string, nth = 0): number {
  let seen = 0
  for (let i = 0; i < header.length; i++) {
    if (header[i] === name && seen++ === nth) return i
  }
  throw new Error(`Column "${name}" (#${nth + 1}) not found`)
}

function main() {
  const wb = XLSX.read(readFileSync(SRC), { type: 'buffer' })

  const general = readTable(wb, 'General')
  const H = general.header
  const c = {
    brauhaus: col(H, 'Brauhaus'),
    bier: col(H, 'Bier', 0),
    mitglieder: col(H, 'Mitglieder'),
    gaeste: col(H, 'Gäste'),
    rechnung: col(H, 'Rechnung'),
    biere: col(H, 'Bier', 1),
    liter: col(H, 'Liter Bier'),
    bierpreis: col(H, 'Bierpreis'),
    kurze: col(H, 'Kurze'),
    planer: col(H, 'Planer'),
    datum: col(H, 'Datum'),
    nr: col(H, 'Nr'),
  }

  const ratingTables = Object.fromEntries(
    (Object.entries(RATING_SHEETS) as [Category, string][]).map(([cat, sheet]) => {
      const t = readTable(wb, sheet)
      // rater columns: everything between "Brauhaus" and "AVG"
      const raters = t.header.slice(1, col(t.header, 'AVG'))
      return [cat, { raters, rows: t.rows }]
    }),
  ) as Record<Category, { raters: string[], rows: Row[] }>

  const people = new Set<string>()

  const visits: Visit[] = general.rows.map((r, i) => {
    const brauhaus = clean(r[c.brauhaus])
    const ratings = {} as Record<Category, ScoreMap>
    const catAvg = {} as Record<Category, number | null>

    for (const cat of Object.keys(RATING_SHEETS) as Category[]) {
      const { raters, rows } = ratingTables[cat]
      const row = rows[i]
      if (!row || clean(row[0]) !== brauhaus) {
        throw new Error(`Row ${i + 1} in ${RATING_SHEETS[cat]} is "${clean(row?.[0] ?? null)}", expected "${brauhaus}"`)
      }
      const scores: ScoreMap = {}
      raters.forEach((name, j) => {
        const v = num(row[j + 1])
        const p = person(name)
        if (v != null && p) {
          scores[p] = v
          people.add(p)
        }
      })
      ratings[cat] = scores
      // rounded like the AVG cells in the xlsx, so Gesamt matches Excel
      catAvg[cat] = round2(mean(Object.values(scores)))
    }

    const cats = Object.values(catAvg).filter((x): x is number => x != null)
    const gesamt = cats.length === 3 ? round2(mean(cats)) : null
    const rechnung = num(r[c.rechnung])
    const mitglieder = num(r[c.mitglieder])
    const gaeste = num(r[c.gaeste])
    const heads = (mitglieder ?? 0) + (gaeste ?? 0)
    const avgRechnung = rechnung != null && heads > 0 ? round2(rechnung / heads) : null
    const datum = num(r[c.datum])
    if (datum == null) throw new Error(`Visit "${brauhaus}" has no date`)

    return {
      nr: num(r[c.nr]) ?? i + 1,
      date: excelDate(datum),
      brauhaus,
      slug: slugify(brauhaus),
      bier: clean(r[c.bier]) || null,
      mitglieder,
      gaeste,
      rechnung,
      biere: num(r[c.biere]),
      liter: num(r[c.liter]),
      bierpreis: num(r[c.bierpreis]),
      kurze: num(r[c.kurze]),
      planer: person(r[c.planer]),
      ratings,
      averages: {
        location: round2(catAvg.location),
        service: round2(catAvg.service),
        essen: round2(catAvg.essen),
        gesamt: round2(gesamt),
        preisLeistung: round2(avgRechnung != null && gesamt ? avgRechnung / gesamt : null),
      },
    }
  })

  visits.sort((a, b) => a.date.localeCompare(b.date) || a.nr - b.nr)

  const participants: Participant[] = [...people].map(name => ({ name, slug: slugify(name) }))

  const data: StammtischData = { generatedAt: new Date().toISOString(), visits, participants }
  writeFileSync(OUT, `${JSON.stringify(data, null, 2)}\n`)
  console.log(`✔ ${visits.length} Besuche, ${participants.length} Teilnehmer → data/stammtisch.json`)
}

main()
