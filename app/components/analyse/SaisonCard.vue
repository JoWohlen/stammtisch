<script setup lang="ts">
import { formatNumber, formatScore } from '@/lib/format'
import { scoreScale } from '@/lib/score-color'
import { mean, raterNames } from '@/lib/stats'

/** Saison: per calendar month, how good the evenings were and how many members came. */
const { visits } = useStammtisch()

type Mode = 'bewertung' | 'anwesenheit'
const MODES: { key: Mode, label: string }[] = [
  { key: 'bewertung', label: 'Bewertung' },
  { key: 'anwesenheit', label: 'Anwesenheit' },
]
const mode = ref<Mode>('bewertung')

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const MONTHS_LONG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

const scored = visits.filter(v => v.averages.gesamt != null)
const overall = mean(scored.map(v => v.averages.gesamt!))

const months = MONTHS.map((short, m) => {
  const vs = visits.filter(v => Number(v.date.slice(5, 7)) === m + 1)
  const sc = vs.filter(v => v.averages.gesamt != null)
  return {
    m,
    short,
    long: MONTHS_LONG[m]!,
    abende: vs.length,
    score: sc.length ? mean(sc.map(v => v.averages.gesamt!)) : null,
    leute: vs.length ? mean(vs.map(v => raterNames(v).size)) : null,
  }
})

/** score colour ramp centred on the overall Ø, like the tiles */
const scale = scoreScale(months.map(x => x.score), overall)

/** Bewertung: symmetric range around Ø; Anwesenheit: 0 → most members */
const devMax = Math.max(0.1, ...months.map(x => (x.score == null ? 0 : Math.abs(x.score - overall))))
const leuteMax = Math.max(1, ...months.map(x => x.leute ?? 0))

const bar = (x: (typeof months)[number]) => {
  if (mode.value === 'bewertung') {
    if (x.score == null) return null
    const d = (x.score - overall) / devMax
    // from the middle line, up or down, at most half the height
    return { bottom: d >= 0 ? '50%' : `${50 + d * 50}%`, height: `${Math.abs(d) * 50}%`, color: scale?.color(x.score) ?? 'var(--muted)' }
  }
  if (x.leute == null) return null
  return { bottom: '0%', height: `${(x.leute / leuteMax) * 100}%`, color: 'var(--chart-2)' }
}
const valueText = (x: (typeof months)[number]) => mode.value === 'bewertung'
  ? (x.score == null ? '–' : formatScore(x.score))
  : (x.leute == null ? '–' : formatNumber(x.leute, 1))

const active = ref<number | null>(null)

/** tooltip sits just past the bar's end: above bars that go up, below bars that go down */
const tipStyle = (x: (typeof months)[number]) => {
  const b = bar(x)
  if (!b) return { bottom: '50%' }
  const down = mode.value === 'bewertung' && x.score != null && x.score < overall
  return down
    ? { top: `calc(100% - ${b.bottom} + 4px)` }
    : { bottom: `calc(${b.bottom} + ${b.height} + 4px)` }
}
const activeText = computed(() => {
  const x = active.value == null ? null : months[active.value]!
  if (!x) return null
  if (!x.abende) return `${x.long}: noch kein Stammtisch`
  return `${x.long}: ${x.abende} ${x.abende === 1 ? 'Abend' : 'Abende'} · Ø ${x.score == null ? '–' : formatScore(x.score)} · Ø ${x.leute == null ? '–' : formatNumber(x.leute, 1)} Mitglieder`
})
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-xl">
        Saison
      </CardTitle>
      <CardDescription>
        Ist der Stammtisch zu manchen Jahreszeiten besser oder voller? Alle Abende nach Kalendermonat, über alle Jahre.
      </CardDescription>
    </CardHeader>

    <CardContent class="flex flex-col gap-4">
      <Tabs
        v-model="mode"
        class="w-full"
      >
        <TabsList
          aria-label="Saison zeigen"
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
        class="grid grid-cols-12 gap-0.5 sm:gap-1.5"
        role="img"
        :aria-label="`${mode === 'bewertung' ? 'Ø Bewertung' : 'Ø Mitglieder'} je Kalendermonat`"
        @pointerleave="active = null"
      >
        <div
          v-for="x in months"
          :key="x.m"
          class="relative flex min-w-0 flex-col items-center gap-1"
          @pointerenter="active = x.m"
        >
          <span class="text-[10px] text-muted-foreground tabular-nums sm:text-xs">{{ valueText(x) }}</span>
          <div
            class="relative h-40 w-full rounded-sm"
            :class="active === x.m ? 'bg-muted/60' : ''"
          >
            <!-- Ø line (Bewertung) / baseline (Anwesenheit) -->
            <div
              class="absolute inset-x-0 h-px bg-muted-foreground/50"
              :style="{ bottom: mode === 'bewertung' ? '50%' : '0%' }"
            />
            <div
              v-if="bar(x)"
              class="absolute inset-x-[15%] rounded-sm"
              :style="{ bottom: bar(x)!.bottom, height: bar(x)!.height, minHeight: '2px', background: bar(x)!.color }"
            />
            <!-- desktop: details as a tooltip at the end of the hovered bar; edge months align inward so it stays in the card -->
            <div
              v-if="active === x.m && activeText"
              class="pointer-events-none absolute z-20 hidden w-48 rounded-lg border bg-popover p-2 text-xs text-popover-foreground shadow-md sm:block"
              :class="x.m < 3 ? 'left-0' : x.m > 8 ? 'right-0' : 'left-1/2 -translate-x-1/2'"
              :style="tipStyle(x)"
            >
              {{ activeText }}
            </div>
          </div>
          <span class="text-[10px] font-medium sm:text-xs">{{ x.short }}</span>
          <span class="text-[10px] text-muted-foreground tabular-nums">{{ x.abende }}×</span>
        </div>
      </div>

      <!-- mobile: details in a row below (desktop uses the hover tooltip) -->
      <p
        class="min-h-5 text-sm sm:hidden"
        aria-live="polite"
      >
        {{ activeText ?? 'Tipp auf einen Monat für Details.' }}
      </p>
    </CardContent>
  </Card>
</template>
