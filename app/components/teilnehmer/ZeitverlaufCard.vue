<script setup lang="ts">
import { type ScoreKey, scoreKeyLabel, vote, votes } from '@/lib/analysis'
import type { DeviationBar } from '@/lib/chart'
import { formatDate, formatScore } from '@/lib/format'
import { mean } from '@/lib/stats'
import type { Teilnehmer } from '@/composables/useStammtisch'

/**
 * A member's own votes over time, like "Bewertungen im Zeitverlauf" on the Analyse page:
 * one bar per evening they rated, drawn from their own Ø. Shows whether someone got milder or stricter.
 */
const props = defineProps<{ teilnehmer: Teilnehmer }>()

const key = ref<ScoreKey>('gesamt')
const full = ref(false)

const rows = computed(() => props.teilnehmer.votes.flatMap(({ visit: v }) => {
  const own = vote(v, props.teilnehmer.name, key.value)
  if (own == null) return []
  const others = votes(v, key.value).filter(x => x.name !== props.teilnehmer.name).map(x => x.x)
  return [{ v, own, others: others.length ? mean(others) : null }]
}).sort((a, b) => a.v.date.localeCompare(b.v.date) || a.v.nr - b.v.nr))
const byNr = computed(() => new Map(rows.value.map(r => [r.v.nr, r])))

const bars = computed<DeviationBar[]>(() => rows.value.map(r => ({
  id: r.v.nr, name: r.v.brauhaus, date: r.v.date, value: r.own, to: `/brauhaus/${r.v.slug}?besuch=${r.v.nr}`,
})))
const avg = computed(() => mean(bars.value.map(b => b.value)))

/** first vs second half of the member's evenings */
const trend = computed(() => {
  const xs = bars.value.map(b => b.value)
  if (xs.length < 6) return null
  const half = Math.floor(xs.length / 2)
  const before = mean(xs.slice(0, half))
  const after = mean(xs.slice(half))
  const d = after - before
  return { before, after, word: Math.abs(d) < 0.05 ? 'gleich geblieben' : d > 0 ? 'milder geworden' : 'strenger geworden' }
})

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${formatScore(Math.abs(n))}`
</script>

<template>
  <FullscreenCard v-model:full="full">
    <Card :class="full && 'min-h-0 gap-2 py-3 sm:gap-2 sm:py-3'">
      <CardHeader>
        <CardTitle class="text-xl">
          Bewertungen im Zeitverlauf
        </CardTitle>
        <CardDescription v-if="!full">
          Die eigenen Stimmen von {{ teilnehmer.name }}, ein Balken pro Abend, chronologisch ·
          Abstand zum eigenen Ø: besser nach oben, schlechter nach unten
        </CardDescription>
        <CardAction class="flex items-center gap-2">
          <ScoreKeyTabs
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
        <ScoreKeyTabs
          v-if="!full"
          v-model="key"
        />

        <p
          v-if="trend && !full"
          class="text-sm"
        >
          In der ersten Hälfte Ø {{ formatScore(trend.before) }}, in der zweiten Ø {{ formatScore(trend.after) }}:
          {{ teilnehmer.name }} ist <span class="font-semibold">{{ trend.word }}</span>.
        </p>

        <p
          v-if="!bars.length"
          class="text-sm text-muted-foreground"
        >
          Noch keine Stimmen in dieser Kategorie.
        </p>
        <AnalyseDeviationBarChart
          v-else
          :bars="bars"
          :avg="avg"
          higher-is-better
          :format="formatScore"
          :full="full"
          :label="`${scoreKeyLabel(key)}-Stimmen von ${teilnehmer.name} an ${bars.length} Abenden im Vergleich zum eigenen Ø`"
        >
          <template #tooltip="{ bar }">
            <div class="font-semibold leading-tight">
              {{ bar.name }}
            </div>
            <div class="mt-0.5 text-xs text-muted-foreground">
              #{{ bar.id }} · {{ formatDate(bar.date) }}
            </div>
            <div class="mt-1 tabular-nums">
              Eigene Stimme {{ formatScore(bar.value) }}
            </div>
            <div
              v-if="byNr.get(bar.id)?.others != null"
              class="text-xs text-muted-foreground tabular-nums"
            >
              Rest der Runde Ø {{ formatScore(byNr.get(bar.id)!.others!) }} ({{ signed(bar.value - byNr.get(bar.id)!.others!) }})
            </div>
          </template>
        </AnalyseDeviationBarChart>
      </CardContent>
    </Card>
  </FullscreenCard>
</template>
