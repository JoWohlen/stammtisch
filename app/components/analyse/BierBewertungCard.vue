<script setup lang="ts">
import { niceTicks } from '@/lib/analysis'
import { formatScore } from '@/lib/format'
import { scoreScale } from '@/lib/score-color'
import { groupBy, mean } from '@/lib/stats'

/** Bewertung nach Biersorte: Ø Gesamt of the evenings each beer was served, against the overall Ø. */
const { visits } = useStammtisch()

const scored = visits.filter(v => v.bier && v.averages.gesamt != null)
const overall = mean(scored.map(v => v.averages.gesamt!))

const rows = [...groupBy(scored, v => v.bier!).entries()]
  .map(([bier, vs]) => ({ bier, n: vs.length, score: mean(vs.map(v => v.averages.gesamt!)) }))
  .sort((a, b) => b.score - a.score)

const scale = scoreScale(rows.map(r => r.score), overall)
const ticks = niceTicks(Math.min(...rows.map(r => r.score), overall), Math.max(...rows.map(r => r.score), overall), 4)
const LO = ticks[0]!
const HI = ticks.at(-1)!
const pos = (x: number) => `${((x - LO) / (HI - LO || 1)) * 100}%`

/** a single evening says nothing about the beer → faded */
const MIN_N = 2
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-xl">
        Bewertung nach Biersorte
      </CardTitle>
      <CardDescription>
        Welches Bier gibt es an den besten Abenden? Ø Gesamtbewertung aller Besuche, an denen die Sorte ausgeschenkt wurde.
      </CardDescription>
    </CardHeader>

    <CardContent class="flex flex-col gap-4">
      <ol class="flex flex-col gap-2">
        <li
          v-for="r in rows"
          :key="r.bier"
          class="grid grid-cols-[7rem_1fr_3rem] items-center gap-3 sm:grid-cols-[10rem_1fr_3.5rem]"
          :class="r.n < MIN_N ? 'opacity-50' : ''"
          :title="`${r.bier}: Ø ${formatScore(r.score)} an ${r.n} ${r.n === 1 ? 'Abend' : 'Abenden'}`"
        >
          <span class="flex min-w-0 flex-col text-sm">
            <span class="truncate font-medium">{{ r.bier }}</span>
            <span class="text-xs text-muted-foreground">{{ r.n }} {{ r.n === 1 ? 'Abend' : 'Abende' }}</span>
          </span>
          <div
            class="relative h-6"
            role="img"
            :aria-label="`${r.bier}: Ø ${formatScore(r.score)}`"
          >
            <div class="absolute inset-x-0 top-1/2 h-px bg-border" />
            <!-- overall Ø -->
            <div
              class="absolute inset-y-0 w-px bg-muted-foreground/50"
              :style="{ left: pos(overall) }"
            />
            <!-- stem from Ø to the beer's value -->
            <div
              class="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-muted-foreground/40"
              :style="{ left: pos(Math.min(overall, r.score)), width: `calc(${pos(Math.max(overall, r.score))} - ${pos(Math.min(overall, r.score))})` }"
            />
            <span
              class="absolute top-1/2 size-3.5 -translate-1/2 rounded-full ring-2 ring-card"
              :style="{ left: pos(r.score), background: scale?.color(r.score) ?? 'var(--foreground)' }"
            />
          </div>
          <span class="text-right text-sm font-semibold tabular-nums">{{ formatScore(r.score) }}</span>
        </li>
      </ol>

      <!-- axis -->
      <div class="grid grid-cols-[7rem_1fr_3rem] gap-3 sm:grid-cols-[10rem_1fr_3.5rem]">
        <div class="relative col-start-2 h-4 text-[11px] text-muted-foreground tabular-nums">
          <span
            v-for="t in ticks"
            :key="t"
            class="absolute -translate-x-1/2"
            :style="{ left: pos(t) }"
          >{{ formatScore(t) }}</span>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
