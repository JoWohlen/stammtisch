<script setup lang="ts">
import { formatDate, formatNumber } from '@/lib/format'
import { byDate } from '@/lib/stats'

/** Rhythmus: histogram of the days between two Stammtische, in weekly buckets. */
const { visits } = useStammtisch()

const DAY = 24 * 60 * 60 * 1000
const timeline = byDate(visits)
const gaps = timeline.slice(1).map((v, i) => ({
  from: timeline[i]!,
  to: v,
  days: Math.round((Date.parse(v.date) - Date.parse(timeline[i]!.date)) / DAY),
}))

const sortedDays = gaps.map(g => g.days).sort((a, b) => a - b)
const median = sortedDays.length ? sortedDays[Math.floor((sortedDays.length - 1) / 2)]! : null
const longest = [...gaps].sort((a, b) => b.days - a.days)[0]

/** one bucket per week: 0–6, 7–13, … up to the longest gap */
const WEEK = 7
const buckets = Array.from({ length: Math.floor((sortedDays.at(-1) ?? 0) / WEEK) + 1 }, (_, k) => {
  const lo = k * WEEK
  const hi = lo + WEEK - 1
  const items = gaps.filter(g => g.days >= lo && g.days <= hi)
  return { k, lo, hi, items }
})
const most = Math.max(1, ...buckets.map(b => b.items.length))
const usual = [...buckets].sort((a, b) => b.items.length - a.items.length)[0]

const weeks = (k: number) => (k === 0 ? '< 1' : String(k))

const active = ref<number | null>(null)
const activeBucket = computed(() => (active.value == null ? null : buckets[active.value]!))
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-xl">
        Rhythmus
      </CardTitle>
      <CardDescription>
        Wie regelmäßig treffen wir uns? Wie viele Tage lagen zwischen zwei Stammtischen, in Wochen zusammengefasst.
      </CardDescription>
    </CardHeader>

    <CardContent class="flex flex-col gap-4">
      <p
        v-if="median != null && usual && longest"
        class="text-sm"
      >
        Meistens liegen <span class="font-semibold">{{ usual.lo }}–{{ usual.hi }} Tage</span> dazwischen
        (Median {{ median }} Tage). Die längste Pause waren {{ longest.days }} Tage,
        vor dem Abend im {{ longest.to.brauhaus }} am {{ formatDate(longest.to.date) }}.
      </p>

      <div
        class="flex h-48 items-end gap-1 pt-5 sm:gap-2"
        role="img"
        :aria-label="`Abstände zwischen ${gaps.length + 1} Stammtischen, in Wochen`"
        @pointerleave="active = null"
      >
        <div
          v-for="b in buckets"
          :key="b.k"
          class="relative h-full min-w-0 flex-1 rounded-sm"
          :class="active === b.k ? 'bg-muted/60' : ''"
          @pointerenter="active = b.k"
        >
          <!-- bar height ∝ count; the count sits just above it -->
          <div
            class="absolute inset-x-[10%] bottom-0 mx-auto max-w-12 rounded-t"
            :style="{ height: `${(b.items.length / most) * 100}%`, background: 'var(--chart-2)', minHeight: b.items.length ? '2px' : '0' }"
          />
          <span
            v-if="b.items.length"
            class="absolute inset-x-0 text-center text-xs text-muted-foreground tabular-nums"
            :style="{ bottom: `calc(${(b.items.length / most) * 100}% + 2px)` }"
          >{{ b.items.length }}</span>
        </div>
      </div>
      <!-- axis: weeks -->
      <div class="-mt-2 flex gap-1 sm:gap-2">
        <span
          v-for="b in buckets"
          :key="b.k"
          class="min-w-0 flex-1 text-center text-[10px] text-muted-foreground tabular-nums sm:text-xs"
        >{{ weeks(b.k) }}</span>
      </div>
      <p class="-mt-2 text-center text-xs text-muted-foreground">
        Wochen Pause
      </p>

      <div
        class="min-h-5 text-sm"
        aria-live="polite"
      >
        <template v-if="activeBucket">
          <span class="font-medium">{{ activeBucket.lo }}–{{ activeBucket.hi }} Tage:</span>
          {{ activeBucket.items.length ? `${formatNumber(activeBucket.items.length)}×` : 'nie' }}
          <span
            v-if="activeBucket.items.length"
            class="text-muted-foreground"
          >· zuletzt vor {{ activeBucket.items.at(-1)!.to.brauhaus }} ({{ formatDate(activeBucket.items.at(-1)!.to.date) }})</span>
        </template>
        <template v-else>
          Zeig auf einen Balken für Details.
        </template>
      </div>
    </CardContent>
  </Card>
</template>
