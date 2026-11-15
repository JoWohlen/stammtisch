<script setup lang="ts">
import { memberColor } from '@/lib/members'

/** The only place on the page that maps colours to members. */
defineProps<{ names: string[] }>()
</script>

<template>
  <Card class="py-3">
    <CardContent class="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 sm:px-6">
      <span class="text-sm text-muted-foreground">Mitglieder:</span>
      <span
        v-for="name in names"
        :key="name"
        class="inline-flex items-center gap-2 text-sm font-medium"
      >
        <span
          class="size-3 rounded-full"
          :style="{ backgroundColor: memberColor(name) }"
          aria-hidden="true"
        />
        {{ name }}
      </span>
    </CardContent>
  </Card>
</template>
