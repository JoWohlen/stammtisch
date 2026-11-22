<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import type { BrowseTarget } from '@/composables/useBrowse'

/** ‹ n / total › next to the back link; on phones swiping does the same */
defineProps<{
  prev: BrowseTarget | null
  next: BrowseTarget | null
  counter: { n: number, total: number } | null
}>()
const emit = defineEmits<{ go: [BrowseTarget] }>()

const BTN = 'grid size-8 place-items-center rounded-md border bg-background text-muted-foreground shadow-xs transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40'
</script>

<template>
  <nav
    v-if="counter"
    class="flex items-center gap-2"
    aria-label="Blättern"
  >
    <button
      type="button"
      :class="BTN"
      :disabled="!prev"
      :title="prev ? `Zurück: ${prev.label}` : undefined"
      :aria-label="prev ? `Zurück: ${prev.label}` : 'Kein vorheriger Eintrag'"
      @click="prev && emit('go', prev)"
    >
      <ChevronLeft
        class="size-4"
        aria-hidden="true"
      />
    </button>
    <span class="min-w-12 text-center text-sm text-muted-foreground tabular-nums">{{ counter.n }} / {{ counter.total }}</span>
    <button
      type="button"
      :class="BTN"
      :disabled="!next"
      :title="next ? `Weiter: ${next.label}` : undefined"
      :aria-label="next ? `Weiter: ${next.label}` : 'Kein nächster Eintrag'"
      @click="next && emit('go', next)"
    >
      <ChevronRight
        class="size-4"
        aria-hidden="true"
      />
    </button>
  </nav>
</template>
