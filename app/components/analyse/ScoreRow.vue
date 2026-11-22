<script setup lang="ts">
import { SCORE_KEYS, type ScoreKey } from '@/lib/analysis'
import { formatDate, formatScore } from '@/lib/format'

/**
 * Tap-row content for score bar charts (the #row slot of <AnalyseDeviationBarChart>):
 * date · Gesamt · Location · Service · Essen, each with its colored icon, the selected one highlighted.
 * Renders several root spans on purpose: the chart puts a "·" between its row's children.
 */
defineProps<{
  date: string
  scores: Record<ScoreKey, number | null | undefined>
  selected: ScoreKey
}>()
</script>

<template>
  <span>{{ formatDate(date) }}</span>
  <span
    v-for="s in SCORE_KEYS"
    :key="s.key"
  >
    <span
      class="inline-flex items-center gap-0.5"
      :class="s.key === selected && 'font-semibold text-foreground'"
      :title="s.label"
    >
      <component
        :is="s.icon"
        class="size-3"
        :style="{ color: s.color }"
        aria-hidden="true"
      />
      <span class="sr-only">{{ s.label }}</span>
      {{ formatScore(scores[s.key] ?? null) }}
    </span>
  </span>
</template>
