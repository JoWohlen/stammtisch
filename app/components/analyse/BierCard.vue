<script setup lang="ts">
import type { Visit } from '#shared/types'
import { formatNumber } from '@/lib/format'
import { groupBy, heads, mean, sum } from '@/lib/stats'

const { visits } = useStammtisch()

/** 'abend' = the whole table per evening, 'gesamt' = all liters ever, summed */
type Mode = 'abend' | 'kopf' | 'gesamt'
const MODES: { key: Mode, label: string }[] = [
  { key: 'abend', label: 'Pro Abend' },
  { key: 'kopf', label: 'Pro Kopf' },
  { key: 'gesamt', label: 'Gesamt' },
]
const mode = ref<Mode>('abend')

const withLiter = visits.filter((v): v is Visit & { liter: number } => v.liter != null)
const perHead = (vs: (Visit & { liter: number })[]) => vs.filter(v => heads(v) > 0).map(v => v.liter / heads(v))
const values = (vs: (Visit & { liter: number })[]) => (mode.value === 'kopf' ? perHead(vs) : vs.map(v => v.liter))
/** Ø per evening, or the sum in the Gesamt tab */
const combine = (xs: number[]) => (mode.value === 'gesamt' ? sum(xs) : mean(xs))

const groups = [...groupBy(withLiter, v => v.bier).entries()]

/**
 * One colour per beer, fixed whatever the tab. The wheel is walked in steps of 5 of 12,
 * so beers next to each other in the "Pro Abend" ranking get far-apart colours.
 */
const WHEEL = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#d946ef', // fuchsia
  '#ec4899', // pink
]
const colorOrder = groups
  .map(([bier, vs]) => ({ bier, x: mean(vs.map(v => v.liter)) }))
  .sort((a, b) => b.x - a.x)
  .map(r => r.bier)
const beerColor = (bier: string) => WHEEL[(colorOrder.indexOf(bier) * 5) % WHEEL.length]!

/**
 * Per beer: mean liters over every visit (A, B, A = 3 visits, each weighs the same),
 * either for the whole table or per head (Mitglieder + Gäste; visits without a head count are left out),
 * or all liters drunk with that beer, summed.
 */
const rows = computed(() => groups
  .map(([bier, vs]) => {
    const xs = values(vs)
    return { bier, besuche: xs.length, liter: xs.length ? combine(xs) : null, color: beerColor(bier) }
  })
  .filter((r): r is typeof r & { liter: number } => r.liter != null)
  .sort((a, b) => b.liter - a.liter))

/** Ø over all evenings (or the grand total), shown in the middle when nothing is hovered */
const overall = computed(() => combine(values(withLiter)))

// ---- donut ----
const SIZE = 240
const R = 112
const INNER = 72
/** gap between slices, in px */
const GAP = 3
/** corner radius of the slices; thin slices get less so they don't vanish */
const CORNER = 5

const point = (r: number, a: number) => `${(SIZE / 2 + r * Math.sin(a)).toFixed(2)},${(SIZE / 2 - r * Math.cos(a)).toFixed(2)}`
/**
 * A slice with rounded corners: the shape is shrunk by the corner radius on every side
 * and then stroked in its own colour with round joins, which grows it back with round corners.
 */
const arc = (a0: number, a1: number) => {
  const inner = (a1 - a0) * INNER - GAP
  const c = Math.max(0, Math.min(CORNER, inner / 2 - 0.5, (R - INNER) / 2 - 1))
  const ro = R - c
  const ri = INNER + c
  // the inner radius needs a larger angle for the same width
  const go = (GAP / 2 + c) / ro
  const gi = (GAP / 2 + c) / ri
  if (a1 - a0 <= 2 * gi) return { d: '', c }
  const large = a1 - a0 - 2 * go > Math.PI ? 1 : 0
  return { d: `M${point(ro, a0 + go)} A${ro},${ro} 0 ${large} 1 ${point(ro, a1 - go)} L${point(ri, a1 - gi)} A${ri},${ri} 0 ${large} 0 ${point(ri, a0 + gi)} Z`, c }
}
const slices = computed(() => {
  const total = rows.value.reduce((s, r) => s + r.liter, 0)
  let a = 0
  return rows.value.map((r) => {
    const a0 = a
    a += (r.liter / total) * 2 * Math.PI
    return { ...r, ...arc(a0, a) }
  })
})

const active = ref<string | null>(null)
const shown = computed(() => rows.value.find(r => r.bier === active.value) ?? null)

const besuche = (n: number) => `${n} ${n === 1 ? 'Besuch' : 'Besuche'}`
const liter = (x: number) => `${formatNumber(x, mode.value === 'kopf' ? 2 : 1)} l`
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-xl">
        Biersorten
      </CardTitle>
      <CardDescription>
        <template v-if="mode === 'gesamt'">
          Wie viel Liter haben wir insgesamt von welchem Bier getrunken?
        </template>
        <template v-else>
          Wie viel Liter trinken wir im Schnitt, je nachdem welches Bier ausgeschenkt wird?
        </template>
      </CardDescription>
    </CardHeader>

    <CardContent class="flex flex-col gap-4">
      <Tabs
        v-model="mode"
        class="w-full"
      >
        <TabsList
          aria-label="Liter zählen"
          class="w-full"
        >
          <TabsTrigger
            v-for="m in MODES"
            :key="m.key"
            :value="m.key"
            class="px-3"
          >
            {{ m.label }}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div
        class="flex flex-col items-center gap-6 md:flex-row md:items-start"
        @pointerleave="$event.pointerType === 'mouse' && (active = null)"
      >
        <!-- donut, the hovered / tapped beer in the middle -->
        <svg
          :viewBox="`0 0 ${SIZE} ${SIZE}`"
          class="w-full max-w-60 shrink-0 touch-manipulation select-none"
          role="img"
          :aria-label="`${mode === 'gesamt' ? 'Liter gesamt' : `Ø Liter ${mode === 'abend' ? 'pro Abend' : 'pro Kopf'}`} je Biersorte, ${rows.length} Sorten`"
        >
          <path
            v-for="s in slices"
            :key="s.bier"
            :d="s.d"
            :fill="s.color"
            :stroke="s.color"
            :stroke-width="s.c * 2"
            stroke-linejoin="round"
            class="cursor-pointer transition-opacity duration-150"
            :opacity="active == null || active === s.bier ? 1 : 0.3"
            @pointerenter="active = s.bier"
          >
            <title>{{ s.bier }}: {{ liter(s.liter) }} ({{ besuche(s.besuche) }})</title>
          </path>
          <text
            :x="SIZE / 2"
            :y="SIZE / 2 - 16"
            text-anchor="middle"
            class="fill-muted-foreground text-[11px]"
          >{{ shown ? shown.bier : mode === 'gesamt' ? 'Alle Abende' : 'Ø alle Abende' }}</text>
          <text
            :x="SIZE / 2"
            :y="SIZE / 2 + 10"
            text-anchor="middle"
            class="fill-foreground text-2xl font-semibold tabular-nums"
          >{{ liter(shown ? shown.liter : overall) }}</text>
          <text
            :x="SIZE / 2"
            :y="SIZE / 2 + 30"
            text-anchor="middle"
            class="fill-muted-foreground text-[11px]"
          >{{ shown ? besuche(shown.besuche) : besuche(values(withLiter).length) }}</text>
        </svg>

        <!-- legend = the values, same order as the slices (clockwise from the top) -->
        <ol class="grid w-full grid-cols-1 gap-x-6 gap-y-0.5 text-sm select-none sm:grid-cols-2">
          <li
            v-for="r in rows"
            :key="r.bier"
            class="flex cursor-default items-center gap-2 rounded-md px-2 py-1 transition-colors"
            :class="active === r.bier ? 'bg-accent' : active != null ? 'opacity-50' : ''"
            @pointerenter="active = r.bier"
          >
            <span
              class="size-3 shrink-0 rounded-sm"
              :style="{ background: r.color }"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1 truncate font-medium">{{ r.bier }}</span>
            <span class="text-xs text-muted-foreground">{{ besuche(r.besuche) }}</span>
            <span class="w-14 text-right font-semibold tabular-nums">{{ liter(r.liter) }}</span>
          </li>
        </ol>
      </div>
    </CardContent>
  </Card>
</template>
