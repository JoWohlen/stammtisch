<script setup lang="ts">
import { ArrowLeft, Beer, Handshake, MapPin, RotateCcw, Utensils, Wallet } from '@lucide/vue'
import type { Category } from '#shared/types'
import type { ScoreTile } from '@/lib/score-tiles'
import { formatEuro, formatNumber } from '@/lib/format'
import { mean } from '@/lib/stats'

useHead({ title: 'Suche · Stammtisch-Tracker' })

const { brauhaeuser } = useStammtisch()

/** beer price brackets, cheapest first: [label, exclusive upper bound] */
const PREISKLASSEN: [string, number][] = [
  [`unter ${formatEuro(2, true)}`, 2],
  [`${formatEuro(2, true)} – ${formatEuro(2.24, true)}`, 2.25],
  [`${formatEuro(2.25, true)} – ${formatEuro(2.49, true)}`, 2.5],
  [`${formatEuro(2.5, true)} – ${formatEuro(2.99, true)}`, 3],
  [`ab ${formatEuro(3, true)}`, Infinity],
]
const preisklasse = (p: number | null): string | null =>
  p == null ? null : PREISKLASSEN.find(([, upTo]) => p < upTo - 1e-9)![0]

/** one search row per Brauhaus: scores = mean over its rated visits, price/beer/district = newest known value */
const rows = brauhaeuser.map((b) => {
  const rated = b.visits.filter(v => v.averages.gesamt != null)
  const avg = (k: Category | 'gesamt') => {
    const xs = rated.map(v => v.averages[k]).filter((x): x is number => x != null)
    return xs.length ? mean(xs) : null
  }
  return {
    name: b.name,
    slug: b.slug,
    besuche: b.visits.length,
    /** newest visit (visits are newest first) */
    lastDate: b.visits[0]!.date,
    gesamt: avg('gesamt'),
    location: avg('location'),
    service: avg('service'),
    essen: avg('essen'),
    preis: preisklasse(b.visits.find(v => v.bierpreis != null)?.bierpreis ?? null),
    bier: b.visits.find(v => v.bier != null)?.bier ?? null,
    bezirk: b.ort.lage?.stadtbezirk ?? null,
  }
})

type Row = (typeof rows)[number]

const present = (xs: (string | null)[]) => new Set(xs.filter((x): x is string => x != null))
const alphabetical = (xs: (string | null)[]) => [...present(xs)].sort((a, b) => a.localeCompare(b, 'de'))
const usedPreise = present(rows.map(r => r.preis))

const SCORE_SLIDERS = [
  { key: 'location', label: 'Location', icon: MapPin },
  { key: 'service', label: 'Service', icon: Handshake },
  { key: 'essen', label: 'Essen/Trinken', icon: Utensils },
] as const

const minScore = reactive<Record<Category, number>>({ location: 0, service: 0, essen: 0 })

/** toggle-button groups; everything selected by default = every Brauhaus visible */
const GROUPS = [
  { key: 'preis', label: 'Bierpreis', icon: Wallet, options: PREISKLASSEN.map(([l]) => l).filter(l => usedPreise.has(l)) },
  { key: 'bier', label: 'Bier', icon: Beer, options: alphabetical(rows.map(r => r.bier)) },
  { key: 'bezirk', label: 'Stadtbezirk', icon: MapPin, options: alphabetical(rows.map(r => r.bezirk)) },
] as const satisfies readonly { key: keyof Row, label: string, icon: unknown, options: string[] }[]

type GroupKey = (typeof GROUPS)[number]['key']

const allSelected = () => Object.fromEntries(GROUPS.map(g => [g.key, new Set(g.options)])) as Record<GroupKey, Set<string>>
const selected = reactive(allSelected())

function toggle(key: GroupKey, option: string) {
  const set = selected[key]
  if (set.has(option)) set.delete(option)
  else set.add(option)
}

const setAll = (key: GroupKey, on: boolean) => {
  selected[key] = on ? new Set(GROUPS.find(g => g.key === key)!.options) : new Set()
}

const isDefault = computed(() =>
  SCORE_SLIDERS.every(({ key }) => !minScore[key])
  && GROUPS.every(g => selected[g.key].size === g.options.length))

function reset() {
  for (const { key } of SCORE_SLIDERS) minScore[key] = 0
  Object.assign(selected, allSelected())
}

/** sliders at 0 let everything through; a value missing in the data only passes while its whole group is selected */
const results = computed(() => rows
  .filter(r => SCORE_SLIDERS.every(({ key }) => !minScore[key] || (r[key] ?? -1) >= minScore[key]))
  .filter(r => GROUPS.every((g) => {
    const v = r[g.key]
    return v == null ? selected[g.key].size === g.options.length : selected[g.key].has(v)
  })))

/** same tiles as "Alle Besuche" on the overview, but one per Brauhaus (Ø over its visits) */
const tiles = computed<ScoreTile[]>(() => results.value.map(r => ({
  key: r.slug,
  name: r.name,
  to: `/brauhaus/${r.slug}`,
  date: r.lastDate,
  scores: { gesamt: r.gesamt, location: r.location, service: r.service, essen: r.essen },
  badge: r.besuche > 1 ? `${r.besuche} Besuche` : undefined,
  badgeTone: 'subtle',
})))
</script>

<template>
  <main class="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
    <header class="flex flex-col gap-3">
      <NuxtLink
        to="/"
        class="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft class="size-4" /> Übersicht
      </NuxtLink>
      <h1 class="text-3xl font-semibold tracking-tight">
        Suche
      </h1>
      <p class="text-sm text-muted-foreground">
        Brauhaus nach Bewertung, Bierpreis, Bier und Stadtbezirk finden
      </p>
    </header>

    <Card>
      <CardHeader>
        <CardTitle>Filter</CardTitle>
        <CardAction>
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            :disabled="isDefault"
            @click="reset"
          >
            <RotateCcw
              class="size-3.5"
              aria-hidden="true"
            />
            Zurücksetzen
          </button>
        </CardAction>
      </CardHeader>
      <CardContent class="flex flex-col gap-6">
        <div class="grid gap-x-8 gap-y-5 md:grid-cols-3">
          <label
            v-for="sl in SCORE_SLIDERS"
            :key="sl.key"
            class="flex flex-col gap-2"
          >
            <span class="flex items-center justify-between gap-2 text-sm">
              <span class="flex items-center gap-2 font-medium">
                <component
                  :is="sl.icon"
                  class="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                {{ sl.label }}
              </span>
              <span class="text-muted-foreground tabular-nums">
                {{ minScore[sl.key] ? `ab ${formatNumber(minScore[sl.key], 1)}` : 'egal' }}
              </span>
            </span>
            <input
              v-model.number="minScore[sl.key]"
              type="range"
              min="0"
              max="5"
              step="0.25"
              class="w-full cursor-pointer accent-primary"
            >
          </label>
        </div>

        <Separator />

        <div
          v-for="g in GROUPS"
          :key="g.key"
          role="group"
          :aria-label="g.label"
          class="flex flex-col gap-2"
        >
          <span class="flex items-center justify-between gap-2 text-sm font-medium">
            <span class="flex items-center gap-2">
              <component
                :is="g.icon"
                class="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              {{ g.label }}
              <span class="font-normal text-muted-foreground tabular-nums">{{ selected[g.key].size }}/{{ g.options.length }}</span>
            </span>
            <span class="flex gap-3 text-xs font-normal text-muted-foreground">
              <button
                type="button"
                class="hover:text-foreground"
                @click="setAll(g.key, true)"
              >
                alle
              </button>
              <button
                type="button"
                class="hover:text-foreground"
                @click="setAll(g.key, false)"
              >
                keine
              </button>
            </span>
          </span>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="o in g.options"
              :key="o"
              type="button"
              :aria-pressed="selected[g.key].has(o)"
              class="rounded-full border px-3 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              :class="selected[g.key].has(o)
                ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground'"
              @click="toggle(g.key, o)"
            >
              {{ o }}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>

    <section class="flex flex-col gap-3">
      <ScoreTileGrid
        v-if="tiles.length"
        title="Treffer"
        :tiles="tiles"
        :count="`${tiles.length} von ${rows.length} Brauhäusern`"
      />
      <p
        v-else
        class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"
        aria-live="polite"
      >
        Kein Brauhaus passt zu diesen Filtern.
      </p>
    </section>
  </main>
</template>
