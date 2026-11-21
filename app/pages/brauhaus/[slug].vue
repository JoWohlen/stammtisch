<script setup lang="ts">
import { ArrowLeft, Handshake, MapPin, Utensils } from '@lucide/vue'
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
  <main class="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
    <header class="flex flex-col gap-3">
      <NuxtLink
        to="/"
        class="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft class="size-4" /> Übersicht
      </NuxtLink>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-3xl font-semibold tracking-tight">
          {{ brauhaus.name }}
        </h1>
        <Badge class="border-amber-300 bg-amber-100 px-3 py-1 text-base text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
          Gesamt {{ formatScore(visit.averages.gesamt) }} / 5
        </Badge>
      </div>
      <Tabs
        v-if="brauhaus.visits.length > 1"
        v-model="selected"
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
    </header>

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
  </main>
</template>
