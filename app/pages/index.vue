<script setup lang="ts">
useHead({ title: 'Übersicht · Stammtisch-Tracker' })
</script>

<template>
  <main class="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
    <OverviewKpiCard />
    <OverviewFunFactCard />
    <OverviewMemberCard />
    <OverviewBrauhausGrid />
  </main>
</template>
