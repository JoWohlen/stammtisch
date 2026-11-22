<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core'
import { Handshake, MapPin, Star, Utensils } from '@lucide/vue'
import type { Category } from '#shared/types'
import type { DeviationBar } from '@/lib/chart'
import { formatDate, formatScore } from '@/lib/format'

type Key = Category | 'gesamt'

/** the category switch: below the title normally, next to it in fullscreen */
const [DefineTabs, ReuseTabs] = createReusableTemplate()

const { visits } = useStammtisch()

const CATS: { key: Key, label: string, short: string, icon: typeof MapPin, color: string }[] = [
  { key: 'gesamt', label: 'Gesamt', short: 'Gesamt', icon: Star, color: 'var(--foreground)' },
  { key: 'location', label: 'Location', short: 'Loc.', icon: MapPin, color: '#2563eb' },
  { key: 'service', label: 'Service', short: 'Serv.', icon: Handshake, color: '#ea580c' },
  { key: 'essen', label: 'Essen/Trinken', short: 'Essen', icon: Utensils, color: '#16a34a' },
]

const selected = ref<Key>('gesamt')
const cat = computed(() => CATS.find(c => c.key === selected.value)!)

/** fullscreen on phones, see FullscreenCard */
const full = ref(false)

/** visits in date order (the xlsx order is not strictly chronological) */
const timeline = [...visits].sort((a, b) => a.date.localeCompare(b.date))
const byNr = new Map(timeline.map(v => [v.nr, v]))

/** one bar per visit with a score in the selected category */
const bars = computed<DeviationBar[]>(() => timeline.flatMap((v) => {
  const value = v.averages[selected.value]
  return value == null ? [] : [{ id: v.nr, name: v.brauhaus, date: v.date, value, to: `/brauhaus/${v.slug}?besuch=${v.nr}` }]
}))

/** Ø over all visits in the selected category */
const avg = computed(() => bars.value.reduce((s, b) => s + b.value, 0) / Math.max(1, bars.value.length))
</script>

<template>
  <FullscreenCard v-model:full="full">
    <!-- single root, so the page's class still lands on FullscreenCard -->
    <DefineTabs>
      <Tabs v-model="selected">
        <TabsList>
          <TabsTrigger
            v-for="c in CATS"
            :key="c.key"
            :value="c.key"
            class="gap-1.5 px-3"
          >
            <component
              :is="c.icon"
              class="hidden size-3.5 sm:block"
              aria-hidden="true"
            />
            <span class="sm:hidden">{{ c.short }}</span>
            <span class="hidden sm:inline">{{ c.label }}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </DefineTabs>

    <!-- fullscreen: tighter padding, and min-h-0 so everything fits the screen without scrolling -->
    <Card :class="full && 'min-h-0 gap-2 py-3 sm:gap-2 sm:py-3'">
      <CardHeader>
        <CardTitle class="text-xl">
          Bewertungen im Zeitverlauf
        </CardTitle>
        <CardDescription v-if="!full">
          Ein Balken pro Besuch, chronologisch · Abstand zum Ø aller Besuche:
          besser nach oben, schlechter nach unten
        </CardDescription>
        <CardAction class="flex items-center gap-2">
          <!-- fullscreen: the category switch moves up next to the title -->
          <ReuseTabs v-if="full" />
          <FullscreenButton />
        </CardAction>
      </CardHeader>

      <CardContent
        class="flex flex-col gap-4"
        :class="full && 'min-h-0 flex-1'"
      >
        <div
          v-if="!full"
          class="flex flex-wrap items-center justify-start gap-3"
        >
          <ReuseTabs />
        </div>

        <AnalyseDeviationBarChart
          :bars="bars"
          :avg="avg"
          higher-is-better
          :format="formatScore"
          :full="full"
          row-hide-value
          :aria-label="`${cat.label}-Bewertung aller ${bars.length} Besuche im Vergleich zum Ø`"
        >
          <template #tooltip="{ bar }">
            <div class="font-semibold leading-tight">
              {{ bar.name }}
            </div>
            <div class="mt-0.5 text-xs text-muted-foreground">
              #{{ bar.id }} · {{ formatDate(bar.date) }}<template v-if="byNr.get(bar.id)?.bier">
                · {{ byNr.get(bar.id)!.bier }}
              </template>
            </div>
            <dl class="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1 text-sm">
              <template
                v-for="c in CATS"
                :key="c.key"
              >
                <span
                  class="size-2 rounded-full"
                  :style="{ background: c.color }"
                />
                <dt :class="c.key === selected ? 'font-medium' : 'text-muted-foreground'">
                  {{ c.label }}
                </dt>
                <dd
                  class="text-right tabular-nums"
                  :class="c.key === selected ? 'font-semibold' : ''"
                >
                  {{ formatScore(byNr.get(bar.id)!.averages[c.key]) }}
                </dd>
              </template>
            </dl>
          </template>
          <template #row="{ bar }">
            <span
              v-for="c in CATS"
              :key="c.key"
              class="inline-flex items-center gap-0.5"
              :class="c.key === selected && 'font-semibold text-foreground'"
              :title="c.label"
            >
              <component
                :is="c.icon"
                class="size-3"
                :style="{ color: c.color }"
                aria-hidden="true"
              />
              <span class="sr-only">{{ c.label }}</span>
              {{ formatScore(byNr.get(bar.id)!.averages[c.key]) }}
            </span>
          </template>
        </AnalyseDeviationBarChart>
      </CardContent>
    </Card>
  </FullscreenCard>
</template>
