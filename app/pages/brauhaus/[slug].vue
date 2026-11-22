<script setup lang="ts">
import { Handshake, MapPin, Utensils } from '@lucide/vue'
import type { Category } from '#shared/types'
import { formatDate, formatScore } from '@/lib/format'
import { scoreScale } from '@/lib/score-color'

const route = useRoute()
const { getBrauhaus, participants, visits } = useStammtisch()

/** same red → amber → green ramp over all visits as the tiles on the overview */
const scale = scoreScale(visits.map(v => v.averages.gesamt))

const brauhaus = getBrauhaus(String(route.params.slug))
if (!brauhaus) {
  throw createError({ statusCode: 404, statusMessage: 'Brauhaus nicht gefunden', fatal: true })
}

useHead({ title: `${brauhaus.name} · Stammtisch-Tracker` })

/** index into brauhaus.visits (newest first) */
const selected = ref('0')

/** ?besuch=<nr> opens that visit's tab (after hydration, so the prerendered HTML still matches) */
const fromQuery = () => {
  const i = brauhaus.visits.findIndex(v => String(v.nr) === String(route.query.besuch))
  selected.value = String(Math.max(i, 0))
}
onMounted(fromQuery)
// swiping between two visits of the same Brauhaus only changes the query
watch(() => route.query.besuch, fromQuery)
const visit = computed(() => brauhaus.visits[Number(selected.value)]!)

const browse = useBrowse('brauhaus', computed(() => ({ slug: brauhaus.slug, nr: visit.value.nr })))
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
        v-bind="{ prev: browse.prev.value, next: browse.next.value, counter: browse.counter.value }"
        @go="browse.go"
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
