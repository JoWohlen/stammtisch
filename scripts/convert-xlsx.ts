/**
 * Converts data/Stammtisch.xlsx into data/stammtisch.json.
 * Runs automatically before dev/build/generate (see package.json).
 * Sanity checks: see scripts/checks.ts, errors stop the build.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import type { Category, Coords, KoelnGeo, Lage, Participant, ScoreMap, StammtischData, Visit } from '../shared/types'
import { contains } from '../app/lib/geo'
import { AVG_TOLERANCE, checkVisits, Report, VOTE_MAX, VOTE_MIN } from './checks'

const root = fileURLToPath(new URL('..', import.meta.url))
// `tsx scripts/convert-xlsx.ts [file.xlsx] [--check]`: --check only validates, writes nothing
const args = process.argv.slice(2)
const CHECK_ONLY = args.includes('--check')
const SRC = args.find(a => !a.startsWith('--')) ?? `${root}data/Stammtisch.xlsx`
const OUT = `${root}data/stammtisch.json`
const GEO = `${root}data/koeln-geo.json`

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

const report = new Report()

/** a cell that should hold a number: empty/"-" → null, text or an Excel error → error, negative → error */
function numCell(v: Cell, label: string, at: string): number | null {
  if (v == null || clean(v) === '' || clean(v) === '-') return null
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    report.error(at, `${label} "${clean(v)}" ist keine Zahl (als Text eingetragen? Komma statt Punkt?)`)
    return null
  }
  if (v < 0) report.error(at, `${label} ist negativ (${v})`)
  return v
}

interface Table {
  header: string[]
  /** rows with a non-empty "Brauhaus" */
  rows: Row[]
  /** Excel row number of each entry in `rows` */
  lines: number[]
  /** rows without a Brauhaus name, with their Excel row number */
  unnamed: { row: Row, line: number }[]
}

/** Returns the header row and the data rows below it. */
function readTable(wb: XLSX.WorkBook, sheet: string): Table {
  const ws = wb.Sheets[sheet]
  if (!ws) throw new Error(`Sheet "${sheet}" not found`)
  const first = XLSX.utils.decode_range(ws['!ref'] ?? 'A1').s.r + 1
  const all = XLSX.utils.sheet_to_json<Row>(ws, { header: 1, defval: null, raw: true, blankrows: true })
  const h = all.findIndex(r => clean(r[0]) === 'Brauhaus')
  if (h < 0) throw new Error(`No "Brauhaus" header row in sheet "${sheet}"`)
  const header = all[h]!.map(clean)
  const t: Table = { header, rows: [], lines: [], unnamed: [] }
  all.slice(h + 1).forEach((r, i) => {
    const name = clean(r[0])
    const line = first + h + 1 + i
    if (name === '') t.unnamed.push({ row: r, line })
    else if (!name.startsWith('#')) {
      t.rows.push(r)
      t.lines.push(line)
    }
  })
  return t
}

/** Header names (lowercase) accepted for the coordinates column (optional). */
const COORD_HEADERS = ['koordinaten', 'koordinate', 'geokoordinaten', 'geo', 'lat, lng', 'latitude, longitude']

/**
 * Parses a location as copied from Google Maps ("50.93836, 6.95995"), also with decimal commas
 * ("50,93836; 6,95995"). Empty → null. Anything else, or a point far away from the Cologne area, throws.
 */
function coords(v: Cell, brauhaus: string): Coords | null {
  const s = clean(v)
  if (!s || s === '-') return null
  const nums = s.match(/-?\d+(?:[.,]\d+)?/g)?.map(n => Number(n.replace(',', '.')))
  const [lat, lng] = nums ?? []
  if (nums?.length !== 2 || lat == null || lng == null) {
    throw new Error(`Koordinaten von "${brauhaus}" nicht lesbar: "${s}" (erwartet: "50.93836, 6.95995")`)
  }
  // Rhineland plausibility check, catches swapped lat/lng
  if (lat < 49 || lat > 53 || lng < 5 || lng > 9) {
    throw new Error(`Koordinaten von "${brauhaus}" liegen nicht im Rheinland: "${s}" (Reihenfolge Breite, Länge?)`)
  }
  return { lat, lng }
}

/** website with protocol, "www.x.de" → "https://www.x.de" */
function website(v: Cell): string | null {
  const s = clean(v)
  if (!s || s === '-') return null
  return /^https?:\/\//i.test(s) ? s : `https://${s}`
}

/** optional column: index or -1 */
const optCol = (header: string[], ...names: string[]): number =>
  header.findIndex(h => names.includes(h.toLowerCase()))

/** Index of the n-th (0-based) column with this header name. */
function col(header: string[], name: string, nth = 0): number {
  let seen = 0
  for (let i = 0; i < header.length; i++) {
    if (header[i] === name && seen++ === nth) return i
  }
  throw new Error(`Column "${name}" (#${nth + 1}) not found`)
}

/** Index of the first column whose header starts with `prefix` (e.g. "Bierpreis" matches "Bierpreis 0.2 L"). */
function colStartingWith(header: string[], prefix: string): number {
  const i = header.findIndex(h => h.startsWith(prefix))
  if (i < 0) throw new Error(`Column "${prefix}…" not found`)
  return i
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
    bierpreis: colStartingWith(H, 'Bierpreis'),
    kurze: col(H, 'Kurze'),
    planer: col(H, 'Planer'),
    datum: col(H, 'Datum'),
    nr: col(H, 'Nr'),
    coords: optCol(H, ...COORD_HEADERS),
    adresse: optCol(H, 'adresse'),
    website: optCol(H, 'website', 'webseite', 'homepage'),
    // only used for cross-checks
    brauhaus2: H.findIndex((h, i) => h === 'Brauhaus' && i > 0),
    check: optCol(H, 'check'),
    avg: {
      location: optCol(H, 'avg location'),
      service: optCol(H, 'avg service'),
      essen: optCol(H, 'avg essen/ trinken', 'avg essen/trinken', 'avg essen'),
    } as Record<Category, number>,
    avgGesamt: optCol(H, 'avg gesamt'),
  }

  // a row someone filled in but forgot the name: would silently disappear
  const filled = [c.mitglieder, c.rechnung, c.liter, c.datum]
  for (const { row, line } of general.unnamed) {
    if (filled.some(i => typeof row[i] === 'number')) report.error(`General, Zeile ${line}`, 'Besuch ohne Brauhaus-Namen, die Zeile wird ignoriert')
  }

  const geo = JSON.parse(readFileSync(GEO, 'utf8')) as KoelnGeo
  const lage = (c: Coords | null): Lage | null => {
    const t = c && geo.stadtteile.find(d => contains(d, c))
    return t ? { stadtteil: t.name, stadtbezirk: t.stadtbezirk } : null
  }
  const opt = (r: Row, i: number): Cell => (i >= 0 ? r[i] ?? null : null)

  const ratingTables = Object.fromEntries(
    (Object.entries(RATING_SHEETS) as [Category, string][]).map(([cat, sheet]) => {
      const t = readTable(wb, sheet)
      // rater columns: everything between "Brauhaus" and "AVG"
      const raters = t.header.slice(1, col(t.header, 'AVG'))
      const seen = new Set<string>()
      raters.forEach((name, j) => {
        const p = person(name)
        if (!p) report.error(`${sheet}, Spalte ${XLSX.utils.encode_col(j + 1)}`, 'Bewerter-Spalte ohne Namen')
        else if (seen.has(p)) report.error(`${sheet}`, `Bewerter "${p}" hat zwei Spalten`)
        else seen.add(p)
      })
      for (const { row, line } of t.unnamed) {
        if (raters.some((_, j) => clean(row[j + 1]) !== '')) report.error(`${sheet}, Zeile ${line}`, 'Bewertungen ohne Brauhaus-Namen, die Zeile wird ignoriert')
      }
      if (t.rows.length > general.rows.length) {
        report.error(sheet, `${t.rows.length} Zeilen, aber General hat nur ${general.rows.length} (zuerst fehlend: "${clean(t.rows[general.rows.length]![0])}")`)
      }
      return [cat, { raters, rows: t.rows, lines: t.lines, avg: col(t.header, 'AVG'), count: optCol(t.header, 'count') }]
    }),
  ) as Record<Category, { raters: string[], rows: Row[], lines: number[], avg: number, count: number }>

  const people = new Set<string>()

  const visits: Visit[] = general.rows.map((r, i) => {
    const brauhaus = clean(r[c.brauhaus])
    const at = `General, Zeile ${general.lines[i]} (${brauhaus})`
    const n = (idx: number, label: string) => numCell(r[idx], label, at)
    const ratings = {} as Record<Category, ScoreMap>
    const catAvg = {} as Record<Category, number | null>

    for (const cat of Object.keys(RATING_SHEETS) as Category[]) {
      const sheet = RATING_SHEETS[cat]
      const { raters, rows, lines, avg, count } = ratingTables[cat]
      const row = rows[i]
      if (!row || clean(row[0]) !== brauhaus) {
        throw new Error(`Row ${i + 1} in ${sheet} is "${clean(row?.[0] ?? null)}", expected "${brauhaus}"`)
      }
      const rAt = `${sheet}, Zeile ${lines[i]} (${brauhaus})`
      const scores: ScoreMap = {}
      raters.forEach((name, j) => {
        const p = person(name)
        const v = numCell(row[j + 1], `Bewertung von ${p ?? '?'}`, rAt)
        if (v != null && (v < VOTE_MIN || v > VOTE_MAX)) report.error(rAt, `${p} hat ${v} vergeben, erlaubt sind ${VOTE_MIN}–${VOTE_MAX}`)
        if (v != null && p) {
          scores[p] = v
          people.add(p)
        }
      })
      ratings[cat] = scores
      // rounded like the AVG cells in the xlsx, so Gesamt matches Excel
      catAvg[cat] = round2(mean(Object.values(scores)))

      // Excel's cached results: differ when a formula range wasn't extended to a new row/column
      const xAvg = num(row[avg])
      if (catAvg[cat] != null && (xAvg == null || Math.abs(xAvg - catAvg[cat]!) > AVG_TOLERANCE)) {
        report.warn(rAt, `AVG in Excel ist ${clean(row[avg]) || 'leer'}, berechnet ${catAvg[cat]} (Formelbereich prüfen)`, 'excel-avg', num(r[c.nr]) ?? undefined)
      }
      const xCount = count >= 0 ? num(row[count]) : null
      if (xCount != null && xCount !== Object.keys(scores).length) {
        report.warn(rAt, `Count in Excel ist ${xCount}, aber ${Object.keys(scores).length} Bewertungen eingetragen (Formelbereich prüfen)`, 'excel-count', num(r[c.nr]) ?? undefined)
      }
      const gAvg = c.avg[cat] >= 0 ? num(r[c.avg[cat]]) : null
      if (gAvg != null && catAvg[cat] != null && Math.abs(gAvg - catAvg[cat]!) > AVG_TOLERANCE) {
        report.warn(at, `${H[c.avg[cat]]} ist ${gAvg}, im Blatt ${sheet} ${catAvg[cat]}`, 'excel-avg-general', num(r[c.nr]) ?? undefined)
      }
    }
    if (c.brauhaus2 >= 0 && clean(r[c.brauhaus2]) && clean(r[c.brauhaus2]) !== brauhaus) {
      report.warn(at, `zweite Brauhaus-Spalte sagt "${clean(r[c.brauhaus2])}"`, 'brauhaus-spalte', num(r[c.nr]) ?? undefined)
    }
    const check = c.check >= 0 ? clean(r[c.check]) : '✔'
    if (check && check !== '✔') report.warn(at, `Spalte Check zeigt "${check}"`, 'excel-check', num(r[c.nr]) ?? undefined)

    const cats = Object.values(catAvg).filter((x): x is number => x != null)
    const gesamt = cats.length === 3 ? round2(mean(cats)) : null
    const rechnung = n(c.rechnung, 'Rechnung')
    const mitglieder = n(c.mitglieder, 'Mitglieder')
    const gaeste = n(c.gaeste, 'Gäste')
    const heads = (mitglieder ?? 0) + (gaeste ?? 0)
    const avgRechnung = rechnung != null && heads > 0 ? round2(rechnung / heads) : null
    const datum = n(c.datum, 'Datum')
    if (datum == null && clean(r[c.datum]) === '') report.error(at, 'kein Datum')
    const gesamtX = c.avgGesamt >= 0 ? num(r[c.avgGesamt]) : null
    const point = coords(opt(r, c.coords), brauhaus)
    const nr = n(c.nr, 'Nr') ?? i + 1
    if (Object.values(catAvg).every(x => x != null) && gesamtX != null) {
      const g = round2(mean(Object.values(catAvg) as number[]))!
      if (Math.abs(gesamtX - g) > AVG_TOLERANCE) report.warn(at, `AVG Gesamt ist ${gesamtX}, berechnet ${g}`, 'excel-avg-general', nr)
    }

    return {
      nr,
      date: datum == null ? '0000-00-00' : excelDate(datum),
      brauhaus,
      slug: slugify(brauhaus),
      bier: clean(r[c.bier]) || null,
      mitglieder,
      gaeste,
      rechnung,
      biere: n(c.biere, 'Bier (Anzahl)'),
      liter: n(c.liter, 'Liter Bier'),
      bierpreis: n(c.bierpreis, 'Bierpreis'),
      // an empty Kurze field means none were drunk
      kurze: n(c.kurze, 'Kurze') ?? 0,
      planer: person(r[c.planer]),
      coords: point,
      lage: lage(point),
      adresse: clean(opt(r, c.adresse)) || null,
      website: website(opt(r, c.website)),
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

  checkVisits(visits, [...people], report)
  report.print()
  if (report.hasErrors) {
    console.error('\n✖ data/stammtisch.json wurde nicht aktualisiert. Bitte die Fehler in der xlsx beheben.')
    process.exit(1)
  }

  if (CHECK_ONLY) {
    console.log(`✔ ${visits.length} Besuche, ${participants.length} Mitglieder, keine Fehler`)
    return
  }

  const data: StammtischData = { generatedAt: new Date().toISOString(), visits, participants }
  writeFileSync(OUT, `${JSON.stringify(data, null, 2)}\n`)
  console.log(`✔ ${visits.length} Besuche, ${participants.length} Mitglieder → data/stammtisch.json`)
}

main()
