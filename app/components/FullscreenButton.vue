<script setup lang="ts">
import { Maximize2, Minimize2 } from '@lucide/vue'

/** phone-only button that toggles the surrounding <FullscreenCard> */
const { isFull, toggle } = useChartFullscreen()
</script>

<template>
  <button
    type="button"
    class="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:hidden"
    :aria-label="isFull ? 'Vollbild schließen' : 'Vollbild'"
    :title="isFull ? 'Vollbild schließen' : 'Vollbild'"
    @click="toggle"
  >
    <component
      :is="isFull ? Minimize2 : Maximize2"
      class="size-4"
      aria-hidden="true"
    />
  </button>
</template>
