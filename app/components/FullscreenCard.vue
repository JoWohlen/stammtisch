<script setup lang="ts">
import { onKeyStroke, useEventListener, useMediaQuery, useScrollLock } from '@vueuse/core'
import { CHART_FULLSCREEN } from '@/composables/useChartFullscreen'

/**
 * Wraps a chart card. Inside, a <FullscreenButton> lets the card cover the whole
 * screen (meant for phones). Browsers with the Fullscreen API also hide their own UI;
 * elsewhere (iPhone Safari) the card is just laid over the page.
 * The wrapper takes the classes the page passes (e.g. lg:col-span-2) and stretches the card inside.
 * `v-model:full` lets the chart itself react (e.g. grow to the screen height).
 *
 * Fullscreen is always landscape: where the browser can lock the orientation (Android,
 * in browser fullscreen) it does; elsewhere (iPhone) a portrait screen gets the card
 * turned by 90°. `v-model:rotated` tells the chart, for pointer maths.
 * Inside, `var(--fs-height)` is the usable screen height in both cases.
 */
defineOptions({ inheritAttrs: false })

const isFull = defineModel<boolean>('full', { default: false })
const rotatedModel = defineModel<boolean>('rotated', { default: false })

type LockableOrientation = ScreenOrientation & { lock?: (o: 'landscape') => Promise<void>, unlock?: () => void }
const orientation = (): LockableOrientation | undefined => (import.meta.client ? screen.orientation as LockableOrientation : undefined)

/** true once the browser itself holds landscape, then no CSS rotation is needed */
const locked = ref(false)
const portrait = useMediaQuery('(orientation: portrait)')
const turned = computed(() => isFull.value && !locked.value && portrait.value)
watch(turned, r => (rotatedModel.value = r), { immediate: true })
const bodyLocked = useScrollLock(import.meta.client ? document.body : null)

/**
 * While full, the card is moved to <body>: inside a transformed parent (the Analyse carousel)
 * `position: fixed` would be relative to that parent and clipped by it. A placeholder of the
 * card's height keeps the page from jumping meanwhile.
 */
const card = useTemplateRef<HTMLElement>('card')
const placeholderHeight = ref(0)

async function enter() {
  placeholderHeight.value = card.value?.offsetHeight ?? 0
  isFull.value = true
  bodyLocked.value = true
  try {
    if (document.fullscreenEnabled && !document.fullscreenElement) await document.documentElement.requestFullscreen()
  }
  catch {
    // not allowed or not supported: the overlay alone is fine
  }
  try {
    await orientation()?.lock?.('landscape')
    locked.value = true
  }
  catch {
    // no orientation lock (iPhone, desktop): rotated via CSS while the phone is held upright
  }
}

async function exit() {
  isFull.value = false
  bodyLocked.value = false
  if (locked.value) {
    try {
      orientation()?.unlock?.()
    }
    catch {
      // nothing to undo
    }
    locked.value = false
  }
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
}

const toggle = () => (isFull.value ? exit() : enter())

// leaving browser fullscreen (back gesture, Esc) also closes the overlay
useEventListener(import.meta.client ? document : null, 'fullscreenchange', () => {
  if (!document.fullscreenElement && isFull.value) exit()
})
onKeyStroke('Escape', () => {
  if (isFull.value) exit()
})
onBeforeUnmount(() => {
  if (isFull.value) exit()
})

provide(CHART_FULLSCREEN, { isFull: readonly(isFull), toggle })
</script>

<template>
  <div
    v-if="isFull"
    v-bind="$attrs"
    :style="{ height: `${placeholderHeight}px` }"
    aria-hidden="true"
  />
  <Teleport
    to="body"
    :disabled="!isFull"
  >
    <div
      ref="card"
      v-bind="isFull ? {} : $attrs"
      :class="!isFull ? 'min-w-0' : turned ? 'fixed top-0 left-full z-50 h-[100dvw] w-[100dvh] origin-top-left rotate-90 overflow-auto bg-background p-2' : 'fixed inset-0 z-50 overflow-auto bg-background p-2'"
      :style="isFull ? { '--fs-height': turned ? '100dvw' : '100dvh' } : undefined"
      :role="isFull ? 'dialog' : undefined"
      :aria-modal="isFull ? 'true' : undefined"
      class="flex flex-col *:flex-1"
    >
      <slot />
    </div>
  </Teleport>
</template>
