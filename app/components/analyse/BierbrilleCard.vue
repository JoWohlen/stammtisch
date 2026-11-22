<script setup lang="ts">
import { type ScoreKey, scoreKeyLabel } from '@/lib/analysis'
import { formatDate, formatScore, formatUpTo1 } from '@/lib/format'
import { heads } from '@/lib/stats'
import type { ScatterPoint } from '@/lib/chart'

/** Bierbrille: liters per head (x) against the group's score (y), one dot per evening. */
const { visits } = useStammtisch()
const key = ref<ScoreKey>('gesamt')

const points = computed<ScatterPoint[]>(() => visits.flatMap((v) => {
  const y = v.averages[key.value]
  if (v.liter == null || !heads(v) || y == null) return []
  const x = v.liter / heads(v)
  return [{
    key: v.nr,
    x,
    y,
    title: v.brauhaus,
    lines: [formatDate(v.date), `${formatUpTo1(x)} L pro Kopf · ${scoreKeyLabel(key.value)} ${formatScore(y)}`],
    to: `/brauhaus/${v.slug}?besuch=${v.nr}`,
  }]
}))

/** fullscreen on phones, see FullscreenCard */
const full = ref(false)
</script>

<template>
  <FullscreenCard v-model:full="full">
    <Card :class="full && 'min-h-0 gap-2 py-3 sm:gap-2 sm:py-3'">
      <CardHeader>
        <CardTitle class="text-xl">
          Bierbrille
        </CardTitle>
        <CardDescription v-if="!full">
          Bewerten wir einen Abend besser, je mehr wir getrunken haben? Ein Punkt pro Besuch:
          Liter Bier pro Kopf gegen die Ø Bewertung der Runde, die gestrichelte Linie ist der Trend.
        </CardDescription>
        <CardAction class="flex items-center gap-2">
          <AnalyseScoreKeyTabs
            v-if="full"
            v-model="key"
          />
          <FullscreenButton />
        </CardAction>
      </CardHeader>

      <CardContent
        class="flex flex-col gap-4"
        :class="full && 'min-h-0 flex-1'"
      >
        <AnalyseScoreKeyTabs
          v-if="!full"
          v-model="key"
          stretch
        />

        <AnalyseScatterChart
          :points="points"
          :x-format="x => `${formatUpTo1(x)} L`"
          :y-format="formatScore"
          x-label="Liter Bier pro Kopf"
          :y-label="`Ø ${scoreKeyLabel(key)}`"
          :full="full"
          :label="`Liter Bier pro Kopf gegen die ${scoreKeyLabel(key)}-Bewertung, ${points.length} Besuche`"
        />
      </CardContent>
    </Card>
  </FullscreenCard>
</template>
