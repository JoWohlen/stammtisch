<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'
import { memberColor } from '@/lib/members'

const route = useRoute()
const { getTeilnehmer } = useStammtisch()

const teilnehmer = getTeilnehmer(String(route.params.slug))
if (!teilnehmer) {
  throw createError({ statusCode: 404, statusMessage: 'Teilnehmer nicht gefunden', fatal: true })
}

useHead({ title: `${teilnehmer.name} · Stammtisch-Tracker` })
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
      <h1 class="flex items-center gap-3 text-3xl font-semibold tracking-tight">
        <span
          class="size-4 shrink-0 rounded-full"
          :style="{ backgroundColor: memberColor(teilnehmer.name) }"
          aria-hidden="true"
        />
        {{ teilnehmer.name }}
      </h1>
    </header>

    <TeilnehmerBilanzCard :teilnehmer="teilnehmer" />
    <TeilnehmerVotesCard :teilnehmer="teilnehmer" />
  </main>
</template>
