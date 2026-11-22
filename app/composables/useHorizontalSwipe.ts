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

/**
 * Calls `onSwipe('left' | 'right')` for a quick, clearly horizontal one-finger swipe anywhere on the page,
 * except on elements that pan themselves (mark more with `data-no-swipe`), while a fullscreen chart
 * locks the body, or while text is selected. 'left' = finger moved left = "next".
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
}
