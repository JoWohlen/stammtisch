import type { Category, Participant, Visit } from '#shared/types'
import { formatEuro, formatNumber, formatScore, formatVote } from '@/lib/format'

export type FunFactCategory = 'bier' | 'kurze' | 'geld' | 'termine' | 'brauhaus' | 'mitglieder' | 'gaeste' | 'zusammenhang'

export interface FunFact {
  key: string
  category: FunFactCategory
  text: string
}

export const FUN_FACT_CATEGORY_LABEL: Record<FunFactCategory, string> = {
  bier: 'Bier',
  kurze: 'Kurze',
  geld: 'Geld',
  termine: 'Termine',
  brauhaus: 'Brauhäuser',
  mitglieder: 'Mitglieder',
  gaeste: 'Gäste',
  zusammenhang: 'Zusammenhänge',
}

// ---- helpers ------------------------------------------------------------

const CATEGORIES: Category[] = ['location', 'service', 'essen']
const CATEGORY_NAME: Record<Category, string> = { location: 'die Location', service: 'den Service', essen: 'das Essen' }
const CATEGORY_DAT: Record<Category, string> = { location: 'der Location', service: 'dem Service', essen: 'dem Essen' }
const CATEGORY_LABEL: Record<Category, string> = { location: 'Location', service: 'Service', essen: 'Essen & Trinken' }
const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
const MIN_VISITS = 5

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const mean = (xs: number[]) => sum(xs) / xs.length
const n0 = (n: number) => formatNumber(n, 0)
const n1 = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 })
const heads = (v: Visit) => (v.mitglieder ?? 0) + (v.gaeste ?? 0)
const perHead = (v: Visit, x: number | null) => (x != null && heads(v) ? x / heads(v) : null)
const raters = (v: Visit) => new Set(CATEGORIES.flatMap(c => Object.keys(v.ratings[c])))
const day = (iso: string) => new Date(`${iso}T00:00:00`)
const monthYear = (iso: string) => day(iso).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
const monthName = (m: string) => new Date(2000, Number(m) - 1, 1).toLocaleDateString('de-DE', { month: 'long' })
const times = (n: number) => (n === 1 ? 'einmal' : n === 2 ? 'zweimal' : n === 3 ? 'dreimal' : n === 4 ? 'viermal' : n === 5 ? 'fünfmal' : `${n0(n)}-mal`)

/** "A", "A und B", "A, B und C" */
function list(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} und ${xs.at(-1)}`
}

function count<T>(xs: T[], key: (x: T) => string | null): Map<string, number> {
  const m = new Map<string, number>()
  for (const x of xs) {
    const k = key(x)
    if (k != null) m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x])
  return m
}

/** visits with a value for `get`, sorted by it (descending) */
function ranked(visits: Visit[], get: (v: Visit) => number | null): { v: Visit, x: number }[] {
  return visits
    .flatMap((v) => {
      const x = get(v)
      return x == null ? [] : [{ v, x }]
    })
    .sort((a, b) => b.x - a.x)
}

function corr(pairs: [number, number][]): number | null {
  if (pairs.length < 5) return null
  const mx = mean(pairs.map(p => p[0]))
  const my = mean(pairs.map(p => p[1]))
  const cov = sum(pairs.map(([x, y]) => (x - mx) * (y - my)))
  const sx = sum(pairs.map(([x]) => (x - mx) ** 2))
  const sy = sum(pairs.map(([, y]) => (y - my) ** 2))
  return sx && sy ? cov / Math.sqrt(sx * sy) : null
}

interface Vote { visit: Visit, cat: Category, name: string, score: number }

interface Ctx {
  visits: Visit[]
  votes: Vote[]
  members: string[]
  founders: Set<string>
  /** visits since a member's first rating */
  since: Map<string, Visit[]>
}

type Generator = (c: Ctx) => FunFact | FunFact[] | null

const fact = (key: string, category: FunFactCategory, text: string): FunFact => ({ key, category, text })

// ---- facts --------------------------------------------------------------

const GENERATORS: Generator[] = [
  // Bier
  ({ visits }) => {
    const biere = sum(visits.map(v => v.biere ?? 0))
    const l = sum(visits.map(v => v.liter ?? 0))
    return biere ? fact('bier-total', 'bier', `In ${visits.length} Abenden haben wir ${n0(biere)} Biere getrunken, das sind ${n0(l)} Liter.`) : null
  },
  ({ visits }) => {
    const xs = ranked(visits, v => perHead(v, v.biere)).map(r => r.x)
    return xs.length ? fact('bier-kopf', 'bier', `Im Schnitt trinkt jeder von uns rund ${n0(mean(xs))} Biere pro Stammtisch.`) : null
  },
  ({ visits }) => {
    const top = ranked(visits, v => perHead(v, v.biere))[0]
    return top ? fact('bier-rekord', 'bier', `Rekord bei ${top.v.brauhaus}: ${n1(top.x)} Biere pro Kopf an einem Abend.`) : null
  },
  ({ visits }) => {
    const low = ranked(visits, v => perHead(v, v.biere)).at(-1)
    if (!low) return null
    return low.x < 1
      ? fact('bier-wenig', 'bier', `Bei ${low.v.brauhaus} kamen wir zu ${n0(heads(low.v))} auf nur ${n0(low.v.biere!)} Biere, also weniger als eins pro Person.`)
      : fact('bier-wenig', 'bier', `Am wenigsten getrunken haben wir bei ${low.v.brauhaus}: nur ${n1(low.x)} Biere pro Kopf.`)
  },
  ({ visits }) => {
    const [bier, n] = [...count(visits, v => v.bier)].sort((a, b) => b[1] - a[1])[0] ?? []
    return bier && n && n > 1 ? fact('bier-stamm', 'bier', `${bier} ist unser Stammbier: Bei ${n} von ${visits.length} Stammtischen floss ${bier}.`) : null
  },
  ({ visits }) => {
    const sorts = [...count(visits, v => v.bier).keys()]
    return sorts.length > 1 ? fact('bier-sorten', 'bier', `Wir haben schon ${sorts.length} verschiedene Biersorten getrunken.`) : null
  },
  ({ visits }) => {
    const top = ranked(visits, v => v.bierpreis)[0]
    if (!top) return null
    const glass = top.v.liter && top.v.biere ? top.v.liter / top.v.biere : null
    return glass != null && glass >= 0.3
      ? fact('bier-teuer', 'bier', `Bei ${top.v.brauhaus} gab es ${formatVote(Math.round(glass * 10) / 10)}-l-Gläser, deshalb war das Bier mit ${formatEuro(top.x, true)} das teuerste bisher.`)
      : fact('bier-teuer', 'bier', `Das teuerste Bier gab es bei ${top.v.brauhaus} für ${formatEuro(top.x, true)}.`)
  },
  ({ visits }) => {
    const low = ranked(visits, v => v.bierpreis).at(-1)
    return low ? fact('bier-billig', 'bier', `Das billigste Bier gab es für ${formatEuro(low.x, true)} bei ${low.v.brauhaus}.`) : null
  },
  ({ visits }) => {
    const years = [...groupBy(visits, v => v.date.slice(0, 4))].map(([y, vs]) => ({ y, l: sum(vs.map(v => v.liter ?? 0)) }))
    const max = [...years].sort((a, b) => b.l - a.l)[0]
    const last = years.at(-1)
    if (!max || !last || max.y === last.y) return null
    return fact('bier-jahre', 'bier', `${max.y} tranken wir mit ${n0(max.l)} Litern am meisten, ${last.y} bisher erst ${n0(last.l)} Liter.`)
  },
  ({ visits }) => {
    const sizes = visits.flatMap(v => (v.liter && v.biere ? [Math.round((v.liter / v.biere) * 20) / 20] : []))
    const [mode] = [...count(sizes, s => String(s))].sort((a, b) => b[1] - a[1])[0] ?? []
    if (!mode) return null
    const bigger = sizes.filter(s => s > Number(mode)).length
    return fact('bier-glas', 'bier', `Das Kölsch-Glas ist meistens ${formatVote(Number(mode))} l groß${bigger ? `, bei ${bigger} Stammtischen gab es aber größere Gläser` : ''}.`)
  },

  // Kurze
  ({ visits }) => {
    const known = visits.filter(v => v.kurze != null)
    if (!known.length) return null
    const missing = visits.length - known.length
    return fact('kurze-total', 'kurze', `Insgesamt haben wir mindestens ${n0(sum(known.map(v => v.kurze!)))} Kurze getrunken.${missing ? ` Bei ${missing} Abenden wurde gar nicht mitgezählt.` : ''}`)
  },
  ({ visits }) => {
    const top = ranked(visits, v => perHead(v, v.kurze))[0]
    return top && top.x > 0 ? fact('kurze-rekord', 'kurze', `Bei ${top.v.brauhaus} gab es ${n1(top.x)} Kurze pro Kopf, so viele wie nirgendwo sonst.`) : null
  },
  ({ visits }) => {
    const none = visits.filter(v => v.kurze === 0).map(v => v.brauhaus)
    if (!none.length) return null
    return none.length === 1
      ? fact('kurze-null', 'kurze', `Der einzige Abend ganz ohne Kurze: bei ${none[0]}.`)
      : fact('kurze-null', 'kurze', `Ganz ohne Kurze blieben wir nur bei ${list(none)}.`)
  },

  // Geld
  ({ visits }) => {
    const total = sum(visits.map(v => v.rechnung ?? 0))
    return total ? fact('geld-total', 'geld', `Zusammen haben wir ${formatEuro(total)} in Brauhäusern gelassen.`) : null
  },
  ({ visits }) => {
    const xs = ranked(visits, v => v.rechnung).map(r => r.x)
    return xs.length ? fact('geld-schnitt', 'geld', `Ein Stammtisch kostet im Schnitt ${formatEuro(mean(xs))} für die ganze Runde.`) : null
  },
  ({ visits }) => {
    const both = visits.filter(v => v.rechnung != null && v.biere)
    const biere = sum(both.map(v => v.biere!))
    return biere ? fact('geld-bier', 'geld', `Rechnet man die Gesamtrechnung auf alle Biere um, kostet uns jedes Bier etwa ${formatEuro(sum(both.map(v => v.rechnung!)) / biere, true)}.`) : null
  },
  ({ visits }) => {
    const r = ranked(visits, v => perHead(v, v.rechnung))
    const [top, low] = [r[0], r.at(-1)]
    return top && low && top !== low
      ? fact('geld-kopf', 'geld', `Am teuersten pro Kopf war ${top.v.brauhaus} mit ${formatEuro(top.x)}, am günstigsten ${low.v.brauhaus} mit ${formatEuro(low.x)}.`)
      : null
  },
  ({ visits }) => {
    const years = [...groupBy(visits, v => v.date.slice(0, 4))].map(([y, vs]) => ({ y, n: vs.length, euro: sum(vs.map(v => v.rechnung ?? 0)) }))
    const top = years.sort((a, b) => b.euro - a.euro)[0]
    return top && years.length > 1 ? fact('geld-jahr', 'geld', `${top.y} war unser teuerstes Jahr: ${formatEuro(top.euro)} in ${top.n} Stammtischen.`) : null
  },

  // Termine
  ({ visits }) => {
    const [a, b] = [...count(visits, v => WEEKDAYS[day(v.date).getDay()]!)].sort((x, y) => y[1] - x[1])
    if (!a) return null
    return fact('termin-wochentag', 'termine', `${a[1]} von ${visits.length} Stammtischen waren an einem ${a[0]}${b ? `, ${b[1]} an einem ${b[0]}` : ''}.`)
  },
  ({ visits }) => {
    const weekday = visits.filter(v => [1, 2, 3, 4].includes(day(v.date).getDay()))
    if (!weekday.length) return null
    const days = [...new Set(weekday.map(v => day(v.date).getDay()))].sort().map(d => WEEKDAYS[d]!)
    return fact('termin-woche', 'termine', `Nur ${times(weekday.length)} haben wir uns unter der Woche getroffen (${list(days)}).`)
  },
  ({ visits }) => {
    const gaps = visits.slice(1).map((v, i) => ({ d: Math.round((day(v.date).getTime() - day(visits[i]!.date).getTime()) / 864e5), a: visits[i]!, b: v }))
    if (gaps.length < 2) return null
    const sorted = [...gaps].sort((x, y) => y.d - x.d)
    const long = sorted[0]!
    const short = sorted.at(-1)!
    return [
      fact('termin-abstand', 'termine', `Zwischen zwei Stammtischen liegen im Schnitt ${n0(mean(gaps.map(g => g.d)))} Tage.`),
      fact('termin-pause', 'termine', `Die längste Pause: ${long.d} Tage, von ${long.a.brauhaus} (${monthYear(long.a.date)}) bis ${long.b.brauhaus} (${monthYear(long.b.date)}).`),
      fact('termin-kurz', 'termine', `Die kürzeste Pause: nur ${short.d} ${short.d === 1 ? 'Tag' : 'Tage'}, von ${short.a.brauhaus} zu ${short.b.brauhaus} im ${monthYear(short.b.date)}.`),
    ]
  },
  ({ visits }) => {
    const [y, n] = [...count(visits, v => v.date.slice(0, 4))].sort((a, b) => b[1] - a[1])[0] ?? []
    return y && n ? fact('termin-jahr', 'termine', `${y} war unser fleißigstes Jahr mit ${n} Stammtischen.`) : null
  },
  ({ visits }) => {
    const months = [...groupBy(visits.filter(v => v.averages.gesamt != null), v => v.date.slice(5, 7))]
      .filter(([, vs]) => vs.length >= 2)
      .map(([m, vs]) => ({ m, avg: mean(vs.map(v => v.averages.gesamt!)) }))
      .sort((a, b) => b.avg - a.avg)
    const [best, worst] = [months[0], months.at(-1)]
    return best && worst && best !== worst
      ? fact('termin-monat', 'termine', `Im ${monthName(best.m)} gefällt es uns am besten: Die ${monthName(best.m)}-Stammtische haben mit ${formatScore(best.avg)} die höchste Ø-Bewertung. Der ${monthName(worst.m)} ist mit ${formatScore(worst.avg)} Schlusslicht.`)
      : null
  },

  // Brauhäuser
  ({ visits }) => {
    const c = count(visits, v => v.brauhaus)
    const repeats = [...c].filter(([, n]) => n > 1).map(([b]) => b)
    const base = `Wir waren in ${c.size} verschiedenen Brauhäusern.`
    if (!repeats.length) return fact('brauhaus-anzahl', 'brauhaus', `${base} Kein einziges haben wir zweimal besucht.`)
    return fact('brauhaus-anzahl', 'brauhaus', `${base} ${repeats.length <= 3 ? `Nur ${list(repeats)} haben wir mehrmals besucht.` : `${repeats.length} davon haben wir mehrmals besucht.`}`)
  },
  ({ visits }) =>
    [...groupBy(visits.filter(v => v.averages.gesamt != null), v => v.brauhaus)]
      .filter(([, vs]) => vs.length > 1)
      .map(([b, vs]) => {
        const [a, z] = [vs[0]!.averages.gesamt!, vs.at(-1)!.averages.gesamt!]
        const how = z < a ? 'fiel' : z > a ? 'stieg' : 'blieb'
        return fact(`brauhaus-wieder-${vs[0]!.slug}`, 'brauhaus', how === 'blieb'
          ? `${b} hat beim Wiederholungsbesuch exakt dieselbe Bewertung bekommen: ${formatScore(a)}.`
          : `Beim Wiederholungsbesuch ${how} die Bewertung von ${b} von ${formatScore(a)} auf ${formatScore(z)}.`)
      }),
  ({ visits }) => {
    const r = ranked(visits, v => v.averages.gesamt)
    const [top, low] = [r[0], r.at(-1)]
    if (!top || !low || top === low) return null
    return [
      fact('brauhaus-best', 'brauhaus', `Die beste Bewertung aller Zeiten bekam ${top.v.brauhaus} im ${monthYear(top.v.date)} mit ${formatScore(top.x)}.`),
      fact('brauhaus-worst', 'brauhaus', `Das Schlusslicht ist ${low.v.brauhaus} mit ${formatScore(low.x)}.`),
    ]
  },
  ({ votes }) => {
    const min = Math.min(...votes.map(v => v.score))
    const lows = votes.filter(v => v.score === min)
    if (!lows.length || min >= 2) return null
    const one = lows[0]!
    return lows.length === 1
      ? fact('vote-min', 'brauhaus', `Die schlechteste Einzelnote aller Zeiten: ${one.name} gab ${CATEGORY_DAT[one.cat]} bei ${one.visit.brauhaus} eine ${formatVote(min)}.`)
      : fact('vote-min', 'brauhaus', `Die schlechteste Einzelnote, eine ${formatVote(min)}, wurde ${times(lows.length)} vergeben.`)
  },
  ({ votes }) => {
    const fives = votes.filter(v => v.score === 5).length
    return votes.length ? fact('vote-fuenf', 'brauhaus', `Bestnoten sind selten: Nur ${fives} von ${votes.length} Einzelbewertungen waren eine glatte 5.`) : null
  },
  ({ visits }) => {
    const avgs = CATEGORIES
      .map(c => ({ c, avg: mean(ranked(visits, v => v.averages[c]).map(r => r.x)) }))
      .filter(a => !Number.isNaN(a.avg))
      .sort((a, b) => b.avg - a.avg)
    const [best, worst] = [avgs[0], avgs.at(-1)]
    return best && worst && best !== worst
      ? fact('kategorie', 'brauhaus', `${CATEGORY_LABEL[best.c]} schneidet im Schnitt am besten ab (${formatScore(best.avg)}), ${CATEGORY_LABEL[worst.c]} am schlechtesten (${formatScore(worst.avg)}).`)
      : null
  },
  ({ visits }) => {
    const same = visits.flatMap(v => CATEGORIES.flatMap((c) => {
      const s = Object.values(v.ratings[c])
      return s.length > 2 && new Set(s).size === 1 ? [{ v, c, score: s[0]!, n: s.length }] : []
    }))
    const ex = same[0]
    if (!ex) return null
    return fact('vote-einig', 'brauhaus', `${times(same.length)[0]!.toUpperCase()}${times(same.length).slice(1)} waren sich alle einig und haben exakt die gleiche Note vergeben, ${same.length > 1 ? 'zum Beispiel' : 'nämlich'} ${ex.n}× eine ${formatVote(ex.score)} für ${CATEGORY_NAME[ex.c]} bei ${ex.v.brauhaus}.`)
  },

  // Mitglieder
  ({ members, since, visits, founders }) => {
    const always = members.filter(n => (since.get(n)?.length ?? 0) >= MIN_VISITS && since.get(n)!.every(v => raters(v).has(n)))
    if (!always.length) return null
    return always.map(n => fact(`mitglied-immer-${n}`, 'mitglieder', founders.has(n)
      ? `${n} war bei allen ${visits.length} Stammtischen dabei, ohne eine einzige Lücke.`
      : `${n} hat seit dem Einstieg keinen einzigen Stammtisch verpasst.`))
  },
  ({ members, visits }) => {
    const streaks = members.map((n) => {
      let best = 0
      let cur = 0
      for (const v of visits) {
        cur = raters(v).has(n) ? cur + 1 : 0
        best = Math.max(best, cur)
      }
      return { n, best }
    }).filter(s => s.best < visits.length).sort((a, b) => b.best - a.best)
    const [a, b] = streaks
    return a && a.best >= MIN_VISITS
      ? fact('mitglied-serie', 'mitglieder', `${a.n} hat ${a.best} Stammtische am Stück mitgemacht${b && b.best >= MIN_VISITS ? `, ${b.n} ${b.best}` : ''}.`)
      : null
  },
  ({ votes }) => {
    const [a, b] = [...count(votes.filter(v => v.score === 5), v => v.name)].sort((x, y) => y[1] - x[1])
    if (!a) return null
    return b
      ? fact('mitglied-fuenf', 'mitglieder', `${a[0]} und ${b[0]} vergeben am liebsten die Höchstnote: ${a[1]} bzw. ${b[1]} glatte Fünfen.`)
      : fact('mitglied-fuenf', 'mitglieder', `${a[0]} vergibt am liebsten die Höchstnote: ${a[1]} glatte Fünfen.`)
  },
  ({ votes }) =>
    votes.filter(v => v.score > 5).map(v =>
      fact(`vote-ueber5-${v.visit.nr}-${v.cat}-${v.name}`, 'mitglieder', `${v.name} hat ${CATEGORY_NAME[v.cat]} bei ${v.visit.brauhaus} einmal mit ${formatVote(v.score)} bewertet, auf einer Skala bis 5.`)),
  ({ members, votes, since }) => {
    const bias = members
      .filter(n => (since.get(n)?.filter(v => raters(v).has(n)).length ?? 0) >= MIN_VISITS)
      .map((n) => {
        const diffs = votes.filter(v => v.name === n).flatMap((v) => {
          const others = Object.entries(v.visit.ratings[v.cat]).filter(([k]) => k !== n).map(([, s]) => s)
          return others.length ? [v.score - mean(others)] : []
        })
        return { n, d: mean(diffs) }
      })
      .filter(b => !Number.isNaN(b.d))
      .sort((a, b) => a.d - b.d)
    const [strict, kind] = [bias[0], bias.at(-1)]
    const out: FunFact[] = []
    if (strict && strict.d < -0.05) out.push(fact('mitglied-streng', 'mitglieder', `${strict.n} ist der strengste Kritiker und bewertet im Schnitt ${formatScore(-strict.d)} Punkte schlechter als der Rest.`))
    if (kind && kind.d > 0.05) out.push(fact('mitglied-milde', 'mitglieder', `${kind.n} ist der großzügigste: im Schnitt ${formatScore(kind.d)} Punkte über den anderen.`))
    return out
  },
  ({ votes }) => {
    const decimals = (x: number) => String(x).split('.')[1]?.length ?? 0
    const precise = votes.filter(v => decimals(v.score) > 2)
      .sort((a, b) => String(b.score).length - String(a.score).length)
      .slice(0, 2)
    if (!precise.length) return null
    const txt = precise.map(v => `${v.name} bewertete ${CATEGORY_NAME[v.cat]} bei ${v.visit.brauhaus} mit ${String(v.score).replace('.', ',')}`)
    return fact('vote-praezise', 'mitglieder', `Präzision ist alles: ${list(txt)}.`)
  },
  ({ votes }) =>
    votes.filter(v => v.score > 4.9 && v.score < 5).map(v =>
      fact(`vote-knapp-${v.visit.nr}-${v.cat}-${v.name}`, 'mitglieder', `${v.name} gab ${CATEGORY_DAT[v.cat]} bei ${v.visit.brauhaus} eine ${formatVote(v.score)}. Für die 5 hat es knapp nicht gereicht.`)),
  ({ votes }) => {
    const c = [...count(votes.filter(v => v.score % 1 !== 0), v => v.name)].sort((a, b) => b[1] - a[1])
    const top = c.filter(e => e[1] === c[0]?.[1]).map(e => e[0])
    if (!c[0]) return null
    return fact('vote-krumm', 'mitglieder', top.length > 1
      ? `${list(top)} vergeben am häufigsten krumme Noten, jeweils ${c[0][1]}-mal.`
      : `${top[0]} vergibt am häufigsten krumme Noten: ${c[0][1]}-mal.`)
  },
  ({ visits }) => {
    const planner = [...groupBy(visits.filter(v => v.planer && v.averages.gesamt != null), v => v.planer!)]
      .filter(([, vs]) => vs.length >= 3)
      .map(([n, vs]) => ({ n, avg: mean(vs.map(v => v.averages.gesamt!)) }))
      .sort((a, b) => b.avg - a.avg)
    const top = planner[0]
    return top && planner.length > 1 ? fact('planer-best', 'mitglieder', `Die Stammtische, die ${top.n} geplant hat, kommen im Schnitt auf ${formatScore(top.avg)}. Kein anderer Planer ist besser.`) : null
  },
  ({ visits, founders }) => {
    const c = count(visits, v => v.planer)
    const f = [...founders].map(n => c.get(n) ?? 0)
    if (f.length > 1 && f[0]! > 0 && f.every(x => x === f[0])) {
      return fact('planer-fair', 'mitglieder', `Jeder der ${f.length} Gründer hat bisher genau ${f[0]} Stammtische geplant.`)
    }
    const [n, k] = [...c].sort((a, b) => b[1] - a[1])[0] ?? []
    return n && k ? fact('planer-fair', 'mitglieder', `Am häufigsten geplant hat ${n}: ${k} Stammtische.`) : null
  },

  // Gäste
  ({ visits }) => {
    const withGuests = visits.filter(v => (v.gaeste ?? 0) > 0)
    const total = sum(withGuests.map(v => v.gaeste!))
    return total ? fact('gaeste-total', 'gaeste', `Insgesamt hatten wir ${total} ${total === 1 ? 'Gast' : 'Gäste'} an ${withGuests.length} ${withGuests.length === 1 ? 'Abend' : 'Abenden'} dabei.`) : null
  },
  ({ visits }) => {
    const xs = ranked(visits, v => v.mitglieder)
    const [top, low] = [xs[0], xs.at(-1)]
    return top && low && top.x !== low.x ? fact('gaeste-runde', 'gaeste', `Die größte Runde: ${top.x} Mitglieder an einem Abend. Die kleinste: ${low.x}.`) : null
  },

  // Zusammenhänge
  ({ visits }) => {
    const r = corr(visits.flatMap(v => (v.liter != null && v.averages.gesamt != null ? [[v.liter, v.averages.gesamt] as [number, number]] : [])))
    if (r == null) return null
    if (Math.abs(r) < 0.1) return fact('corr-liter', 'zusammenhang', 'Mehr Bier macht die Bewertung nicht besser: Zwischen Litern und Gesamtnote gibt es praktisch keinen Zusammenhang.')
    if (r >= 0.3) return fact('corr-liter', 'zusammenhang', 'Je mehr Bier fließt, desto besser fällt die Bewertung aus.')
    if (r <= -0.3) return fact('corr-liter', 'zusammenhang', 'Je mehr Bier fließt, desto schlechter fällt die Bewertung aus. Seltsam.')
    return null
  },
  ({ visits }) => {
    const r = corr(visits.flatMap(v => (v.averages.essen != null && v.averages.service != null ? [[v.averages.essen, v.averages.service] as [number, number]] : [])))
    return r != null && r >= 0.3 ? fact('corr-essen', 'zusammenhang', 'Wenn das Essen gut ist, finden wir meist auch den Service gut.') : null
  },
  ({ visits }) => {
    const r = corr(visits.flatMap(v => (v.kurze != null && v.biere != null ? [[v.kurze, v.biere] as [number, number]] : [])))
    return r != null && r >= 0.3 ? fact('corr-kurze', 'zusammenhang', 'An Abenden mit viel Bier gibt es auch mehr Kurze.') : null
  },
]

/** All fun facts, computed from the visits. Facts whose data is missing are left out. */
export function computeFunFacts(visits: Visit[], participants: Participant[]): FunFact[] {
  const byDate = [...visits].sort((a, b) => a.date.localeCompare(b.date) || a.nr - b.nr)
  if (!byDate.length) return []

  const votes: Vote[] = byDate.flatMap(visit => CATEGORIES.flatMap(cat =>
    Object.entries(visit.ratings[cat]).map(([name, score]) => ({ visit, cat, name, score }))))
  const members = participants.map(p => p.name).filter(n => byDate.some(v => raters(v).has(n)))
  const since = new Map(members.map((n) => {
    const i = byDate.findIndex(v => raters(v).has(n))
    return [n, byDate.slice(i)] as const
  }))

  const ctx: Ctx = { visits: byDate, votes, members, founders: raters(byDate[0]!), since }
  return GENERATORS.flatMap(g => g(ctx) ?? [])
}
