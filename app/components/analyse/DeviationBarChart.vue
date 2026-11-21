<script setup lang="ts">
import { useElementSize, useScroll } from '@vueuse/core'
import { ArrowRight, ThumbsDown, Trophy } from '@lucide/vue'
import type { DeviationBar } from '@/lib/chart'
import { formatDate } from '@/lib/format'
import { rampColor } from '@/lib/score-color'

/**
 * One bar per visit (chronological, evenly spaced), drawn from the average:
 * better than Ø goes up, worse goes down. Colour runs from red (worst) to green (best).
 * `higherIsBetter: false` flips the direction (e.g. Preis/Leistung: lower = better).
 * Like the Anwesenheit grid, the y axis stays put and the bars scroll sideways once
 * they would get narrower than MIN_BAND (starting scrolled to the newest visits).
 */
const props = defineProps<{
  bars: DeviationBar[]
  avg: number
  higherIsBetter: boolean
  format: (n: number) => string
  ariaLabel: string
  /** fullscreen: fill the available height instead of the fixed one */
  full?: boolean
  /** mobile row: leave out the bar's value (when the row slot already shows it) */
  rowHideValue?: boolean
}>()

defineSlots<{
  /** tooltip body for the active bar */
  tooltip: (p: { bar: DeviationBar }) => unknown
  /** extra info for the second line of the mobile row (after the date) */
  row?: (p: { bar: DeviationBar }) => unknown
}>()

// ---- layout -------------------------------------------------------------
const box = useTemplateRef<HTMLDivElement>('box')
const { width, height: boxHeight } = useElementSize(box)
const compact = computed(() => width.value < 640)
const height = computed(() => (props.full ? Math.max(120, boxHeight.value) : compact.value ? 280 : 400))
/** left = width of the fixed y-axis column */
const PAD = { top: 18, right: 8, bottom: 28, left: 44 }
/** narrowest column per visit before the bars scroll instead of squeezing */
const MIN_BAND = 14

const scroller = useTemplateRef<HTMLDivElement>('scroller')
const { height: scrollerHeight } = useElementSize(scroller)
const { x: scrollX } = useScroll(scroller)
/** drawing height: the scroller's content box, so a desktop scrollbar does not cut off the year axis */
const h = computed(() => scrollerHeight.value || height.value)
/** fullscreen: this many visits fill the screen, the rest scroll sideways */
const FULL_WINDOW = 50
/** narrowest column per visit: fixed normally, 1/50 of the visible plot in fullscreen */
const minBand = computed(() => (props.full ? (width.value - PAD.left - PAD.right) / FULL_WINDOW : MIN_BAND))
/** width of the scrolling plot (≥ visible width) */
const plotW = computed(() => Math.max(width.value - PAD.left, props.bars.length * minBand.value + PAD.right))

/** signed distance from Ø, positive = better */
const better = (v: number) => (props.higherIsBetter ? v - props.avg : props.avg - v)

/** symmetric range around Ø with a readable step */
const scale = computed(() => {
  const maxAbs = Math.max(...props.bars.map(b => Math.abs(b.value - props.avg)), 0.01)
  const step = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10].find(s => maxAbs / s <= 3) ?? 10
  const lim = Math.ceil(maxAbs / step) * step
  return { lim, step, maxAbs }
})

const mid = computed(() => PAD.top + (h.value - PAD.top - PAD.bottom) / 2)
/** y of a "better" amount: positive goes up */
const fy = (d: number) => mid.value - (d / scale.value.lim) * ((h.value - PAD.top - PAD.bottom) / 2)

const yTicks = computed(() => {
  const { lim, step } = scale.value
  const n = Math.round(lim / step)
  // label = how far the value itself is from Ø (sign follows the value, not "better")
  return Array.from({ length: 2 * n + 1 }, (_, i) => (i - n) * step).map(d => ({
    y: fy(d),
    zero: d === 0,
    label: d === 0 ? 'Ø' : `${(props.higherIsBetter ? d : -d) > 0 ? '+' : '−'}${props.format(Math.abs(d)).replace(/,?0+$/, '')}`,
  }))
})

const band = computed(() => (plotW.value - PAD.right) / Math.max(1, props.bars.length))

/** red (worst) → green (best), through amber in the middle */
const color = (b: DeviationBar) => {
  const t = (better(b.value) / scale.value.maxAbs + 1) / 2
  return rampColor(t)
}

const items = computed(() => {
  if (!width.value) return []
  const w = Math.max(1, band.value * 0.7)
  return props.bars.map((b, i) => {
    const d = better(b.value)
    const y0 = fy(0)
    const y1 = fy(d)
    return {
      bar: b,
      cx: (i + 0.5) * band.value,
      x: i * band.value + (band.value - w) / 2,
      w,
      top: Math.min(y0, y1),
      // at least 1px, so a visit right at Ø stays visible
      h: Math.max(1, Math.abs(y1 - y0)),
      up: d >= 0,
      end: y1,
      fill: color(b),
    }
  })
})

/** a tick at the first visit of every year */
const xTicks = computed(() => {
  const seen = new Set<string>()
  return items.value.flatMap((it) => {
    const y = it.bar.date.slice(0, 4)
    if (seen.has(y)) return []
    seen.add(y)
    return [{ x: it.x - (band.value - it.w) / 2, label: y }]
  })
})

const extremes = computed(() => {
  if (compact.value || !items.value.length) return []
  const sorted = [...items.value].sort((a, b) => better(a.bar.value) - better(b.bar.value))
  return [
    { it: sorted.at(-1)!, icon: Trophy, cls: 'text-amber-500', above: true },
    { it: sorted[0]!, icon: ThumbsDown, cls: 'text-muted-foreground', above: false },
  ].map(e => ({ ...e, right: e.it.cx > plotW.value * 0.7 }))
})

// ---- interaction --------------------------------------------------------
const active = ref<number | null>(null)
const activeItem = computed(() => (active.value == null ? null : items.value[active.value] ?? null))
const lastPointer = ref('mouse')
const touch = computed(() => lastPointer.value !== 'mouse')
/** mobile (narrow) and fullscreen: details go into a row below the chart; otherwise a floating tooltip */
const mobile = computed(() => compact.value || !!props.full)

/** hover/focus only drive the floating tooltip; on touch the emulated mouse events would undo the tap */
function hover(i: number | null) {
  if (!mobile.value && !touch.value) active.value = i
}

/** mobile or touch: a tap only selects (or deselects) the bar, never navigates; desktop mouse: click opens the restaurant */
function onClick(i: number) {
  if (mobile.value || touch.value) {
    active.value = active.value === i ? null : i
    return
  }
  navigateTo(items.value[i]!.bar.to)
}

/** start at the newest visits (once, as soon as the plot is laid out and wider than the screen) */
let startedAtEnd = false
watch([scroller, width], () => {
  const el = scroller.value
  if (startedAtEnd || !el || !width.value) return
  startedAtEnd = true
  nextTick(() => el.scrollTo({ left: el.scrollWidth }))
}, { flush: 'post' })
/** entering/leaving fullscreen changes the bar width: start at the newest visits again once it is laid out */
watch(() => props.full, () => (startedAtEnd = false))

const tooltipStyle = computed(() => {
  const it = activeItem.value
  if (!it || mobile.value) return {}
  // bar position on screen: after the fixed axis, minus how far the plot is scrolled
  const x = PAD.left + it.cx - scrollX.value
  const left = x > width.value / 2
  return {
    left: left ? undefined : `${x + 12}px`,
    right: left ? `${width.value - x + 12}px` : undefined,
    // good bars: tooltip below the baseline, bad bars: above it, so it never covers the bar
    top: it.up ? `${fy(0) + 8}px` : undefined,
    bottom: it.up ? undefined : `${height.value - fy(0) + 8}px`,
  }
})

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${props.format(Math.abs(n))}`
</script>

<template>
  <div
    class="flex w-full flex-col gap-3"
    :class="full && 'min-h-0 flex-1'"
    @pointerdown="lastPointer = $event.pointerType"
  >
    <div
      ref="box"
      class="relative w-full"
      :class="full && 'min-h-30 flex-1'"
      :style="full ? undefined : { height: `${height}px` }"
      @mouseleave="hover(null)"
    >
      <div
        v-if="width"
        class="absolute inset-0 flex"
        role="img"
        :aria-label="ariaLabel"
      >
        <!-- fixed y axis -->
        <svg
          :width="PAD.left"
          :height="h"
          class="shrink-0 text-[11px]"
          aria-hidden="true"
        >
          <text
            v-for="t in yTicks"
            :key="t.label"
            :x="PAD.left - 6"
            :y="t.y"
            text-anchor="end"
            dominant-baseline="middle"
            class="fill-muted-foreground tabular-nums"
            :class="t.zero && 'font-medium'"
          >{{ t.label }}</text>
        </svg>

        <!-- scrolling bars -->
        <div
          ref="scroller"
          class="min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain"
        >
          <svg
            :width="plotW"
            :height="h"
            class="block overflow-visible"
          >
            <!-- grid -->
            <g class="text-[11px]">
              <line
                v-for="t in yTicks"
                :key="t.label"
                :x1="0"
                :x2="plotW - PAD.right"
                :y1="t.y"
                :y2="t.y"
                :class="t.zero ? 'stroke-muted-foreground' : 'stroke-border'"
                :stroke-dasharray="t.zero ? '5 4' : undefined"
              />
              <template
                v-for="t in xTicks"
                :key="t.label"
              >
                <line
                  :x1="t.x"
                  :x2="t.x"
                  :y1="h - PAD.bottom"
                  :y2="h - PAD.bottom + 4"
                  class="stroke-muted-foreground/50"
                />
                <text
                  :x="t.x"
                  :y="h - PAD.bottom + 16"
                  class="fill-muted-foreground"
                >{{ t.label }}</text>
              </template>
            </g>

            <!-- bars -->
            <g
              v-for="(it, i) in items"
              :key="it.bar.id"
              class="outline-none"
              :class="lastPointer === 'mouse' && 'cursor-pointer'"
              tabindex="0"
              role="link"
              :aria-label="`${it.bar.name}, ${formatDate(it.bar.date)}: ${format(it.bar.value)} (${signed(it.bar.value - avg)} zum Ø)`"
              @mouseenter="hover(i)"
              @focus="hover(i)"
              @blur="hover(null)"
              @click="onClick(i)"
              @keydown.enter="navigateTo(it.bar.to)"
            >
              <!-- whole column is the hit area -->
              <rect
                :x="i * band"
                :y="PAD.top"
                :width="band"
                :height="h - PAD.top - PAD.bottom"
                fill="transparent"
              />
              <rect
                :x="it.x"
                :y="it.top"
                :width="it.w"
                :height="it.h"
                :rx="Math.min(2, it.w / 3)"
                :fill="it.fill"
                :opacity="active == null || active === i ? 1 : 0.45"
                class="transition-[y,height,opacity] duration-300"
              />
            </g>

            <!-- best / worst labels -->
            <g
              v-for="e in extremes"
              :key="e.it.bar.id"
              class="pointer-events-none"
            >
              <foreignObject
                :x="e.right ? e.it.cx - 310 : e.it.cx + 4"
                :y="e.above ? e.it.end - 24 : e.it.end + 2"
                width="306"
                height="22"
              >
                <div
                  class="flex items-center gap-1 text-xs whitespace-nowrap"
                  :class="e.right ? 'justify-end' : ''"
                >
                  <component
                    :is="e.icon"
                    class="size-3.5 shrink-0"
                    :class="e.cls"
                    aria-hidden="true"
                  />
                  <span class="font-medium">{{ e.it.bar.name }}</span>
                  <span class="tabular-nums">{{ format(e.it.bar.value) }}</span>
                </div>
              </foreignObject>
            </g>
          </svg>
        </div>
      </div>

      <!-- tooltip (mouse/keyboard) -->
      <div
        v-if="activeItem && !mobile"
        class="pointer-events-none absolute z-10 w-56 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md"
        :style="tooltipStyle"
      >
        <slot
          name="tooltip"
          :bar="activeItem.bar"
        />
        <div class="mt-1 flex justify-between text-sm">
          <span class="text-muted-foreground">zum Ø {{ format(avg) }}</span>
          <span
            class="font-medium tabular-nums"
            :style="{ color: activeItem.fill }"
          >{{ signed(activeItem.bar.value - avg) }}</span>
        </div>
        <div
          v-if="!touch"
          class="mt-2 text-xs text-muted-foreground"
        >
          Klick → Brauhaus-Seite
        </div>
      </div>
    </div>

    <!-- details row below the chart (mobile, fullscreen) -->
    <div
      v-if="activeItem && mobile"
      class="flex items-center gap-1 rounded-lg border text-sm transition-colors"
      :style="{
        background: `color-mix(in oklab, ${activeItem.fill} 15%, transparent)`,
        borderColor: `color-mix(in oklab, ${activeItem.fill} 45%, transparent)`,
      }"
    >
      <NuxtLink
        :to="activeItem.bar.to"
        class="flex min-w-0 flex-1 items-center gap-2 px-3 py-2"
      >
        <span class="min-w-0 flex-1">
          <span class="block truncate font-medium">{{ activeItem.bar.name }}</span>
          <!-- a dot between the values -->
          <span class="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
            <span class="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap [&>*+*]:before:mr-1.5 [&>*+*]:before:font-normal [&>*+*]:before:text-muted-foreground [&>*+*]:before:content-['·']">
              <slot
                name="row"
                :bar="activeItem.bar"
              />
            </span>
            <span
              v-if="!rowHideValue"
              class="shrink-0 font-semibold text-foreground before:mr-1.5 before:font-normal before:text-muted-foreground before:content-['·']"
            >{{ format(activeItem.bar.value) }}</span>
          </span>
        </span>
        <ArrowRight
          class="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </NuxtLink>
    </div>
    <p
      v-else-if="mobile"
      class="text-center text-xs text-muted-foreground"
    >
      Tippe auf einen Balken für Details
    </p>
  </div>
</template>
