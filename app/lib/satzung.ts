/** Resolutions of the Satzung. Shared by the Satzung page and the "Satzung geändert" award. */
export interface Beschluss {
  /** ISO date of the Stammtisch where it was decided */
  date: string
  regeln: { nr: number, text: string }[]
}

/** numbered across all resolutions (rule 7 refers back to rule 1) */
const BESCHLUESSE: { date: string, regeln: string[] }[] = [
  {
    date: '2025-07-12',
    regeln: [
      'Wer nach 3 Werktagen seine Schulden nicht zahlt, gibt eine Runde aus.',
      'Wer reserviert, zahlt.',
      'Wer 3-mal in Folge kommt, darf bewerten, muss aber auch zahlen und reservieren.',
      'Wer selbst verschuldet vergisst zu reservieren, zahlt beim nächsten Mal allen Alkohol.',
      'Der Alkohol wird unter allen Alkoholtrinkern aufgeteilt.',
      'Das Trinkgeld wird unter allen geteilt und vom Reservierer bestimmt.',
      'Wer zahlt, ist verantwortlich, die Rechnung zu zahlen, zu posten und auszurechnen. Ab dann zählt Regel 1.',
      'Gründungsmitglieder: Tim, Simon, Jan, Kevin, Mathieu, Lucas und Johannes.',
    ],
  },
  {
    date: '2026-02-28',
    regeln: [
      'Flo wird am 28.02.2026 aufgenommen.',
      'Neue Regeln können einstimmig beim neuen Stammtisch von allen vorhandenen Mitgliedern beschlossen werden.',
      'Regeln zu einzelnen Mitgliedern sind nicht erlaubt.',
      'Wer zu wenig überweist, muss eine Runde Bier ausgeben und natürlich den ausstehenden Rest begleichen.',
    ],
  },
  {
    date: '2026-10-31',
    regeln: [
      'Johannes Jr. wird am 31.10.2026 aufgenommen.',
    ],
  },
]

export const SATZUNG: Beschluss[] = BESCHLUESSE.reduce<Beschluss[]>((acc, b) => {
  const start = acc.reduce((n, c) => n + c.regeln.length, 1)
  return [...acc, { date: b.date, regeln: b.regeln.map((text, i) => ({ nr: start + i, text })) }]
}, [])
