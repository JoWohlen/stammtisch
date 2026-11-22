<script setup lang="ts">
import { memberColor } from '@/lib/members'

const route = useRoute()
const { getTeilnehmer } = useStammtisch()

const teilnehmer = getTeilnehmer(String(route.params.slug))
if (!teilnehmer) {
  throw createError({ statusCode: 404, statusMessage: 'Mitglied nicht gefunden', fatal: true })
}

useHead({ title: `${teilnehmer.name} · Stammtisch-Tracker` })
</script>

<template>
  <AppPage
    :title="teilnehmer.name"
    back
  >
    <template #title>
      <span
        class="size-4 shrink-0 rounded-full"
        :style="{ backgroundColor: memberColor(teilnehmer.name) }"
        aria-hidden="true"
      />
      {{ teilnehmer.name }}
    </template>

    <TeilnehmerBilanzCard :teilnehmer="teilnehmer" />
    <TeilnehmerVotesCard :teilnehmer="teilnehmer" />
  </AppPage>
</template>
