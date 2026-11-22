<script setup lang="ts">
import { formatDate } from '@/lib/format'
import { memberColor } from '@/lib/members'

const route = useRoute()
const { getTeilnehmer, getMemberAwards } = useStammtisch()

const teilnehmer = getTeilnehmer(String(route.params.slug))
if (!teilnehmer) {
  throw createError({ statusCode: 404, statusMessage: 'Mitglied nicht gefunden', fatal: true })
}

useHead({ title: `${teilnehmer.name} · Stammtisch-Tracker` })

const awards = getMemberAwards(teilnehmer.name)

const browse = useBrowse('teilnehmer', computed(() => ({ slug: teilnehmer.slug })))
</script>

<template>
  <AppPage
    :title="teilnehmer.name"
    :description="`Seit ${formatDate(teilnehmer.stats.ersterBesuch)} dabei`"
    back
  >
    <template #nav>
      <BrowseNav
        v-bind="{ prev: browse.prev.value, next: browse.next.value, counter: browse.counter.value }"
        @go="browse.go"
      />
    </template>
    <template #title>
      <span
        class="size-4 shrink-0 rounded-full"
        :style="{ backgroundColor: memberColor(teilnehmer.name) }"
        aria-hidden="true"
      />
      {{ teilnehmer.name }}
    </template>
    <template
      v-if="awards.length"
      #header
    >
      <div class="mt-2 flex flex-wrap gap-1.5">
        <AwardBadge
          v-for="a in awards"
          :key="a.key"
          :award="a"
        />
      </div>
    </template>

    <TeilnehmerBilanzCard :teilnehmer="teilnehmer" />
    <TeilnehmerVotesCard :teilnehmer="teilnehmer" />
  </AppPage>
</template>
