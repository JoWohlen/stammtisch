<script setup lang="ts">
import type { BrowseKind, BrowseTarget } from '@/composables/useBrowse'

/**
 * A detail page with its neighbours (in the order of the list it was opened from, see useBrowse)
 * left and right of it in a <PageCarousel>: swiping drags the neighbour in; once it has come to
 * rest, the URL switches to it (replace, so "back" still returns to the list).
 * The ‹ › buttons scroll the carousel the same way.
 */
const props = defineProps<{
  kind: BrowseKind
  slug: string
  /** selected visit on a Brauhaus page */
  nr?: number | null
}>()

type Nav = ReturnType<ReturnType<typeof useBrowse>['navAt']>
defineSlots<{
  /** `onGo`: ‹ › clicked; `go(path)`: switch the page directly (e.g. another visit picked in the tabs) */
  default: (p: { slug: string, nr: number | null, nav: Nav, active: boolean, onGo: (t: BrowseTarget) => void, go: (to: string) => void }) => unknown
}>()

const browse = useBrowse(props.kind, computed(() => ({ slug: props.slug, nr: props.nr ?? undefined })))
const route = useRoute()

const parse = (path: string) => {
  const url = new URL(path, 'http://x')
  const besuch = url.searchParams.get('besuch')
  return { slug: decodeURIComponent(url.pathname.split('/')[2] ?? ''), nr: besuch == null ? null : Number(besuch) }
}

const pages = computed(() => [
  ...(browse.prev.value ? [{ to: browse.prev.value.to, offset: -1 }] : []),
  { to: route.fullPath, offset: 0 },
  ...(browse.next.value ? [{ to: browse.next.value.to, offset: 1 }] : []),
].map(p => (p.offset === 0 ? { ...p, slug: props.slug, nr: props.nr ?? null } : { ...p, ...parse(p.to) })))

const center = computed(() => pages.value.findIndex(p => p.offset === 0))
const index = ref(center.value)
// neighbours known only after hydration (e.g. ?besuch=) shift the current page
watch(center, c => (index.value = c))

function onSettle(i: number) {
  const p = pages.value[i]
  if (p && p.offset !== 0) browse.go(p.to)
}

function onGo(t: BrowseTarget) {
  const i = pages.value.findIndex(p => p.to === t.to)
  if (i !== -1) index.value = i
}
</script>

<template>
  <PageCarousel
    v-model:index="index"
    :count="pages.length"
    :keys="pages.map(p => p.to)"
    @settle="onSettle"
  >
    <template #default="{ i, active }">
      <slot
        :slug="pages[i]!.slug"
        :nr="pages[i]!.nr"
        :nav="browse.navAt(pages[i]!.offset)"
        :active="active"
        :on-go="onGo"
        :go="browse.go"
      />
    </template>
  </PageCarousel>
</template>
