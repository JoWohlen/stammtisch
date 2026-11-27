<script setup lang="ts">
import type { Component } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import type { ScoreMap } from '#shared/types'
import { formatScore, formatVote } from '@/lib/format'
import { memberColor } from '@/lib/members'

const props = defineProps<{
  label: string
  /** used instead of `label` when that doesn't fit next to the Ø badge */
  shortLabel?: string
  icon: Component
  scores: ScoreMap
  avg: number | null
}>()

/** the full label is always measured (invisible copy), so it comes back once there is room again */
const titleBox = useTemplateRef<HTMLElement>('titleBox')
const fullLabel = useTemplateRef<HTMLElement>('fullLabel')
const tooWide = ref(false)
useResizeObserver(titleBox, () => {
  if (titleBox.value && fullLabel.value) tooWide.value = fullLabel.value.offsetWidth > titleBox.value.clientWidth
})

const MAX = 5
/** A 5 is a full circle, a 0 draws no arc. */
const SWEEP = 360
const C = 110
const OUTER = 100
const INNER = 22

const at = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180
  return `${C + r * Math.sin(a)} ${C - r * Math.cos(a)}`
}
/** clockwise arc from 12 o'clock; split at 180° so a full 360° circle still renders */
const arcPath = (r: number, deg: number) => {
  const first = Math.min(deg, 180)
  let d = `M ${at(r, 0)} A ${r} ${r} 0 0 1 ${at(r, first)}`
  if (deg > 180) d += ` A ${r} ${r} 0 0 1 ${at(r, Math.min(deg, 359.99))}`
  return d
}

const rings = computed(() => {
  const entries = Object.entries(props.scores).sort((a, b) => b[1] - a[1])
  const step = (OUTER - INNER) / Math.max(entries.length, 1)
  return entries.map(([name, score], i) => {
    const r = OUTER - step / 2 - i * step
    const deg = Math.min(score / MAX, 1) * SWEEP
    return {
      name,
      score,
      r,
      width: step * 0.72,
      font: Math.min(11, step * 0.95),
      color: memberColor(name),
      arc: deg > 0 ? arcPath(r, deg) : '',
    }
  })
})
</script>

<template>
  <Card class="gap-2">
    <CardHeader>
      <CardTitle class="flex min-w-0 items-center gap-2">
        <component
          :is="icon"
          class="size-4 text-muted-foreground"
          aria-hidden="true"
        />
        <span
          ref="titleBox"
          class="relative min-w-0 flex-1 truncate"
          :title="tooWide && shortLabel ? label : undefined"
        >
          <span
            ref="fullLabel"
            class="invisible absolute whitespace-nowrap"
            aria-hidden="true"
          >{{ label }}</span>
          {{ tooWide && shortLabel ? shortLabel : label }}
        </span>
      </CardTitle>
      <CardDescription>Note je Mitglied (0–5)</CardDescription>
      <CardAction>
        <Badge class="border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
          Ø {{ formatScore(avg) }}
        </Badge>
      </CardAction>
    </CardHeader>
    <CardContent class="flex flex-1 items-center justify-center">
      <svg
        v-if="rings.length"
        :viewBox="`0 0 ${2 * C} ${2 * C}`"
        class="w-full max-w-64 select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]"
        role="img"
        :aria-label="`${label}: ${rings.map(r => `${r.name} ${formatVote(r.score)}`).join(', ')}`"
      >
        <g
          v-for="ring in rings"
          :key="ring.name"
        >
          <title>{{ ring.name }}: {{ formatVote(ring.score) }}</title>
          <circle
            :cx="C"
            :cy="C"
            :r="ring.r"
            fill="none"
            class="stroke-muted"
            :stroke-width="ring.width"
          />
          <path
            v-if="ring.arc"
            :d="ring.arc"
            fill="none"
            :stroke="ring.color"
            :stroke-width="ring.width"
            stroke-linecap="round"
          />
        </g>
        <!-- value labels left of the 12 o'clock start, drawn on top with a halo so they stay readable over full rings -->
        <text
          v-for="ring in rings"
          :key="`l-${ring.name}`"
          :x="C - 5"
          :y="C - ring.r"
          text-anchor="end"
          dominant-baseline="central"
          :fill="ring.color"
          :font-size="ring.font"
          class="pointer-events-none font-semibold tabular-nums"
          style="paint-order: stroke; stroke: var(--card); stroke-width: 3px; stroke-linejoin: round"
        >{{ formatVote(ring.score) }}</text>
      </svg>
      <p
        v-else
        class="text-sm text-muted-foreground"
      >
        Keine Bewertungen
      </p>
    </CardContent>
  </Card>
</template>
