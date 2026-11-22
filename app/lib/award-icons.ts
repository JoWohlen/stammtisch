import { type FunctionalComponent, h } from 'vue'

/**
 * Award icons Lucide doesn't have (Kölsch, Kurze, Dom), drawn on Lucide's 24px grid with the same
 * stroke style, so they sit next to Lucide icons and take `class` (size, colour) the same way.
 */
const icon = (name: string, paths: string[]): FunctionalComponent => {
  const c: FunctionalComponent = (_, { attrs }) => h('svg', {
    'xmlns': 'http://www.w3.org/2000/svg',
    'width': 24,
    'height': 24,
    'viewBox': '0 0 24 24',
    'fill': 'none',
    'stroke': 'currentColor',
    'stroke-width': 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'class': `lucide lucide-${name}`,
    ...attrs,
  }, paths.map(d => h('path', { d })))
  c.displayName = name
  return c
}

/** a full Kölsch-Stange: tall narrow glass, foam line near the top */
export const KoelschStange = icon('koelsch-stange', [
  'M8 3h8v17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z',
  'M8 7h8',
  'M11 11v6',
])

/** an almost empty Stange: only a sip left at the bottom */
export const StangeLeer = icon('stange-leer', [
  'M8 3h8v17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z',
  'M8 18h8',
])

/** a Stange next to a euro sign */
export const StangeEuro = icon('stange-euro', [
  'M3 3h7v17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
  'M3 7h7',
  'M21.5 9a4 4 0 1 0 0 6',
  'M13.5 11h5',
  'M13.5 13h5',
])

/** beer tap with dripping spout, for the Bierbrunnen */
export const Zapfhahn = icon('zapfhahn', [
  'M4 6v4',
  'M4 8h11a3 3 0 0 1 3 3v2',
  'M12 8V3',
  'M10 3h4',
  'M18 17v.5',
  'M18 20.5v.5',
])

/** two shot glasses */
export const Kurze = icon('kurze', [
  'M3 9h7l-1 11H4z',
  'M3.4 13h6.2',
  'M14 4h7l-1 11h-5z',
  'M14.4 8h6.2',
])

/** a shot glass, crossed out */
export const KurzFrei = icon('kurz-frei', [
  'M8 6h8l-1.2 14H9.2z',
  'M4 4l16 16',
])

/**
 * Kölner Dom from the side (south): the west towers with their spire on the left, the long nave
 * with the small crossing spire on its roof, buttresses, and the choir sloping down on the right
 */
export const KoelnerDom = icon('koelner-dom', [
  'M2 21h20',
  'M3 21V10l2-8 2 8v11',
  'M7 11h10l3 3v7',
  'M7 14h13',
  'M13 11V6',
  'M10.5 14v7',
  'M16.5 14v7',
])
