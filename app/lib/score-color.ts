/**
 * Score colours: one red → amber → green ramp, centred on the average.
 * The worst score is red, the average amber, the best green; each half is stretched
 * separately, so "below Ø" always reads warm and "above Ø" always reads green,
 * however skewed the scores are. The stops are light (≥ 7:1 against black) so black text on top stays crisp.
 */
const RED = 'oklch(70.4% 0.191 22.216)' // red-400
const AMBER = 'oklch(87.9% 0.169 91.605)' // amber-300
const GREEN = 'oklch(79.2% 0.209 151.711)' // green-400

/** the ramp's three stops, for things rated good / so-so / bad without a number (e.g. awards) */
export const TONE_COLOR = { bad: RED, neutral: AMBER, good: GREEN } as const

const clamp = (t: number) => Math.max(0, Math.min(1, t))
const pct = (t: number) => `${Math.round(t * 100)}%`

/** position `t` on the ramp: 0 = red, 0.5 = amber, 1 = green */
export const rampColor = (t: number): string => {
  const x = clamp(t)
  return x < 0.5
    ? `color-mix(in oklch, ${AMBER} ${pct(x * 2)}, ${RED})`
    : `color-mix(in oklch, ${GREEN} ${pct(x * 2 - 1)}, ${AMBER})`
}

/** legend bar of the whole ramp; its middle is the average */
export const rampGradient = (steps = 10): string =>
  `linear-gradient(to right, ${Array.from({ length: steps + 1 }, (_, i) => rampColor(i / steps)).join(', ')})`

export interface ScoreScale {
  min: number
  avg: number
  max: number
  /** ramp position of a score: 0 = min, 0.5 = Ø, 1 = max */
  position: (score: number) => number
  color: (score: number) => string
}

/**
 * Scale over a set of scores (nulls ignored). Pass `avg` to centre on a different
 * average than the mean of `scores`, e.g. the group's overall Ø.
 * Returns null when there is no score at all.
 */
export function scoreScale(scores: readonly (number | null | undefined)[], avg?: number): ScoreScale | null {
  const xs = scores.filter((x): x is number => x != null)
  if (!xs.length) return null
  const mid = avg ?? xs.reduce((a, b) => a + b, 0) / xs.length
  const min = Math.min(...xs, mid)
  const max = Math.max(...xs, mid)
  const position = (s: number) => s < mid
    ? 0.5 * (s - min) / (mid - min)
    : max > mid ? 0.5 + 0.5 * (s - mid) / (max - mid) : 0.5
  return { min, avg: mid, max, position, color: s => rampColor(position(s)) }
}
