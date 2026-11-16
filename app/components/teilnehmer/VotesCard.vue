<script setup lang="ts">
import type { Teilnehmer } from '@/composables/useStammtisch'
import type { ScoreTile } from '@/lib/score-tiles'

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
</script>

<template>
  <ScoreTileGrid
    title="Meine Bewertungen"
    :tiles="tiles"
    :count="`${tiles.length} ${tiles.length === 1 ? 'Besuch' : 'Besuche'} · eigene Stimmen`"
  />
</template>
