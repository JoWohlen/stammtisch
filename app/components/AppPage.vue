<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'

/** Shared page frame so every page has the same width, spacing and header. */
defineProps<{
  title: string
  description?: string
  /** shows a "← Übersicht" link above the title (for detail pages) */
  back?: boolean
}>()
</script>

<template>
  <main class="mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-5 pb-10 sm:px-6">
    <header class="flex flex-col gap-1.5">
      <div
        v-if="back || $slots.nav"
        class="mb-1 flex items-center justify-between gap-3"
      >
        <NuxtLink
          v-if="back"
          to="/"
          class="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft
            class="size-4"
            aria-hidden="true"
          /> Übersicht
        </NuxtLink>
        <!-- e.g. ‹ › browsing on detail pages -->
        <slot name="nav" />
      </div>
      <!-- title and actions always share one line; a long title shrinks (see FitText) -->
      <div class="flex items-center justify-between gap-3">
        <h1 class="flex min-w-0 flex-1 items-center gap-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          <slot name="title">
            {{ title }}
          </slot>
        </h1>
        <slot name="actions" />
      </div>
      <p
        v-if="description"
        class="text-sm text-muted-foreground"
      >
        {{ description }}
      </p>
      <slot name="header" />
    </header>

    <slot />
  </main>
</template>
