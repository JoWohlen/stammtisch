<script setup lang="ts">
// key on the full path: another visit of the same Brauhaus (?besuch=) is its own page in the carousel
definePageMeta({ key: route => route.fullPath })

const route = useRoute()
const { getBrauhaus } = useStammtisch()

const brauhaus = getBrauhaus(String(route.params.slug))
if (!brauhaus) {
  throw createError({ statusCode: 404, statusMessage: 'Brauhaus nicht gefunden', fatal: true })
}

useHead({ title: `${brauhaus.name} · Stammtisch-Tracker` })

/** ?besuch=<nr> picks the visit, read after hydration so the prerendered HTML (newest visit) still matches */
const nr = ref<number | null>(null)
onMounted(() => {
  const n = Number(route.query.besuch)
  nr.value = brauhaus.visits.some(v => v.nr === n) ? n : null
})
// template: the Brauhaus page with the previous and next entry beside it, to swipe through; another visit picked in the date tabs is its own entry in the browse order
</script>

<template>
  <BrowseCarousel
    v-slot="{ slug, nr: shownNr, nav, onGo, go }"
    kind="brauhaus"
    :slug="brauhaus.slug"
    :nr="nr"
  >
    <BrauhausDetail
      :slug="slug"
      :nr="shownNr"
      :nav="nav"
      @go="onGo"
      @select-visit="(n: number) => go(`/brauhaus/${slug}?besuch=${n}`)"
    />
  </BrowseCarousel>
</template>
