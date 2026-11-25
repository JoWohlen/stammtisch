<script setup lang="ts">
import { Handshake, MapPin, Utensils } from '@lucide/vue'
import type { Category } from '#shared/types'
import type { BrowseTarget } from '@/composables/useBrowse'
import { formatDate, formatScore } from '@/lib/format'
import { scoreScale } from '@/lib/score-color'

/** A Brauhaus page, as one page of the <BrowseCarousel> (the page itself checks that the Brauhaus exists). */
const props = defineProps<{
  slug: string
  /** visit shown; null = the newest */
  nr: number | null
  nav: { prev: BrowseTarget | null, next: BrowseTarget | null, counter: { n: number, total: number } | null }
}>()
const emit = defineEmits<{
  'go': [BrowseTarget]
  /** another visit picked in the date tabs */
  'select-visit': [nr: number]
}>()

const { getBrauhaus, participants, visits } = useStammtisch()

/** same red → amber → green ramp over all visits as the tiles on the overview */
const scale = scoreScale(visits.map(v => v.averages.gesamt))

const brauhaus = getBrauhaus(props.slug)!

/** index into brauhaus.visits (newest first) */
const selected = computed({
  get: () => String(Math.max(brauhaus.visits.findIndex(v => v.nr === props.nr), 0)),
  set: (i: string) => emit('select-visit', brauhaus.visits[Number(i)]!.nr),
})
const visit = computed(() => brauhaus.visits[Number(selected.value)]!)
const compare = computed(() => brauhaus.visits[Number(selected.value) + 1] ?? null)
/** selector tabs oldest → newest, so the newest date sits on the right */
const visitTabs = brauhaus.visits.map((v, i) => ({ v, i })).reverse()

const CATS: { key: Category, label: string, shortLabel?: string, icon: typeof MapPin }[] = [
  { key: 'location', label: 'Location', icon: MapPin },
  { key: 'service', label: 'Service', icon: Handshake },
  { key: 'essen', label: 'Essen & Trinken', shortLabel: 'Essen', icon: Utensils },
]

/** members who rated the selected visit, in participant order */
const raters = computed(() => {
  const rated = new Set(Object.values(visit.value.ratings).flatMap(Object.keys))
  return participants.map(p => p.name).filter(n => rated.has(n))
})
</script>

<template>
  <AppPage
    :title="brauhaus.name"
    back
  >
    <template #nav>
      <BrowseNav
        v-bind="nav"
        @go="emit('go', $event)"
      />
    </template>
    <template #title>
      <FitText :text="brauhaus.name" />
    </template>
    <template #actions>
      <Badge
        class="shrink-0 px-3 py-1 text-base tabular-nums"
        :class="visit.averages.gesamt != null && scale ? 'border-transparent text-black' : 'bg-muted text-muted-foreground'"
        :style="visit.averages.gesamt != null && scale ? { backgroundColor: scale.color(visit.averages.gesamt) } : undefined"
      >
        <span class="max-sm:hidden">Gesamt</span> {{ formatScore(visit.averages.gesamt) }} / 5
      </Badge>
    </template>
    <template #header>
      <Tabs
        v-if="brauhaus.visits.length > 1"
        v-model="selected"
        class="mt-2"
      >
        <TabsList>
          <TabsTrigger
            v-for="{ v, i } in visitTabs"
            :key="v.date"
            :value="String(i)"
            class="px-4"
          >
            {{ formatDate(v.date) }}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </template>

    <BrauhausVisitInfoCard :visit="visit" />

    <BrauhausConsensusCard :visit="visit" />

    <BrauhausMemberLegend :names="raters" />

    <section class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <BrauhausScoreRadarCard
        :visit="visit"
        :compare="compare"
      />
      <BrauhausMemberVotesRadial
        v-for="c in CATS"
        :key="c.key"
        :label="c.label"
        :short-label="c.shortLabel"
        :icon="c.icon"
        :scores="visit.ratings[c.key]"
        :avg="visit.averages[c.key]"
      />
    </section>

    <BrauhausOrtCard
      :name="brauhaus.name"
      :ort="brauhaus.ort"
    />

    <BrauhausNachbarnLegend :slug="brauhaus.slug" />
  </AppPage>
</template>
