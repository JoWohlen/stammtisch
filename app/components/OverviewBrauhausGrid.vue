<script setup lang="ts">
import type { ScoreTile } from '@/lib/score-tiles'
import { formatScore } from '@/lib/format'

const { visits } = useStammtisch()

const byDate = [...visits].sort((a, b) => a.date.localeCompare(b.date) || a.nr - b.nr)
const visitsOf = (slug: string) => byDate.filter(v => v.slug === slug)

/** one tile per visit: repeat visits of a Brauhaus show up once per visit */
const tiles: ScoreTile[] = byDate.map((v) => {
  const all = visitsOf(v.slug)
  return {
    key: String(v.nr),
    name: v.brauhaus,
    to: `/brauhaus/${v.slug}?besuch=${v.nr}`,
    date: v.date,
    scores: { gesamt: v.averages.gesamt, location: v.averages.location, service: v.averages.service, essen: v.averages.essen },
    badge: all.length > 1 ? `${all.indexOf(v) + 1}. Besuch` : undefined,
    badgeTone: 'subtle',
  }
})

const best = [...visits].filter(v => v.averages.gesamt != null).sort((a, b) => b.averages.gesamt! - a.averages.gesamt!)[0]
</script>

<template>
  <ScoreTileGrid
    title="Alle Besuche"
    :tiles="tiles"
    :count="`${tiles.length} Besuche`"
    :collapsed-text="best ? `Bester: ${best.brauhaus} ${formatScore(best.averages.gesamt)}` : undefined"
  />
</template>
