<script setup lang="ts">
import { fiveNumbers, type ScoreKey, scoreKeyLabel, vote } from '@/lib/analysis'
import { formatScore } from '@/lib/format'
import { memberColor } from '@/lib/members'

/**
 * One box plot ("Kerze") per member over all their votes: whiskers = lowest/highest vote,
 * box = middle half (25–75 %), line = median, dot = mean.
 */
const { visits, participants } = useStammtisch()
const key = ref<ScoreKey>('gesamt')

/** below this many votes the box says little → faded */
const MIN_N = 5

const rows = computed(() => participants.flatMap((p) => {
  const f = fiveNumbers(visits.map(v => vote(v, p.name, key.value)).filter((x): x is number => x != null))
  return f ? [{ ...p, ...f }] : []
}))

/** fixed 1–5 scale, the whole voting range, so cards are comparable when switching */
const LO = 1
const HI = 5
const ticks = [1, 2, 3, 4, 5]
const pos = (x: number) => `${((x - LO) / (HI - LO)) * 100}%`
const span = (a: number, b: number) => ({ left: pos(a), width: `calc(${pos(b)} - ${pos(a)})` })

const widest = computed(() => [...rows.value].filter(r => r.n >= MIN_N).sort((a, b) => (b.q3 - b.q1) - (a.q3 - a.q1))[0])
const narrowest = computed(() => [...rows.value].filter(r => r.n >= MIN_N).sort((a, b) => (a.q3 - a.q1) - (b.q3 - b.q1))[0])

const describe = (r: (typeof rows.value)[number]) =>
  `${r.name}: ${r.n} Stimmen · niedrigste ${formatScore(r.min)}, mittlere Hälfte ${formatScore(r.q1)}–${formatScore(r.q3)}, Median ${formatScore(r.median)}, Ø ${formatScore(r.mean)}, höchste ${formatScore(r.max)}`
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-xl">
        Notenverteilung
      </CardTitle>
      <CardDescription>
        Wie nutzt jedes Mitglied die Skala? Die Linie reicht von der niedrigsten bis zur höchsten Stimme,
        der Kasten zeigt die mittlere Hälfte aller Stimmen, der Strich darin den Median und der Punkt den Durchschnitt.
      </CardDescription>
    </CardHeader>

    <CardContent class="flex flex-col gap-4">
      <AnalyseScoreKeyTabs v-model="key" />

      <p
        v-if="widest && narrowest && widest !== narrowest"
        class="text-sm"
      >
        Die breiteste Spanne nutzt <span class="font-semibold">{{ widest.name }}</span>
        ({{ formatScore(widest.q1) }}–{{ formatScore(widest.q3) }}),
        am engsten bleibt <span class="font-semibold">{{ narrowest.name }}</span>
        ({{ formatScore(narrowest.q1) }}–{{ formatScore(narrowest.q3) }}).
      </p>

      <ol
        class="flex flex-col gap-2.5"
        :aria-label="`${scoreKeyLabel(key)}-Stimmen je Mitglied`"
      >
        <li
          v-for="r in rows"
          :key="r.slug"
          class="grid grid-cols-[5.5rem_1fr] items-center gap-3 sm:grid-cols-[8rem_1fr]"
          :class="r.n < MIN_N ? 'opacity-50' : ''"
        >
          <NuxtLink
            :to="`/teilnehmer/${r.slug}`"
            class="flex flex-col truncate text-sm font-medium hover:underline"
          >
            {{ r.name }}
            <span class="text-xs font-normal text-muted-foreground">{{ r.n }} Stimmen</span>
          </NuxtLink>

          <div
            class="relative h-7"
            role="img"
            :aria-label="describe(r)"
          >
            <!-- grid lines at the whole notes -->
            <div
              v-for="t in ticks"
              :key="t"
              class="absolute inset-y-0 w-px bg-border"
              :style="{ left: pos(t) }"
            />
            <!-- whisker: lowest → highest -->
            <div
              class="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full"
              :style="{ ...span(r.min, r.max), background: memberColor(r.name) }"
            />
            <div
              v-for="x in [r.min, r.max]"
              :key="x"
              class="absolute top-1/2 h-3 w-0.5 -translate-1/2 rounded-full"
              :style="{ left: pos(x), background: memberColor(r.name) }"
            />
            <!-- box: middle half -->
            <div
              class="absolute inset-y-1 min-w-1 rounded border-2 bg-card"
              :style="{ ...span(r.q1, r.q3), borderColor: memberColor(r.name) }"
            />
            <!-- median -->
            <div
              class="absolute inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
              :style="{ left: pos(r.median) }"
            />
            <!-- mean -->
            <div
              class="absolute top-1/2 size-2 -translate-1/2 rounded-full ring-2 ring-card"
              :style="{ left: pos(r.mean), background: memberColor(r.name) }"
            />
          </div>
        </li>
      </ol>

      <!-- axis -->
      <div class="grid grid-cols-[5.5rem_1fr] gap-3 sm:grid-cols-[8rem_1fr]">
        <div class="relative col-start-2 h-4 text-[11px] text-muted-foreground tabular-nums">
          <span
            v-for="t in ticks"
            :key="t"
            class="absolute -translate-x-1/2"
            :style="{ left: pos(t) }"
          >{{ t }}</span>
        </div>
      </div>

      <p class="text-xs text-muted-foreground">
        Blass = weniger als {{ MIN_N }} Stimmen.
      </p>
    </CardContent>
  </Card>
</template>
