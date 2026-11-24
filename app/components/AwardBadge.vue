<script setup lang="ts">
import { type Award, awardDef } from '@/lib/awards'
import { TONE_COLOR } from '@/lib/score-color'

/** An award tag that links to its explanation on /awards. */
const props = defineProps<{ award: Award }>()

/** hidden awards have no card on /awards to link to */
const linked = computed(() => !awardDef(props.award.type).hidden)
const title = computed(() => (props.award.detail ? `${props.award.hint} · ${props.award.detail}` : props.award.hint))
</script>

<template>
  <Badge
    variant="outline"
    class="border-transparent bg-(--tone) text-black hover:brightness-95"
    :style="{ '--tone': TONE_COLOR[award.tone] }"
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
