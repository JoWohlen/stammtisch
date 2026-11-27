<script setup lang="ts">
import { UserPlus } from '@lucide/vue'
import { formatDate } from '@/lib/format'
import { CATEGORIES } from '@/lib/stats'
import { memberColor } from '@/lib/members'

const { visits, participants } = useStammtisch()

/** attendance = rated at least one category (same rule as the member pages) */
const attended = (name: string, v: (typeof visits)[number]) => CATEGORIES.some(c => v.ratings[c][name] != null)

const rows = participants.map((p) => {
  // one column per Stammtisch, so two in the same month are two columns
  const cells = visits.map(v => ({
    here: attended(p.name, v), before: false, joined: false, beforeLabel: '',
    label: `${formatDate(v.date)} ${v.brauhaus} ${attended(p.name, v) ? '✓' : '✗'}`,
  }))
  // before someone's first Stammtisch they were not a member yet: no block at all ("Seit Beitritt"), grey ("Alle")
  const joined = cells.findIndex(c => c.here)
  cells.forEach((c, i) => {
    if (i < joined) Object.assign(c, { before: true, beforeLabel: `${formatDate(visits[i]!.date)}: noch kein Mitglied` })
  })
  // mark the Stammtisch someone joined at, unless they were there from the very first one
  if (joined > 0) Object.assign(cells[joined]!, { joined: true, label: `${cells[joined]!.label} · neu dabei` })
  const besuche = cells.filter(c => c.here).length
  // possible = every Stammtisch since their first one
  const moeglich = joined < 0 ? 0 : visits.length - joined
  return { ...p, cells, besuche, moeglich }
}).filter(r => r.besuche > 0)

/** year axis: label the first Stammtisch of each year */
const years = visits.map((v, i) => {
  const y = v.date.slice(0, 4)
  return i === 0 || y !== visits[i - 1]!.date.slice(0, 4) ? { label: y, border: i > 0 } : { label: '', border: false }
})

/** blocks never get narrower than 0.75rem → the grid scrolls instead of squeezing */
const cols = { gridTemplateColumns: `repeat(${visits.length}, minmax(0.75rem, 1fr))` }

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
          Ein Kästchen pro Stammtisch. Farbig = dabei, grau = nicht dabei{{ basis === 'seit' ? ', leer = noch kein Mitglied' : '' }}, Symbol = erster Stammtisch.
        </CardDescription>
        <CardAction>
          <FullscreenButton />
        </CardAction>
      </CardHeader>

      <CardContent class="flex flex-col">
        <Tabs
          v-model="basis"
          class="mb-3 w-full"
        >
          <TabsList
            aria-label="Anwesenheit zählen"
            class="w-full"
          >
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
        <!-- names and counts stay put, only the grid scrolls on narrow screens -->
        <div class="flex items-start gap-2 select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]">
          <div class="flex w-[4.5rem] shrink-0 flex-col gap-px sm:w-[7rem] sm:gap-0.5">
            <span
              v-for="r in rows"
              :key="r.slug"
              class="flex h-3 items-center truncate text-xs leading-none font-medium sm:h-3.5"
            >
              {{ r.name }}
            </span>
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

            <!-- year axis: label at the first Stammtisch of each year -->
            <div
              class="mt-1 grid gap-px text-[11px] text-muted-foreground tabular-nums sm:gap-0.5"
              :style="cols"
            >
              <span
                v-for="(y, i) in years"
                :key="i"
                class="overflow-visible whitespace-nowrap"
                :class="y.border ? 'border-l border-muted-foreground/50 pl-0.5' : ''"
              >{{ y.label }}</span>
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
      </CardContent>
    </Card>
  </FullscreenCard>
</template>
