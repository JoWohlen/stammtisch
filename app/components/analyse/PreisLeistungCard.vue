<script setup lang="ts">
import { Star } from '@lucide/vue'
import type { Visit } from '#shared/types'
import type { DeviationBar } from '@/lib/chart'
import { formatDate, formatEuro, formatNumber, formatScore } from '@/lib/format'

const { visits } = useStammtisch()

const fmt = (n: number) => formatNumber(n, 2)

/** fullscreen on phones, see FullscreenCard */
const full = ref(false)

/** visits in date order, only those with a Preis/Leistung value */
const timeline = [...visits]
  .filter((v): v is Visit & { averages: { preisLeistung: number } } => v.averages.preisLeistung != null)
  .sort((a, b) => a.date.localeCompare(b.date))
const byNr = new Map<number, Visit>(timeline.map(v => [v.nr, v]))

const bars: DeviationBar[] = timeline.map(v => ({
  id: v.nr,
  name: v.brauhaus,
  date: v.date,
  value: v.averages.preisLeistung,
  to: `/brauhaus/${v.slug}?besuch=${v.nr}`,
}))

const avg = bars.reduce((s, b) => s + b.value, 0) / bars.length

const perHead = (v: Visit) => {
  const n = (v.mitglieder ?? 0) + (v.gaeste ?? 0)
  return v.rechnung != null && n ? v.rechnung / n : null
}
</script>

<template>
  <FullscreenCard v-model:full="full">
    <!-- fullscreen: tighter padding, and min-h-0 so everything fits the screen without scrolling -->
    <Card :class="full && 'min-h-0 gap-2 py-3 sm:gap-2 sm:py-3'">
      <CardHeader>
        <CardTitle class="text-xl">
          Preis/Leistung im Zeitverlauf
        </CardTitle>
        <CardDescription v-if="!full">
          € pro Kopf geteilt durch die Gesamtbewertung · ein Balken pro Besuch, chronologisch ·
          Abstand zum Ø: günstiger fürs Gebotene nach oben, teurer nach unten
        </CardDescription>
        <CardAction>
          <FullscreenButton />
        </CardAction>
      </CardHeader>

      <CardContent :class="full && 'flex min-h-0 flex-1 flex-col'">
        <AnalyseDeviationBarChart
          :bars="bars"
          :avg="avg"
          :higher-is-better="false"
          :format="fmt"
          :full="full"
          row-hide-value
          :label="`Preis/Leistung aller ${bars.length} Besuche im Vergleich zum Ø`"
        >
          <template #tooltip="{ bar }">
            <div class="font-semibold leading-tight">
              {{ bar.name }}
            </div>
            <div class="mt-0.5 text-xs text-muted-foreground">
              #{{ bar.id }} · {{ formatDate(bar.date) }}
            </div>
            <dl class="mt-2 grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-sm">
              <dt class="font-medium">
                Preis/Leistung
              </dt>
              <dd class="text-right font-semibold tabular-nums">
                {{ fmt(bar.value) }}
              </dd>
              <template v-if="perHead(byNr.get(bar.id)!) != null">
                <dt class="text-muted-foreground">
                  € pro Kopf
                </dt>
                <dd class="text-right tabular-nums">
                  {{ formatEuro(perHead(byNr.get(bar.id)!)!, true) }}
                </dd>
              </template>
              <dt class="text-muted-foreground">
                Gesamt
              </dt>
              <dd class="text-right tabular-nums">
                {{ formatScore(byNr.get(bar.id)!.averages.gesamt) }}
              </dd>
            </dl>
          </template>
          <template #row="{ bar }">
            <span v-if="perHead(byNr.get(bar.id)!) != null">
              {{ formatEuro(perHead(byNr.get(bar.id)!)!, true) }}/Kopf
            </span>
            <span class="inline-flex items-center gap-0.5">
              <Star
                class="size-3"
                aria-hidden="true"
              />
              <span class="sr-only">Gesamt</span>
              {{ formatScore(byNr.get(bar.id)!.averages.gesamt) }}
            </span>
            <span class="font-semibold text-foreground">
              {{ fmt(bar.value) }} € pro Punkt
            </span>
          </template>
        </AnalyseDeviationBarChart>
      </CardContent>
    </Card>
  </FullscreenCard>
</template>
