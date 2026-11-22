<script setup lang="ts">
import { SCORE_KEYS, type ScoreKey } from '@/lib/analysis'

/** The Gesamt / Location / Service / Essen switch shared by the analysis cards. */
const model = defineModel<ScoreKey>({ required: true })
</script>

<template>
  <Tabs
    v-model="model"
    class="self-start"
  >
    <TabsList aria-label="Kategorie">
      <TabsTrigger
        v-for="c in SCORE_KEYS"
        :key="c.key"
        :value="c.key"
        class="gap-1.5 px-2.5 sm:px-3"
      >
        <component
          :is="c.icon"
          class="hidden size-3.5 sm:block"
          aria-hidden="true"
        />
        <span class="sm:hidden">{{ c.short }}</span>
        <span class="hidden sm:inline">{{ c.label }}</span>
      </TabsTrigger>
    </TabsList>
  </Tabs>
</template>
