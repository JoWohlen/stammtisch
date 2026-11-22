<script setup lang="ts">
import { formatDate } from '@/lib/format'

useHead({ title: 'Analyse · Stammtisch-Tracker' })

const { overviewStats: s } = useStammtisch()
const description = s.ersterBesuch && s.letzterBesuch
  ? `Auswertungen über alle ${s.besuche} Stammtische · ${formatDate(s.ersterBesuch)} – ${formatDate(s.letzterBesuch)}`
  : undefined
</script>

<template>
  <AppPage
    title="Analyse"
    :description="description"
  >
    <!-- 1 column for wide charts; smaller cards later go into lg:grid-cols-2 -->
    <section class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <AnalyseScoreTimelineCard class="lg:col-span-2" />
      <AnalyseAnwesenheitCard class="lg:col-span-2" />
      <AnalysePreisLeistungCard class="lg:col-span-2" />
      <AnalysePcaCard class="lg:col-span-2" />
      <AnalyseBierCard class="lg:col-span-2" />
      <AnalysePlanerBiasCard class="lg:col-span-2" />
      <AnalyseKarteCard class="lg:col-span-2" />
    </section>
  </AppPage>
</template>
