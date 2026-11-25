<script setup lang="ts">
import type { Component } from 'vue'
import { Beer, CalendarDays, Map as MapIcon, Star } from '@lucide/vue'
import { formatDate } from '@/lib/format'

useHead({ title: 'Analyse · Stammtisch-Tracker' })

const { overviewStats: s } = useStammtisch()
const zeitraum = s.ersterBesuch && s.letzterBesuch
  ? `${formatDate(s.ersterBesuch)} – ${formatDate(s.letzterBesuch)}`
  : undefined

type Kategorie = 'bewertungen' | 'termine' | 'bier' | 'orte'
const KATEGORIEN: { key: Kategorie, label: string, short: string, icon: Component, hint: string }[] = [
  { key: 'bewertungen', label: 'Bewertungen', short: 'Noten', icon: Star, hint: 'Wie wir bewerten, wer ähnlich tickt und wie sich das verändert' },
  { key: 'termine', label: 'Termine', short: 'Termine', icon: CalendarDays, hint: 'Wer wann da war, Jahreszeiten und wie regelmäßig wir uns treffen' },
  { key: 'bier', label: 'Bier', short: 'Bier', icon: Beer, hint: 'Was wir trinken und was es kostet' },
  { key: 'orte', label: 'Orte', short: 'Orte', icon: MapIcon, hint: 'Wo in Köln wir schon waren' },
]
const keys = KATEGORIEN.map(k => k.key)

/** the four sections sit side by side in a carousel: swiping drags the page along, the tabs scroll it */
const index = ref(0)
const kategorie = computed(() => keys[index.value]!)
const aktiv = computed(() => KATEGORIEN[index.value]!)
const carousel = useTemplateRef('carousel')

function select(k: Kategorie) {
  index.value = keys.indexOf(k)
}

// ?kategorie=… keeps the tab on reload and in shared links (read after hydration, the prerendered page shows the first)
const route = useRoute()
const router = useRouter()
onMounted(() => {
  const i = keys.indexOf(String(route.query.kategorie ?? '') as Kategorie)
  if (i > 0) carousel.value?.jumpTo(i)
})
watch(kategorie, (k) => {
  router.replace({ query: { ...route.query, kategorie: k === keys[0] ? undefined : k } })
})
</script>

<template>
  <AppPage title="Analyse">
    <template
      v-if="zeitraum"
      #description
    >
      <!-- two lines on mobile, one line with a separator from sm up -->
      <span class="block sm:inline">Auswertungen über alle {{ s.besuche }} Stammtische</span>
      <span
        class="hidden sm:inline"
        aria-hidden="true"
      > · </span>
      <span class="block sm:inline">{{ zeitraum }}</span>
    </template>
    <template #header>
      <Tabs
        :model-value="kategorie"
        class="mt-3"
        @update:model-value="select($event as Kategorie)"
      >
        <!-- page sections: folder tabs on a line, unlike the filled switches inside the cards;
             the active tab is open towards the content below -->
        <TabsList
          class="grid h-auto w-full grid-cols-4 items-end gap-1 rounded-none border-b bg-transparent p-0 sm:flex sm:justify-start"
          aria-label="Kategorie"
        >
          <TabsTrigger
            v-for="k in KATEGORIEN"
            :key="k.key"
            :value="k.key"
            class="-mb-px h-11 cursor-pointer gap-1.5 rounded-t-lg rounded-b-none border border-b-0 border-border bg-muted/60 px-2 text-base text-muted-foreground shadow-none transition-colors hover:bg-muted hover:text-foreground data-[state=active]:h-12 data-[state=active]:border-b data-[state=active]:border-b-background data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:hover:bg-background data-[state=active]:hover:text-foreground sm:flex-none sm:px-5"
          >
            <component
              :is="k.icon"
              class="size-4"
              aria-hidden="true"
            />
            <span class="sm:hidden">{{ k.short }}</span>
            <span class="hidden sm:inline">{{ k.label }}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ aktiv.hint }}<span class="sm:hidden"> · Wischen für die nächste Kategorie</span>
      </p>
    </template>

    <!-- one section per page; only the shown one and its neighbours are built. Cards: wide ones span both columns -->
    <PageCarousel
      ref="carousel"
      v-model:index="index"
      :count="KATEGORIEN.length"
      :labels="KATEGORIEN.map(k => k.label)"
    >
      <template #default="{ i, near }">
        <section class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <template v-if="!near" />
          <template v-else-if="keys[i] === 'bewertungen'">
            <AnalyseScoreTimelineCard class="lg:col-span-2" />
            <AnalysePreisLeistungCard class="lg:col-span-2" />
            <AnalyseKonsensCard class="lg:col-span-2" />
            <AnalyseGeschmackCard class="lg:col-span-2" />
            <AnalyseNotenverteilungCard class="lg:col-span-2" />
            <AnalysePcaCard class="lg:col-span-2" />
            <AnalysePlanerBiasCard class="lg:col-span-2" />
          </template>
          <template v-else-if="keys[i] === 'termine'">
            <AnalyseAnwesenheitCard class="lg:col-span-2" />
            <AnalyseSaisonCard />
            <AnalyseRhythmusCard />
          </template>
          <template v-else-if="keys[i] === 'bier'">
            <AnalyseBierpreisCard />
            <AnalyseBierbrilleCard />
            <AnalyseBierBewertungCard class="lg:col-span-2" />
            <AnalyseBierCard class="lg:col-span-2" />
          </template>
          <template v-else>
            <AnalyseKarteCard class="lg:col-span-2" />
          </template>
        </section>
      </template>
    </PageCarousel>
  </AppPage>
</template>
