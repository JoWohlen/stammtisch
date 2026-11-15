<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import type { BestBrauhaus } from '@/composables/useStammtisch'
import { formatDate, formatScore } from '@/lib/format'

type Metric = 'gesamt' | 'location' | 'service' | 'essen'
type Sort = Metric | 'datum'

const SORTS: { key: Sort, label: string }[] = [
  { key: 'datum', label: 'Datum' },
  { key: 'gesamt', label: 'Ø Gesamt' },
  { key: 'location', label: 'Location' },
  { key: 'service', label: 'Service' },
  { key: 'essen', label: 'Essen' },
]

/** green-600; mixed with the theme's muted colour so both light and dark mode work */
const GREEN = 'oklch(62.7% 0.194 149.214)'

const { brauhausRanking } = useStammtisch()

const open = ref(true)
const sort = ref<Sort>('gesamt')

/** the value shown and coloured (from the most recent visit); sorting by date keeps Ø Gesamt */
const metric = computed<Metric>(() => (sort.value === 'datum' ? 'gesamt' : sort.value))

const range = computed(() => {
  const xs = brauhausRanking.map(b => b.latest[metric.value])
  return { min: Math.min(...xs), max: Math.max(...xs) }
})

const items = computed(() => {
  const m = metric.value
  const { min, max } = range.value
  const list = [...brauhausRanking].sort(sort.value === 'datum'
    ? (a, b) => b.lastDate.localeCompare(a.lastDate)
    : (a, b) => b.latest[m] - a.latest[m])
  return list.map((b, i) => {
    const t = max > min ? (b.latest[m] - min) / (max - min) : 1
    return {
      ...b,
      rank: i + 1,
      value: b.latest[m],
      light: t > 0.6,
      bg: `color-mix(in oklch, ${GREEN} ${Math.round(t * 100)}%, var(--muted))`,
      sub: subLine(b),
    }
  })
})

/** always the date of the most recent visit, whatever the sort */
const subLine = (b: BestBrauhaus): string => formatDate(b.lastDate)

const best = brauhausRanking[0]
</script>

<template>
  <Collapsible
    v-model:open="open"
    as-child
  >
    <Card>
      <CardHeader>
        <CollapsibleTrigger as-child>
          <button
            type="button"
            class="group flex w-full items-start justify-between gap-4 rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span class="flex flex-col gap-1.5">
              <CardTitle class="text-2xl">
                Alle Brauhäuser
              </CardTitle>
              <CardDescription>
                {{ brauhausRanking.length }} Brauhäuser ·
                <template v-if="open">
                  Farbe &amp; Zahl = gewählte Sortierung
                </template>
                <template v-else-if="best">
                  Bestes: {{ best.name }} {{ formatScore(best.gesamt) }}
                </template>
              </CardDescription>
            </span>
            <span class="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors group-hover:text-foreground">
              <ChevronDown
                class="size-4 transition-transform"
                :class="open ? 'rotate-180' : ''"
                aria-hidden="true"
              />
              <span class="sr-only">{{ open ? 'Einklappen' : 'Ausklappen' }}</span>
            </span>
          </button>
        </CollapsibleTrigger>
      </CardHeader>

      <CollapsibleContent>
        <CardContent class="flex flex-col gap-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-wrap items-center gap-2">
              <span class="hidden text-sm text-muted-foreground sm:inline">Sortieren nach</span>
              <Tabs v-model="sort">
                <TabsList>
                  <TabsTrigger
                    v-for="s in SORTS"
                    :key="s.key"
                    :value="s.key"
                    class="px-2 text-xs sm:px-3 sm:text-sm"
                  >
                    {{ s.label }}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div
              class="flex w-full flex-col gap-1 sm:w-48"
              aria-hidden="true"
            >
              <div
                class="h-2.5 rounded-full"
                :style="{ background: `linear-gradient(to right, var(--muted), ${GREEN})` }"
              />
              <div class="flex justify-between text-xs text-muted-foreground tabular-nums">
                <span>{{ formatScore(range.min) }}</span>
                <span>{{ formatScore(range.max) }}</span>
              </div>
            </div>
          </div>

          <ul class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <li
              v-for="b in items"
              :key="b.slug"
            >
              <NuxtLink
                :to="`/brauhaus/${b.slug}`"
                class="flex h-full flex-col gap-1 rounded-lg border p-3 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                :class="b.light ? 'border-transparent text-white' : 'text-foreground'"
                :style="{ backgroundColor: b.bg }"
              >
                <span class="truncate text-sm font-medium">
                  <template v-if="sort !== 'datum'">{{ b.rank }}. </template>{{ b.name }}
                </span>
                <span class="text-2xl font-semibold tabular-nums">{{ formatScore(b.value) }}</span>
                <span
                  class="truncate text-xs"
                  :class="b.light ? 'text-white/80' : 'text-muted-foreground'"
                >{{ b.sub }}</span>
              </NuxtLink>
            </li>
          </ul>
        </CardContent>
      </CollapsibleContent>
    </Card>
  </Collapsible>
</template>
