<script setup lang="ts">
import { formatNumber, formatScore } from '@/lib/format'
import { scoreColor } from '@/lib/score-color'

/** Brauhäuser within 1 km, styled like the member legend. */
const props = defineProps<{ slug: string }>()

const RADIUS = 1000
const { getBrauhaus, getNachbarn, brauhausRanking } = useStammtisch()

const hasCoords = !!getBrauhaus(props.slug)?.ort.coords

const gesamt = new Map(brauhausRanking.map(b => [b.slug, b.gesamt]))
const min = Math.min(...gesamt.values())
const max = Math.max(...gesamt.values())

const nachbarn = computed(() => getNachbarn(props.slug, RADIUS).map((n) => {
  const score = gesamt.get(n.slug) ?? null
  const f = score == null ? 0 : max > min ? (score - min) / (max - min) : 1
  return {
    ...n,
    score,
    light: f > 0.6,
    bg: score == null ? 'var(--muted)' : scoreColor(f),
  }
}))

/** 340 m (rounded to 10 m) */
const meters = (m: number) => `${formatNumber(Math.round(m / 10) * 10)} m`
</script>

<template>
  <Card
    v-if="hasCoords"
    class="py-3"
  >
    <CardContent class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span class="text-xl leading-none font-semibold">In der Nähe:</span>
      <NuxtLink
        v-for="n in nachbarn"
        :key="n.slug"
        :to="`/brauhaus/${n.slug}`"
        class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-sm font-medium underline-offset-4 hover:underline"
        :class="n.light ? 'text-white' : 'text-foreground'"
        :style="{ background: n.bg }"
        :title="`${n.score == null ? 'noch nicht bewertet' : `Ø Gesamt ${formatScore(n.score)} / 5`} · ${meters(n.meter)} Luftlinie`"
      >
        {{ n.name }}
        <span
          class="font-normal tabular-nums"
          :class="n.light ? 'text-white/90' : 'text-foreground/75'"
        >({{ meters(n.meter) }})</span>
      </NuxtLink>
      <span
        v-if="!nachbarn.length"
        class="text-sm text-muted-foreground"
      >
        kein anderes besuchtes Brauhaus im Umkreis von 1 km
      </span>
    </CardContent>
  </Card>
</template>
