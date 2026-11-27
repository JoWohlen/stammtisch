<script setup lang="ts">
import { createSittichScene } from '@/lib/sittich/engine'
import type { SittichScene } from '@/lib/sittich/engine'
import { onKeyStroke, useEventListener } from '@vueuse/core'
import { DRUNK_EVENT, isDrunk } from '@/lib/drunk'
import { SITTICH_CALL_EVENT } from '@/lib/sittich/call'

/**
 * Easter egg: a Halsbandsittich (sometimes a pair) lands on the menu bar's bottom line once the bar
 * has been on screen for a while without the menu being opened. Clicking it scares it off, and the wait starts over.
 * On Lucas' and Johannes Jr.'s pages a click blows it up.
 * Force a landing with B on the keyboard, a tap on the Übersicht headline (SITTICH_CALL_EVENT),
 * or `?sittich` (one bird) / `?sittich=paar` (a pair) in the URL.
 * While the bar is slid away (scrolling down) or the page is drunk no bird comes (when it gets drunk, birds fly off); birds already there ride up with it and,
 * once it is up, fly off (still mid-flight if the bar comes back quickly).
 */
const props = defineProps<{
  /** the menu bar, to find the free stretch between logo and button */
  bar?: HTMLElement | null
  barHidden?: boolean
  /** opening the menu starts the wait over */
  menuOpen?: boolean
}>()

/** how long the bar has to be visible (tab in front, menu closed, no bird around) before a bird comes */
const WAIT_MS = 45_000
/** chance that a female follows the male */
const PAIR_CHANCE = 0.35
const NUKE_PAGES = new Set(['/teilnehmer/lucas', '/teilnehmer/johannes-jr'])
const TICK_MS = 250
/** the bar's slide in AppMenu: the birds take off once it is up */
const BAR_SLIDE_MS = 200

const perch = useTemplateRef<HTMLElement>('perch')
const route = useRoute()
let scene: SittichScene | undefined
let ticker: ReturnType<typeof setInterval> | undefined
let visibleMs = 0
let takeOff: ReturnType<typeof setTimeout> | undefined

// counts only while the tab is in front and no bird is on screen; a hidden tab pauses the count
const tick = () => {
  if (!scene || document.visibilityState !== 'visible') return
  // drunk easter egg (DrunkEasterEgg.vue) running: no bird
  if (props.barHidden || props.menuOpen || isDrunk()) {
    visibleMs = 0
    return
  }
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
  scene = createSittichScene(perch.value!, { isNukePage: () => NUKE_PAGES.has(route.path), bar: () => props.bar })
  ticker = setInterval(tick, TICK_MS)
  forceFromUrl()
})
watch(() => route.query.sittich, forceFromUrl)

/** calls one in right away (not while one is around, the bar is away or the page is drunk) */
const callBird = () => {
  if (!scene || scene.busy() || props.barHidden || isDrunk()) return
  visibleMs = 0
  scene.land(Math.random() < PAIR_CHANCE)
}

// B on the keyboard (not while typing or with a modifier)
onKeyStroke(['b', 'B'], (ev) => {
  if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat) return
  const t = ev.target as HTMLElement | null
  if (t?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return
  callBird()
})
// a tap on the Übersicht headline
useEventListener(import.meta.client ? window : null, SITTICH_CALL_EVENT, callBird)
// the page gets drunk: any bird flies off (and none comes while it lasts, see tick)
useEventListener(import.meta.client ? window : null, DRUNK_EVENT, () => scene?.scareAll())
watch(() => props.barHidden, (h) => {
  clearTimeout(takeOff)
  if (h) takeOff = setTimeout(() => scene?.scareAll(), BAR_SLIDE_MS)
})
onBeforeUnmount(() => {
  clearInterval(ticker)
  clearTimeout(takeOff)
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
