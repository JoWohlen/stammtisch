<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'

/**
 * One line of text that never wraps: if it doesn't fit, the font gets smaller (down to `min`
 * of the inherited size). Still too long at that size → cut off with "…", full text on hover.
 */
const props = withDefaults(defineProps<{
  text: string
  /** smallest size as a share of the inherited font size */
  min?: number
}>(), { min: 0.6 })

const box = useTemplateRef<HTMLElement>('box')
const scale = ref(1)
const cut = ref(false)

const measure = () => {
  if (!box.value) return
  // the text's own width (a Range ignores the box's clipping and never pads up to the box width),
  // divided by the size applied right now → width at full size, so the text can grow back too
  const range = document.createRange()
  range.selectNodeContents(box.value)
  const natural = range.getBoundingClientRect().width / scale.value
  const room = box.value.clientWidth
  if (!natural || !room) return
  const fit = Math.min(1, room / natural)
  scale.value = Math.max(props.min, Math.floor(fit * 1000) / 1000)
  cut.value = fit < props.min
}
useResizeObserver(box, measure)
watch(() => props.text, () => {
  scale.value = 1
  nextTick(measure)
})
</script>

<template>
  <!-- flex-1: the box takes the free width, so shrinking the font never shrinks the room it is measured against -->
  <span
    ref="box"
    class="block min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
    :title="cut ? text : undefined"
    :style="scale < 1 ? { fontSize: `${scale}em` } : undefined"
  >{{ text }}</span>
</template>
