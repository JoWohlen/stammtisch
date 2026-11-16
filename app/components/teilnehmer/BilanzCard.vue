<script setup lang="ts">
import { Beer, CalendarDays, ChevronRight, Crown, GlassWater, Handshake, MapPin, Utensils, Wallet } from '@lucide/vue'
import type { Teilnehmer } from '@/composables/useStammtisch'
import { formatDate, formatEuro, formatNumber, formatScore } from '@/lib/format'

const props = defineProps<{ teilnehmer: Teilnehmer }>()

const s = props.teilnehmer.stats
const p = props.teilnehmer.planer
const perVisit = (n: number) => n / Math.max(s.besuche, 1)
const pct = (a: number, b: number) => `${Math.round((100 * a) / Math.max(b, 1))} %`

/** joined later than the very first Stammtisch → show both attendance rates */
const spaeterDabei = s.ersterBesuch !== s.start

const tiles = [
  { label: 'Biere', icon: Beer, value: `≈ ${formatNumber(s.biere)}`, sub: `Ø ${formatNumber(perVisit(s.biere), 1)} pro Abend` },
  { label: 'Liter Bier', icon: GlassWater, value: `≈ ${formatNumber(s.liter, 1)} L`, sub: `Ø ${formatNumber(perVisit(s.liter), 1)} L pro Abend` },
  { label: 'Ausgaben', icon: Wallet, value: `≈ ${formatEuro(s.kosten)}`, sub: `Ø ${formatEuro(perVisit(s.kosten))} pro Abend` },
  { label: 'Geplant', icon: Crown, value: formatNumber(p?.besuche ?? 0), sub: `von ${s.besucheSeitStart} Abenden` },
]

const categories = p
  ? [
      { label: 'Location', icon: MapPin, value: p.location },
      { label: 'Service', icon: Handshake, value: p.service },
      { label: 'Essen/Trinken', icon: Utensils, value: p.essen },
    ]
  : []

/** green-600 pill, coloured within the planned visits like the tile grids */
const GREEN = 'oklch(62.7% 0.194 149.214)'
const planned = computed(() => {
  if (!p) return []
  const xs = p.visits.map(v => v.averages.gesamt!)
  const min = Math.min(...xs)
  const max = Math.max(...xs)
  return p.visits.map((v) => {
    const f = max > min ? (v.averages.gesamt! - min) / (max - min) : 1
    return { v, light: f > 0.6, bg: `color-mix(in oklch, ${GREEN} ${Math.round(f * 100)}%, var(--muted))` }
  })
})
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-2xl">
        Bilanz
      </CardTitle>
      <CardDescription>
        {{ s.besuche }} von {{ s.besucheSeitStart }} Stammtischen · {{ formatDate(s.ersterBesuch) }} – {{ formatDate(teilnehmer.votes.at(-1)!.visit.date) }}
      </CardDescription>
    </CardHeader>

    <CardContent class="flex flex-col gap-6">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <!-- with the two rate lines the tile spans 2 columns below lg, so the lines never wrap -->
        <StatTile
          label="Besuche"
          :icon="CalendarDays"
          :value="formatNumber(s.besuche)"
          :class="spaeterDabei ? 'col-span-2 lg:col-span-1' : ''"
        >
          <div class="flex flex-col text-xs whitespace-nowrap text-zinc-400 tabular-nums dark:text-zinc-500">
            <span>{{ s.besuche }}/{{ s.besucheSeitStart }} · {{ pct(s.besuche, s.besucheSeitStart) }} seit Start</span>
            <span v-if="spaeterDabei">{{ s.besuche }}/{{ s.besucheSeitBeitritt }} · {{ pct(s.besuche, s.besucheSeitBeitritt) }} ab {{ formatDate(s.ersterBesuch) }}</span>
          </div>
        </StatTile>
        <!-- otherwise the last tile fills the odd slot on mobile -->
        <StatTile
          v-for="(t, i) in tiles"
          :key="t.label"
          v-bind="t"
          :class="!spaeterDabei && i === tiles.length - 1 ? 'col-span-2 sm:col-span-1' : ''"
        />
      </div>

      <template v-if="p">
        <Separator />

        <div class="flex flex-col gap-3 rounded-lg border-2 border-violet-400 bg-violet-50 p-4 dark:border-violet-500/60 dark:bg-violet-500/10">
          <div class="flex items-start justify-between gap-3">
            <div class="flex flex-col gap-1">
              <span class="flex items-center gap-2 text-sm text-muted-foreground">
                <Crown
                  class="size-4 text-violet-500"
                  aria-hidden="true"
                />
                Als Planer
              </span>
              <span class="text-2xl font-semibold tracking-tight">
                {{ p.besuche }} {{ p.besuche === 1 ? 'geplanter Abend' : 'geplante Abende' }}
              </span>
            </div>
            <Badge
              variant="outline"
              class="bg-background text-sm tabular-nums"
            >
              {{ formatScore(p.gesamt) }} / 5
            </Badge>
          </div>

          <div class="grid grid-cols-3 gap-2">
            <div
              v-for="c in categories"
              :key="c.label"
              class="flex flex-col justify-center rounded-md border border-violet-300 bg-background px-2.5 py-1.5 dark:border-violet-500/40"
            >
              <span class="flex items-center gap-1 truncate text-xs text-muted-foreground">
                <component
                  :is="c.icon"
                  class="size-3 shrink-0"
                  aria-hidden="true"
                />
                {{ c.label }}
              </span>
              <span class="text-lg font-semibold tabular-nums">{{ formatScore(c.value) }}</span>
            </div>
          </div>

          <div class="overflow-hidden rounded-md border border-violet-300 bg-background dark:border-violet-500/40">
            <div
              class="hidden grid-cols-[2rem_minmax(0,1fr)_6rem_4.5rem_4.5rem_4.5rem_4rem_1rem] items-center gap-3 border-b border-violet-200 px-3 py-1.5 text-xs text-muted-foreground sm:grid dark:border-violet-500/20"
              aria-hidden="true"
            >
              <span>#</span>
              <span>Brauhaus</span>
              <span>Datum</span>
              <span class="text-right">Location</span>
              <span class="text-right">Service</span>
              <span class="text-right">Essen</span>
              <span class="text-center">Gesamt</span>
              <span />
            </div>
            <ol class="divide-y divide-violet-200 dark:divide-violet-500/20">
              <li
                v-for="(r, i) in planned"
                :key="r.v.nr"
              >
                <NuxtLink
                  :to="`/brauhaus/${r.v.slug}`"
                  class="group grid grid-cols-[1.5rem_minmax(0,1fr)_4rem_1rem] items-center gap-3 px-3 py-2 transition-colors hover:bg-violet-50 focus-visible:bg-violet-50 focus-visible:outline-none sm:grid-cols-[2rem_minmax(0,1fr)_6rem_4.5rem_4.5rem_4.5rem_4rem_1rem] dark:hover:bg-violet-500/10 dark:focus-visible:bg-violet-500/10"
                >
                  <span class="text-sm font-semibold text-violet-600 tabular-nums dark:text-violet-300">{{ i + 1 }}.</span>
                  <span class="flex min-w-0 flex-col">
                    <span class="truncate text-sm font-medium">{{ r.v.brauhaus }}</span>
                    <span class="truncate text-xs text-muted-foreground sm:hidden">
                      {{ formatDate(r.v.date) }}<template v-if="r.v.bier"> · {{ r.v.bier }}</template>
                    </span>
                  </span>
                  <span class="hidden text-xs text-muted-foreground tabular-nums sm:inline">{{ formatDate(r.v.date) }}</span>
                  <span class="hidden text-right text-sm tabular-nums sm:inline">{{ formatScore(r.v.averages.location) }}</span>
                  <span class="hidden text-right text-sm tabular-nums sm:inline">{{ formatScore(r.v.averages.service) }}</span>
                  <span class="hidden text-right text-sm tabular-nums sm:inline">{{ formatScore(r.v.averages.essen) }}</span>
                  <span
                    class="rounded-md py-0.5 text-center text-sm font-semibold tabular-nums"
                    :class="r.light ? 'text-white' : 'text-foreground'"
                    :style="{ backgroundColor: r.bg }"
                  >{{ formatScore(r.v.averages.gesamt) }}</span>
                  <ChevronRight
                    class="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </NuxtLink>
              </li>
            </ol>
          </div>

          <span class="text-xs text-muted-foreground">
            Ø der Gruppe an {{ p.besuche === 1 ? 'seinem geplanten Abend' : 'seinen geplanten Abenden' }} · bester zuerst
          </span>
        </div>
      </template>
    </CardContent>
  </Card>
</template>
