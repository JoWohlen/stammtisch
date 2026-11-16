<script setup lang="ts">
import type { ScoreTile } from '@/lib/score-tiles'
import { formatScore } from '@/lib/format'

const { brauhausRanking } = useStammtisch()

/** one tile per Brauhaus, scored by its most recent visit */
const tiles: ScoreTile[] = brauhausRanking.map(b => ({
  key: b.slug,
  name: b.name,
  to: `/brauhaus/${b.slug}`,
  date: b.lastDate,
  scores: b.latest,
}))

const best = brauhausRanking[0]
</script>

<template>
  <ScoreTileGrid
    title="Alle Brauhäuser"
    :tiles="tiles"
    :count="`${brauhausRanking.length} Brauhäuser`"
    :collapsed-text="best ? `Bestes: ${best.name} ${formatScore(best.gesamt)}` : undefined"
  />
</template>
