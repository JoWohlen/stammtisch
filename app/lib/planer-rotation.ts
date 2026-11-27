import type { Visit } from '#shared/types'

/**
 * Who plans when: one Stammtisch each, in this order, then the next round starts.
 * Not in the xlsx (its columns are in a different order), so it lives here; new members go at the end.
 */
export const PLANER_ORDER = ['Johannes', 'Jan', 'Kevin', 'Simon', 'Tim', 'Lucas', 'Mathieu', 'Flo', 'Johannes Jr.']

/**
 * The next planner: the first one in the order who hasn't planned in the current round,
 * so whoever was skipped comes next. A round ends once everyone planned, or when
 * someone plans a second time (then a new round has begun).
 * Evenings without a planner, or planned by someone outside the order, don't count.
 */
export function nextPlaner(visits: Visit[], order = PLANER_ORDER): string | null {
  if (!order.length) return null
  const done = new Set<string>()
  const sorted = [...visits].sort((a, b) => a.date.localeCompare(b.date) || a.nr - b.nr)
  for (const { planer } of sorted) {
    if (!planer || !order.includes(planer)) continue
    if (done.has(planer)) done.clear()
    done.add(planer)
    if (done.size === order.length) done.clear()
  }
  return order.find(p => !done.has(p)) ?? null
}

/**
 * The December Stammtisch is the Weihnachtsessen, without a planner.
 * The next Stammtisch is in the current month while nothing is entered for it yet,
 * otherwise in the month after; the Weihnachtsessen is next when that month is December.
 */
export function weihnachtsessenNext(visits: Visit[], today = new Date()): boolean {
  const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`
  const y = today.getFullYear()
  const m = today.getMonth() + 1
  const thisMonthDone = visits.some(v => v.date.startsWith(ym(y, m)))
  const nextMonth = thisMonthDone ? (m % 12) + 1 : m
  return nextMonth === 12
}
