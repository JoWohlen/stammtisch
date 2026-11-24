/**
 * Sanity checks for data/Stammtisch.xlsx, run by convert-xlsx.ts on every dev/build/generate.
 *
 * - error   → the conversion stops and the build fails (the data would be wrong on the site)
 * - warning → printed, the build continues (probably a typo, but could be intended)
 */
import type { Category, Visit } from '../shared/types'
import { SATZUNG } from '../app/lib/satzung'
import { MEMBER_PALETTE } from '../app/lib/member-palette'

/** Warnings that were checked and are fine. Key: "<check>#<Nr>", printed next to every warning. */
const ACCEPTED = new Set<string>([
  // liters as entered, confirmed correct (bigger glasses counted as 0.2 l)
  'liter-0.2#1', 'liter-0.2#3', 'liter-0.2#19', 'liter-0.2#27', 'liter-0.2#29',
  // Kevin planned Malzmühle but couldn't join
  'planer-abwesend#2',
])

export const VOTE_MIN = 1
export const VOTE_MAX = 5
const BIERPREIS = { min: 1, max: 5 }
const PRO_KOPF = { min: 10, max: 150 }
/** same Brauhaus, coordinates further apart than this → probably a copy-paste mistake */
const MAX_COORD_DRIFT_M = 300
/** cached Excel AVG vs our own mean */
export const AVG_TOLERANCE = 0.011

interface Issue { level: 'error' | 'warning', where: string, msg: string, key?: string }

export class Report {
  private issues: Issue[] = []
  private accepted = 0

  error(where: string, msg: string) {
    this.issues.push({ level: 'error', where, msg })
  }

  /** `check` + `nr` form the key under which a warning can be put on the ACCEPTED list */
  warn(where: string, msg: string, check?: string, nr?: number) {
    const key = check ? `${check}${nr != null ? `#${nr}` : ''}` : undefined
    if (key && ACCEPTED.has(key)) {
      this.accepted++
      return
    }
    this.issues.push({ level: 'warning', where, msg, key })
  }

  get hasErrors() {
    return this.issues.some(i => i.level === 'error')
  }

  print() {
    const gh = !!process.env.GITHUB_ACTIONS
    for (const level of ['error', 'warning'] as const) {
      const list = this.issues.filter(i => i.level === level)
      if (!list.length) continue
      console.log(`\n${level === 'error' ? '✖' : '⚠'} ${list.length} ${level === 'error' ? 'Fehler' : 'Warnung(en)'} in data/Stammtisch.xlsx:`)
      for (const i of list) {
        const line = `${i.where}: ${i.msg}${i.key ? `  [${i.key}]` : ''}`
        console.log(`  ${line}`)
        // shows up as an annotation on the GitHub Actions run
        if (gh) console.log(`::${level} title=Stammtisch.xlsx::${line}`)
      }
    }
    if (this.accepted) console.log(`  (${this.accepted} bekannte Warnung(en) ausgeblendet, siehe ACCEPTED in scripts/checks.ts)`)
  }
}

export const where = (v: Pick<Visit, 'nr' | 'brauhaus'>) => `#${v.nr} ${v.brauhaus}`

const CATEGORY: Record<Category, string> = { location: 'Location', service: 'Service', essen: 'Essen & Trinken' }
const FIELD = { mitglieder: 'Mitglieder', rechnung: 'Rechnung', liter: 'Liter Bier', bierpreis: 'Bierpreis' } as const

const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 })

/** metres between two points (equirectangular, fine for a few km) */
function distance(a: { lat: number, lng: number }, b: { lat: number, lng: number }): number {
  const rad = Math.PI / 180
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad)
  const y = (b.lat - a.lat) * rad
  return Math.hypot(x, y) * 6_371_000
}

/** checks on the converted visits (cell-level checks happen while reading, in convert-xlsx.ts) */
export function checkVisits(visits: Visit[], members: string[], report: Report, today = new Date().toISOString().slice(0, 10)) {
  const cats = Object.keys(visits[0]?.ratings ?? {}) as Category[]

  // --- numbering and dates --------------------------------------------------
  const byNr = new Map<number, Visit[]>()
  for (const v of visits) byNr.set(v.nr, [...(byNr.get(v.nr) ?? []), v])
  for (const [nr, vs] of byNr) {
    if (vs.length > 1) report.error(`Nr ${nr}`, `kommt ${vs.length}× vor (${vs.map(v => v.brauhaus).join(', ')})`)
  }
  const nrs = [...byNr.keys()].sort((a, b) => a - b)
  for (let i = 1; i < nrs.length; i++) {
    if (nrs[i]! - nrs[i - 1]! > 1) report.warn(`Nr ${nrs[i - 1]}–${nrs[i]}`, 'Lücke in der Nummerierung', 'nr-luecke', nrs[i])
  }
  // visits are sorted by date; numbers should rise with them
  for (let i = 1; i < visits.length; i++) {
    const [a, b] = [visits[i - 1]!, visits[i]!]
    if (b.nr < a.nr) report.warn(where(b), `Nr passt nicht zum Datum: liegt nach #${a.nr} (${a.date}), hat aber eine kleinere Nr`, 'nr-datum', b.nr)
    if (a.date === b.date) report.warn(where(b), `gleiches Datum wie #${a.nr} ${a.brauhaus} (${b.date})`, 'datum-doppelt', b.nr)
  }
  for (const v of visits) {
    if (v.date > today) report.warn(where(v), `Datum ${v.date} liegt in der Zukunft`, 'datum-zukunft', v.nr)
  }

  // --- names and pages ------------------------------------------------------
  const slugs = new Map<string, Set<string>>()
  for (const v of visits) slugs.set(v.slug, (slugs.get(v.slug) ?? new Set()).add(v.brauhaus))
  for (const [slug, names] of slugs) {
    if (names.size > 1) report.error(`Brauhaus "${[...names].join('" / "')}"`, `unterschiedliche Schreibweisen ergeben dieselbe Seite /brauhaus/${slug}, bitte vereinheitlichen`)
  }
  const lower = new Map<string, string[]>()
  for (const m of members) lower.set(m.toLowerCase().replace(/\s+/g, ''), [...(lower.get(m.toLowerCase().replace(/\s+/g, '')) ?? []), m])
  for (const ns of lower.values()) {
    if (ns.length > 1) report.warn('Mitglieder', `"${ns.join('" / "')}" unterscheiden sich nur in Groß-/Kleinschreibung oder Leerzeichen`, 'name-doppelt')
  }
  if (members.length > MEMBER_PALETTE.length) {
    report.warn('Mitglieder', `${members.length} Mitglieder, aber nur ${MEMBER_PALETTE.length} Farben, Farben wiederholen sich (app/lib/member-palette.ts erweitern)`, 'farben')
  }

  // --- location ---------------------------------------------------------------
  const firstCoords = new Map<string, Visit>()
  for (const v of visits) {
    if (!v.coords) {
      report.warn(where(v), 'keine Koordinaten, erscheint nicht auf der Karte', 'koordinaten', v.nr)
      continue
    }
    if (!v.lage) report.warn(where(v), 'Koordinaten liegen außerhalb von Köln, kein Stadtteil', 'stadtteil', v.nr)
    const first = firstCoords.get(v.slug)
    if (!first) firstCoords.set(v.slug, v)
    else if (distance(first.coords!, v.coords) > MAX_COORD_DRIFT_M) {
      report.warn(where(v), `Koordinaten ${Math.round(distance(first.coords!, v.coords))} m entfernt von denen bei #${first.nr}, gleiches Lokal?`, 'koordinaten-abweichung', v.nr)
    }
  }

  // --- per visit ----------------------------------------------------------
  for (const v of visits) {
    const w = where(v)
    const missing = (Object.keys(FIELD) as (keyof typeof FIELD)[]).filter(k => v[k] == null)
    if (missing.length) report.warn(w, `leer: ${missing.map(k => FIELD[k]).join(', ')}`, 'leer', v.nr)

    // beer: always 0.2 l glasses
    if (v.liter != null && Math.abs(v.liter / 0.2 - Math.round(v.liter / 0.2)) > 1e-6) {
      report.warn(w, `${fmt(v.liter)} l Bier ist nicht durch 0,2 l teilbar`, 'liter-0.2', v.nr)
    }
    if (!Number.isInteger(v.kurze)) report.warn(w, `${fmt(v.kurze)} Kurze ist keine ganze Zahl`, 'kurze', v.nr)
    if (v.bierpreis != null && (v.bierpreis < BIERPREIS.min || v.bierpreis > BIERPREIS.max)) {
      report.warn(w, `Bierpreis ${fmt(v.bierpreis)} € wirkt unplausibel (erwartet ${BIERPREIS.min}–${BIERPREIS.max} €)`, 'bierpreis', v.nr)
    }

    // money
    const heads = (v.mitglieder ?? 0) + (v.gaeste ?? 0)
    if (v.rechnung != null && heads > 0) {
      const proKopf = v.rechnung / heads
      if (proKopf < PRO_KOPF.min || proKopf > PRO_KOPF.max) {
        report.warn(w, `${fmt(proKopf)} € pro Kopf wirkt unplausibel (erwartet ${PRO_KOPF.min}–${PRO_KOPF.max} €)`, 'pro-kopf', v.nr)
      }
    }
    if (v.rechnung != null && v.biere != null && v.bierpreis != null && v.biere * v.bierpreis > v.rechnung) {
      report.warn(w, `das Bier allein (${fmt(v.biere)} × ${fmt(v.bierpreis)} €) kostet mehr als die Rechnung (${fmt(v.rechnung)} €)`, 'bier-rechnung', v.nr)
    }

    // who rated
    const raters = new Set(cats.flatMap(c => Object.keys(v.ratings[c])))
    if (raters.size === 0) report.warn(w, 'niemand hat bewertet', 'keine-bewertung', v.nr)
    else if (v.mitglieder != null && raters.size !== v.mitglieder) {
      report.warn(w, `${v.mitglieder} Mitglieder eingetragen, aber ${raters.size} haben bewertet`, 'bewerter-anzahl', v.nr)
    }
    for (const r of raters) {
      const gaps = cats.filter(c => v.ratings[c][r] == null)
      if (gaps.length) report.warn(w, `${r} hat ${gaps.map(c => CATEGORY[c]).join(', ')} nicht bewertet`, 'bewertung-luecke', v.nr)
    }
    if (v.planer) {
      if (!members.includes(v.planer)) report.warn(w, `Planer "${v.planer}" ist kein bekanntes Mitglied (Tippfehler?)`, 'planer', v.nr)
      else if (raters.size && !raters.has(v.planer)) report.warn(w, `Planer ${v.planer} hat an dem Abend nicht bewertet`, 'planer-abwesend', v.nr)
    }
  }

  // --- Satzung ----------------------------------------------------------------
  const dates = new Set(visits.map(v => v.date))
  for (const b of SATZUNG) {
    if (!dates.has(b.date)) report.warn(`Satzung ${b.date}`, 'an diesem Datum gab es keinen Stammtisch, der Award „Satzung geändert“ erscheint nicht (app/lib/satzung.ts)', 'satzung')
  }
}
