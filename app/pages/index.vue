<script setup lang="ts">
import { formatDate } from '@/lib/format'

useHead({ title: 'Übersicht · Stammtisch-Tracker' })

const { overviewStats: s } = useStammtisch()
const description = s.ersterBesuch && s.letzterBesuch
  ? `${s.besuche} Stammtische · ${formatDate(s.ersterBesuch)} – ${formatDate(s.letzterBesuch)}`
  : undefined
</script>

<template>
  <AppPage
    title="Übersicht"
    :description="description"
  >
    <OverviewKpiCard />
    <OverviewFunFactCard />
    <OverviewMemberCard />
    <OverviewBrauhausGrid />
  </AppPage>
</template>
