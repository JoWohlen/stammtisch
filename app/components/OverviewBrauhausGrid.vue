<script setup lang="ts">
import type { Visit } from '#shared/types'
import type { ScoreTile } from '@/lib/score-tiles'
import { formatScore } from '@/lib/format'
import { byDate as sortByDate, groupBy } from '@/lib/stats'

const { visits } = useStammtisch()

const byDate = sortByDate(visits)
const visitsOf = groupBy(byDate, v => v.slug)

const visitDetails = (v: Visit): string[] => [
  v.averages.gesamt != null ? `Ø ${formatScore(v.averages.gesamt)}` : null,
  `Planer: ${v.planer || '–'}`,
].filter((x): x is string => !!x)

/** one tile per visit: repeat visits of a Brauhaus show up once per visit */
const tiles: ScoreTile[] = byDate.map((v) => {
  const all = visitsOf.get(v.slug)!
  return {
    key: String(v.nr),
    name: v.brauhaus,
    repeat: all.length > 1 ? all.indexOf(v) + 1 : undefined,
    to: `/brauhaus/${v.slug}?besuch=${v.nr}`,
    date: v.date,
    scores: { gesamt: v.averages.gesamt, location: v.averages.location, service: v.averages.service, essen: v.averages.essen },
    details: visitDetails(v),
  }
})
</script>

<template>
  <ScoreTileGrid
    title="Alle Besuche"
    :tiles="tiles"
    :count="`${tiles.length} Besuche`"
    :collapsible="false"
    podium-on-gesamt
  />
</template>
