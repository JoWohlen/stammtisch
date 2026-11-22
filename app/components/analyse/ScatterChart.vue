<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { linearFit, niceTicks } from '@/lib/analysis'
import type { ScatterPoint } from '@/lib/chart'

/**
 * Dots on one x and one y axis, with an optional least-squares trend line.
 * Hovering (or tapping) shows the nearest dot's tooltip; clicking a dot opens its link.
 */
const props = withDefaults(defineProps<{
  points: ScatterPoint[]
  xFormat: (n: number) => string
  yFormat: (n: number) => string
  /** axis captions */
  xLabel: string
  yLabel: string
  trend?: boolean
  label: string
  /** custom x ticks (e.g. years on a date axis) */
  xTicks?: { value: number, label: string }[]
  /** fullscreen: fill the available height instead of the fixed one */
  full?: boolean
}>(), { trend: true })

const box = useTemplateRef<HTMLDivElement>('box')
const { width, height: boxHeight } = useElementSize(box)
const H_DEFAULT = 300
const H = computed(() => (props.full ? Math.max(160, boxHeight.value) : H_DEFAULT))
const PAD = { top: 12, right: 12, bottom: 40, left: 48 }

const xs = computed(() => props.points.map(p => p.x))
const ys = computed(() => props.points.map(p => p.y))
const yTicks = computed(() => (ys.value.length ? niceTicks(Math.min(...ys.value), Math.max(...ys.value)) : []))
const xTickList = computed(() => props.xTicks
  ?? (xs.value.length ? niceTicks(Math.min(...xs.value), Math.max(...xs.value)).map(value => ({ value, label: props.xFormat(value) })) : []))

const domain = computed(() => {
  const xv = [...xs.value, ...(props.xTicks ? [] : xTickList.value.map(t => t.value))]
  const yv = [...ys.value, ...yTicks.value]
  const pad = (lo: number, hi: number) => (hi > lo ? (hi - lo) * 0.03 : 1)
  const x0 = Math.min(...xv)
  const x1 = Math.max(...xv)
  return { x0: x0 - pad(x0, x1), x1: x1 + pad(x0, x1), y0: Math.min(...yv), y1: Math.max(...yv) }
})
const sx = (x: number) => PAD.left + ((x - domain.value.x0) / (domain.value.x1 - domain.value.x0 || 1)) * (width.value - PAD.left - PAD.right)
const sy = (y: number) => PAD.top + (1 - (y - domain.value.y0) / (domain.value.y1 - domain.value.y0 || 1)) * (H.value - PAD.top - PAD.bottom)

const fit = computed(() => (props.trend ? linearFit(xs.value, ys.value) : null))
const fitLine = computed(() => {
  const f = fit.value
  if (!f) return null
  const a = Math.min(...xs.value)
  const b = Math.max(...xs.value)
  return { x1: sx(a), y1: sy(f.intercept + f.slope * a), x2: sx(b), y2: sy(f.intercept + f.slope * b) }
})

// ---- hover: nearest dot within reach --------------------------------------
const active = ref<ScatterPoint | null>(null)
const REACH = 28
function onMove(e: PointerEvent) {
  const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  let best: ScatterPoint | null = null
  let bestD = REACH
  for (const p of props.points) {
    const d = Math.hypot(sx(p.x) - mx, sy(p.y) - my)
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  active.value = best
}
const tip = computed(() => {
  const p = active.value
  if (!p) return null
  const left = sx(p.x)
  return { p, left, top: sy(p.y), alignRight: left > width.value / 2 }
})
</script>

<template>
  <div
    ref="box"
    class="relative w-full"
    :class="full && 'min-h-0 flex-1'"
  >
    <svg
      v-if="width"
      :width="width"
      :height="H"
      class="block touch-pan-y select-none"
      :class="full && 'absolute inset-0'"
      data-no-swipe
      role="img"
      :aria-label="label"
      @pointermove="onMove"
      @pointerdown="onMove"
      @pointerleave="active = null"
      @click="active?.to && navigateTo(active.to)"
    >
      <!-- grid + axes -->
      <g class="text-[11px] text-muted-foreground tabular-nums">
        <g
          v-for="t in yTicks"
          :key="`y${t}`"
        >
          <line
            :x1="PAD.left"
            :x2="width - PAD.right"
            :y1="sy(t)"
            :y2="sy(t)"
            class="stroke-border"
          />
          <text
            :x="PAD.left - 6"
            :y="sy(t)"
            text-anchor="end"
            dominant-baseline="middle"
            fill="currentColor"
          >{{ yFormat(t) }}</text>
        </g>
        <text
          v-for="t in xTickList"
          :key="`x${t.value}`"
          :x="sx(t.value)"
          :y="H - PAD.bottom + 16"
          text-anchor="middle"
          fill="currentColor"
        >{{ t.label }}</text>
        <text
          :x="(PAD.left + width - PAD.right) / 2"
          :y="H - 4"
          text-anchor="middle"
          fill="currentColor"
        >{{ xLabel }}</text>
        <text
          :transform="`translate(11 ${(PAD.top + H - PAD.bottom) / 2}) rotate(-90)`"
          text-anchor="middle"
          fill="currentColor"
        >{{ yLabel }}</text>
      </g>

      <line
        v-if="fitLine"
        v-bind="fitLine"
        class="stroke-muted-foreground"
        stroke-width="2"
        stroke-dasharray="6 4"
        stroke-linecap="round"
      />

      <!-- dots with a surface ring, so overlapping ones stay apart -->
      <circle
        v-for="p in points"
        :key="p.key"
        :cx="sx(p.x)"
        :cy="sy(p.y)"
        :r="active === p ? 7 : 5"
        class="stroke-card"
        stroke-width="2"
        :fill="p.color ?? 'var(--foreground)'"
        :fill-opacity="active && active !== p ? 0.35 : 0.85"
        :style="{ cursor: p.to ? 'pointer' : undefined }"
      />
    </svg>

    <div
      v-if="tip"
      class="pointer-events-none absolute z-10 w-max max-w-56 rounded-md border bg-popover px-2.5 py-1.5 text-sm text-popover-foreground shadow-md"
      :style="{
        top: `${tip.top}px`,
        left: tip.alignRight ? undefined : `${tip.left + 12}px`,
        right: tip.alignRight ? `${width - tip.left + 12}px` : undefined,
        transform: 'translateY(-50%)',
      }"
    >
      <div class="font-semibold leading-tight">
        {{ tip.p.title }}
      </div>
      <div
        v-for="l in tip.p.lines"
        :key="l"
        class="text-xs text-muted-foreground"
      >
        {{ l }}
      </div>
    </div>
  </div>
</template>
