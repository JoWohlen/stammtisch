<script setup lang="ts">
import type { Teilnehmer } from '@/composables/useStammtisch'
import type { Metric, ScoreTile } from '@/lib/score-tiles'
import { scoreKeyLabel, votes } from '@/lib/analysis'
import { formatScore } from '@/lib/format'
import { mean } from '@/lib/stats'

const props = defineProps<{ teilnehmer: Teilnehmer }>()

/** one tile per visit (repeat visits separately), scored with the member's own votes */
const tiles: ScoreTile[] = props.teilnehmer.votes.map(x => ({
  key: String(x.visit.nr),
  name: x.visit.brauhaus,
  to: `/brauhaus/${x.visit.slug}`,
  date: x.visit.date,
  scores: { gesamt: x.gesamt, location: x.location, service: x.service, essen: x.essen },
  badge: x.geplant ? 'geplant' : undefined,
}))

/** German genitive: "Mathieus", but "Lucas'" for names ending in an s sound */
const name = props.teilnehmer.name
const title = `${name}${/[sßxz]$/i.test(name) ? '’' : 's'} Bewertungen`

/**
 * Description, following the sorted metric (Datum → Gesamt, like the tile colours):
 * visits, then on a second line own Ø · how much milder or stricter than the rest of the round, averaged over the evenings
 * where others voted too (the own vote is left out of their Ø)
 */
const besuche = `${tiles.length} ${tiles.length === 1 ? 'Besuch' : 'Besuche'}`
function count(m: Metric): string {
  const own = props.teilnehmer.votes.flatMap(x => (x[m] == null ? [] : [{ visit: x.visit, x: x[m]! }]))
  if (!own.length) return besuche
  const diffs = own.flatMap(({ visit, x }) => {
    const others = votes(visit, m).filter(o => o.name !== name).map(o => o.x)
    return others.length ? [x - mean(others)] : []
  })
  const d = diffs.length ? mean(diffs) : null
  const vergleich = d == null
    ? null
    : Math.abs(d) < 0.05 ? 'bewertet wie die Runde' : `${formatScore(Math.abs(d))} ${d > 0 ? 'milder' : 'strenger'} als die Runde`
  // two lines: the visits, then how this member rates
  return `${besuche}\n${[`Ø ${scoreKeyLabel(m)} ${formatScore(mean(own.map(o => o.x)))}`, vergleich].filter(Boolean).join(' · ')}`
}
</script>

<template>
  <ScoreTileGrid
    :title="title"
    :collapsible="false"
    :tiles="tiles"
    score-line
    :podium="false"
    :count="count"
  />
</template>
