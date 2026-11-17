<script setup lang="ts">
import { memberColor } from '@/lib/members'

/** The only place on the page that maps colours to members. */
defineProps<{ names: string[] }>()

const { memberPath } = useStammtisch()
</script>

<template>
  <Card class="py-3">
    <CardContent class="flex flex-wrap items-center gap-x-5 gap-y-2">
      <span class="text-sm text-muted-foreground">Mitglieder:</span>
      <NuxtLink
        v-for="name in names"
        :key="name"
        :to="memberPath(name) ?? undefined"
        class="inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
      >
        <span
          class="size-3 rounded-full"
          :style="{ backgroundColor: memberColor(name) }"
          aria-hidden="true"
        />
        {{ name }}
      </NuxtLink>
    </CardContent>
  </Card>
</template>
