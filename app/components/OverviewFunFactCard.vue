<script setup lang="ts">
import { Lightbulb } from '@lucide/vue'
import { FUN_FACT_CATEGORY_LABEL } from '@/lib/funfacts'

const { funFacts } = useStammtisch()

/** server renders the first fact, the client picks a random one after hydration */
const index = ref(0)
const current = computed(() => funFacts[index.value])

function next() {
  if (funFacts.length < 2) return
  let i = index.value
  while (i === index.value) i = Math.floor(Math.random() * funFacts.length)
  index.value = i
}

onMounted(next)
</script>

<template>
  <Card
    v-if="current"
    class="transition-colors"
    :class="funFacts.length > 1 ? 'cursor-pointer select-none hover:bg-accent/50' : ''"
    :role="funFacts.length > 1 ? 'button' : undefined"
    :tabindex="funFacts.length > 1 ? 0 : undefined"
    :title="funFacts.length > 1 ? 'Klicken für einen anderen Fun Fact' : undefined"
    @click="next"
    @keydown.enter.prevent="next"
    @keydown.space.prevent="next"
  >
    <CardContent class="flex items-start gap-4">
      <Lightbulb
        class="mt-0.5 size-6 shrink-0 text-amber-500"
        aria-hidden="true"
      />
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="text-sm text-muted-foreground">
          Wusstest du? · {{ FUN_FACT_CATEGORY_LABEL[current.category] }}
        </span>
        <p
          class="text-base font-medium text-pretty"
          aria-live="polite"
        >
          {{ current.text }}
        </p>
      </div>
    </CardContent>
  </Card>
</template>
