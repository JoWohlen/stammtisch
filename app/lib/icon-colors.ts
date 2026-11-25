import type { Category } from '#shared/types'
import { SCORE_KEYS } from '@/lib/analysis'

/**
 * One colour per kind of thing, the same wherever its icon appears (tiles, badges, tabs),
 * so a tile is recognised at a glance. Full class names, so Tailwind finds them.
 */
export const ICON_COLOR = {
  termine: 'text-sky-500',
  personen: 'text-indigo-500 dark:text-indigo-400',
  bier: 'text-amber-500',
  geld: 'text-emerald-600 dark:text-emerald-500',
  kurze: 'text-pink-500',
  bewertung: 'text-yellow-500',
  planer: 'text-violet-500',
  orte: 'text-blue-500',
} as const

/** Location / Service / Essen in the colours the charts use */
export const categoryColor = (c: Category): string => SCORE_KEYS.find(k => k.key === c)!.color
