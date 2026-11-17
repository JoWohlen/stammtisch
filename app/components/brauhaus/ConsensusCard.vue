<script setup lang="ts">
import { CircleCheck, CircleAlert, Split } from '@lucide/vue'
import type { Category, Visit } from '#shared/types'
import { CATEGORIES, consensusLabel, spread, visitSpread } from '@/lib/consensus'

const props = defineProps<{ visit: Visit }>()

const LABELS: Record<Category, string> = { location: 'der Location', service: 'dem Service', essen: 'Essen & Trinken' }
const ICONS = { good: CircleCheck, mid: CircleAlert, bad: Split }
const TONES = {
  good: 'text-emerald-600 dark:text-emerald-400',
  mid: 'text-amber-600 dark:text-amber-400',
  bad: 'text-rose-600 dark:text-rose-400',
}

const label = computed(() => {
  const s = visitSpread(props.visit)
  return s == null ? null : consensusLabel(s)
})

/** category with the largest spread, only worth mentioning if the vote wasn't unanimous */
const mostDivided = computed(() => {
  if (!label.value || label.value.tone === 'good') return null
  const list = CATEGORIES
    .map(c => ({ c, s: spread(props.visit.ratings[c]) }))
    .filter((x): x is { c: Category, s: number } => x.s != null)
    .sort((a, b) => b.s - a.s)
  return list.length > 1 ? LABELS[list[0]!.c] : null
})
</script>

<template>
  <Card
    v-if="label"
    class="py-4"
  >
    <CardContent class="flex items-start gap-3">
      <component
        :is="ICONS[label.tone]"
        class="mt-0.5 size-5 shrink-0"
        :class="TONES[label.tone]"
        aria-hidden="true"
      />
      <div>
        <p class="font-semibold">
          {{ label.title }}
        </p>
        <p class="text-sm text-muted-foreground">
          {{ label.text }}
          <template v-if="mostDivided">
            Am weitesten auseinander lagen wir bei {{ mostDivided }}.
          </template>
        </p>
      </div>
    </CardContent>
  </Card>
</template>
