<script setup lang="ts">
import type { Component } from 'vue'
import type { ScoreMap } from '#shared/types'
import { formatScore, formatVote } from '@/lib/format'
import { memberColor } from '@/lib/members'

const props = defineProps<{
  label: string
  icon: Component
  scores: ScoreMap
  avg: number | null
}>()

const MAX = 5
/** A 5 fills 270°, which leaves the top-left quadrant free for the value labels. */
const SWEEP = 270
const C = 110
const OUTER = 100
const INNER = 22

const rings = computed(() => {
  const entries = Object.entries(props.scores).sort((a, b) => b[1] - a[1])
  const step = (OUTER - INNER) / Math.max(entries.length, 1)
  return entries.map(([name, score], i) => {
    const r = OUTER - step / 2 - i * step
    const end = ((score / MAX) * SWEEP * Math.PI) / 180
    const x = C + r * Math.sin(end)
    const y = C - r * Math.cos(end)
    const large = (score / MAX) * SWEEP > 180 ? 1 : 0
    return {
      name,
      score,
      r,
      width: step * 0.72,
      font: Math.min(11, step * 0.95),
      color: memberColor(name),
      track: `M ${C} ${C - r} A ${r} ${r} 0 1 1 ${C - r} ${C}`,
      arc: score > 0 ? `M ${C} ${C - r} A ${r} ${r} 0 ${large} 1 ${x} ${y}` : '',
    }
  })
})
</script>

<template>
  <Card class="gap-2">
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <component
          :is="icon"
          class="size-4 text-muted-foreground"
          aria-hidden="true"
        />
        {{ label }}
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
        class="w-full max-w-64"
        role="img"
        :aria-label="`${label}: ${rings.map(r => `${r.name} ${formatVote(r.score)}`).join(', ')}`"
      >
        <g
          v-for="ring in rings"
          :key="ring.name"
        >
          <title>{{ ring.name }}: {{ formatVote(ring.score) }}</title>
          <path
            :d="ring.track"
            fill="none"
            class="stroke-muted"
            :stroke-width="ring.width"
            stroke-linecap="round"
          />
          <path
            v-if="ring.arc"
            :d="ring.arc"
            fill="none"
            :stroke="ring.color"
            :stroke-width="ring.width"
            stroke-linecap="round"
          />
          <text
            :x="C - 6"
            :y="C - ring.r"
            text-anchor="end"
            dominant-baseline="central"
            :fill="ring.color"
            :font-size="ring.font"
            class="font-semibold tabular-nums"
          >{{ formatVote(ring.score) }}</text>
        </g>
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
