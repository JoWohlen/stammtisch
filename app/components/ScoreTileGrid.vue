<script setup lang="ts">
import { ChevronDown, Crown } from '@lucide/vue'
import type { Metric, ScoreTile } from '@/lib/score-tiles'
import { formatDate, formatScore } from '@/lib/format'

type Sort = Metric | 'datum'

const props = defineProps<{
  title: string
  tiles: ScoreTile[]
  /** description start, e.g. "40 Brauhäuser" */
  count: string
  /** description when collapsed */
  collapsedText?: string
}>()

const SORTS: { key: Sort, label: string }[] = [
  { key: 'datum', label: 'Datum' },
  { key: 'gesamt', label: 'Ø Gesamt' },
  { key: 'location', label: 'Location' },
  { key: 'service', label: 'Service' },
  { key: 'essen', label: 'Essen' },
]

/** green-600; mixed with the theme's muted colour so both light and dark mode work */
const GREEN = 'oklch(62.7% 0.194 149.214)'

const open = ref(true)
const sort = ref<Sort>('gesamt')

/** the value shown and coloured; sorting by date keeps Ø Gesamt */
const metric = computed<Metric>(() => (sort.value === 'datum' ? 'gesamt' : sort.value))

const range = computed(() => {
  const xs = props.tiles.map(t => t.scores[metric.value]).filter((x): x is number => x != null)
  return { min: Math.min(...xs), max: Math.max(...xs) }
})

const items = computed(() => {
  const m = metric.value
  const { min, max } = range.value
  const val = (t: ScoreTile) => t.scores[m] ?? -Infinity
  const list = [...props.tiles].sort(sort.value === 'datum'
    ? (a, b) => b.date.localeCompare(a.date)
    : (a, b) => val(b) - val(a))
  return list.map((t, i) => {
    const value = t.scores[m]
    const f = value == null ? 0 : max > min ? (value - min) / (max - min) : 1
    return {
      ...t,
      rank: i + 1,
      value,
      light: f > 0.6,
      bg: `color-mix(in oklch, ${GREEN} ${Math.round(f * 100)}%, var(--muted))`,
    }
  })
})
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
                {{ title }}
              </CardTitle>
              <CardDescription>
                {{ count }} ·
                <template v-if="open || !collapsedText">
                  Farbe &amp; Zahl = gewählte Sortierung
                </template>
                <template v-else>
                  {{ collapsedText }}
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
              v-for="t in items"
              :key="t.key"
            >
              <NuxtLink
                :to="t.to"
                class="flex h-full flex-col gap-1 rounded-lg border p-3 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                :class="t.light ? 'border-transparent text-white' : 'text-foreground'"
                :style="{ backgroundColor: t.bg }"
              >
                <span class="truncate text-sm font-medium">
                  <template v-if="sort !== 'datum'">{{ t.rank }}. </template>{{ t.name }}
                </span>
                <span class="text-2xl font-semibold tabular-nums">{{ formatScore(t.value) }}</span>
                <span class="flex items-center justify-between gap-2">
                  <span
                    class="truncate text-xs"
                    :class="t.light ? 'text-white/80' : 'text-muted-foreground'"
                  >{{ formatDate(t.date) }}</span>
                  <span
                    v-if="t.badge && t.badgeTone === 'subtle'"
                    class="inline-flex shrink-0 items-center rounded-full border border-current/30 bg-transparent px-1.5 py-0.5 text-[10px] font-medium"
                    :class="t.light ? 'text-white/80' : 'text-muted-foreground'"
                  >
                    {{ t.badge }}
                  </span>
                  <span
                    v-else-if="t.badge"
                    class="inline-flex shrink-0 items-center gap-1 rounded-full border border-violet-300 bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:border-violet-500/40 dark:bg-violet-950 dark:text-violet-200"
                  >
                    <Crown
                      class="size-3"
                      aria-hidden="true"
                    />
                    {{ t.badge }}
                  </span>
                </span>
              </NuxtLink>
            </li>
          </ul>
        </CardContent>
      </CollapsibleContent>
    </Card>
  </Collapsible>
</template>
