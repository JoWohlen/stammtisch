const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const eurCents = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
const date = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

/** Intl formatters are expensive to build, toLocaleString(…, options) builds one per call → cache them */
const fixed = new Map<number, Intl.NumberFormat>()
const fixedFormat = (digits: number): Intl.NumberFormat => {
  let f = fixed.get(digits)
  if (!f) {
    f = new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    fixed.set(digits, f)
  }
  return f
}
const upTo1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })
const upTo2 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

export const formatEuro = (n: number, cents = false): string => (cents ? eurCents : eur).format(n)

export const formatNumber = (n: number, digits = 0): string => fixedFormat(digits).format(n)

export const formatScore = (n: number | null): string => (n == null ? '–' : formatNumber(n, 2))

export const formatDate = (iso: string): string => date.format(new Date(`${iso}T00:00:00`))

/** A single vote: up to 2 decimals, no trailing zeros (4 · 3,5 · 3,57). */
export const formatVote = (n: number): string => upTo2.format(n)

/** up to 1 decimal, no trailing zeros (4 · 3,5) */
export const formatUpTo1 = (n: number): string => upTo1.format(n)

export interface FitOptions {
  /** decimals of the full form */
  digits?: number
  /** text before the number, e.g. '≈ ' */
  prefix?: string
  /** text after the number, e.g. ' L' or a no-break space + '€' */
  suffix?: string
}

/** cuts off (never rounds up) so a shortened value never claims more than there is: 45,7 → 45 */
const trunc = (n: number, digits: number) => Math.trunc(n * 10 ** digits) / 10 ** digits

/**
 * Ever shorter spellings of one number, for a tile that picks the first one that fits:
 * full (45,7 · 1.553) → whole number (≈ 45) → thousands with one decimal (≈ 1,5k) → whole thousands (≈ 1k).
 * Every shortened form starts with '≈' (once, even if the prefix already has one).
 */
export function fitForms(n: number, { digits = 0, prefix = '', suffix = '' }: FitOptions = {}): string[] {
  const forms = [formatNumber(n, digits), formatNumber(trunc(n, 0))]
  if (Math.abs(n) >= 1000) forms.push(`${formatUpTo1(trunc(n / 1000, 1))}k`, `${formatNumber(trunc(n / 1000, 0))}k`)
  const approx = prefix.startsWith('≈') ? prefix : `≈ ${prefix}`
  return [...new Set(forms)].map((f, i) => `${i ? approx : prefix}${f}${suffix}`)
}
