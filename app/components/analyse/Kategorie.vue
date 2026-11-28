<script setup lang="ts">
import type { Kategorie } from '@/lib/analyse-kategorien'

/** The cards of one Analyse category (see pages/analyse.vue). */
defineProps<{ kategorie: Kategorie }>()
</script>

<template>
  <!-- the first card of each category right away, the ones further down only once they are
       scrolled into view (on a phone that's most of the page); the map with its geo data only on Orte -->
  <template v-if="kategorie === 'bewertungen'">
    <AnalyseScoreTimelineCard class="lg:col-span-2" />
    <LazyAnalysePreisLeistungCard
      hydrate-on-visible
      class="lg:col-span-2"
    />
    <LazyAnalyseKonsensCard
      hydrate-on-visible
      class="lg:col-span-2"
    />
    <LazyAnalyseGeschmackCard
      hydrate-on-visible
      class="lg:col-span-2"
    />
    <LazyAnalyseNotenverteilungCard
      hydrate-on-visible
      class="lg:col-span-2"
    />
    <LazyAnalysePcaCard
      hydrate-on-visible
      class="lg:col-span-2"
    />
    <LazyAnalysePlanerBiasCard
      hydrate-on-visible
      class="lg:col-span-2"
    />
  </template>
  <template v-else-if="kategorie === 'termine'">
    <AnalyseAnwesenheitCard class="lg:col-span-2" />
    <LazyAnalyseSaisonCard hydrate-on-visible />
    <LazyAnalyseRhythmusCard hydrate-on-visible />
  </template>
  <template v-else-if="kategorie === 'bier'">
    <AnalyseBierpreisCard />
    <AnalyseBierbrilleCard />
    <LazyAnalyseBierBewertungCard
      hydrate-on-visible
      class="lg:col-span-2"
    />
    <LazyAnalyseBierCard
      hydrate-on-visible
      class="lg:col-span-2"
    />
  </template>
  <template v-else>
    <LazyAnalyseKarteCard class="lg:col-span-2" />
  </template>
</template>
