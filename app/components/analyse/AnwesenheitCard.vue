<script setup lang="ts">
import { UserPlus } from '@lucide/vue'
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
    return { here: here.length, total: m.visits.length, before: false, joined: false, beforeLabel: '', label: m.visits.length
      ? `${MONATE[m.month]} ${m.year}: ${m.visits.map(v => `${formatDate(v.date)} ${v.brauhaus} ${attended(p.name, v) ? '✓' : '✗'}`).join(' · ')}`
      : `${MONATE[m.month]} ${m.year}: kein Stammtisch` }
  })
  // before someone's first Stammtisch they were not a member yet: no block at all ("Seit Beitritt"), grey ("Alle")
  const joined = cells.findIndex(c => c.here)
  cells.forEach((c, i) => {
    if (i < joined) Object.assign(c, { before: true, beforeLabel: `${c.label.split(':')[0]}: noch kein Mitglied` })
  })
  // mark the month someone joined, unless they were there from the very first Stammtisch
  if (joined > 0) Object.assign(cells[joined]!, { joined: true, label: `${cells[joined]!.label} · neu dabei` })
  const mine = visits.filter(v => attended(p.name, v))
  // possible = every Stammtisch since their first one
  const firstDate = mine.reduce((d, v) => (v.date < d ? v.date : d), mine[0]?.date ?? '')
  const moeglich = visits.filter(v => v.date >= firstDate).length
  return { ...p, cells, besuche: mine.length, moeglich }
}).filter(r => r.besuche > 0)

/** blocks never get narrower than 0.75rem → the grid scrolls instead of squeezing */
const cols = { gridTemplateColumns: `repeat(${months.length}, minmax(0.75rem, 1fr))` }

/** count against every Stammtisch since joining, or against all of them */
const basis = ref<'seit' | 'alle'>('seit')
const BASIS = [
  { key: 'seit', label: 'Seit Beitritt' },
  { key: 'alle', label: 'Alle' },
] as const
const total = (r: { moeglich: number }) => (basis.value === 'seit' ? r.moeglich : visits.length)

/** fullscreen on phones, see FullscreenCard */
const full = ref(false)
</script>

<template>
  <FullscreenCard v-model:full="full">
    <Card>
      <CardHeader>
        <CardTitle class="text-xl">
          Anwesenheit
        </CardTitle>
        <CardDescription>
          Ein Kästchen pro Monat seit dem ersten Stammtisch. Farbig = dabei, grau = nicht dabei oder kein Stammtisch in dem Monat{{ basis === 'seit' ? ', leer = noch kein Mitglied' : '' }}, Symbol = erster Stammtisch.
        </CardDescription>
        <CardAction>
          <FullscreenButton />
        </CardAction>
      </CardHeader>

      <CardContent class="flex flex-col">
        <Tabs
          v-model="basis"
          class="mb-3 self-start"
        >
          <TabsList aria-label="Anwesenheit zählen">
            <TabsTrigger
              v-for="o in BASIS"
              :key="o.key"
              :value="o.key"
              class="px-3"
            >
              {{ o.label }}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <!-- names and counts stay put, only the month grid scrolls on narrow screens -->
        <div class="flex items-start gap-2">
          <div class="flex w-[4.5rem] shrink-0 flex-col gap-px sm:w-[7rem] sm:gap-0.5">
            <NuxtLink
              v-for="r in rows"
              :key="r.slug"
              :to="`/teilnehmer/${r.slug}`"
              class="flex h-3 items-center truncate text-xs leading-none font-medium hover:underline sm:h-3.5"
            >
              {{ r.name }}
            </NuxtLink>
          </div>

          <div
            class="flex min-w-0 flex-1 flex-col gap-px overflow-x-auto pb-1 sm:gap-0.5"
          >
            <div
              v-for="r in rows"
              :key="r.slug"
              class="grid gap-px sm:gap-0.5"
              :style="cols"
              role="img"
              :aria-label="`${r.name}: bei ${r.besuche} von ${total(r)} ${basis === 'seit' ? 'möglichen ' : ''}Stammtischen`"
            >
              <span
                v-for="(c, i) in r.cells"
                :key="i"
                class="flex h-3 items-center justify-center rounded-[3px] sm:h-3.5 sm:rounded-[4px]"
                :class="c.here || (c.before && basis === 'seit') ? '' : 'bg-muted-foreground/25'"
                :style="c.here ? { background: memberColor(r.name) } : undefined"
                :title="c.before && basis === 'seit' ? c.beforeLabel : c.label"
              >
                <UserPlus
                  v-if="c.joined"
                  class="size-2.5 text-white sm:size-3"
                  :stroke-width="3"
                  aria-hidden="true"
                />
              </span>
            </div>

            <!-- year axis: label at each January (and at the start) -->
            <div
              class="mt-1 grid gap-px text-[11px] text-muted-foreground tabular-nums sm:gap-0.5"
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

          <div class="flex w-10 shrink-0 flex-col gap-px sm:w-12 sm:gap-0.5">
            <span
              v-for="r in rows"
              :key="r.slug"
              class="flex h-3 items-center justify-end text-xs leading-none text-muted-foreground tabular-nums sm:h-3.5"
            >{{ r.besuche }}/{{ total(r) }}</span>
          </div>
        </div>

        <p class="mt-1 text-xs text-muted-foreground">
          Dabei sein heißt: mitbewertet. In Monaten mit zwei Stammtischen reicht einer.
        </p>
      </CardContent>
    </Card>
  </FullscreenCard>
</template>
