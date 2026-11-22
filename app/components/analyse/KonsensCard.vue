<script setup lang="ts">
import { type ScoreKey, scoreKeyLabel, std, votes } from '@/lib/analysis'
import type { DeviationBar } from '@/lib/chart'
import { formatDate, formatNumber } from '@/lib/format'
import { mean } from '@/lib/stats'

/**
 * Konsens im Zeitverlauf: per evening the standard deviation of the members' votes.
 * Small = everyone agreed, large = opinions far apart. Drawn like "Bewertungen im Zeitverlauf":
 * bars from the Ø spread, more agreement than usual goes up.
 */
const { visits } = useStammtisch()
const key = ref<ScoreKey>('gesamt')
const full = ref(false)

/** a spread needs a few voters */
const MIN_RATERS = 3

const timeline = [...visits].sort((a, b) => a.date.localeCompare(b.date) || a.nr - b.nr)

const rows = computed(() => timeline.flatMap((v) => {
  const vs = votes(v, key.value)
  return vs.length >= MIN_RATERS ? [{ v, n: vs.length, s: std(vs.map(x => x.x)) }] : []
}))
const byNr = computed(() => new Map(rows.value.map(r => [r.v.nr, r])))

const bars = computed<DeviationBar[]>(() => rows.value.map(r => ({
  id: r.v.nr, name: r.v.brauhaus, date: r.v.date, value: r.s, to: `/brauhaus/${r.v.slug}?besuch=${r.v.nr}`,
})))
const avg = computed(() => mean(bars.value.map(b => b.value)))

const fmt = (n: number) => `± ${formatNumber(n, 2)}`
</script>

<template>
  <FullscreenCard v-model:full="full">
    <Card :class="full && 'min-h-0 gap-2 py-3 sm:gap-2 sm:py-3'">
      <CardHeader>
        <CardTitle class="text-xl">
          Konsens im Zeitverlauf
        </CardTitle>
        <CardDescription v-if="!full">
          Wie weit lagen die Stimmen an einem Abend auseinander?
          Ein Balken pro Besuch: nach oben = einiger als sonst, nach unten = uneiniger.
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
          stretch="mobile"
        />

        <AnalyseDeviationBarChart
          :bars="bars"
          :avg="avg"
          :higher-is-better="false"
          :format="fmt"
          :full="full"
          :label="`Streuung der ${scoreKeyLabel(key)}-Stimmen aller ${bars.length} Besuche im Vergleich zum Ø`"
        >
          <template #tooltip="{ bar }">
            <div class="font-semibold leading-tight">
              {{ bar.name }}
            </div>
            <div class="mt-0.5 text-xs text-muted-foreground">
              #{{ bar.id }} · {{ formatDate(bar.date) }} · {{ byNr.get(bar.id)?.n }} Stimmen
            </div>
            <div class="mt-1 tabular-nums">
              Streuung {{ fmt(bar.value) }}
            </div>
          </template>
        </AnalyseDeviationBarChart>
      </CardContent>
    </Card>
  </FullscreenCard>
</template>
