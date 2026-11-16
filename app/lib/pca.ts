import { PCA } from 'ml-pca'
import type { Visit } from '#shared/types'

export interface Feature {
  key: string
  label: string
  get: (v: Visit) => number | null
}

/**
 * Numeric attributes of a visit. Derived values (Gesamt = mean of the three
 * categories, Preis/Leistung = Rechnung / Gesamt) are left out on purpose:
 * they are linear combinations of other columns and add no information.
 * Liter is excluded too: it is almost exactly Biere × glass size, so it would only
 * split Biere's weight in two.
 */
export const FEATURES: Feature[] = [
  { key: 'location', label: 'Location', get: v => v.averages.location },
  { key: 'service', label: 'Service', get: v => v.averages.service },
  { key: 'essen', label: 'Essen/Trinken', get: v => v.averages.essen },
  { key: 'mitglieder', label: 'Mitglieder', get: v => v.mitglieder },
  // no entry = no guests
  { key: 'gaeste', label: 'Gäste', get: v => v.gaeste ?? 0 },
  { key: 'rechnung', label: 'Rechnung', get: v => v.rechnung },
  { key: 'biere', label: 'Biere', get: v => v.biere },
  { key: 'bierpreis', label: 'Bierpreis', get: v => v.bierpreis },
  { key: 'kurze', label: 'Kurze', get: v => v.kurze },
]

export interface Importance {
  feature: Feature
  /** normalized share, 0..1 (all features sum to 1) */
  share: number
}

export interface PcaResult {
  /** leading components the importance score is summed over */
  importanceComponents: number
  /** variance those components explain together, 0..1 */
  importanceVariance: number
  /** every feature, most important first */
  importance: Importance[]
  /** visits used (all), missing values were mean-imputed */
  samples: number
}

/**
 * PCA on the standardized visit attributes (z-scores, so € and 1–5 scores are comparable).
 *
 * Importance per attribute j: I_j = Σ_{k=1..K} λ_k · L_jk², normalized to Σ_j I_j = 1
 * (λ = explained variance ratio, L = loading). K must stay small: on standardized data,
 * summing over all components gives exactly 1/p for every attribute, so the score only
 * discriminates over the leading components (default K = 2, the elbow of the scree plot).
 */
export function analysePca(visits: Visit[], importanceComponents = 2): PcaResult {
  const cols = FEATURES.map(f => visits.map(f.get))
  const means = cols.map((c) => {
    const xs = c.filter((x): x is number => x != null)
    return xs.reduce((a, b) => a + b, 0) / xs.length
  })
  const X = visits.map((_, i) => FEATURES.map((_, j) => cols[j]![i] ?? means[j]!))

  const pca = new PCA(X, { center: true, scale: true })
  const explained = pca.getExplainedVariance()
  const U = pca.getEigenvectors()
  const K = Math.min(importanceComponents, explained.length)

  const raw = FEATURES.map((_, j) => {
    let s = 0
    for (let k = 0; k < K; k++) s += explained[k]! * U.get(j, k) ** 2
    return s
  })
  const total = raw.reduce((a, b) => a + b, 0)

  return {
    importanceComponents: K,
    importanceVariance: pca.getCumulativeVariance()[K - 1] ?? 0,
    importance: FEATURES
      .map((feature, j) => ({ feature, share: raw[j]! / total }))
      .sort((a, b) => b.share - a.share),
    samples: visits.length,
  }
}
