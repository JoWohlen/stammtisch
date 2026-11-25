/** element that handles horizontal touch itself (inputs, sliders, side-scrolling areas, maps/charts) */
export function handlesTouch(el: Element | null): boolean {
  for (let e = el; e && e !== document.body; e = e.parentElement) {
    if (e.matches('input, textarea, select, [data-no-swipe]')) return true
    const style = getComputedStyle(e)
    if (style.touchAction === 'none') return true
    if (/(auto|scroll)/.test(style.overflowX) && e.scrollWidth > e.clientWidth) return true
  }
  return false
}

/** focused element that uses the arrow keys itself (text fields, tabs, sliders, side-scrolling areas) */
export function handlesArrows(el: Element | null): boolean {
  if (!el || el === document.body) return false
  if (el.closest('[contenteditable=""], [contenteditable="true"], [role="tablist"], [role="radiogroup"], [role="slider"], [role="listbox"], [role="menu"]')) return true
  return handlesTouch(el)
}
