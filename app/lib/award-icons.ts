import { type FunctionalComponent, h } from 'vue'

/**
 * Award icons Lucide doesn't have (Kölsch, Kurze, Dom), drawn on Lucide's 24px grid with the same
 * stroke style, so they sit next to Lucide icons and take `class` (size, colour) the same way.
 */
const icon = (name: string, paths: string[], strokeWidth = 2): FunctionalComponent => {
  const c: FunctionalComponent = (_, { attrs }) => h('svg', {
    'xmlns': 'http://www.w3.org/2000/svg',
    'width': 24,
    'height': 24,
    'viewBox': '0 0 24 24',
    'fill': 'none',
    'stroke': 'currentColor',
    'stroke-width': strokeWidth,
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

/** a money sack: tied at the neck with a frilled top, a euro sign on the bulging body */
export const Geldsack = icon('geldsack', [
  'M10 7 8.5 3.5c1.2.6 2.3.6 3.5 0 1.2.6 2.3.6 3.5 0L14 7',
  'M9.5 7h5',
  'M9.5 7C5.5 9.5 4 13 4 16a5 5 0 0 0 5 5h6a5 5 0 0 0 5-5c0-3-1.5-6.5-5.5-9',
  'M14.5 13a3 3 0 1 0 0 4',
  'M9 15h3.5',
])

/** a group of three, in the style of Lucide's people icons: one in front, one peeking out on each side */
export const Gruppe = icon('gruppe', [
  'M15.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 1 1 7 0',
  'M17 21v-2a4 4 0 0 0-4-4h-2a4 4 0 0 0-4 4v2',
  'M17 3.5a3.5 3.5 0 0 1 0 7',
  'M22 21v-2a4 4 0 0 0-3-3.87',
  'M7 3.5a3.5 3.5 0 0 0 0 7',
  'M2 21v-2a4 4 0 0 1 3-3.87',
])

/** a sheep's head from the front, for the Herdentier: woolly tuft, long face, ears to the sides, dot eyes */
export const Schaf = icon('schaf', [
  'M6 10a2.5 2.5 0 0 1 1-4.5 3 3 0 0 1 5-3 3 3 0 0 1 5 3 2.5 2.5 0 0 1 1 4.5',
  'M7 11c0-2.5 2.2-3.5 5-3.5s5 1 5 3.5v6a5 5 0 0 1-10 0z',
  'M7 10.5c-1.5-.8-3-.8-4 0 .8 1.2 2.4 1.2 4 .8',
  'M17 10.5c1.5-.8 3-.8 4 0-.8 1.2-2.4 1.2-4 .8',
  'M10 14h.01',
  'M14 14h.01',
  'M11 19h2',
])

/** a running figure, for the Marathonläufer (shape from Tabler Icons' "run", MIT licence) */
export const Laeufer = icon('laeufer', [
  'M12 4a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
  'M4 17l5 1l.75 -1.5',
  'M15 21l0 -4l-4 -3l1 -6',
  'M7 12l0 -3l5 -1l3 3l3 1',
])

/** a plain Christian cross from two fat bars, for "Auferstanden": long upright, crossbar near the top
 * (the rounded ends stay inside the 24px box) */
export const Kreuz = icon('kreuz', [
  'M12 2.5v19',
  'M5 8h14',
], 3.5)
