<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { ThumbsDown, Trophy } from '@lucide/vue'
import type { Visit } from '#shared/types'
import { formatDate, formatEuro, formatNumber, formatScore } from '@/lib/format'
import { monotonePath } from '@/lib/chart'

const { visits } = useStammtisch()

const COLOR = '#7c3aed'
const fmt = (n: number) => formatNumber(n, 2)

/** visits in date order, only those with a Preis/Leistung value */
const timeline = [...visits]
  .filter((v): v is Visit & { averages: { preisLeistung: number } } => v.averages.preisLeistung != null)
  .sort((a, b) => a.date.localeCompare(b.date))

const values = timeline.map(v => v.averages.preisLeistung)
const Y_STEP = 2
const Y_MIN = Math.floor(Math.min(...values) / Y_STEP) * Y_STEP
const Y_MAX = Math.ceil(Math.max(...values) / Y_STEP) * Y_STEP
const yTicks = Array.from({ length: (Y_MAX - Y_MIN) / Y_STEP + 1 }, (_, i) => Y_MIN + i * Y_STEP)
const avg = values.reduce((a, b) => a + b, 0) / values.length

const day = (iso: string) => new Date(`${iso}T00:00:00`).getTime()
const MONTH = 30 * 24 * 3600 * 1000
const T0 = day(timeline[0]!.date) - MONTH
const T1 = day(timeline.at(-1)!.date) + MONTH

// ---- layout -------------------------------------------------------------
const box = useTemplateRef<HTMLDivElement>('box')
const { width } = useElementSize(box)
const compact = computed(() => width.value < 640)
const height = computed(() => (compact.value ? 260 : 360))
const PAD = { top: 16, right: 12, bottom: 28, left: 36 }

const fx = (iso: string) => PAD.left + ((day(iso) - T0) / (T1 - T0)) * (width.value - PAD.left - PAD.right)
const fy = (v: number) => PAD.top + (1 - (v - Y_MIN) / (Y_MAX - Y_MIN)) * (height.value - PAD.top - PAD.bottom)

const xTicks = computed(() => {
  const ticks: { x: number, label: string }[] = []
  for (let y = new Date(T0).getFullYear(); y <= new Date(T1).getFullYear(); y++) {
    for (const m of compact.value ? [1] : [1, 7]) {
      const iso = `${y}-${String(m).padStart(2, '0')}-01`
      const t = day(iso)
      if (t < T0 || t > T1) continue
      ticks.push({ x: fx(iso), label: m === 1 ? String(y) : `07/${String(y).slice(2)}` })
    }
  }
  return ticks
})

interface Point { x: number, y: number, value: number, visit: Visit }

const points = computed<Point[]>(() => {
  if (!width.value) return []
  return timeline.map(v => ({ x: fx(v.date), y: fy(v.averages.preisLeistung), value: v.averages.preisLeistung, visit: v }))
})

const linePath = computed(() => monotonePath(points.value))

/** lower = better: fewer € per rating point */
const extremes = computed(() => {
  if (compact.value || !points.value.length) return []
  const sorted = [...points.value].sort((a, b) => a.value - b.value)
  return [
    { p: sorted[0]!, icon: Trophy, cls: 'text-amber-500', above: false },
    { p: sorted.at(-1)!, icon: ThumbsDown, cls: 'text-muted-foreground', above: true },
  ].map(e => ({ ...e, right: e.p.x > width.value * 0.7 }))
})

// ---- interaction --------------------------------------------------------
const active = ref<number | null>(null)
const activePoint = computed(() => (active.value == null ? null : points.value[active.value] ?? null))
const lastPointer = ref('mouse')

/** mouse: click opens the restaurant; touch: first tap shows the tooltip, second tap opens it */
function onClick(i: number) {
  if (lastPointer.value !== 'mouse' && active.value !== i) {
    active.value = i
    return
  }
  navigateTo(`/brauhaus/${points.value[i]!.visit.slug}`)
}

const perHead = (v: Visit) => {
  const n = (v.mitglieder ?? 0) + (v.gaeste ?? 0)
  return v.rechnung != null && n ? v.rechnung / n : null
}

const tooltipStyle = computed(() => {
  const p = activePoint.value
  if (!p) return {}
  const left = p.x > width.value / 2
  const below = p.y < height.value / 2
  return {
    left: left ? undefined : `${p.x + 12}px`,
    right: left ? `${width.value - p.x + 12}px` : undefined,
    top: below ? `${p.y + 12}px` : undefined,
    bottom: below ? undefined : `${height.value - p.y + 12}px`,
  }
})
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-xl">
        Preis/Leistung im Zeitverlauf
      </CardTitle>
      <CardDescription>
        € pro Kopf geteilt durch die Gesamtbewertung, chronologisch · ein Punkt = ein Besuch ·
        je niedriger, desto besser
      </CardDescription>
    </CardHeader>

    <CardContent>
      <div
        ref="box"
        class="relative w-full"
        :style="{ height: `${height}px` }"
        @pointerdown="lastPointer = $event.pointerType"
        @mouseleave="active = null"
      >
        <svg
          v-if="width"
          :width="width"
          :height="height"
          class="overflow-visible"
          role="img"
          :aria-label="`Preis/Leistung aller ${points.length} Besuche im Zeitverlauf`"
        >
          <!-- grid -->
          <g class="text-[11px]">
            <template
              v-for="t in yTicks"
              :key="t"
            >
              <line
                :x1="PAD.left"
                :x2="width - PAD.right"
                :y1="fy(t)"
                :y2="fy(t)"
                :class="t === Y_MIN ? 'stroke-muted-foreground/50' : 'stroke-border'"
              />
              <text
                :x="PAD.left - 6"
                :y="fy(t)"
                text-anchor="end"
                dominant-baseline="middle"
                class="fill-muted-foreground tabular-nums"
              >{{ t }}</text>
            </template>
            <template
              v-for="t in xTicks"
              :key="t.label"
            >
              <line
                :x1="t.x"
                :x2="t.x"
                :y1="height - PAD.bottom"
                :y2="height - PAD.bottom + 4"
                class="stroke-muted-foreground/50"
              />
              <text
                :x="t.x"
                :y="height - PAD.bottom + 16"
                text-anchor="middle"
                class="fill-muted-foreground"
              >{{ t.label }}</text>
            </template>
          </g>

          <!-- Ø line -->
          <line
            :x1="PAD.left"
            :x2="width - PAD.right"
            :y1="fy(avg)"
            :y2="fy(avg)"
            class="stroke-muted-foreground"
            stroke-dasharray="5 4"
          />
          <text
            :x="width - PAD.right - 2"
            :y="fy(avg) - 6"
            text-anchor="end"
            class="fill-muted-foreground text-[11px]"
          >Ø alle Besuche {{ fmt(avg) }}</text>

          <path
            :d="linePath"
            fill="none"
            :stroke="COLOR"
            stroke-width="2"
            stroke-linejoin="round"
          />

          <!-- points -->
          <g
            v-for="(p, i) in points"
            :key="p.visit.nr"
            class="cursor-pointer outline-none"
            tabindex="0"
            role="link"
            :aria-label="`${p.visit.brauhaus}, ${formatDate(p.visit.date)}: ${fmt(p.value)}`"
            @mouseenter="active = i"
            @focus="active = i"
            @blur="active = null"
            @click="onClick(i)"
            @keydown.enter="navigateTo(`/brauhaus/${p.visit.slug}`)"
          >
            <circle
              :cx="p.x"
              :cy="p.y"
              r="12"
              fill="transparent"
            />
            <circle
              :cx="p.x"
              :cy="p.y"
              :r="active === i ? 6 : 3.5"
              fill="var(--card)"
              :stroke="COLOR"
              stroke-width="2"
              class="transition-[r]"
            />
          </g>

          <!-- best / worst labels -->
          <g
            v-for="e in extremes"
            :key="e.p.visit.nr"
            class="pointer-events-none"
          >
            <foreignObject
              :x="e.right ? e.p.x - 310 : e.p.x + 8"
              :y="e.above ? e.p.y - 26 : e.p.y + 6"
              width="300"
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
                <span class="font-medium">{{ e.p.visit.brauhaus }}</span>
                <span class="tabular-nums">{{ fmt(e.p.value) }}</span>
              </div>
            </foreignObject>
          </g>
        </svg>

        <!-- tooltip -->
        <div
          v-if="activePoint"
          class="pointer-events-none absolute z-10 w-56 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md"
          :style="tooltipStyle"
        >
          <div class="font-semibold leading-tight">
            {{ activePoint.visit.brauhaus }}
          </div>
          <div class="mt-0.5 text-xs text-muted-foreground">
            #{{ activePoint.visit.nr }} · {{ formatDate(activePoint.visit.date) }}
          </div>
          <dl class="mt-2 grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-sm">
            <dt class="font-medium">
              Preis/Leistung
            </dt>
            <dd class="text-right font-semibold tabular-nums">
              {{ fmt(activePoint.value) }}
            </dd>
            <template v-if="perHead(activePoint.visit) != null">
              <dt class="text-muted-foreground">
                € pro Kopf
              </dt>
              <dd class="text-right tabular-nums">
                {{ formatEuro(perHead(activePoint.visit)!, true) }}
              </dd>
            </template>
            <dt class="text-muted-foreground">
              Gesamt
            </dt>
            <dd class="text-right tabular-nums">
              {{ formatScore(activePoint.visit.averages.gesamt) }}
            </dd>
          </dl>
          <div class="mt-2 text-xs text-muted-foreground">
            {{ lastPointer === 'mouse' ? 'Klick' : 'Nochmal tippen' }} → Brauhaus-Seite
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
