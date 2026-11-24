<script setup lang="ts">
import { formatDate, formatEuro } from '@/lib/format'
import type { ScatterPoint } from '@/lib/chart'

/** Bierpreis-Index: the price of one beer per visit over time, with a linear trend. */
const { visits } = useStammtisch()

const YEAR = 365.25 * 24 * 60 * 60 * 1000
/** dates as fractional years, so the trend's slope reads as € per year */
const toYear = (iso: string) => 1970 + Date.parse(`${iso}T00:00:00Z`) / YEAR

const priced = visits.filter((v): v is typeof v & { bierpreis: number } => v.bierpreis != null)
  .sort((a, b) => a.date.localeCompare(b.date))

const points: ScatterPoint[] = priced.map(v => ({
  key: v.nr,
  x: toYear(v.date),
  y: v.bierpreis,
  title: v.brauhaus,
  lines: [`${formatDate(v.date)} · ${formatEuro(v.bierpreis, true)}${v.bier ? ` · ${v.bier}` : ''}`],
  to: `/brauhaus/${v.slug}?besuch=${v.nr}`,
}))

const first = points[0]
const last = points.at(-1)

const years = first && last
  ? Array.from({ length: Math.floor(last.x) - Math.ceil(first.x) + 1 }, (_, i) => Math.ceil(first.x) + i).map(y => ({ value: y, label: String(y) }))
  : []

/** fullscreen on phones, see FullscreenCard */
const full = ref(false)
</script>

<template>
  <FullscreenCard v-model:full="full">
    <Card :class="full && 'min-h-0 gap-2 py-3 sm:gap-2 sm:py-3'">
      <CardHeader>
        <CardTitle class="text-xl">
          Bierpreis-Index
        </CardTitle>
        <CardDescription v-if="!full">
          Was hat ein Bier gekostet? Ein Punkt pro Besuch, die gestrichelte Linie ist der Trend über alle Brauhäuser.
        </CardDescription>
        <CardAction class="flex items-center gap-2">
          <FullscreenButton />
        </CardAction>
      </CardHeader>

      <CardContent
        class="flex flex-col gap-4"
        :class="full && 'min-h-0 flex-1'"
      >
        <AnalyseScatterChart
          :points="points"
          :x-format="x => String(Math.round(x))"
          :y-format="y => formatEuro(y, true)"
          :x-ticks="years"
          x-label="Datum"
          y-label="Bierpreis"
          :full="full"
          start-at-end
          :label="`Bierpreis von ${points.length} Besuchen über die Zeit`"
        />

        <p
          v-if="!full"
          class="text-xs text-muted-foreground"
        >
          Der Trend mischt Preissteigerung und die Wahl des Brauhauses: Ein teures Lokal hebt den Punkt, nicht die Inflation.
        </p>
      </CardContent>
    </Card>
  </FullscreenCard>
</template>
