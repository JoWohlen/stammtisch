<script setup lang="ts">
import { SCORE_KEYS, type ScoreKey, scoreKeyLabel, vote, votes } from '@/lib/analysis'
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

/** the member's own votes in all four categories (fixed order), for the tooltip and the tap row; the chosen one is highlighted */
const allScores = (nr: number) => {
  const v = byNr.value.get(nr)?.v
  return v ? SCORE_KEYS.map(s => ({ ...s, x: vote(v, props.teilnehmer.name, s.key), selected: s.key === key.value })) : []
}

/** the member's own votes keyed by category, for the tap row */
const ownScores = (nr: number) => Object.fromEntries(allScores(nr).map(s => [s.key, s.x])) as Record<ScoreKey, number | null>

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
          row-hide-value
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
            <div class="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
              <span
                v-for="s in allScores(bar.id)"
                :key="s.key"
                class="inline-flex items-center gap-0.5"
                :class="s.selected && 'font-semibold text-foreground'"
                :title="s.label"
              >
                <component
                  :is="s.icon"
                  class="size-3"
                  :style="{ color: s.color }"
                  :aria-label="s.label"
                />
                {{ formatScore(s.x) }}
              </span>
            </div>
            <div
              v-if="byNr.get(bar.id)?.others != null"
              class="text-xs text-muted-foreground tabular-nums"
            >
              Rest der Runde Ø {{ formatScore(byNr.get(bar.id)!.others!) }} ({{ signed(bar.value - byNr.get(bar.id)!.others!) }})
            </div>
          </template>
          <template #row="{ bar }">
            <AnalyseScoreRow
              :date="bar.date"
              :scores="ownScores(bar.id)"
              :selected="key"
            />
          </template>
        </AnalyseDeviationBarChart>
      </CardContent>
    </Card>
  </FullscreenCard>
</template>
