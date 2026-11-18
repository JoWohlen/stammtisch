<script setup lang="ts">
import type { Component } from 'vue'
import { useElementSize } from '@vueuse/core'

const props = defineProps<{
  label: string
  /** one text, or several from longest to shortest: the first that fits the tile is shown */
  value: string | string[]
  icon: Component
  sub?: string
}>()

const forms = computed(() => (Array.isArray(props.value) ? props.value : [props.value]))

const box = useTemplateRef<HTMLDivElement>('box')
const { width } = useElementSize(box)
const probes = useTemplateRef<HTMLSpanElement[]>('probes')

/** index of the first form that fits; the full form until the tile has been measured (SSR) */
const fit = computed(() => {
  const w = width.value
  const els = probes.value
  if (!w || !els?.length) return 0
  const i = els.findIndex(el => el.offsetWidth <= w)
  return i === -1 ? forms.value.length - 1 : i
})
</script>

<template>
  <div class="flex flex-col gap-1 rounded-lg border bg-muted/40 p-4">
    <div class="flex items-center gap-2 text-sm text-muted-foreground">
      <component
        :is="icon"
        class="size-4"
        aria-hidden="true"
      />
      {{ label }}
    </div>
    <div
      ref="box"
      class="relative overflow-hidden text-3xl font-semibold whitespace-nowrap tabular-nums tracking-tight"
      :title="fit > 0 ? forms[0] : undefined"
    >
      {{ forms[fit] }}
      <!-- invisible copies to measure every form at the tile's font size -->
      <template v-if="forms.length > 1">
        <span
          v-for="f in forms"
          ref="probes"
          :key="f"
          class="invisible absolute top-0 left-0 w-max"
          aria-hidden="true"
        >{{ f }}</span>
      </template>
    </div>
    <div
      v-if="sub"
      class="text-xs text-muted-foreground"
    >
      {{ sub }}
    </div>
    <slot />
  </div>
</template>
