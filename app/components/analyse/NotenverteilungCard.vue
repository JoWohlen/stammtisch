<script setup lang="ts">
import { fiveNumbers, quantile, type ScoreKey, scoreKeyLabel, std, vote } from '@/lib/analysis'
import { formatScore } from '@/lib/format'
import { memberColor } from '@/lib/members'

/**
 * One violin per member over all their votes: the shape is a smoothed density (Gaussian kernel),
 * thick where many votes landed, mirrored around the middle; line = median, dot = mean.
 */
const { visits, participants } = useStammtisch()
const key = ref<ScoreKey>('gesamt')

/** below this many votes the box says little → faded */
const MIN_N = 5

const rows = computed(() => participants.flatMap((p) => {
  const xs = visits.map(v => vote(v, p.name, key.value)).filter((x): x is number => x != null)
  const f = fiveNumbers(xs)
  return f ? [{ ...p, ...f, ...violin(xs) }] : []
}))

/** fixed 1–5 scale, the whole voting range, so cards are comparable when switching */
const LO = 1
const HI = 5
const ticks = [1, 2, 3, 4, 5]
const pos = (x: number) => `${((x - LO) / (HI - LO)) * 100}%`

/** x in the SVG's 0–100 coordinate space (same scale as `pos`) */
const sx = (x: number) => ((x - LO) / (HI - LO)) * 100

/**
 * Kernel density over the votes, as an SVG path in a 100 × 2 box (middle line at y = 1),
 * scaled so each member's thickest spot fills the row. Tails run 2 bandwidths past the
 * lowest/highest vote, cut at the 1–5 scale. Also returns the half-thickness at the median.
 */
function violin(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b)
  const iqr = quantile(s, 0.75) - quantile(s, 0.25)
  const spread = Math.min(std(s), iqr ? iqr / 1.34 : Infinity)
  // Silverman's rule; a floor keeps few or identical votes from collapsing into a spike
  const h = Math.max(0.15, 0.9 * (Number.isFinite(spread) ? spread : 0) * s.length ** -0.2)
  const density = (x: number) => s.reduce((sum, v) => sum + Math.exp(-0.5 * ((x - v) / h) ** 2), 0)
  const a = Math.max(LO, s[0]! - 2 * h)
  const b = Math.min(HI, s.at(-1)! + 2 * h)
  const STEPS = 80
  const pts = Array.from({ length: STEPS + 1 }, (_, i) => a + ((b - a) * i) / STEPS).map(x => [x, density(x)] as const)
  const peak = Math.max(...pts.map(p => p[1])) || 1
  const half = (d: number) => (d / peak) * 0.95
  const top = pts.map(([x, d]) => `${sx(x).toFixed(2)},${(1 - half(d)).toFixed(3)}`)
  const bottom = pts.toReversed().map(([x, d]) => `${sx(x).toFixed(2)},${(1 + half(d)).toFixed(3)}`)
  return { path: `M${top.join('L')}L${bottom.join('L')}Z`, medianHalf: half(density(quantile(s, 0.5))) }
}

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
        Wie nutzt jedes Mitglied die Skala? Je breiter die Form, desto mehr Stimmen lagen dort,
        der Strich zeigt den Median und der Punkt den Durchschnitt.
      </CardDescription>
    </CardHeader>

    <CardContent class="flex flex-col gap-4">
      <AnalyseScoreKeyTabs
        v-model="key"
        stretch="mobile"
      />

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
            class="relative h-9"
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
            <!-- violin: density of the votes, plus the median as a line across it -->
            <svg
              class="absolute inset-0 size-full overflow-visible"
              viewBox="0 0 100 2"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                :d="r.path"
                :fill="memberColor(r.name)"
                fill-opacity="0.3"
                :stroke="memberColor(r.name)"
                stroke-width="1.5"
                stroke-linejoin="round"
                vector-effect="non-scaling-stroke"
              />
              <line
                :x1="sx(r.median)"
                :x2="sx(r.median)"
                :y1="1 - r.medianHalf"
                :y2="1 + r.medianHalf"
                class="stroke-foreground"
                stroke-width="2"
                stroke-linecap="round"
                vector-effect="non-scaling-stroke"
              />
            </svg>
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
    </CardContent>
  </Card>
</template>
