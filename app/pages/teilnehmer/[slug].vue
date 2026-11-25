<script setup lang="ts">
// a new page per member, so the carousel starts fresh on the one swiped to
definePageMeta({ key: route => route.fullPath })

const route = useRoute()
const { getTeilnehmer } = useStammtisch()

const teilnehmer = getTeilnehmer(String(route.params.slug))
if (!teilnehmer) {
  throw createError({ statusCode: 404, statusMessage: 'Mitglied nicht gefunden', fatal: true })
}

useHead({ title: `${teilnehmer.name} · Stammtisch-Tracker` })
// template: the member's page with the previous and next member beside it, to swipe through
</script>

<template>
  <BrowseCarousel
    v-slot="{ slug, nav, onGo }"
    kind="teilnehmer"
    :slug="teilnehmer.slug"
  >
    <TeilnehmerDetail
      :slug="slug"
      :nav="nav"
      @go="onGo"
    />
  </BrowseCarousel>
</template>
