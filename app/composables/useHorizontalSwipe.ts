import { useEventListener } from '@vueuse/core'

/** swipes shorter than this, or more vertical than horizontal, are scrolling, not swiping */
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

/** focused element that uses the arrow keys itself (text fields, tabs, sliders, side-scrolling areas) */
function handlesArrows(el: Element | null): boolean {
  if (!el || el === document.body) return false
  if (el.closest('[contenteditable=""], [contenteditable="true"], [role="tablist"], [role="radiogroup"], [role="slider"], [role="listbox"], [role="menu"]')) return true
  return handlesTouch(el)
}

/**
 * Calls `onSwipe('left' | 'right')` for a quick, clearly horizontal one-finger swipe anywhere on the page,
 * except on elements that pan themselves (mark more with `data-no-swipe`), while a fullscreen chart
 * locks the body, or while text is selected. 'left' = finger moved left = "next".
 * On desktop the arrow keys do the same: → = "next" (like swiping left), ← = "previous".
 */
export function useHorizontalSwipe(onSwipe: (dir: 'left' | 'right') => void) {
  if (!import.meta.client) return
  let start: { x: number, y: number, t: number } | null = null
  useEventListener(window, 'touchstart', (e: TouchEvent) => {
    const touch = e.touches[0]
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
    onSwipe(dx < 0 ? 'left' : 'right')
  }, { passive: true })
  useEventListener(window, 'keydown', (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    if (document.body.style.overflow === 'hidden' || handlesArrows(document.activeElement)) return
    onSwipe(e.key === 'ArrowRight' ? 'left' : 'right')
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
