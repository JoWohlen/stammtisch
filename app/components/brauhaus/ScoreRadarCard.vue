<script setup lang="ts">
import type { Category, Visit } from '#shared/types'
import { formatDate, formatScore } from '@/lib/format'

const props = defineProps<{
  visit: Visit
  /** optional earlier visit, drawn dashed for comparison */
  compare?: Visit | null
}>()

const CATS: { key: Category, label: string }[] = [
  { key: 'location', label: 'Location' },
  { key: 'service', label: 'Service' },
  { key: 'essen', label: 'Essen' },
]

const MAX = 5
/** nearly square viewBox, so the card is as tall as the radial cards next to it */
const R = 100
const CX = 110
const CY = 134
const W = 2 * CX
const H = CY + R + 2

const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / CATS.length
const point = (i: number, value: number, r = R) => {
  const k = (r * value) / MAX
  return [CX + k * Math.cos(angle(i)), CY + k * Math.sin(angle(i))] as const
}
const polygon = (v: Visit) => CATS.map((c, i) => point(i, v.averages[c.key] ?? 0).join(',')).join(' ')

/** top label above the circle, the two bottom labels just below their spoke ends (inside the circle) */
const labels = CATS.map((c, i) => {
  const [x, y] = point(i, MAX)
  return { ...c, x, y: i === 0 ? y - 20 : y + 16 }
})

const points = computed(() => CATS.map((c, i) => point(i, props.visit.averages[c.key] ?? 0)))
</script>

<template>
  <Card class="gap-2">
    <CardHeader>
      <CardTitle>Bewertung</CardTitle>
      <CardDescription>
        Ø je Kategorie (0–5)<template v-if="compare">
          · <span class="inline-block w-4 border-t border-dashed border-muted-foreground align-middle" /> {{ formatDate(compare.date) }}
        </template>
      </CardDescription>
      <CardAction>
        <Badge class="border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
          Ø {{ formatScore(visit.averages.gesamt) }}
        </Badge>
      </CardAction>
    </CardHeader>
    <CardContent class="flex flex-1 items-center justify-center">
      <svg
        :viewBox="`0 0 ${W} ${H}`"
        class="w-full max-w-64"
        role="img"
        :aria-label="CATS.map(c => `${c.label} ${formatScore(visit.averages[c.key])}`).join(', ')"
      >
        <circle
          v-for="n in MAX"
          :key="n"
          :cx="CX"
          :cy="CY"
          :r="(R * n) / MAX"
          class="fill-none stroke-border"
        />
        <line
          v-for="(_, i) in CATS"
          :key="i"
          :x1="CX"
          :y1="CY"
          :x2="point(i, MAX)[0]"
          :y2="point(i, MAX)[1]"
          class="stroke-border"
        />
        <polygon
          v-if="compare"
          :points="polygon(compare)"
          class="fill-none stroke-muted-foreground"
          stroke-dasharray="4 3"
          stroke-width="1.5"
        />
        <polygon
          :points="polygon(visit)"
          class="fill-amber-400/30 stroke-amber-500"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <circle
          v-for="([x, y], i) in points"
          :key="`p${i}`"
          :cx="x"
          :cy="y"
          r="4"
          class="fill-amber-500"
        />
        <text
          v-for="l in labels"
          :key="l.key"
          :x="l.x"
          :y="l.y"
          text-anchor="middle"
          class="fill-muted-foreground text-[11px]"
        >
          {{ l.label }}
          <tspan
            :x="l.x"
            dy="14"
            class="fill-foreground text-[13px] font-semibold"
          >{{ formatScore(visit.averages[l.key]) }}</tspan>
        </text>
      </svg>
    </CardContent>
  </Card>
</template>
