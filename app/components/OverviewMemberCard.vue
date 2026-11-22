<script setup lang="ts">
import { memberColor } from '@/lib/members'

const { participants } = useStammtisch()
const rememberOrder = useBrowseList()
const paths = participants.map(p => `/teilnehmer/${p.slug}`)
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-2xl">
        Mitglieder
      </CardTitle>
      <CardDescription>
        {{ participants.length }} Personen · Klick → persönliche Seite
      </CardDescription>
    </CardHeader>

    <CardContent>
      <ul class="flex flex-wrap gap-2">
        <li
          v-for="p in participants"
          :key="p.slug"
        >
          <NuxtLink
            :to="`/teilnehmer/${p.slug}`"
            class="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:h-10"
            @click="rememberOrder(paths)"
          >
            <span
              class="size-2.5 shrink-0 rounded-full"
              :style="{ backgroundColor: memberColor(p.name) }"
              aria-hidden="true"
            />
            {{ p.name }}
          </NuxtLink>
        </li>
      </ul>
    </CardContent>
  </Card>
</template>
