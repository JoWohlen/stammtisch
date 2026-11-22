import { useEventListener } from '@vueuse/core'
import type { ComputedRef } from 'vue'
import { formatDate } from '@/lib/format'

/**
 * Swipe (and ‹ › buttons) through Brauhäuser or members on their detail pages.
 *
 * Clicking an entry in a list (tile grid, member list) remembers that list's current order,
 * e.g. "Alle Besuche" sorted by date, so swiping follows exactly what the user just saw.
 * Arriving any other way (direct link, map, award, reload) falls back to a default order.
 */
export type BrowseKind = 'brauhaus' | 'teilnehmer'

export interface BrowseTarget {
  to: string
  label: string
}

const kindOf = (path: string): BrowseKind | null =>
  path.startsWith('/brauhaus/') ? 'brauhaus' : path.startsWith('/teilnehmer/') ? 'teilnehmer' : null

const parse = (path: string) => {
  const url = new URL(path, 'http://x')
  const besuch = url.searchParams.get('besuch')
  return { slug: decodeURIComponent(url.pathname.split('/')[2] ?? ''), nr: besuch == null ? null : Number(besuch) }
}

/** set right before a list click navigates, consumed by the detail page it lands on */
let fromList = false
/** set when the detail page itself navigates to a neighbour, so the order is kept */
let fromBrowse = false

const useOrder = () => useState<Record<BrowseKind, string[]>>('browse-order', () => ({ brauhaus: [], teilnehmer: [] }))

/** Call from a list when one of its entries is clicked: `paths` in the order shown. */
export function useBrowseList() {
  const order = useOrder()
  return (paths: string[]) => {
    const kind = kindOf(paths[0] ?? '')
    if (!kind) return
    order.value = { ...order.value, [kind]: paths }
    fromList = true
  }
}

/** swipes shorter than this, or more vertical than horizontal, are scrolling, not browsing */
const MIN_SWIPE_PX = 70
const MAX_SWIPE_MS = 700

/** element that handles horizontal touch itself (inputs, sliders, side-scrolling areas, maps/charts) */
function handlesTouch(el: Element | null): boolean {
  for (let e = el; e && e !== document.body; e = e.parentElement) {
    if (e.matches('input, textarea, select, [data-no-swipe]')) return true
    const style = getComputedStyle(e)
    if (style.touchAction === 'none') return true
    if (/(auto|scroll)/.test(style.overflowX) && e.scrollWidth > e.clientWidth) return true
  }
  return false
}

/**
 * Neighbours of the current page in the remembered (or default) order, plus swipe handling.
 * `current.nr` is the selected visit on a Brauhaus page (repeat visits are separate entries).
 */
export function useBrowse(kind: BrowseKind, current: ComputedRef<{ slug: string, nr?: number }>) {
  const { visits, participants, getBrauhaus } = useStammtisch()
  const order = useOrder()

  // a fresh arrival from somewhere other than a list or a swipe forgets the old list
  if (import.meta.client) {
    if (!fromList && !fromBrowse) order.value = { ...order.value, [kind]: [] }
    fromList = false
    fromBrowse = false
  }

  const fallback = (): string[] => kind === 'brauhaus'
    ? [...visits].sort((a, b) => b.date.localeCompare(a.date) || b.nr - a.nr).map(v => `/brauhaus/${v.slug}?besuch=${v.nr}`)
    : participants.map(p => `/teilnehmer/${p.slug}`)

  const indexIn = (list: string[]) => {
    const { slug, nr } = current.value
    const exact = list.findIndex((p) => {
      const q = parse(p)
      return q.slug === slug && (nr == null || q.nr == null || q.nr === nr)
    })
    return exact !== -1 ? exact : list.findIndex(p => parse(p).slug === slug)
  }

  const position = computed(() => {
    const remembered = order.value[kind]
    const i = remembered.length ? indexIn(remembered) : -1
    if (i !== -1) return { list: remembered, i }
    const list = fallback()
    return { list, i: indexIn(list) }
  })

  const label = (path: string): string => {
    const { slug, nr } = parse(path)
    if (kind === 'teilnehmer') return participants.find(p => p.slug === slug)?.name ?? slug
    const b = getBrauhaus(slug)
    if (!b) return slug
    const v = b.visits.find(x => x.nr === nr)
    return b.visits.length > 1 && v ? `${b.name} (${formatDate(v.date)})` : b.name
  }

  const at = (i: number): BrowseTarget | null => {
    const p = position.value.list[i]
    return position.value.i !== -1 && p ? { to: p, label: label(p) } : null
  }
  const prev = computed(() => at(position.value.i - 1))
  const next = computed(() => at(position.value.i + 1))
  const counter = computed(() => (position.value.i === -1 ? null : { n: position.value.i + 1, total: position.value.list.length }))

  /** replace, so "back" returns to the list instead of stepping through every swipe */
  const go = (t: BrowseTarget | null) => {
    if (!t) return
    fromBrowse = true
    navigateTo(t.to, { replace: true })
  }

  if (import.meta.client) {
    let start: { x: number, y: number, t: number } | null = null
    useEventListener(window, 'touchstart', (e: TouchEvent) => {
      const touch = e.touches[0]
      // one finger, not on something that pans itself, and no fullscreen chart (it locks the body)
      start = e.touches.length === 1 && touch && !handlesTouch(e.target as Element) && document.body.style.overflow !== 'hidden'
        ? { x: touch.clientX, y: touch.clientY, t: Date.now() }
        : null
    }, { passive: true })
    useEventListener(window, 'touchend', (e: TouchEvent) => {
      const touch = e.changedTouches[0]
      if (!start || !touch) return
      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y
      const quick = Date.now() - start.t < MAX_SWIPE_MS
      start = null
      if (!quick || Math.abs(dx) < MIN_SWIPE_PX || Math.abs(dx) < 2 * Math.abs(dy)) return
      if (window.getSelection()?.toString()) return
      go(dx < 0 ? next.value : prev.value)
    }, { passive: true })
  }

  return { prev, next, counter, go }
}
