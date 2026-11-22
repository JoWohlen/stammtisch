<script setup lang="ts">
import { Handshake, MapPin, Utensils } from '@lucide/vue'
import type { Category } from '#shared/types'
import { formatDate, formatScore } from '@/lib/format'

const route = useRoute()
const { getBrauhaus, participants } = useStammtisch()

const brauhaus = getBrauhaus(String(route.params.slug))
if (!brauhaus) {
  throw createError({ statusCode: 404, statusMessage: 'Brauhaus nicht gefunden', fatal: true })
}

useHead({ title: `${brauhaus.name} · Stammtisch-Tracker` })

/** index into brauhaus.visits (newest first) */
const selected = ref('0')

/** ?besuch=<nr> opens that visit's tab (after hydration, so the prerendered HTML still matches) */
onMounted(() => {
  const i = brauhaus.visits.findIndex(v => String(v.nr) === String(route.query.besuch))
  if (i > 0) selected.value = String(i)
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
    <template #actions>
      <Badge class="border-amber-300 bg-amber-100 px-3 py-1 text-base text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
        Gesamt {{ formatScore(visit.averages.gesamt) }} / 5
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
