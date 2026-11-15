const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const eurCents = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
const date = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

export const formatEuro = (n: number, cents = false): string => (cents ? eurCents : eur).format(n)

export const formatNumber = (n: number, digits = 0): string =>
  n.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const formatScore = (n: number | null): string => (n == null ? '–' : formatNumber(n, 2))

export const formatDate = (iso: string): string => date.format(new Date(`${iso}T00:00:00`))

/** A single vote: up to 2 decimals, no trailing zeros (4 · 3,5 · 3,57). */
export const formatVote = (n: number): string => n.toLocaleString('de-DE', { maximumFractionDigits: 2 })
