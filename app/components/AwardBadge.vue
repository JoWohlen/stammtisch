<script setup lang="ts">
import { type Award, type AwardTone, awardDef } from '@/lib/awards'

/** An award tag that links to its explanation on /awards. */
const props = defineProps<{ award: Award }>()

/** hidden awards have no card on /awards to link to */
const linked = computed(() => !awardDef(props.award.type).hidden)
const title = computed(() => (props.award.detail ? `${props.award.hint} · ${props.award.detail}` : props.award.hint))

const TONE: Record<AwardTone, string> = {
  good: 'border-emerald-300 bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200 dark:hover:bg-emerald-500/25',
  bad: 'border-rose-300 bg-rose-100 text-rose-900 hover:bg-rose-200 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25',
  neutral: 'border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/25',
}
</script>

<template>
  <Badge
    variant="outline"
    :class="TONE[award.tone]"
    :as-child="linked"
    :title="linked ? undefined : title"
  >
    <NuxtLink
      v-if="linked"
      :to="`/awards#${award.type}`"
      :title="title"
    >
      <component :is="award.icon" /> {{ award.label }}
    </NuxtLink>
    <template v-else>
      <component :is="award.icon" /> {{ award.label }}
    </template>
  </Badge>
</template>
