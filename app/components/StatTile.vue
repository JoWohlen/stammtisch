<script setup lang="ts">
import type { Component } from 'vue'
import { useElementSize, useResizeObserver } from '@vueuse/core'
import { Minus, TrendingDown, TrendingUp } from '@lucide/vue'

const props = defineProps<{
  label: string
  /** one text, or several from longest to shortest: the first that fits the tile is shown */
  value: string | string[]
  icon?: Component
  sub?: string
  /** arrow next to the value: green up, red down, grey sideways */
  trend?: 'up' | 'down' | 'flat'
}>()

const TREND = {
  up: { icon: TrendingUp, class: 'text-emerald-600 dark:text-emerald-400', label: 'steigend' },
  down: { icon: TrendingDown, class: 'text-rose-600 dark:text-rose-400', label: 'fallend' },
  flat: { icon: Minus, class: 'text-muted-foreground', label: 'gleichbleibend' },
}

const forms = computed(() => (Array.isArray(props.value) ? props.value : [props.value]))

const box = useTemplateRef<HTMLDivElement>('box')
const { width } = useElementSize(box)
const probes = useTemplateRef<HTMLSpanElement[]>('probes')

/**
 * widths of the invisible copies, kept reactive: offsetWidth alone is not, so a late web font
 * (common on mobile) widened the digits without re-checking which form fits
 */
const probeWidths = ref<number[]>([])
useResizeObserver(() => probes.value ?? [], () => {
  probeWidths.value = (probes.value ?? []).map(el => el.offsetWidth)
})

/** index of the first form that fits; the full form until the tile has been measured (SSR) */
const fit = computed(() => {
  const w = width.value
  const ws = probeWidths.value
  if (!w || !ws.length) return 0
  const i = ws.findIndex(pw => pw <= w)
  return i === -1 ? forms.value.length - 1 : i
})
</script>

<template>
  <!-- min-w-0: let the grid column shrink below the number, so the value can switch to a shorter form -->
  <div class="flex min-w-0 flex-col gap-1 rounded-lg border bg-muted/40 p-4">
    <div class="flex items-center gap-2 text-sm text-muted-foreground">
      <component
        :is="icon"
        v-if="icon"
        class="size-4"
        aria-hidden="true"
      />
      {{ label }}
    </div>
    <div class="flex items-center gap-1.5">
      <div
        ref="box"
        :class="trend ? '' : 'flex-1'"
        class="relative min-w-0 overflow-hidden text-3xl font-semibold whitespace-nowrap tabular-nums tracking-tight"
        :title="fit > 0 ? forms[0] : undefined"
      >
        {{ forms[fit] }}
        <!-- invisible copies to measure every form at the tile's font size -->
        <template v-if="forms.length > 1">
          <span
            v-for="f in forms"
            ref="probes"
            :key="f"
            class="invisible absolute top-0 left-0 w-max"
            aria-hidden="true"
          >{{ f }}</span>
        </template>
      </div>
      <component
        :is="TREND[trend].icon"
        v-if="trend"
        class="size-7 shrink-0"
        :class="TREND[trend].class"
        :aria-label="TREND[trend].label"
        role="img"
      />
    </div>
    <div
      v-if="sub"
      class="text-xs text-muted-foreground"
    >
      {{ sub }}
    </div>
    <slot />
  </div>
</template>
