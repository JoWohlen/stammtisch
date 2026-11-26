<script setup lang="ts">
import { useElementSize, useScroll } from '@vueuse/core'
import { niceTicks, polyFit } from '@/lib/analysis'
import type { ScatterPoint } from '@/lib/chart'

/**
 * Dots on one x and one y axis, with an optional least-squares trend (a line, or a
 * polynomial curve with `degree` > 1).
 * Hovering (or tapping) shows the nearest dot's tooltip; clicking a dot opens its link.
 * Like the deviation bar charts, the y axis stays put and the plot scrolls sideways once
 * there would be less than MIN_GAP of width per dot.
 */
const props = withDefaults(defineProps<{
  points: ScatterPoint[]
  xFormat: (n: number) => string
  yFormat: (n: number) => string
  /** axis captions */
  xLabel: string
  yLabel: string
  trend?: boolean
  /** degree of the least-squares trend polynomial (1 = straight line) */
  degree?: number
  label: string
  /** custom x ticks (e.g. years on a date axis) */
  xTicks?: { value: number, label: string }[]
  /** fullscreen: fill the available height instead of the fixed one */
  full?: boolean
  /** start scrolled to the right end (e.g. the newest visits on a date axis) */
  startAtEnd?: boolean
}>(), { trend: true, degree: 1 })

const box = useTemplateRef<HTMLDivElement>('box')
const { width, height: boxHeight } = useElementSize(box)
const H_DEFAULT = 300
const H = computed(() => (props.full ? Math.max(160, boxHeight.value) : H_DEFAULT))
/** left = width of the fixed y-axis column; inner = gap between the axis and the first dot */
const PAD = { top: 12, right: 12, bottom: 40, left: 48, inner: 12 }
/** narrowest width per dot before the plot scrolls instead of squeezing */
const MIN_GAP = 14
/** fullscreen: this many dots fill the screen, the rest scroll sideways */
const FULL_WINDOW = 50

const scroller = useTemplateRef<HTMLDivElement>('scroller')
const { height: scrollerHeight } = useElementSize(scroller)
const { x: scrollX } = useScroll(scroller)
/** drawing height: the scroller's content box, so a desktop scrollbar does not cut off the x axis */
const h = computed(() => scrollerHeight.value || H.value)
const visibleW = computed(() => Math.max(0, width.value - PAD.left))
const minGap = computed(() => (props.full ? visibleW.value / FULL_WINDOW : MIN_GAP))
/** width of the scrolling plot (≥ visible width) */
const plotW = computed(() => Math.max(visibleW.value, props.points.length * minGap.value + PAD.inner + PAD.right))

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
/** x inside the scrolling plot (0 = right after the fixed axis) */
const sx = (x: number) => PAD.inner + ((x - domain.value.x0) / (domain.value.x1 - domain.value.x0 || 1)) * (plotW.value - PAD.inner - PAD.right)
const sy = (y: number) => PAD.top + (1 - (y - domain.value.y0) / (domain.value.y1 - domain.value.y0 || 1)) * (h.value - PAD.top - PAD.bottom)

const fit = computed(() => (props.trend ? polyFit(xs.value, ys.value, props.degree) : null))
/** the trend as an SVG path, sampled across the data's x range and clipped to the plot's y range */
const fitPath = computed(() => {
  const f = fit.value
  if (!f) return null
  const a = Math.min(...xs.value)
  const b = Math.max(...xs.value)
  const { y0, y1 } = domain.value
  const steps = props.degree > 1 ? 80 : 1
  const pts = Array.from({ length: steps + 1 }, (_, i) => {
    const x = a + ((b - a) * i) / steps
    return `${sx(x).toFixed(1)},${sy(Math.min(y1, Math.max(y0, f(x)))).toFixed(1)}`
  })
  return `M${pts.join('L')}`
})

// ---- hover: nearest dot within reach --------------------------------------
const active = ref<ScatterPoint | null>(null)
const REACH = 28
function onMove(e: PointerEvent) {
  // the plot's own rect already accounts for the scroll position
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
  // dot position on screen: after the fixed axis, minus how far the plot is scrolled
  const left = PAD.left + sx(p.x) - scrollX.value
  return { p, left, top: sy(p.y), alignRight: left > width.value / 2 }
})

/** start at the right end (once, as soon as the plot is laid out) */
let startedAtEnd = false
watch([scroller, width], () => {
  const el = scroller.value
  if (!props.startAtEnd || startedAtEnd || !el || !width.value) return
  startedAtEnd = true
  nextTick(() => el.scrollTo({ left: el.scrollWidth }))
}, { flush: 'post' })
/** entering/leaving fullscreen changes the plot width: scroll to the end again once it is laid out */
watch(() => props.full, () => (startedAtEnd = false))
</script>

<template>
  <div
    ref="box"
    class="relative w-full"
    :class="full && 'min-h-0 flex-1'"
    :style="full ? undefined : { height: `${H}px` }"
  >
    <div
      v-if="width"
      class="absolute inset-0 flex select-none"
      role="img"
      :aria-label="label"
    >
      <!-- fixed y axis -->
      <svg
        :width="PAD.left"
        :height="h"
        class="shrink-0 text-[11px] text-muted-foreground tabular-nums"
        aria-hidden="true"
      >
        <text
          v-for="t in yTicks"
          :key="`y${t}`"
          :x="PAD.left - 6"
          :y="sy(t)"
          text-anchor="end"
          dominant-baseline="middle"
          fill="currentColor"
        >{{ yFormat(t) }}</text>
        <text
          :transform="`translate(11 ${(PAD.top + h - PAD.bottom) / 2}) rotate(-90)`"
          text-anchor="middle"
          fill="currentColor"
        >{{ yLabel }}</text>
      </svg>

      <!-- scrolling plot -->
      <div
        ref="scroller"
        class="min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain"
      >
        <svg
          :width="plotW"
          :height="h"
          class="block touch-pan-x touch-pan-y"
          data-no-swipe
          @pointermove="onMove"
          @pointerdown="onMove"
          @pointerleave="active = null"
          @click="active?.to && navigateTo(active.to)"
        >
          <!-- grid + x axis -->
          <g class="text-[11px] text-muted-foreground tabular-nums">
            <line
              v-for="t in yTicks"
              :key="`y${t}`"
              :x1="0"
              :x2="plotW - PAD.right"
              :y1="sy(t)"
              :y2="sy(t)"
              class="stroke-border"
            />
            <text
              v-for="t in xTickList"
              :key="`x${t.value}`"
              :x="sx(t.value)"
              :y="h - PAD.bottom + 16"
              text-anchor="middle"
              fill="currentColor"
            >{{ t.label }}</text>
          </g>

          <path
            v-if="fitPath"
            :d="fitPath"
            fill="none"
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
      </div>

      <!-- x caption: stays centred under the visible part while the plot scrolls -->
      <div
        class="pointer-events-none absolute right-0 text-center text-[11px] text-muted-foreground"
        :style="{ left: `${PAD.left}px`, top: `${h - 16}px` }"
        aria-hidden="true"
      >
        {{ xLabel }}
      </div>
    </div>

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
