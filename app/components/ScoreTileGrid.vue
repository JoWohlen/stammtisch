<script setup lang="ts">
import { ChevronDown, Crown, Repeat2, Trophy } from '@lucide/vue'
import type { Metric, ScoreTile } from '@/lib/score-tiles'
import { SCORE_KEYS } from '@/lib/analysis'
import { formatDate, formatScore } from '@/lib/format'
import { rampGradient, scoreScale } from '@/lib/score-color'

type Sort = Metric | 'datum'

const props = withDefaults(defineProps<{
  title: string
  tiles: ScoreTile[]
  /** description start, e.g. "40 Brauhäuser"; a function gets the shown metric, so the text can follow the sort */
  count: string | ((metric: Metric) => string)
  /** description when collapsed */
  collapsedText?: string
  /** whether the card can be folded (default true) */
  collapsible?: boolean
  /** details line shows all four scores with icons: date · Gesamt · Location · Service · Essen, the sorted metric bold */
  scoreLine?: boolean
  /** gold/silver/bronze badge on places 1–3 while sorted by date (default true) */
  podium?: boolean
  /** also show the badge while sorted by Ø Gesamt */
  podiumOnGesamt?: boolean
}>(), { collapsible: true, podium: true })

const SORTS: { key: Sort, label: string }[] = [
  { key: 'datum', label: 'Datum' },
  { key: 'gesamt', label: 'Ø Gesamt' },
  { key: 'location', label: 'Location' },
  { key: 'service', label: 'Service' },
  { key: 'essen', label: 'Essen' },
]

const open = ref(true)
const sort = ref<Sort>('gesamt')

/** the value shown and coloured; sorting by date keeps Ø Gesamt */
const metric = computed<Metric>(() => (sort.value === 'datum' ? 'gesamt' : sort.value))

const countText = computed(() => (typeof props.count === 'function' ? props.count(metric.value) : props.count))

/** red (worst) → amber (Ø) → green (best) over the shown metric */
const scale = computed(() => scoreScale(props.tiles.map(t => t.scores[metric.value])))
const gradient = rampGradient()

/** trophy colours for places 1–3 (gold, silver, bronze) */
const PODIUM = [
  { color: '#f5c518', label: 'Gold' },
  { color: '#c0c7d0', label: 'Silber' },
  { color: '#cd7f32', label: 'Bronze' },
]

/** place by Ø Gesamt (ties share a place), only places 1–3 */
const podium = computed(() => {
  const xs = props.tiles.map(t => t.scores.gesamt).filter((x): x is number => x != null)
  const places = new Map<string, number>()
  for (const t of props.tiles) {
    const g = t.scores.gesamt
    if (g == null) continue
    const place = 1 + xs.filter(x => x > g).length
    if (place <= 3) places.set(t.key, place)
  }
  return places
})

/** clicking a tile remembers the order shown, so the detail page can swipe through it */
const rememberOrder = useBrowseList()

const items = computed(() => {
  const m = metric.value
  const val = (t: ScoreTile) => t.scores[m] ?? -Infinity
  const list = [...props.tiles].sort(sort.value === 'datum'
    ? (a, b) => b.date.localeCompare(a.date)
    : (a, b) => val(b) - val(a))
  return list.map((t, i) => {
    const value = t.scores[m]
    return {
      ...t,
      rank: i + 1,
      value,
      /** trophy badge while sorted by date, where the rank number is not shown (optionally also by Ø Gesamt) */
      place: props.podium && (sort.value === 'datum' || (props.podiumOnGesamt && sort.value === 'gesamt'))
        ? podium.value.get(t.key)
        : undefined,
      /** scored tiles always get black text */
      scored: value != null,
      bg: value == null || !scale.value ? 'var(--muted)' : scale.value.color(value),
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
      <CardHeader v-if="!collapsible">
        <CardTitle class="text-2xl">
          {{ title }}
        </CardTitle>
        <!-- pre-line: a "\n" in the text starts a second line -->
        <CardDescription class="whitespace-pre-line">
          {{ countText }}
        </CardDescription>
      </CardHeader>
      <CardHeader v-else>
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
                {{ countText }}<template v-if="!open && collapsedText">
                  · {{ collapsedText }}
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
          <!-- the score scale takes all the room right of the sort switch -->
          <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <!-- phones: the sort switch spans the card, left to right -->
            <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <span class="hidden text-sm text-muted-foreground sm:inline">Sortieren nach</span>
              <Tabs
                v-model="sort"
                class="w-full sm:w-auto"
              >
                <TabsList class="w-full sm:w-auto">
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
              v-if="scale"
              class="flex w-full flex-col gap-1 sm:w-auto sm:min-w-48 sm:flex-1"
              aria-hidden="true"
            >
              <div class="flex justify-between text-xs text-muted-foreground tabular-nums">
                <span>{{ formatScore(scale.min) }}</span>
                <span>Ø {{ formatScore(scale.avg) }}</span>
                <span>{{ formatScore(scale.max) }}</span>
              </div>
              <div
                class="h-2.5 rounded-full"
                :style="{ background: gradient }"
              />
            </div>
          </div>

          <ul class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <li
              v-for="t in items"
              :key="t.key"
            >
              <NuxtLink
                :to="t.to"
                class="flex h-full items-center gap-4 rounded-lg border p-3 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                :class="t.scored ? 'border-transparent text-black' : 'text-foreground'"
                :style="{ backgroundColor: t.bg }"
                @click="rememberOrder(items.map(x => x.to))"
              >
                <span class="flex min-w-0 flex-1 flex-col gap-1">
                  <span
                    class="flex min-w-0 items-center gap-2"
                    :class="t.scored ? 'font-semibold' : 'font-medium'"
                  >
                    <span class="truncate">
                      <template v-if="sort !== 'datum'">{{ t.rank }}. </template>{{ t.name }}
                    </span>
                    <span
                      v-if="t.place || t.repeat || (t.badge && t.badgeTone !== 'subtle')"
                      class="ml-auto flex shrink-0 items-center gap-1"
                    >
                      <span
                        v-if="t.place"
                        class="inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-900 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums"
                        :title="`${t.place}. Platz (Ø Gesamt)`"
                      >
                        <Trophy
                          class="size-3"
                          :style="{ color: PODIUM[t.place - 1]!.color }"
                          :fill="PODIUM[t.place - 1]!.color"
                          aria-hidden="true"
                        />
                        {{ t.place }}.
                        <span class="sr-only">Platz, {{ PODIUM[t.place - 1]!.label }}</span>
                      </span>
                      <span
                        v-if="t.repeat"
                        class="inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-900 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums"
                        :title="`${t.repeat}. Besuch`"
                      >
                        <Repeat2
                          class="size-3"
                          aria-hidden="true"
                        />
                        {{ t.repeat }}
                        <span class="sr-only">. Besuch</span>
                      </span>
                      <span
                        v-if="t.badge && t.badgeTone !== 'subtle'"
                        class="inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-900 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                      >
                        <Crown
                          class="size-3 text-violet-300"
                          aria-hidden="true"
                        />
                        {{ t.badge }}
                      </span>
                    </span>
                  </span>
                  <span
                    class="flex items-center gap-y-1 text-xs"
                    :class="[
                      t.scored ? 'font-medium text-black/85' : 'text-muted-foreground',
                      // score line: date and all four scores stay on one line, also on phones
                      scoreLine ? 'flex-nowrap gap-x-1.5 whitespace-nowrap' : 'flex-wrap gap-x-2',
                    ]"
                  >
                    <span>{{ formatDate(t.date) }}</span>
                    <template
                      v-for="s in scoreLine ? SCORE_KEYS : []"
                      :key="s.key"
                    >
                      <span aria-hidden="true">·</span>
                      <span
                        class="inline-flex items-center gap-0.5 tabular-nums"
                        :class="s.key === metric && 'font-bold'"
                        :title="s.label"
                      >
                        <component
                          :is="s.icon"
                          class="size-3"
                          :aria-label="s.label"
                        />
                        {{ formatScore(t.scores[s.key]) }}
                      </span>
                    </template>
                    <template
                      v-for="d in t.details"
                      :key="d"
                    >
                      <span aria-hidden="true">·</span>
                      <span>{{ d }}</span>
                    </template>
                    <span
                      v-if="t.badge && t.badgeTone === 'subtle'"
                      class="inline-flex shrink-0 items-center rounded-full border border-current/30 bg-transparent px-1.5 py-0.5 text-[10px] font-medium"
                    >
                      {{ t.badge }}
                    </span>
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
