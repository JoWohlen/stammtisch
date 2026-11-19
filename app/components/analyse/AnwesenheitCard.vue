<script setup lang="ts">
import { formatDate } from '@/lib/format'
import { CATEGORIES } from '@/lib/stats'
import { memberColor } from '@/lib/members'

const { visits, participants } = useStammtisch()

const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

/** months since the first Stammtisch (0 = month of the first one) */
const first = visits[0]!.date
const monthIndex = (iso: string) =>
  (Number(iso.slice(0, 4)) - Number(first.slice(0, 4))) * 12 + Number(iso.slice(5, 7)) - Number(first.slice(5, 7))

const months = Array.from({ length: monthIndex(visits.at(-1)!.date) + 1 }, (_, i) => {
  const m = Number(first.slice(5, 7)) - 1 + i
  return { year: Number(first.slice(0, 4)) + Math.floor(m / 12), month: m % 12, visits: [] as typeof visits }
})
for (const v of visits) months[monthIndex(v.date)]!.visits.push(v)

/** attendance = rated at least one category (same rule as the member pages) */
const attended = (name: string, v: (typeof visits)[number]) => CATEGORIES.some(c => v.ratings[c][name] != null)

const rows = participants.map((p) => {
  const cells = months.map((m) => {
    const here = m.visits.filter(v => attended(p.name, v))
    return { here: here.length, total: m.visits.length, label: m.visits.length
      ? `${MONATE[m.month]} ${m.year}: ${m.visits.map(v => `${formatDate(v.date)} ${v.brauhaus} ${attended(p.name, v) ? '✓' : '✗'}`).join(' · ')}`
      : `${MONATE[m.month]} ${m.year}: kein Stammtisch` }
  })
  return { ...p, cells, besuche: visits.filter(v => attended(p.name, v)).length }
}).filter(r => r.besuche > 0)

const cols = { gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-xl">
        Anwesenheit
      </CardTitle>
      <CardDescription>
        Ein Kästchen pro Monat seit dem ersten Stammtisch. Farbig = dabei, grau = nicht dabei oder kein Stammtisch in dem Monat.
      </CardDescription>
    </CardHeader>

    <CardContent class="flex flex-col gap-px sm:gap-0.5">
      <div
        v-for="r in rows"
        :key="r.slug"
        class="grid grid-cols-[4.5rem_1fr_2.5rem] items-center gap-2 sm:grid-cols-[7rem_1fr_3rem]"
      >
        <NuxtLink
          :to="`/teilnehmer/${r.slug}`"
          class="truncate text-xs leading-none font-medium hover:underline"
        >
          {{ r.name }}
        </NuxtLink>
        <div
          class="grid gap-px sm:gap-0.5"
          :style="cols"
          role="img"
          :aria-label="`${r.name}: bei ${r.besuche} von ${visits.length} Stammtischen`"
        >
          <span
            v-for="(c, i) in r.cells"
            :key="i"
            class="h-3 rounded-[3px] sm:h-3.5 sm:rounded-[4px]"
            :class="c.here ? '' : 'bg-muted-foreground/25'"
            :style="c.here ? { background: memberColor(r.name) } : undefined"
            :title="c.label"
          />
        </div>
        <span class="text-right text-xs leading-none text-muted-foreground tabular-nums">{{ r.besuche }}/{{ visits.length }}</span>
      </div>

      <!-- year axis: label at each January (and at the start) -->
      <div class="mt-1 grid grid-cols-[4.5rem_1fr_2.5rem] gap-2 sm:grid-cols-[7rem_1fr_3rem]">
        <div
          class="col-start-2 grid gap-px text-[11px] text-muted-foreground tabular-nums sm:gap-0.5"
          :style="cols"
        >
          <span
            v-for="(m, i) in months"
            :key="i"
            class="overflow-visible whitespace-nowrap"
            :class="m.month === 0 ? 'border-l border-muted-foreground/50 pl-0.5' : ''"
          >{{ m.month === 0 || i === 0 ? m.year : '' }}</span>
        </div>
      </div>

      <p class="mt-2 text-xs text-muted-foreground">
        Dabei sein heißt: mitbewertet. In Monaten mit zwei Stammtischen reicht einer.
      </p>
    </CardContent>
  </Card>
</template>
