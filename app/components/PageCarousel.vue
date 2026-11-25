<script setup lang="ts">
import { useEventListener, usePreferredReducedMotion, useResizeObserver } from '@vueuse/core'
import type { UnwrapRefCarouselApi as CarouselApi } from '@/components/ui/carousel/interface'
import { handlesArrows, handlesTouch } from '@/lib/touch'

/**
 * Whole-width pages side by side (shadcn Carousel / Embla): the page follows the finger and snaps
 * to the next one; on desktop ← → do the same. `v-model:index` is the shown page, set from
 * outside to scroll there. `settle` fires once a scroll has come to rest.
 *
 * Charts and maps that pan sideways, and fullscreen charts, keep their own touch handling.
 * The carousel is as tall as the shown page, not the tallest one, and the window scrolls back up
 * when the page changes.
 */
const props = defineProps<{
  /** number of pages */
  count: number
  /** label per page, for screen readers */
  labels?: string[]
  /** stable key per page, so a page keeps its content when others are added in front */
  keys?: string[]
}>()
const index = defineModel<number>('index', { required: true })
const emit = defineEmits<{ settle: [i: number] }>()
defineSlots<{
  /** `near`: shown or next to the shown page (also while a scroll is under way): worth building */
  default: (p: { i: number, active: boolean, near: boolean }) => unknown
}>()

const api = shallowRef<CarouselApi>()
const reducedMotion = usePreferredReducedMotion()
const jump = () => reducedMotion.value === 'reduce'

/** where the carousel last came to rest */
const settled = ref(index.value)
const near = (i: number) => Math.abs(i - index.value) <= 1 || Math.abs(i - settled.value) <= 1

const opts = {
  align: 'start' as const,
  startIndex: index.value,
  watchDrag: (_: unknown, e: MouseEvent | TouchEvent) => !handlesTouch(e.target as Element) && document.body.style.overflow !== 'hidden',
}

function onInit(a: CarouselApi) {
  api.value = a
  if (!a) return
  a.on('select', () => {
    const i = a.selectedScrollSnap()
    if (i === index.value) return
    index.value = i
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: jump() ? 'auto' : 'smooth' })
  })
  a.on('settle', () => {
    settled.value = a.selectedScrollSnap()
    emit('settle', settled.value)
  })
}

/** scroll to `i` without animation (e.g. a page picked from the URL after hydration) */
function jumpTo(i: number) {
  index.value = i
  settled.value = i
  api.value?.scrollTo(i, true)
}
defineExpose({ jumpTo })

// set from outside (tabs, ‹ › buttons) → scroll there
watch(index, (i) => {
  if (api.value && api.value.selectedScrollSnap() !== i) api.value.scrollTo(i, jump())
})
// pages added or removed (e.g. neighbours known only after hydration) → stay on the shown one
watch(() => props.count, async () => {
  await nextTick()
  api.value?.reInit()
  jumpTo(index.value)
})

useEventListener(import.meta.client ? window : null, 'keydown', (e: KeyboardEvent) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
  if (document.body.style.overflow === 'hidden' || handlesArrows(document.activeElement)) return
  const i = index.value + (e.key === 'ArrowRight' ? 1 : -1)
  if (i >= 0 && i < props.count) index.value = i
})

const pages = reactive<(HTMLElement | null)[]>([])
const heights = ref<number[]>([])
useResizeObserver(() => pages.filter((el): el is HTMLElement => !!el), () => {
  heights.value = pages.map(el => el?.offsetHeight ?? 0)
})
const height = computed(() => {
  const h = heights.value[index.value]
  return h ? `${h}px` : undefined
})
</script>

<template>
  <Carousel
    :opts="opts"
    @init-api="onInit"
  >
    <!-- until Embla takes over (prerendered HTML), the start page is shifted into view by CSS;
         Embla's own inline transform wins afterwards -->
    <CarouselContent
      class="items-start [transform:translateX(calc(var(--start)*-100%))]"
      :style="{ '--start': opts.startIndex, 'height': height }"
    >
      <CarouselItem
        v-for="i in count"
        :key="keys?.[i - 1] ?? i"
        :aria-label="labels?.[i - 1]"
        :aria-hidden="i - 1 !== index ? 'true' : undefined"
        :inert="i - 1 !== index"
      >
        <div :ref="el => (pages[i - 1] = el as HTMLElement | null)">
          <slot
            :i="i - 1"
            :active="i - 1 === index"
            :near="near(i - 1)"
          />
        </div>
      </CarouselItem>
    </CarouselContent>
  </Carousel>
</template>
