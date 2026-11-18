/** green-600, the "best score" end of every score scale */
export const SCORE_GREEN = 'oklch(62.7% 0.194 149.214)'

/**
 * S-curve of the scale (0 and 1 stay put): stays in the brownish low tones up to about CURVE_CENTER,
 * then turns green quickly. Higher CURVE_STEEPNESS = sharper turn.
 */
const CURVE_CENTER = 0.55
const CURVE_STEEPNESS = 2

function curve(f: number): number {
  const x = Math.max(0, Math.min(1, f)) ** (Math.log(0.5) / Math.log(CURVE_CENTER)) // moves CURVE_CENTER to 0.5
  const a = x ** CURVE_STEEPNESS
  const b = (1 - x) ** CURVE_STEEPNESS
  return a + b === 0 ? 0 : a / (a + b)
}

/** green share of the lowest score (= what 3,0 had on the overview before): the scale starts tinted, not gray */
const MIN_GREEN = 0.39

/**
 * Score colour: `f` = 0 → MIN_GREEN green in the theme's muted gray, 1 → full green.
 * Items without a score are not passed here, they use plain var(--muted).
 * Mixed into muted so both light and dark mode work.
 */
export const scoreColor = (f: number): string =>
  `color-mix(in oklch, ${SCORE_GREEN} ${Math.round((MIN_GREEN + (1 - MIN_GREEN) * curve(f)) * 100)}%, var(--muted))`

/** legend bar from scoreColor(`from`) to green, sampled from scoreColor so it shows exactly the tile colours */
export const scoreGradient = (from = 0, steps = 10): string => {
  const stops = Array.from({ length: steps + 1 }, (_, i) => scoreColor(from + (i / steps) * (1 - from)))
  return `linear-gradient(to right, ${stops.join(', ')})`
}
