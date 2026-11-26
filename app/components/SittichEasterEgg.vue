<script setup lang="ts">
import { createSittichScene } from '@/lib/sittich/engine'
import type { SittichScene } from '@/lib/sittich/engine'

/**
 * Easter egg: a Halsbandsittich (sometimes a pair) lands on the menu bar's bottom line once the bar
 * has been on screen for a while. Clicking it or scrolling scares it off, and the wait starts over.
 * On Lucas' and Johannes Jr.'s pages a click blows it up.
 * Force a landing with `?sittich` (one bird) or `?sittich=paar` (a pair) in the URL.
 */

/** how long the bar has to be visible (tab in front, no bird around) before a bird comes */
const WAIT_MS = 10_000
/** chance that a female follows the male */
const PAIR_CHANCE = 0.35
const NUKE_PAGES = new Set(['/teilnehmer/lucas', '/teilnehmer/johannes-jr'])
const TICK_MS = 250

const perch = useTemplateRef<HTMLElement>('perch')
const route = useRoute()
let scene: SittichScene | undefined
let ticker: ReturnType<typeof setInterval> | undefined
let visibleMs = 0

// counts only while the tab is in front and no bird is on screen; a hidden tab pauses the count
const tick = () => {
  if (!scene || document.visibilityState !== 'visible') return
  if (scene.busy()) {
    visibleMs = 0
    return
  }
  visibleMs += TICK_MS
  if (visibleMs < WAIT_MS) return
  visibleMs = 0
  scene.land(Math.random() < PAIR_CHANCE)
}

const forceFromUrl = () => {
  const q = route.query.sittich
  if (q === undefined || !scene || scene.busy()) return
  visibleMs = 0
  scene.land(q === 'paar')
}

onMounted(() => {
  scene = createSittichScene(perch.value!, { isNukePage: () => NUKE_PAGES.has(route.path) })
  ticker = setInterval(tick, TICK_MS)
  forceFromUrl()
})
watch(() => route.query.sittich, forceFromUrl)
onBeforeUnmount(() => {
  clearInterval(ticker)
  scene?.destroy()
})
</script>

<template>
  <div
    ref="perch"
    class="pointer-events-none absolute inset-0"
    aria-hidden="true"
  />
</template>
