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
