<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'
import { formatDate } from '@/lib/format'

useHead({ title: 'Analyse · Stammtisch-Tracker' })

const { overviewStats: s } = useStammtisch()
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
      <h1 class="text-3xl font-semibold tracking-tight">
        Analyse
      </h1>
      <p
        v-if="s.ersterBesuch && s.letzterBesuch"
        class="text-sm text-muted-foreground"
      >
        Auswertungen über alle {{ s.besuche }} Stammtische · {{ formatDate(s.ersterBesuch) }} – {{ formatDate(s.letzterBesuch) }}
      </p>
    </header>

    <!-- 1 column for wide charts; smaller cards later go into lg:grid-cols-2 -->
    <section class="grid gap-6 lg:grid-cols-2">
      <AnalyseScoreTimelineCard class="lg:col-span-2" />
      <AnalysePreisLeistungCard class="lg:col-span-2" />
      <AnalysePcaCard class="lg:col-span-2" />
      <AnalyseBierCard class="lg:col-span-2" />
      <AnalyseKarteCard class="lg:col-span-2" />
    </section>
  </main>
</template>
