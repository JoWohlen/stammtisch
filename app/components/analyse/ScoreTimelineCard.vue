<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { Handshake, MapPin, Star, ThumbsDown, Trophy, Utensils } from '@lucide/vue'
import type { Category, Visit } from '#shared/types'
import { formatDate, formatScore } from '@/lib/format'
import { monotonePath } from '@/lib/chart'

type Key = Category | 'gesamt'

const { visits } = useStammtisch()

const CATS: { key: Key, label: string, short: string, icon: typeof MapPin, color: string }[] = [
  { key: 'gesamt', label: 'Gesamt', short: 'Gesamt', icon: Star, color: 'var(--foreground)' },
  { key: 'location', label: 'Location', short: 'Loc.', icon: MapPin, color: '#2563eb' },
  { key: 'service', label: 'Service', short: 'Serv.', icon: Handshake, color: '#ea580c' },
  { key: 'essen', label: 'Essen/Trinken', short: 'Essen', icon: Utensils, color: '#16a34a' },
]

const selected = ref<Key>('gesamt')
const showAvg = ref(true)
const cat = computed(() => CATS.find(c => c.key === selected.value)!)

/** visits in date order (the xlsx order is not strictly chronological) */
const timeline = [...visits].sort((a, b) => a.date.localeCompare(b.date))

/** one fixed y-range for every category, so switching tabs keeps the scale comparable */
const allScores = timeline.flatMap(v => CATS.map(c => v.averages[c.key]).filter((x): x is number => x != null))
const Y_MIN = Math.min(2.5, Math.floor(Math.min(...allScores) * 2) / 2)
const Y_MAX = 5
const yTicks = Array.from({ length: Math.round((Y_MAX - Y_MIN) * 2) + 1 }, (_, i) => Y_MIN + i * 0.5)

const day = (iso: string) => new Date(`${iso}T00:00:00`).getTime()
const MONTH = 30 * 24 * 3600 * 1000
const T0 = day(timeline[0]!.date) - MONTH
const T1 = day(timeline.at(-1)!.date) + MONTH

// ---- layout -------------------------------------------------------------
const box = useTemplateRef<HTMLDivElement>('box')
const { width } = useElementSize(box)
const compact = computed(() => width.value < 640)
const height = computed(() => (compact.value ? 300 : 440))
const PAD = { top: 16, right: 12, bottom: 28, left: 36 }

const fx = (iso: string) => PAD.left + ((day(iso) - T0) / (T1 - T0)) * (width.value - PAD.left - PAD.right)
const fy = (v: number) => PAD.top + (1 - (v - Y_MIN) / (Y_MAX - Y_MIN)) * (height.value - PAD.top - PAD.bottom)

const xTicks = computed(() => {
  const ticks: { x: number, label: string }[] = []
  const first = new Date(T0).getFullYear()
  const last = new Date(T1).getFullYear()
  for (let y = first; y <= last; y++) {
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
  return timeline.flatMap((v) => {
    const value = v.averages[selected.value]
    return value == null ? [] : [{ x: fx(v.date), y: fy(value), value, visit: v }]
  })
})

const linePath = computed(() => monotonePath(points.value))

const avg = computed(() => {
  const vs = points.value.map(p => p.value)
  return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null
})

const extremes = computed(() => {
  if (compact.value || !points.value.length) return []
  const sorted = [...points.value].sort((a, b) => a.value - b.value)
  const worst = sorted[0]!
  const best = sorted.at(-1)!
  return [
    { p: best, icon: Trophy, cls: 'text-amber-500', above: true },
    { p: worst, icon: ThumbsDown, cls: 'text-muted-foreground', above: false },
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
        Bewertungen im Zeitverlauf
      </CardTitle>
      <CardDescription>
        Ø-Bewertung jedes Besuchs, chronologisch · ein Punkt = ein Brauhaus-Besuch
      </CardDescription>
    </CardHeader>

    <CardContent class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <Tabs v-model="selected">
          <TabsList>
            <TabsTrigger
              v-for="c in CATS"
              :key="c.key"
              :value="c.key"
              class="gap-1.5 px-3"
            >
              <component
                :is="c.icon"
                class="hidden size-3.5 sm:block"
                aria-hidden="true"
              />
              <span class="sm:hidden">{{ c.short }}</span>
              <span class="hidden sm:inline">{{ c.label }}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <label class="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm select-none">
          <input
            v-model="showAvg"
            type="checkbox"
            class="size-4 accent-foreground"
          >
          Ø-Linie zeigen
        </label>
      </div>

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
          :aria-label="`${cat.label}-Bewertung aller ${points.length} Besuche im Zeitverlauf`"
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
              >{{ formatScore(t).replace(/0$/, '') }}</text>
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
          <g v-if="showAvg && avg != null">
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
            >Ø alle Besuche {{ formatScore(avg) }}</text>
          </g>

          <!-- smoothed line -->
          <path
            :d="linePath"
            fill="none"
            :stroke="cat.color"
            stroke-width="2"
            stroke-linejoin="round"
            class="transition-[d] duration-300"
          />

          <!-- points -->
          <g
            v-for="(p, i) in points"
            :key="p.visit.nr"
            class="cursor-pointer outline-none"
            tabindex="0"
            role="link"
            :aria-label="`${p.visit.brauhaus}, ${formatDate(p.visit.date)}: ${formatScore(p.value)}`"
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
              :stroke="cat.color"
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
                <span class="tabular-nums">{{ formatScore(e.p.value) }}</span>
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
          <div class="flex items-center gap-1.5 font-semibold leading-tight">
            {{ activePoint.visit.brauhaus }}
          </div>
          <div class="mt-0.5 text-xs text-muted-foreground">
            #{{ activePoint.visit.nr }} · {{ formatDate(activePoint.visit.date) }}<template v-if="activePoint.visit.bier">
              · {{ activePoint.visit.bier }}
            </template>
          </div>
          <dl class="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1 text-sm">
            <template
              v-for="c in CATS"
              :key="c.key"
            >
              <span
                class="size-2 rounded-full"
                :style="{ background: c.color }"
              />
              <dt
                :class="c.key === selected ? 'font-medium' : 'text-muted-foreground'"
              >
                {{ c.label }}
              </dt>
              <dd
                class="text-right tabular-nums"
                :class="c.key === selected ? 'font-semibold' : ''"
              >
                {{ formatScore(activePoint.visit.averages[c.key]) }}
              </dd>
            </template>
          </dl>
          <div class="mt-2 text-xs text-muted-foreground">
            {{ lastPointer === 'mouse' ? 'Klick' : 'Nochmal tippen' }} → Brauhaus-Seite
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
