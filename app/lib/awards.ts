import type { Component } from 'vue'
import { Anvil, BadgePercent, Banknote, Beer, Bomb, CakeSlice, CalendarCheck, CalendarPlus, ChefHat, Clover, Coins, Compass, ConciergeBell, Crown, Flag, Flame, Footprints, Gavel, Gem, Gift, Ham, HandPlatter, Heart, HeartHandshake, Hourglass, Map as MapIcon, MapPinCheck, MapPinX, Megaphone, PartyPopper, PiggyBank, Plane, Rocket, RotateCcw, Scale, ScrollText, Shuffle, Snail, Sparkles, Star, Store, Swords, ThumbsDown, TrendingDown, Trophy, User, UserPlus, Users, UsersRound, UtensilsCrossed, Wheat, Wind } from '@lucide/vue'
import { KoelnerDom, KoelschStange, KurzFrei, Kurze, StangeEuro, StangeLeer, Zapfhahn } from '@/lib/award-icons'
import type { Category, Coords, Participant, Visit } from '#shared/types'
import { byDate as sortByDate, CATEGORIES, heads, mean, raterNames } from '@/lib/stats'
import { formatDate, formatEuro, formatNumber, formatScore, formatUpTo1 } from '@/lib/format'
import { distance } from '@/lib/geo'
import { computePlanerBias } from '@/lib/planer-bias'
import { SATZUNG } from '@/lib/satzung'

export type AwardTone = 'good' | 'bad' | 'neutral'
export type AwardScope = 'brauhaus' | 'mitglied'

/** One kind of award, as listed and explained on the Awards page. */
export interface AwardDef {
  /** stable id, also the anchor on /awards (#<type>) */
  type: string
  scope: AwardScope
  label: string
  icon: Component
  tone: AwardTone
  /** one line, shown on hover */
  hint: string
  /** how the award is decided; left out for personal awards */
  explain?: string
  /** not listed on /awards; the tag still shows on the member's page, without a link */
  hidden?: boolean
}

/** One award handed out: to a visit (Brauhaus awards) or to a member. */
export interface Award {
  /** unique per visit/member (e.g. join-<name>) */
  key: string
  /** the AwardDef this belongs to */
  type: string
  label: string
  icon: Component
  tone: AwardTone
  /** explains the tag on hover */
  hint: string
  /** the measured value that won it, e.g. "3,2 L" */
  detail?: string
  /** member the award is about, links the tag to their page */
  member?: string
}

const EPS = 1e-9
/** averages over fewer evenings than this are too noisy to win a member award */
export const MIN_MEMBER_VISITS = 5
/** Eigenlob needs a few planned evenings, one alone says little */
export const MIN_PLANNED = 2
/** members rarely miss an evening, so Glücksbringer can't ask for as many evenings without them */
export const MIN_GLUECK = 3

/** Kölner Dom, for "Weit vom Dom" */
export const DOM: Coords = { lat: 50.941320694306455, lng: 6.9582273908731676 }
/** vote spread needs a few voters to mean anything */
const MIN_SPREAD_RATERS = 3

const def = (d: AwardDef) => d

export const AWARD_DEFS: AwardDef[] = [
  // ---- Brauhaus (per visit) ----
  def({ type: 'nr1', scope: 'brauhaus', label: 'Die eine Nummer 1', icon: Trophy, tone: 'good', hint: 'Beste Gesamtbewertung aller Besuche', explain: 'Der Besuch mit der höchsten Ø Gesamtbewertung aller Stammtische. Die Gesamtbewertung ist der Mittelwert aus Location, Service und Essen & Trinken.' }),
  def({ type: 'essen+', scope: 'brauhaus', label: 'Bestes Essen', icon: Ham, tone: 'good', hint: 'Beste Bewertung für Essen & Trinken', explain: 'Der Besuch mit der höchsten Ø Bewertung in der Kategorie Essen & Trinken.' }),
  def({ type: 'essen-', scope: 'brauhaus', label: 'Schlechtestes Essen', icon: UtensilsCrossed, tone: 'bad', hint: 'Schlechteste Bewertung für Essen & Trinken', explain: 'Der Besuch mit der niedrigsten Ø Bewertung in der Kategorie Essen & Trinken.' }),
  def({ type: 'loc+', scope: 'brauhaus', label: 'Beste Location', icon: MapPinCheck, tone: 'good', hint: 'Beste Bewertung für die Location', explain: 'Der Besuch mit der höchsten Ø Bewertung in der Kategorie Location.' }),
  def({ type: 'loc-', scope: 'brauhaus', label: 'Schlechteste Location', icon: MapPinX, tone: 'bad', hint: 'Schlechteste Bewertung für die Location', explain: 'Der Besuch mit der niedrigsten Ø Bewertung in der Kategorie Location.' }),
  def({ type: 'serv+', scope: 'brauhaus', label: 'Bester Service', icon: HandPlatter, tone: 'good', hint: 'Beste Bewertung für den Service', explain: 'Der Besuch mit der höchsten Ø Bewertung in der Kategorie Service.' }),
  def({ type: 'serv-', scope: 'brauhaus', label: 'Schlechtester Service', icon: Snail, tone: 'bad', hint: 'Schlechteste Bewertung für den Service', explain: 'Der Besuch mit der niedrigsten Ø Bewertung in der Kategorie Service.' }),
  def({ type: 'pl', scope: 'brauhaus', label: 'Beste Preis/Leistung', icon: Scale, tone: 'good', hint: 'Niedrigster Wert € pro Kopf / Gesamt', explain: 'Der Besuch mit dem niedrigsten Preis/Leistungs-Wert: Rechnung pro Kopf geteilt durch die Ø Gesamtbewertung. Je weniger Euro pro Bewertungspunkt, desto besser.' }),
  def({ type: 'bp-', scope: 'brauhaus', label: 'Billigstes Bier', icon: PiggyBank, tone: 'good', hint: 'Niedrigster Bierpreis', explain: 'Der Besuch mit dem niedrigsten Preis für ein Bier.' }),
  def({ type: 'bp+', scope: 'brauhaus', label: 'Teuerstes Bier', icon: StangeEuro, tone: 'bad', hint: 'Höchster Bierpreis', explain: 'Der Besuch mit dem höchsten Preis für ein Bier.' }),
  def({ type: 'geld', scope: 'brauhaus', label: 'Geldgrab', icon: Banknote, tone: 'bad', hint: 'Höchste Rechnung pro Kopf', explain: 'Der Besuch mit der höchsten Rechnung pro Kopf.' }),
  def({ type: 'bier', scope: 'brauhaus', label: 'Bierbrunnen', icon: Zapfhahn, tone: 'neutral', hint: 'Meiste Liter Bier an einem Abend', explain: 'Der Abend, an dem insgesamt die meisten Liter Bier getrunken wurden.' }),
  def({ type: 'kurze', scope: 'brauhaus', label: 'Meiste Kurze', icon: Kurze, tone: 'neutral', hint: 'Die meisten Kurzen an einem Abend', explain: 'Der Abend mit den meisten Kurzen.' }),
  def({ type: 'voll', scope: 'brauhaus', label: 'Vollständig', icon: UsersRound, tone: 'good', hint: 'Alle Mitglieder waren da', explain: 'Alle, die zu diesem Zeitpunkt schon Mitglied waren, haben den Abend bewertet. Wer später dazukam, zählt erst ab dem eigenen ersten Besuch.' }),
  def({ type: 'gaeste', scope: 'brauhaus', label: 'Gäste dabei', icon: UserPlus, tone: 'neutral', hint: 'Gäste waren dabei', explain: 'An diesem Abend waren Gäste dabei, die kein Mitglied sind.' }),
  def({ type: 'gross', scope: 'brauhaus', label: 'Größter Stammtisch', icon: Users, tone: 'good', hint: 'Die meisten Leute an einem Abend', explain: 'Der Abend mit den meisten Anwesenden, Mitglieder und Gäste zusammengezählt.' }),
  def({ type: 'klein', scope: 'brauhaus', label: 'Kleinster Stammtisch', icon: User, tone: 'bad', hint: 'Die wenigsten Leute an einem Abend', explain: 'Der Abend mit den wenigsten Anwesenden, Mitglieder und Gäste zusammengezählt.' }),
  def({ type: 'satzung', scope: 'brauhaus', label: 'Satzung geändert', icon: ScrollText, tone: 'neutral', hint: 'An diesem Abend wurde die Satzung geändert', explain: 'An diesem Abend wurden neue Regeln in die Satzung aufgenommen. Welche, steht auf der Seite Satzung.' }),
  def({ type: 'first', scope: 'brauhaus', label: 'Erster Stammtisch', icon: Flag, tone: 'neutral', hint: 'Hier hat alles angefangen', explain: 'Der allererste Stammtisch.' }),
  def({ type: 'join', scope: 'brauhaus', label: 'Neues Mitglied', icon: PartyPopper, tone: 'neutral', hint: 'Jemand war zum ersten Mal dabei', explain: 'Ein Mitglied hat an diesem Abend zum ersten Mal bewertet. Beim ersten Stammtisch zählt das nicht, dort sind alle Gründungsmitglieder.' }),

  def({ type: 'einig', scope: 'brauhaus', label: 'Einig wie nie', icon: HeartHandshake, tone: 'good', hint: 'Die Stimmen lagen am dichtesten beieinander', explain: `Der Abend, an dem sich alle am einigsten waren: Die Gesamtbewertungen der einzelnen Mitglieder lagen am dichtesten beieinander.` }),
  def({ type: 'uneinig', scope: 'brauhaus', label: 'Uneinig wie nie', icon: Swords, tone: 'bad', hint: 'Die Stimmen lagen am weitesten auseinander', explain: `Der Abend, an dem die Meinungen am weitesten auseinandergingen: Die Gesamtbewertungen der einzelnen Mitglieder lagen am weitesten auseinander.` }),
  def({ type: 'hoechststrafe', scope: 'brauhaus', label: 'Höchststrafe', icon: ThumbsDown, tone: 'bad', hint: 'Jemand hat die schlechteste Note vergeben', explain: 'Jemand hat an diesem Abend in einer Kategorie die schlechteste mögliche Note vergeben: eine glatte 1.' }),
  def({ type: 'stammlokal', scope: 'brauhaus', label: 'Stammlokal', icon: Store, tone: 'good', hint: 'Das am häufigsten besuchte Brauhaus', explain: 'Das Brauhaus, in dem wir am häufigsten waren. Der Award hängt am jeweils letzten Besuch dort. Zählt erst ab dem zweiten Besuch.' }),
  def({ type: 'comeback', scope: 'brauhaus', label: 'Comeback', icon: Rocket, tone: 'good', hint: 'Größte Steigerung gegenüber dem letzten Besuch', explain: 'Der Besuch, der sich gegenüber dem vorherigen Besuch im selben Brauhaus am stärksten verbessert hat.' }),
  def({ type: 'absturz', scope: 'brauhaus', label: 'Absturz', icon: TrendingDown, tone: 'bad', hint: 'Größter Einbruch gegenüber dem letzten Besuch', explain: 'Der Besuch, der sich gegenüber dem vorherigen Besuch im selben Brauhaus am stärksten verschlechtert hat.' }),
  def({ type: 'schnaeppchen', scope: 'brauhaus', label: 'Schnäppchen', icon: BadgePercent, tone: 'good', hint: 'Niedrigste Rechnung pro Kopf', explain: 'Das Gegenteil vom Geldgrab: der Besuch mit der niedrigsten Rechnung pro Kopf.' }),
  def({ type: 'durstig', scope: 'brauhaus', label: 'Durstigster Abend', icon: KoelschStange, tone: 'neutral', hint: 'Meiste Liter Bier pro Kopf', explain: 'Der Abend mit den meisten Litern Bier pro Kopf.' }),
  def({ type: 'trocken', scope: 'brauhaus', label: 'Trockenster Abend', icon: StangeLeer, tone: 'neutral', hint: 'Wenigste Liter Bier pro Kopf', explain: 'Der Abend mit den wenigsten Litern Bier pro Kopf.' }),
  def({ type: 'kurzfrei', scope: 'brauhaus', label: 'Kurzfrei', icon: KurzFrei, tone: 'neutral', hint: 'Kein einziger Kurzer', explain: 'Ein Abend ganz ohne Kurze.' }),
  def({ type: 'jubilaeum', scope: 'brauhaus', label: 'Jubiläum', icon: CakeSlice, tone: 'good', hint: 'Ein runder Stammtisch', explain: 'Der 10., 25., 50., 75., 100. … Stammtisch.' }),
  def({ type: 'pause', scope: 'brauhaus', label: 'Längste Durststrecke', icon: Hourglass, tone: 'bad', hint: 'Längste Pause seit dem vorherigen Stammtisch', explain: 'Der Stammtisch, vor dem wir am längsten auf den nächsten Abend warten mussten.' }),
  def({ type: 'veedel', scope: 'brauhaus', label: 'Neues Veedel', icon: MapIcon, tone: 'neutral', hint: 'Zum ersten Mal in diesem Stadtteil', explain: 'Der erste Besuch in einem Kölner Stadtteil, in dem wir vorher noch nie waren.' }),
  def({ type: 'dom', scope: 'brauhaus', label: 'Weit vom Dom', icon: KoelnerDom, tone: 'neutral', hint: 'Am weitesten vom Kölner Dom entfernt', explain: 'Das Brauhaus, das am weitesten vom Kölner Dom entfernt liegt.' }),
  def({ type: 'welt', scope: 'brauhaus', label: 'Weltenbummler', icon: Plane, tone: 'neutral', hint: 'Stammtisch außerhalb von Köln', explain: 'Ein Stammtisch, der nicht in Köln stattfand.' }),

  // ---- Mitglieder ----
  def({ type: 'm-fleissig', scope: 'mitglied', label: 'Fleißig', icon: CalendarPlus, tone: 'good', hint: 'Hat die meisten Abende geplant', explain: 'Das Mitglied, das die meisten Stammtische geplant hat.' }),
  def({ type: 'm-planer', scope: 'mitglied', label: 'Bester Planer', icon: Crown, tone: 'good', hint: 'Höchste Ø Bewertung der selbst geplanten Abende', explain: 'Das Mitglied, dessen geplante Abende im Schnitt die höchste Gesamtbewertung bekommen haben. Bei Gleichstand gewinnt, wer mehr Abende geplant hat.' }),
  def({ type: 'm-dauergast', scope: 'mitglied', label: 'Dauergast', icon: CalendarCheck, tone: 'good', hint: 'Die meisten Besuche', explain: 'Das Mitglied, das bei den meisten Stammtischen dabei war.' }),
  def({ type: 'm-treu', scope: 'mitglied', label: 'Treue Seele', icon: Heart, tone: 'good', hint: 'Höchste Anwesenheit seit Beitritt', explain: `Das Mitglied mit der höchsten Anwesenheitsquote seit dem eigenen ersten Besuch.` }),
  def({ type: 'm-bier', scope: 'mitglied', label: 'Bierkönig', icon: Beer, tone: 'neutral', hint: 'Meiste Liter Bier pro Abend', explain: `Das Mitglied mit dem höchsten Ø Bieranteil pro Abend. Pro Abend wird die getrunkene Menge gleichmäßig auf alle Anwesenden (Mitglieder und Gäste) verteilt. Zählt erst ab ${MIN_MEMBER_VISITS} Besuchen.` }),
  def({ type: 'm-streng', scope: 'mitglied', label: 'Strengster Kritiker', icon: Gavel, tone: 'neutral', hint: 'Niedrigste Ø eigene Bewertung', explain: `Das Mitglied, das im Schnitt die niedrigsten Bewertungen vergibt. Zählt erst ab ${MIN_MEMBER_VISITS} Besuchen.` }),
  def({ type: 'm-mild', scope: 'mitglied', label: 'Gute Seele', icon: Sparkles, tone: 'neutral', hint: 'Höchste Ø eigene Bewertung', explain: `Das Mitglied, das im Schnitt die höchsten Bewertungen vergibt. Zählt erst ab ${MIN_MEMBER_VISITS} Besuchen.` }),
  def({ type: 'm-eigenlob', scope: 'mitglied', label: 'Eigenlob', icon: Megaphone, tone: 'bad', hint: 'Bewertet die eigenen Abende am großzügigsten', explain: `Eigenlob stinkt: das Mitglied, das selbst geplante Abende im Vergleich zum Rest der Runde am besten bewertet. Zählt erst ab ${MIN_PLANNED} geplanten Abenden.` }),
  def({ type: 'm-bescheiden', scope: 'mitglied', label: 'Bescheidenheit', icon: Wheat, tone: 'good', hint: 'Am wenigsten Eigenlob', explain: `Das Gegenteil von Eigenlob: das Mitglied, das selbst geplante Abende im Vergleich zum Rest der Runde am wenigsten hoch bewertet. Zählt erst ab ${MIN_PLANNED} geplanten Abenden.` }),
  def({ type: 'm-flexibel', scope: 'mitglied', label: 'Flexibel', icon: Wind, tone: 'neutral', hint: 'Die eigenen Bewertungen schwanken am stärksten', explain: `Das Mitglied, dessen eigene Gesamtbewertungen von Abend zu Abend am stärksten schwanken. Zählt erst ab ${MIN_MEMBER_VISITS} Besuchen.` }),
  def({ type: 'm-eisern', scope: 'mitglied', label: 'Eisern', icon: Anvil, tone: 'neutral', hint: 'Die eigenen Bewertungen schwanken am wenigsten', explain: `Das Gegenteil von Flexibel: das Mitglied, dessen eigene Gesamtbewertungen von Abend zu Abend am wenigsten schwanken. Zählt erst ab ${MIN_MEMBER_VISITS} Besuchen.` }),
  def({ type: 'm-querdenker', scope: 'mitglied', label: 'Querdenker', icon: Shuffle, tone: 'neutral', hint: 'Liegt am weitesten neben dem Ø der Runde', explain: `Das Mitglied, dessen Gesamtbewertung im Schnitt am weitesten von der der anderen am selben Abend abweicht. Zählt erst ab ${MIN_MEMBER_VISITS} Besuchen.` }),
  def({ type: 'm-herdentier', scope: 'mitglied', label: 'Herdentier', icon: Footprints, tone: 'neutral', hint: 'Liegt am dichtesten am Ø der Runde', explain: `Das Mitglied, dessen Gesamtbewertung im Schnitt am dichtesten an der der anderen am selben Abend liegt. Zählt erst ab ${MIN_MEMBER_VISITS} Besuchen.` }),
  def({ type: 'm-gourmet', scope: 'mitglied', label: 'Gourmet', icon: ChefHat, tone: 'neutral', hint: 'Bewertet das Essen strenger als die anderen', explain: `Das Mitglied, das Essen & Trinken im Vergleich zu den anderen am selben Abend am strengsten bewertet. Zählt erst ab ${MIN_MEMBER_VISITS} Besuchen.` }),
  def({ type: 'm-servicekritiker', scope: 'mitglied', label: 'Servicekritiker', icon: ConciergeBell, tone: 'neutral', hint: 'Bewertet den Service strenger als die anderen', explain: `Das Mitglied, das den Service im Vergleich zu den anderen am selben Abend am strengsten bewertet. Zählt erst ab ${MIN_MEMBER_VISITS} Besuchen.` }),
  def({ type: 'm-notenkoenig', scope: 'mitglied', label: 'Lieblingszahl 5', icon: Star, tone: 'good', hint: 'Hat die meisten glatten 5en vergeben', explain: 'Das Mitglied, das insgesamt die meisten Bestnoten (glatte 5) vergeben hat, über alle Kategorien.' }),
  def({ type: 'm-lieblingszahl1', scope: 'mitglied', label: 'Lieblingszahl 1', icon: Bomb, tone: 'bad', hint: 'Hat die meisten glatten 1en vergeben', explain: 'Das Mitglied, das insgesamt die meisten schlechtesten Noten (glatte 1) vergeben hat, über alle Kategorien.' }),
  def({ type: 'm-serie', scope: 'mitglied', label: 'Marathonläufer', icon: Flame, tone: 'good', hint: 'Längste Serie ohne Fehlen', explain: 'Das Mitglied mit den meisten Stammtischen in Folge, ohne einen einzigen zu verpassen. Die Serie muss nicht mehr laufen.' }),
  def({ type: 'm-comeback', scope: 'mitglied', label: 'Auferstanden', icon: RotateCcw, tone: 'neutral', hint: 'Längste Abwesenheit vor der Rückkehr', explain: 'Das Mitglied, das die meisten Stammtische am Stück verpasst hat und dann doch wiederkam.' }),
  def({ type: 'm-entdecker', scope: 'mitglied', label: 'Entdecker', icon: Compass, tone: 'good', hint: 'Hat die meisten neuen Brauhäuser geplant', explain: 'Das Mitglied, das die meisten Abende in Brauhäusern geplant hat, in denen wir vorher noch nie waren. Teilt sich mehr als die Hälfte der Planer den ersten Platz, wird der Award nicht vergeben.' }),
  def({ type: 'm-sparfuchs', scope: 'mitglied', label: 'Schnäppchenjäger', icon: Coins, tone: 'good', hint: 'Günstigste geplante Abende', explain: `Das Mitglied, dessen geplante Abende im Schnitt die niedrigste Rechnung pro Kopf hatten. Zählt erst ab ${MIN_PLANNED} geplanten Abenden.` }),
  def({ type: 'm-luxus', scope: 'mitglied', label: 'Millionär', icon: Gem, tone: 'bad', hint: 'Teuerste geplante Abende', explain: `Das Mitglied, dessen geplante Abende im Schnitt die höchste Rechnung pro Kopf hatten. Zählt erst ab ${MIN_PLANNED} geplanten Abenden.` }),
  def({ type: 'm-glueck', scope: 'mitglied', label: 'Glücksbringer', icon: Clover, tone: 'good', hint: 'Mit ihm werden die Abende besser bewertet', explain: `Das Mitglied, bei dessen Anwesenheit die Abende im Schnitt am deutlichsten besser bewertet werden als ohne. Zählt erst, wenn es mindestens ${MIN_GLUECK} Abende mit und ohne das Mitglied gibt.` }),
  def({ type: 'm-1812', scope: 'mitglied', label: 'Johannes W. Achtzehnter Zwölfter', icon: Gift, tone: 'good', hint: 'Heißt Johannes W. und hat am 18.12. Geburtstag', hidden: true }),
  def({ type: 'm-gruender', scope: 'mitglied', label: 'Gründungsmitglied', icon: Flag, tone: 'neutral', hint: 'Beim ersten Stammtisch dabei', explain: 'Alle, die schon beim allerersten Stammtisch dabei waren.' }),
]

const DEFS = new Map(AWARD_DEFS.map(d => [d.type, d]))
export const awardDef = (type: string): AwardDef => DEFS.get(type)!

/** an Award of `type`, label/hint from the catalog unless overridden */
function make(type: string, extra: Partial<Award> = {}): Award {
  const d = awardDef(type)
  return { key: type, type, label: d.label, icon: d.icon, tone: d.tone, hint: d.hint, ...extra }
}

/** items that reach the extreme of `get` (ties all win), ignoring missing values */
function extreme<T>(items: T[], get: (x: T) => number | null, dir: 'max' | 'min'): { item: T, x: number }[] {
  const xs = items.flatMap((item) => {
    const x = get(item)
    return x == null ? [] : [{ item, x }]
  })
  if (!xs.length) return []
  const best = dir === 'max' ? Math.max(...xs.map(e => e.x)) : Math.min(...xs.map(e => e.x))
  return xs.filter(e => Math.abs(e.x - best) < EPS)
}

const liter = (x: number) => `${formatUpTo1(x)} L`
const euro = (x: number) => formatEuro(x, true)
const score = (x: number) => `Ø ${formatScore(x)}`
const people = (x: number) => `${formatNumber(x)} ${x === 1 ? 'Person' : 'Personen'}`
const signed = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : '±'}${formatNumber(Math.abs(x), 2)}`
const km = (m: number) => `${formatUpTo1(m / 1000)} km`
const literPerHead = (v: Visit) => (v.liter != null && heads(v) ? v.liter / heads(v) : null)
const DAY = 24 * 60 * 60 * 1000
const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY)
const CATEGORY_LABEL: Record<Category, string> = { location: 'Location', service: 'Service', essen: 'Essen & Trinken' }

/** a member's Gesamt for one visit: mean of their own category votes, null if they did not rate */
const ownGesamt = (v: Visit, name: string): number | null => {
  const own = CATEGORIES.map(c => v.ratings[c][name]).filter((x): x is number => x != null)
  return own.length ? mean(own) : null
}

/** standard deviation of the members' own Gesamt, null with too few raters */
const spread = (v: Visit): number | null => {
  const xs = [...raterNames(v)].map(n => ownGesamt(v, n)).filter((x): x is number => x != null)
  if (xs.length < MIN_SPREAD_RATERS) return null
  const m = mean(xs)
  return Math.sqrt(mean(xs.map(x => (x - m) ** 2)))
}

const pricePerHead = (v: Visit) => (v.rechnung != null && heads(v) ? v.rechnung / heads(v) : null)

/** Tags per visit (by visit nr), derived from all visits. Static data → call once. */
export function computeAwards(visits: Visit[], participants: Participant[]): Map<number, Award[]> {
  const byDate = sortByDate(visits)
  const first = byDate[0]

  // a member joins with their first rating; the founders of the first Stammtisch don't "join"
  const joined = new Map<string, Visit>()
  for (const v of byDate) {
    for (const name of raterNames(v)) if (!joined.has(name)) joined.set(name, v)
  }

  // days since the previous Stammtisch
  const gap = new Map(byDate.slice(1).map((v, i) => [v.nr, days(byDate[i]!.date, v.date)]))

  // repeat visits of one Brauhaus: Stammlokal + change against the previous visit there
  const bySlug = new Map<string, Visit[]>()
  for (const v of byDate) bySlug.set(v.slug, [...(bySlug.get(v.slug) ?? []), v])
  const most = Math.max(...[...bySlug.values()].map(vs => vs.length))
  const stammlokal = new Map(most > 1 ? [...bySlug.values()].filter(vs => vs.length === most).map(vs => [vs.at(-1)!.nr, vs.length]) : [])
  const deltas = [...bySlug.values()].flatMap(vs => vs.slice(1).flatMap((v, i) => {
    const prev = vs[i]!
    return v.averages.gesamt != null && prev.averages.gesamt != null ? [{ v, prev, x: v.averages.gesamt - prev.averages.gesamt }] : []
  }))
  const deltaAward = (dir: 'max' | 'min') => new Map(
    extreme(deltas, d => d.x, dir).filter(e => (dir === 'max' ? e.x > 0 : e.x < 0)).map(e => [e.item.v.nr, e.item]),
  )
  const comeback = deltaAward('max')
  const absturz = deltaAward('min')

  const seenStadtteile = new Set<string>()

  const rules: { type: string, get: (v: Visit) => number | null, dir: 'max' | 'min', fmt: (x: number) => string }[] = [
    { type: 'nr1', get: v => v.averages.gesamt, dir: 'max', fmt: score },
    { type: 'bier', get: v => v.liter, dir: 'max', fmt: liter },
    { type: 'geld', get: pricePerHead, dir: 'max', fmt: x => `${euro(x)} pro Kopf` },
    { type: 'essen+', get: v => v.averages.essen, dir: 'max', fmt: score },
    { type: 'essen-', get: v => v.averages.essen, dir: 'min', fmt: score },
    { type: 'loc+', get: v => v.averages.location, dir: 'max', fmt: score },
    { type: 'loc-', get: v => v.averages.location, dir: 'min', fmt: score },
    { type: 'serv+', get: v => v.averages.service, dir: 'max', fmt: score },
    { type: 'serv-', get: v => v.averages.service, dir: 'min', fmt: score },
    { type: 'kurze', get: v => v.kurze, dir: 'max', fmt: x => `${formatNumber(x)} Kurze` },
    { type: 'gross', get: v => heads(v) || null, dir: 'max', fmt: people },
    { type: 'klein', get: v => heads(v) || null, dir: 'min', fmt: people },
    { type: 'pl', get: v => v.averages.preisLeistung, dir: 'min', fmt: x => formatNumber(x, 2) },
    { type: 'bp+', get: v => v.bierpreis, dir: 'max', fmt: euro },
    { type: 'bp-', get: v => v.bierpreis, dir: 'min', fmt: euro },
    { type: 'einig', get: spread, dir: 'min', fmt: x => `± ${formatNumber(x, 2)}` },
    { type: 'uneinig', get: spread, dir: 'max', fmt: x => `± ${formatNumber(x, 2)}` },
    { type: 'schnaeppchen', get: pricePerHead, dir: 'min', fmt: x => `${euro(x)} pro Kopf` },
    { type: 'durstig', get: literPerHead, dir: 'max', fmt: x => `${liter(x)} pro Kopf` },
    { type: 'trocken', get: literPerHead, dir: 'min', fmt: x => `${liter(x)} pro Kopf` },
    { type: 'dom', get: v => (v.coords ? distance(v.coords, DOM) : null), dir: 'max', fmt: km },
    { type: 'pause', get: v => gap.get(v.nr) ?? null, dir: 'max', fmt: x => `${formatNumber(x)} Tage Pause` },
  ]
  const winners = rules.map(r => ({ r, won: new Map(extreme(visits, r.get, r.dir).map(e => [e.item.nr, e.x])) }))

  const names = participants.map(p => p.name)
  const joinedList = [...joined.entries()]
  const awards = new Map<number, Award[]>()
  for (const v of byDate) {
    const list: Award[] = []

    const nth = byDate.indexOf(v) + 1
    if (v === first) list.push(make('first'))
    if (nth === 10 || nth % 25 === 0) list.push(make('jubilaeum', { detail: `${nth}. Stammtisch` }))

    const stadtteil = v.lage?.stadtteil
    if (stadtteil && !seenStadtteile.has(stadtteil)) {
      list.push(make('veedel', { detail: stadtteil }))
      seenStadtteile.add(stadtteil)
    }
    if (v.coords && !v.lage) list.push(make('welt'))

    const beschluss = SATZUNG.find(b => b.date === v.date)
    if (beschluss) {
      const nrs = beschluss.regeln.map(r => r.nr)
      list.push(make('satzung', { detail: nrs.length > 1 ? `Regeln ${nrs[0]}–${nrs.at(-1)}` : `Regel ${nrs[0]}` }))
    }

    for (const name of names) {
      if (v !== first && joined.get(name) === v) {
        list.push(make('join', { key: `join-${name}`, label: `${name} wird Mitglied`, hint: `${name}s erster Stammtisch`, member: name }))
      }
    }

    // full house: everyone who had joined by this date rated it (newcomers count from their first visit on)
    const present = raterNames(v)
    const members = joinedList.filter(([, j]) => j.date <= v.date).map(([n]) => n)
    if (members.length && members.every(n => present.has(n))) list.push(make('voll'))

    // every 1 handed out that evening, e.g. "1 für Service von Jan"
    const einsen = CATEGORIES.flatMap(c => Object.entries(v.ratings[c]).filter(([, x]) => x === 1).map(([n]) => `${CATEGORY_LABEL[c]} von ${n}`))
    if (einsen.length) list.push(make('hoechststrafe', { detail: `1 für ${einsen.join(', ')}` }))

    const n = stammlokal.get(v.nr)
    if (n) list.push(make('stammlokal', { detail: `${n} Besuche` }))
    const up = comeback.get(v.nr)
    if (up) list.push(make('comeback', { detail: `${signed(up.x)} ggü. ${formatDate(up.prev.date)}` }))
    const down = absturz.get(v.nr)
    if (down) list.push(make('absturz', { detail: `${signed(down.x)} ggü. ${formatDate(down.prev.date)}` }))
    if (v.kurze === 0) list.push(make('kurzfrei'))

    if (v.gaeste) list.push(make('gaeste', { label: v.gaeste === 1 ? '1 Gast' : `${v.gaeste} Gäste` }))

    for (const { r, won } of winners) {
      const x = won.get(v.nr)
      if (x != null) list.push(make(r.type, { detail: r.fmt(x) }))
    }
    awards.set(v.nr, list)
  }
  return awards
}

/** Awards per member name, derived from all visits. Static data → call once. */
export function computeMemberAwards(visits: Visit[], participants: Participant[]): Map<string, Award[]> {
  const byDate = sortByDate(visits)
  const first = byDate[0]

  // visits to a Brauhaus we had never been to before
  const seen = new Set<string>()
  const newBrauhaus = new Set<number>()
  for (const v of byDate) {
    if (!seen.has(v.slug)) newBrauhaus.add(v.nr)
    seen.add(v.slug)
  }

  const stats = participants.flatMap(({ name }) => {
    const attended = byDate.filter(v => raterNames(v).has(name))
    const joined = attended[0]
    if (!joined) return []
    const own = attended.map((v) => {
      const xs = CATEGORIES.map(c => v.ratings[c][name]).filter((x): x is number => x != null)
      return mean(xs)
    })
    const literShares = attended.flatMap(v => (v.liter != null && heads(v) ? [v.liter / heads(v)] : []))
    const planned = byDate.filter(v => v.planer === name)
    const plannedScored = planned.filter(v => v.averages.gesamt != null)
    const possible = byDate.filter(v => v.date >= joined.date).length
    const enough = attended.length >= MIN_MEMBER_VISITS

    // own votes relative to the others at the same table
    const others = (v: Visit, get: (n: string) => number | null) => {
      const xs = [...raterNames(v)].filter(n => n !== name).map(get).filter((x): x is number => x != null)
      return xs.length ? mean(xs) : null
    }
    const diffs = (get: (v: Visit, n: string) => number | null) => attended.flatMap((v) => {
      const own = get(v, name)
      const rest = others(v, n => get(v, n))
      return own != null && rest != null ? [own - rest] : []
    })
    const gesamtDiffs = diffs(ownGesamt)
    const catDiff = (c: Category) => {
      const ds = diffs((v, n) => v.ratings[c][n] ?? null)
      return enough && ds.length ? mean(ds) : null
    }

    // longest run of attended evenings, longest gap before a return (from the first visit on)
    let run = 0
    let serie = 0
    let miss = 0
    let comeback = 0
    for (const v of byDate.filter(v => v.date >= joined.date)) {
      if (raterNames(v).has(name)) {
        run += 1
        serie = Math.max(serie, run)
        comeback = Math.max(comeback, miss)
        miss = 0
      }
      else {
        run = 0
        miss += 1
      }
    }

    const priced = planned.map(pricePerHead).filter((x): x is number => x != null)
    const without = byDate.filter(v => v.averages.gesamt != null && !raterNames(v).has(name))
    const withMe = attended.filter(v => v.averages.gesamt != null)
    const glueck = withMe.length >= MIN_GLUECK && without.length >= MIN_GLUECK
      ? mean(withMe.map(v => v.averages.gesamt!)) - mean(without.map(v => v.averages.gesamt!))
      : null
    return [{
      name,
      joined,
      besuche: attended.length,
      possible,
      quote: possible >= MIN_MEMBER_VISITS ? attended.length / possible : null,
      bier: enough && literShares.length ? mean(literShares) : null,
      vote: enough ? mean(own) : null,
      schwankung: enough ? Math.sqrt(mean(own.map(x => (x - mean(own)) ** 2))) : null,
      geplant: planned.length,
      planerScore: plannedScored.length ? mean(plannedScored.map(v => v.averages.gesamt!)) : null,
      planerScored: plannedScored.length,
      abweichung: enough && gesamtDiffs.length ? mean(gesamtDiffs.map(Math.abs)) : null,
      essen: catDiff('essen'),
      service: catDiff('service'),
      fuenfer: attended.reduce((n, v) => n + CATEGORIES.filter(c => v.ratings[c][name] === 5).length, 0),
      einser: attended.reduce((n, v) => n + CATEGORIES.filter(c => v.ratings[c][name] === 1).length, 0),
      serie,
      comeback,
      neu: planned.filter(v => newBrauhaus.has(v.nr)).length,
      planerPreis: priced.length >= MIN_PLANNED ? mean(priced) : null,
      glueck,
    }]
  })
  type S = typeof stats[number]

  const out = new Map<string, Award[]>(stats.map(s => [s.name, []]))
  const give = (type: string, winners: { item: S, x: number }[], fmt: (x: number, s: S) => string) => {
    for (const { item, x } of winners) out.get(item.name)!.push(make(type, { key: `${type}-${item.name}`, detail: fmt(x, item), member: item.name }))
  }

  // best planner: highest Ø, ties → more planned evenings (same rule as on the overview)
  const bestPlaner = extreme(stats, s => s.planerScore, 'max')
  const mostScored = Math.max(0, ...bestPlaner.map(e => e.item.planerScored))
  give('m-planer', bestPlaner.filter(e => e.item.planerScored === mostScored), (x, s) => `${score(x)} bei ${s.planerScored} ${s.planerScored === 1 ? 'Abend' : 'Abenden'}`)
  give('m-dauergast', extreme(stats, s => s.besuche, 'max'), x => `${formatNumber(x)} Besuche`)
  give('m-treu', extreme(stats, s => s.quote, 'max'), (x, s) => `${formatNumber(x * 100)} % (${s.besuche} von ${s.possible})`)
  give('m-bier', extreme(stats, s => s.bier, 'max'), x => `${liter(x)} pro Abend`)
  give('m-streng', extreme(stats, s => s.vote, 'min'), score)
  give('m-mild', extreme(stats, s => s.vote, 'max'), score)

  // Eigenlob: own votes on planned evenings vs the table, corrected for general strictness (see planer-bias)
  const bias = new Map(computePlanerBias(visits, participants).filter(b => b.geplantN >= MIN_PLANNED).map(b => [b.name, b.bonus]))
  const biasOf = (s: S) => bias.get(s.name) ?? null
  // Eigenlob only for actual self-praise; Bescheidenheit goes to the least self-praising, whatever the sign
  give('m-eigenlob', extreme(stats, biasOf, 'max').filter(e => e.x > 0), x => `${signed(x)} Punkte`)
  give('m-bescheiden', extreme(stats, biasOf, 'min'), x => `${signed(x)} Punkte`)

  const positive = (dir: 'max' | 'min', get: (s: S) => number | null) =>
    extreme(stats, get, dir).filter(e => (dir === 'max' ? e.x > 0 : e.x < 0))
  give('m-flexibel', extreme(stats, s => s.schwankung, 'max'), x => `± ${formatNumber(x, 2)} Punkte`)
  give('m-eisern', extreme(stats, s => s.schwankung, 'min'), x => `± ${formatNumber(x, 2)} Punkte`)
  give('m-fleissig', positive('max', s => s.geplant), x => `${formatNumber(x)} Abende geplant`)
  give('m-querdenker', extreme(stats, s => s.abweichung, 'max'), x => `± ${formatNumber(x, 2)} Punkte`)
  give('m-herdentier', extreme(stats, s => s.abweichung, 'min'), x => `± ${formatNumber(x, 2)} Punkte`)
  give('m-gourmet', positive('min', s => s.essen), x => `${signed(x)} Punkte beim Essen`)
  give('m-servicekritiker', positive('min', s => s.service), x => `${signed(x)} Punkte beim Service`)
  give('m-notenkoenig', positive('max', s => s.fuenfer), x => `${formatNumber(x)}× die 5`)
  give('m-lieblingszahl1', positive('max', s => s.einser), x => `${formatNumber(x)}× die 1`)
  give('m-serie', positive('max', s => s.serie), x => `${formatNumber(x)} in Folge`)
  give('m-comeback', positive('max', s => s.comeback), x => `nach ${formatNumber(x)} verpassten Abenden`)
  // planning rotates and nearly every evening is somewhere new: a tie among most planners says nothing
  const entdecker = positive('max', s => s.neu)
  const planners = stats.filter(s => s.neu > 0).length
  give('m-entdecker', entdecker.length * 2 <= planners ? entdecker : [], x => `${formatNumber(x)} neue Brauhäuser`)
  give('m-sparfuchs', extreme(stats, s => s.planerPreis, 'min'), x => `Ø ${euro(x)} pro Kopf`)
  give('m-luxus', extreme(stats, s => s.planerPreis, 'max'), x => `Ø ${euro(x)} pro Kopf`)
  give('m-glueck', positive('max', s => s.glueck), x => `${signed(x)} Punkte`)

  // hardcoded on purpose: a personal award for these two
  give('m-1812', stats.filter(s => s.name === 'Johannes' || s.name === 'Johannes Jr.').map(item => ({ item, x: 0 })), () => '18.12.')

  if (first) give('m-gruender', stats.filter(s => s.joined === first).map(item => ({ item, x: 0 })), () => '')

  // '' detail → none
  for (const list of out.values()) for (const a of list) if (!a.detail) delete a.detail
  return out
}
