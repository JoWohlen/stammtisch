import { useEventListener } from '@vueuse/core'

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

/** focused element that uses the arrow keys itself (text fields, tabs, sliders, side-scrolling areas) */
function handlesArrows(el: Element | null): boolean {
  if (!el || el === document.body) return false
  if (el.closest('[contenteditable=""], [contenteditable="true"], [role="tablist"], [role="radiogroup"], [role="slider"], [role="listbox"], [role="menu"]')) return true
  return handlesTouch(el)
}

/** finger travel (px) before a gesture counts as horizontal or vertical */
const LOCK_PX = 10
/** let go past this share of the width (or flick faster than FLICK px/ms) and the card flies off */
const FLY_SHARE = 0.28
const FLICK = 0.5
/** tilt (deg) at a drag of the full screen width */
const TILT = 9
/** pulling towards a side with nothing there only moves this fraction of the finger */
const RUBBER = 0.22

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** the card's look at a horizontal offset: moved and tilted, like a card held at the top */
const cardTransform = (dx: number) => `translateX(${dx}px) rotate(${(dx / window.innerWidth) * TILT}deg)`

/** current drag offset of each element, so flying off continues from where the finger let go */
const dragged = new WeakMap<Element, number>()
/** running fly-off per element */
const flying = new WeakMap<Element, Promise<void>>()

/** pivot well below the visible part, so the tilt swings the content like a card held at the top */
function setPivot(el: HTMLElement) {
  const r = el.getBoundingClientRect()
  el.style.transformOrigin = `${r.width / 2}px ${window.innerHeight * 1.5 - r.top}px`
}

/** true while `el` is flying off (then a second swipe is ignored) */
export const isFlying = (el: Element | null | undefined) => !!el && flying.has(el)

/**
 * Dating-app style: the card (`el`) flies off to the `dir` side, tilting, from where the finger
 * left it (or from rest for a key / button). Resolves when it is gone; the caller then shows the next one,
 * whose enter transition (`card-swap` in main.css) lets it come up from behind.
 * The element stays off-screen until it is replaced; if it is still there after a moment, it comes back.
 */
export function flyOut(dir: 'left' | 'right', el: HTMLElement | null = document.querySelector('main')): Promise<void> {
  if (!el || reduceMotion()) return Promise.resolve()
  const running = flying.get(el)
  if (running) return running
  const dx = dragged.get(el) ?? 0
  const sign = dir === 'left' ? -1 : 1
  const toX = sign * window.innerWidth * 1.25
  if (!dx) setPivot(el)
  el.style.transform = ''
  // the further the finger already took it, the shorter the rest of the way
  const duration = 140 + 160 * (1 - Math.min(1, Math.abs(dx) / Math.abs(toX)))
  const anim = el.animate(
    [
      { transform: cardTransform(dx), opacity: 1 },
      { transform: cardTransform(toX), opacity: 0.4 },
    ],
    { duration, easing: 'cubic-bezier(0.35, 0.4, 0.7, 1)', fill: 'forwards' },
  )
  const done = anim.finished.then(() => {}, () => {})
  flying.set(el, done)
  done.then(() => setTimeout(() => {
    dragged.delete(el)
    flying.delete(el)
    // not replaced (e.g. the navigation didn't happen): back to normal
    if (el.isConnected) {
      anim.cancel()
      el.style.transformOrigin = ''
    }
  }, 700))
  return done
}

/** the card goes back to the middle with a little bounce */
function springBack(el: HTMLElement) {
  const dx = dragged.get(el) ?? 0
  dragged.delete(el)
  el.style.transform = ''
  if (!dx) {
    el.style.transformOrigin = ''
    return
  }
  el.animate(
    [{ transform: cardTransform(dx) }, { transform: 'none' }],
    { duration: 420, easing: 'cubic-bezier(0.25, 1.5, 0.45, 1)' },
  ).finished.then(() => (el.style.transformOrigin = ''), () => {})
}

interface SwipeOptions {
  /** the "card" that follows the finger (default: the page's <main>) */
  target?: () => HTMLElement | null | undefined
  /** whether there is something that way ('left' = next); if not, the card only stretches a little */
  can?: (dir: 'left' | 'right') => boolean
}

/**
 * Calls `onSwipe('left' | 'right')` for a clearly horizontal one-finger swipe anywhere on the page,
 * except on elements that pan themselves (mark more with `data-no-swipe`), while a fullscreen chart
 * locks the body, or while text is selected. 'left' = finger moved left = "next".
 *
 * While the finger moves, the target follows it and tilts like a card on a dating app; let go far
 * enough (or flick) and `onSwipe` is called with the card still where the finger left it: the
 * handler calls `flyOut` to send it off. Otherwise it springs back.
 * On desktop the arrow keys do the same: → = "next" (like swiping left), ← = "previous".
 */
export function useHorizontalSwipe(onSwipe: (dir: 'left' | 'right') => void, opts: SwipeOptions = {}) {
  if (!import.meta.client) return
  const target = () => (opts.target ? opts.target() : document.querySelector('main')) ?? null
  const can = (d: 'left' | 'right') => opts.can?.(d) ?? true

  let start: { x: number, y: number, t: number } | null = null
  /** null = undecided, then horizontal (we drag) or vertical (the page scrolls, we stay out) */
  let lock: 'h' | 'v' | null = null
  let el: HTMLElement | null = null
  /** last two finger positions, for the speed at release */
  let last = { x: 0, t: 0 }
  let prev = { x: 0, t: 0 }

  useEventListener(window, 'touchstart', (e: TouchEvent) => {
    const touch = e.touches[0]
    lock = null
    el = null
    start = e.touches.length === 1 && touch && !handlesTouch(e.target as Element) && document.body.style.overflow !== 'hidden'
      ? { x: touch.clientX, y: touch.clientY, t: performance.now() }
      : null
    if (start) last = prev = { x: start.x, t: start.t }
  }, { passive: true })

  useEventListener(window, 'touchmove', (e: TouchEvent) => {
    const touch = e.touches[0]
    if (!start || !touch || e.touches.length !== 1) return
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (!lock) {
      if (Math.hypot(dx, dy) < LOCK_PX) return
      lock = Math.abs(dx) > 1.5 * Math.abs(dy) && !window.getSelection()?.toString() ? 'h' : 'v'
      if (lock === 'h') {
        el = target()
        if (!el || isFlying(el) || reduceMotion()) el = null
        else setPivot(el)
      }
    }
    if (lock !== 'h') return
    // horizontal: the page doesn't scroll meanwhile
    if (e.cancelable) e.preventDefault()
    prev = last
    last = { x: touch.clientX, t: performance.now() }
    if (!el) return
    const d = can(dx < 0 ? 'left' : 'right') ? dx : dx * RUBBER
    dragged.set(el, d)
    el.style.transform = cardTransform(d)
  }, { passive: false })

  const end = (e: TouchEvent) => {
    const touch = e.changedTouches[0]
    const s = start
    start = null
    if (!s || !touch || lock !== 'h') return
    const dx = touch.clientX - s.x
    const dir = dx < 0 ? 'left' : 'right'
    const speed = (touch.clientX - prev.x) / Math.max(1, performance.now() - prev.t)
    const flick = Math.abs(speed) > FLICK && Math.sign(speed) === Math.sign(dx)
    const far = Math.abs(dx) > window.innerWidth * FLY_SHARE
    const go = e.type === 'touchend' && (far || flick) && can(dir)
    const card = el
    el = null
    if (!go) {
      if (card) springBack(card)
      return
    }
    onSwipe(dir)
    // the handler didn't send the card off: put it back
    if (card && !isFlying(card)) springBack(card)
  }
  useEventListener(window, 'touchend', end, { passive: true })
  useEventListener(window, 'touchcancel', end, { passive: true })

  useEventListener(window, 'keydown', (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    if (document.body.style.overflow === 'hidden' || handlesArrows(document.activeElement)) return
    const dir = e.key === 'ArrowRight' ? 'left' : 'right'
    if (can(dir)) onSwipe(dir)
    else edgeBump(dir, target())
  })
}

/**
 * "Nothing more this way": nudges `el` (default: the page's <main>) a little in the swipe direction
 * and springs it back, for a swipe or arrow key at the first / last entry. Skipped with reduced motion.
 */
export function edgeBump(dir: 'left' | 'right', el: Element | null = document.querySelector('main')) {
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const dx = dir === 'left' ? -14 : 14
  el.getAnimations().forEach(a => a.id === 'edge-bump' && a.cancel())
  el.animate(
    [
      { transform: 'translateX(0)' },
      { transform: `translateX(${dx}px)`, offset: 0.3, easing: 'ease-in' },
      { transform: 'translateX(0)' },
    ],
    { id: 'edge-bump', duration: 280, easing: 'ease-out' },
  )
}
