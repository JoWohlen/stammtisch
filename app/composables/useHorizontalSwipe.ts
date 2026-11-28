import { tryOnScopeDispose, useEventListener } from '@vueuse/core'

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
const FLY_SHARE = 0.2
const FLICK = 0.35
/** pulling towards a side with nothing there only moves this fraction of the finger */
const RUBBER = 0.22

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The dating-app card effect is for touch screens only; with a mouse (desktop) the content just
 * slides over quickly (slide-left / slide-right in main.css).
 */
export const cardSwipe = () => import.meta.client && window.matchMedia('(pointer: coarse)').matches && !reduceMotion()

/** name of the enter / leave transition for a switch in direction `dir` ('left' = to the next) */
export const swapTransition = (dir: 'left' | 'right') => (cardSwipe() ? 'card-swap' : `slide-${dir}`)

/** the card's look at a horizontal offset: only moved sideways (no tilt, so nothing goes up or down) */
const cardTransform = (dx: number) => `translateX(${dx}px)`

/** current drag offset of each element, so flying off continues from where the finger let go */
const dragged = new WeakMap<Element, number>()
/** finger speed (px/ms) at release, so the card flies on at that speed */
const releaseSpeed = new WeakMap<Element, number>()
/** running fly-off per element */
const flying = new WeakMap<Element, Promise<void>>()

function promote(el: HTMLElement) {
  // own GPU layer while it moves: the page is only moved, not repainted every frame
  el.style.willChange = 'transform'
}

function resetCard(el: HTMLElement) {
  el.style.transform = ''
  el.style.transformOrigin = ''
  el.style.willChange = ''
}

/** true while `el` is flying off (then a second swipe is ignored) */
export const isFlying = (el: Element | null | undefined) => !!el && flying.has(el)

// ---------- the neighbour following in from the side ----------

/** the neighbour that way, before it is there */
export interface SwipePreview {
  /** the real neighbour, rendered somewhere out of view (or loaded); a copy of it follows the card */
  node?: Element | null
  /** if `node` isn't ready yet: a stand-in with this title and empty cards */
  title: string
  /** the card is a section inside the page (Analyse), not the whole page: no page padding */
  section?: boolean
}

/** runs `cb` when the browser has nothing else to do (Safari has no requestIdleCallback); returns a cancel */
export function whenIdle(cb: () => void, timeout = 1500): () => void {
  if ('requestIdleCallback' in window) {
    const id = requestIdleCallback(cb, { timeout })
    return () => cancelIdleCallback(id)
  }
  const id = setTimeout(cb, 300)
  return () => clearTimeout(id)
}

/** the current page's neighbours (set by its useHorizontalSwipe) */
let previewOf: ((dir: 'left' | 'right') => SwipePreview | null) | null = null
/** the panel next to the card: a copy of the neighbour (or a stand-in for it) */
let peek: { el: HTMLElement, dir: 'left' | 'right' } | null = null

/** the panel sits one screen width to the side of the card and moves with it */
const peekTransform = (dir: 'left' | 'right', cardX: number) =>
  `translateX(${cardX + (dir === 'left' ? 1 : -1) * window.innerWidth}px)`

function removePeek() {
  peek?.el.remove()
  peek = null
}

/** the panel for that side, created on first need; null if nothing is there */
function peekFor(card: HTMLElement, dir: 'left' | 'right'): HTMLElement | null {
  if (peek?.dir === dir) return peek.el
  removePeek()
  const p = previewOf?.(dir)
  if (!p) return null
  const r = card.getBoundingClientRect()
  const el = document.createElement('div')
  el.className = 'pointer-events-none fixed bottom-0 z-30 overflow-hidden bg-background text-foreground'
  // where the card would be when scrolled to the top: the neighbour shows from its start, and the
  // page is scrolled up behind it (see flyOut), so the real one appears exactly there
  Object.assign(el.style, { top: `${r.top + window.scrollY}px`, left: `${r.left}px`, width: `${r.width}px`, willChange: 'transform' })
  el.setAttribute('aria-hidden', 'true')
  if (p.node) {
    el.append(document.importNode(p.node, true))
    document.body.append(el)
    peek = { el, dir }
    return el
  }
  // not ready yet: a stand-in laid out like the real page, so the title lands about where it will be
  const inner = document.createElement('div')
  inner.className = p.section ? 'flex flex-col gap-6' : 'mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-5 sm:px-6'
  const title = document.createElement('div')
  title.className = p.section ? 'text-lg font-semibold tracking-tight' : 'text-2xl font-semibold tracking-tight sm:text-3xl'
  title.textContent = p.title
  inner.append(title)
  for (const w of ['w-2/3', 'w-1/2', 'w-3/5']) {
    const box = document.createElement('div')
    box.className = 'flex h-44 flex-col gap-3 rounded-xl border bg-card p-6'
    box.innerHTML = `<div class="h-3 ${w} rounded bg-muted"></div><div class="h-3 w-1/3 rounded bg-muted"></div>`
    inner.append(box)
  }
  el.append(inner)
  document.body.append(el)
  peek = { el, dir }
  return el
}

/**
 * Once the real neighbour has replaced the card, the copy goes. It waits a moment first, so cards
 * that load a little later (lazy ones) are there too; then it fades out very quickly (it looks the same).
 */
function handOver(card: HTMLElement, panel: HTMLElement) {
  const t0 = performance.now()
  const check = () => {
    if (peek?.el !== panel) return
    if (card.isConnected && performance.now() - t0 < 700) {
      requestAnimationFrame(check)
      return
    }
    // not replaced (navigation didn't happen): just go
    if (card.isConnected) return removePeek()
    setTimeout(() => {
      if (peek?.el !== panel) return
      panel.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 80, easing: 'ease-out', fill: 'forwards' })
        .finished.then(() => peek?.el === panel && removePeek(), () => {})
    }, 150)
  }
  requestAnimationFrame(check)
}

/**
 * Dating-app style: the card (`el`) flies off to the `dir` side (straight sideways) from where the finger
 * left it (or from rest for a key / button). Resolves when it is gone; the caller then shows the next one,
 * Meanwhile the neighbour's stand-in (see peekFor) slides in alongside and stops in place, and fades
 * into the real one once that has replaced the card.
 * The element stays off-screen until it is replaced; if it is still there after a moment, it comes back.
 */
export function flyOut(dir: 'left' | 'right', el: HTMLElement | null = document.querySelector('main')): Promise<void> {
  if (!el || !cardSwipe()) return Promise.resolve()
  const running = flying.get(el)
  if (running) return running
  const dx = dragged.get(el) ?? 0
  const sign = dir === 'left' ? -1 : 1
  // exactly one screen width, so the neighbour (moving along) ends right in place
  const toX = sign * window.innerWidth
  if (!dx) promote(el)
  el.style.transform = ''
  // it starts at the finger's speed (at least a brisk one), so there's no kink when letting go;
  // the easing's start slope is 1, i.e. it begins at distance / duration
  const speed = Math.max(12, Math.abs(releaseSpeed.get(el) ?? 0))
  releaseSpeed.delete(el)
  const duration = Math.min(53, Math.max(23, Math.abs(toX - dx) / speed))
  const timing: KeyframeAnimationOptions = { duration, easing: 'cubic-bezier(0.3, 0.3, 0.6, 1)', fill: 'forwards' }
  const anim = el.animate(
    [
      { transform: cardTransform(dx), opacity: 1 },
      { transform: cardTransform(toX), opacity: 0.4 },
    ],
    timing,
  )
  // the neighbour comes along from the side and stops in place
  const panel = peekFor(el, dir)
  if (panel) {
    panel.style.transform = ''
    panel.animate([{ transform: peekTransform(dir, dx) }, { transform: 'none' }], timing)
    anim.finished.then(() => {
      // the old card is out of view now: scroll up behind the neighbour, where the real one will appear
      window.scrollTo({ top: 0, behavior: 'instant' })
      handOver(el, panel)
    }, () => {})
  }
  const done = anim.finished.then(() => {}, () => {})
  flying.set(el, done)
  done.then(() => setTimeout(() => {
    dragged.delete(el)
    flying.delete(el)
    // not replaced (e.g. the navigation didn't happen): back to normal
    if (el.isConnected) {
      anim.cancel()
      resetCard(el)
    }
  }, 700))
  return done
}

/** the card goes back to the middle with a little bounce */
function springBack(el: HTMLElement) {
  const dx = dragged.get(el) ?? 0
  dragged.delete(el)
  releaseSpeed.delete(el)
  el.style.transform = ''
  const timing = { duration: 87, easing: 'cubic-bezier(0.25, 1.5, 0.45, 1)' }
  // the neighbour slides back out of view with it
  const panel = peek
  if (panel) {
    panel.el.style.transform = ''
    panel.el.animate([{ transform: peekTransform(panel.dir, dx) }, { transform: peekTransform(panel.dir, 0) }], { ...timing, fill: 'forwards' })
      .finished.then(() => peek === panel && removePeek(), () => {})
  }
  if (!dx) {
    resetCard(el)
    return
  }
  el.animate([{ transform: cardTransform(dx) }, { transform: 'none' }], timing)
    .finished.then(() => resetCard(el), () => {})
}

interface SwipeOptions {
  /** the "card" that follows the finger (default: the page's <main>) */
  target?: () => HTMLElement | null | undefined
  /** whether there is something that way ('left' = next); if not, the card only stretches a little */
  can?: (dir: 'left' | 'right') => boolean
  /** title of the neighbour that way, shown on the stand-in that follows the card in from the side */
  preview?: (dir: 'left' | 'right') => SwipePreview | null
}

/**
 * Calls `onSwipe('left' | 'right')` for a clearly horizontal one-finger swipe anywhere on the page,
 * except on elements that pan themselves (mark more with `data-no-swipe`), while a fullscreen chart
 * locks the body, or while text is selected. 'left' = finger moved left = "next".
 *
 * While the finger moves, the target follows it sideways and the neighbour that way (`preview`)
 * follows right next to it, coming in from the side; let go far
 * enough (or flick) and `onSwipe` is called with the card still where the finger left it: the
 * handler calls `flyOut` to send it off. Otherwise it springs back.
 * On desktop the arrow keys do the same: → = "next" (like swiping left), ← = "previous".
 */
export function useHorizontalSwipe(onSwipe: (dir: 'left' | 'right') => void, opts: SwipeOptions = {}) {
  if (!import.meta.client) return
  const target = () => (opts.target ? opts.target() : document.querySelector('main')) ?? null
  const can = (d: 'left' | 'right') => opts.can?.(d) ?? true
  // this page's neighbours for the stand-in; a page set up before the old one is gone doesn't get unset
  const mine = opts.preview ?? null
  previewOf = mine
  tryOnScopeDispose(() => {
    if (previewOf === mine) previewOf = null
  })

  let start: { x: number, y: number, t: number } | null = null
  /** where the finger came down; only checked (handlesTouch) once the gesture turns out horizontal */
  let downOn: Element | null = null
  /** null = undecided, then horizontal (we drag) or vertical (the page scrolls, we stay out) */
  let lock: 'h' | 'v' | null = null
  let el: HTMLElement | null = null
  /** last two finger positions, for the speed at release */
  let last = { x: 0, t: 0 }
  let prev = { x: 0, t: 0 }
  /** finger x when the drag kicked in: the card starts from there, without jumping */
  let originX = 0
  /** the card is moved once per frame, not on every touch event */
  let frame = 0
  let pending = 0
  const paint = () => {
    frame = 0
    if (!el) return
    el.style.transform = cardTransform(pending)
    // the neighbour on the side the card is pulled away from follows right next to it
    const dir = pending < 0 ? 'left' : 'right'
    const panel = pending && can(dir) ? peekFor(el, dir) : null
    if (panel) panel.style.transform = peekTransform(dir, pending)
    // nothing that way (or back in the middle): the copy waits just out of view instead of being rebuilt
    else if (peek) peek.el.style.transform = peekTransform(peek.dir, 0)
  }

  useEventListener(window, 'touchstart', (e: TouchEvent) => {
    const touch = e.touches[0]
    lock = null
    el = null
    // cheap checks only: this runs on every touch, also when just scrolling
    downOn = e.target as Element
    start = e.touches.length === 1 && touch && document.body.style.overflow !== 'hidden'
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
      lock = Math.abs(dx) > 1.5 * Math.abs(dy) && !window.getSelection()?.toString() && !handlesTouch(downOn) ? 'h' : 'v'
      if (lock === 'h') {
        el = target()
        originX = touch.clientX
        if (!el || isFlying(el) || !cardSwipe()) el = null
        else promote(el)
      }
    }
    if (lock !== 'h') return
    // horizontal: the page doesn't scroll meanwhile
    if (e.cancelable) e.preventDefault()
    prev = last
    last = { x: touch.clientX, t: performance.now() }
    if (!el) return
    const drag = touch.clientX - originX
    const d = can(drag < 0 ? 'left' : 'right') ? drag : drag * RUBBER
    dragged.set(el, d)
    pending = d
    frame ||= requestAnimationFrame(paint)
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
    cancelAnimationFrame(frame)
    frame = 0
    if (card) releaseSpeed.set(card, speed)
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
