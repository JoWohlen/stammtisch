<script setup lang="ts">
import type { BrowseTarget } from '@/composables/useBrowse'
import { formatDate } from '@/lib/format'
import { memberColor } from '@/lib/members'

/** A member's page, as one page of the <BrowseCarousel> (the page itself checks that the member exists). */
const props = defineProps<{
  slug: string
  nav: { prev: BrowseTarget | null, next: BrowseTarget | null, counter: { n: number, total: number } | null }
}>()
const emit = defineEmits<{ go: [BrowseTarget] }>()

const { getTeilnehmer, getMemberAwards } = useStammtisch()
const teilnehmer = getTeilnehmer(props.slug)!
const awards = getMemberAwards(teilnehmer.name)
</script>

<template>
  <AppPage
    :title="teilnehmer.name"
    :description="`Seit ${formatDate(teilnehmer.stats.ersterBesuch)} dabei`"
    back
  >
    <template #nav>
      <BrowseNav
        v-bind="nav"
        @go="emit('go', $event)"
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
    <TeilnehmerZeitverlaufCard :teilnehmer="teilnehmer" />
    <TeilnehmerVotesCard :teilnehmer="teilnehmer" />
  </AppPage>
</template>
