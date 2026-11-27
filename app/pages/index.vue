<script setup lang="ts">
import { formatDate } from '@/lib/format'
import { callSittich } from '@/lib/sittich/call'

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
    <!-- easter egg: a tap on the headline calls the Halsbandsittich onto the menu bar -->
    <template #title>
      <span
        class="[-webkit-tap-highlight-color:transparent]"
        @click="callSittich"
      >Übersicht</span>
    </template>
    <OverviewKpiCard />
    <OverviewFunFactCard />
    <OverviewMemberCard />
    <OverviewBrauhausGrid />
  </AppPage>
</template>
