<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  label: string
  value: string
  icon: Component
  sub?: string
}>()
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
    <div class="text-3xl font-semibold tabular-nums tracking-tight">
      {{ value }}
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
