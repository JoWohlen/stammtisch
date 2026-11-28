<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { useElementSize } from '@vueuse/core'
import { formatDate } from '@/lib/format'
import { serveBeer } from '@/lib/drunk'
import { isKategorie, KATEGORIE_KEYS as keys, KATEGORIEN, type Kategorie } from '@/lib/analyse-kategorien'

useHead({ title: 'Analyse · Stammtisch-Tracker' })

const { overviewStats: s } = useStammtisch()
const zeitraum = s.ersterBesuch && s.letzterBesuch
  ? `${formatDate(s.ersterBesuch)} – ${formatDate(s.letzterBesuch)}`
  : undefined

const kategorie = ref<Kategorie>('bewertungen')
const aktiv = computed(() => KATEGORIEN.find(k => k.key === kategorie.value)!)
/** the categories left and right of the current one, for the swipe hint */
const prevKat = computed(() => KATEGORIEN[keys.indexOf(kategorie.value) - 1] ?? null)
const nextKat = computed(() => KATEGORIEN[keys.indexOf(kategorie.value) + 1] ?? null)
/** the current category's content, nudged when swiping past the first / last one */
const content = ref<HTMLElement | null>(null)
/** transition of the last switch (card on touch screens, quick slide on desktop) */
const swap = ref('card-swap')

/**
 * Touch screens: the categories left and right of the current one, rendered out of view (and only
 * once the phone is idle, so switching stays quick). Swiping brings in a copy of the real thing
 * right next to the current one, which then stays in place as the new category.
 */
const ghosts = ref<Kategorie[]>([])
const { width: contentWidth } = useElementSize(content)
let cancelIdle = () => {}
const renderGhosts = () => {
  if (!cardSwipe()) return
  cancelIdle()
  cancelIdle = whenIdle(() => {
    ghosts.value = [prevKat.value?.key, nextKat.value?.key].filter((k): k is Kategorie => !!k)
  })
}
watch(kategorie, renderGhosts)
onBeforeUnmount(() => cancelIdle())

// ?kategorie=… keeps the tab on reload and in shared links (read after hydration, the prerendered page shows the first)
const route = useRoute()
const router = useRouter()
onMounted(() => {
  const q = route.query.kategorie
  if (isKategorie(q)) kategorie.value = q
  peek()
  renderGhosts()
})

/**
 * Once per visit on a touch screen: the content slides a bit to the side and springs back,
 * as if pulled by a finger, so it's clear the categories can be swiped.
 */
function peek() {
  if (!matchMedia('(pointer: coarse)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (sessionStorage.getItem('analyse-peek')) return
  sessionStorage.setItem('analyse-peek', '1')
  const dir = nextKat.value ? -1 : 1
  setTimeout(() => content.value?.animate([
    { transform: 'translateX(0)' },
    { transform: `translateX(${dir * 56}px)`, offset: 0.35, easing: 'ease-in-out' },
    { transform: `translateX(${dir * 44}px)`, offset: 0.55, easing: 'ease-in-out' },
    { transform: 'translateX(0)' },
  ], { duration: 1100, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' }), 700)
}

/** switches the visible category (card-swap / slide-left / slide-right in main.css) */
function show(k: Kategorie) {
  if (k === kategorie.value) return false
  swap.value = swapTransition(keys.indexOf(k) > keys.indexOf(kategorie.value) ? 'left' : 'right')
  kategorie.value = k
  // (after a swipe it is already at the top, see flyOut)
  window.scrollTo({ top: 0, behavior: 'smooth' })
  return true
}

/** the current category flies off like a swiped card, then the chosen one comes up from behind */
async function select(k: Kategorie) {
  if (k === kategorie.value || isFlying(content.value)) return
  await flyOut(keys.indexOf(k) > keys.indexOf(kategorie.value) ? 'left' : 'right', content.value)
  if (show(k)) router.replace({ query: { ...route.query, kategorie: k === keys[0] ? undefined : k } })
}

// links from the app menu change only the query, the page stays mounted
watch(() => route.query.kategorie, (q) => {
  if (!route.path.startsWith('/analyse')) return // leaving the page
  show(isKategorie(q) ? q : keys[0]!)
})

// swipe left → next category, right → previous (charts that scroll or pan themselves are left alone)
const neighbour = (d: 'left' | 'right') => keys[keys.indexOf(kategorie.value) + (d === 'left' ? 1 : -1)]
useHorizontalSwipe(
  (d) => {
    const k = neighbour(d)
    if (k) select(k)
  },
  {
    target: () => content.value,
    can: d => !!neighbour(d),
    preview: (d) => {
      const k = KATEGORIEN.find(c => c.key === neighbour(d))
      return k ? { title: k.label, section: true, node: document.querySelector(`[data-swipe-ghost="${k.key}"]`) } : null
    },
  },
)
</script>

<template>
  <AppPage title="Analyse">
    <!-- easter egg: on the Bier tab, tapping the title serves a Gilden Kölsch (DrunkEasterEgg.vue) -->
    <template #title>
      <span @click="kategorie === 'bier' && serveBeer()">Analyse</span>
    </template>
    <template
      v-if="zeitraum"
      #description
    >
      <!-- two lines on mobile, one line with a separator from sm up -->
      <span class="block sm:inline">Auswertungen über alle {{ s.besuche }} Stammtische</span>
      <span
        class="hidden sm:inline"
        aria-hidden="true"
      > · </span>
      <span class="block sm:inline">{{ zeitraum }}</span>
    </template>
    <template #header>
      <Tabs
        :model-value="kategorie"
        class="mt-3"
        @update:model-value="select($event as Kategorie)"
      >
        <!-- page sections: folder tabs on a line, unlike the filled switches inside the cards;
             the active tab is open towards the content below -->
        <TabsList
          class="grid h-auto w-full grid-cols-4 items-end gap-1 rounded-none border-b bg-transparent p-0 sm:flex sm:justify-start"
          aria-label="Kategorie"
        >
          <TabsTrigger
            v-for="k in KATEGORIEN"
            :key="k.key"
            :value="k.key"
            class="-mb-px h-11 cursor-pointer gap-1.5 rounded-t-lg rounded-b-none border border-b-0 border-border bg-muted/60 px-2 text-base text-muted-foreground shadow-none transition-colors hover:bg-muted hover:text-foreground data-[state=active]:h-12 data-[state=active]:border-b data-[state=active]:border-b-background data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:hover:bg-background data-[state=active]:hover:text-foreground sm:flex-none sm:px-5"
          >
            <span class="sm:hidden">{{ k.short }}</span>
            <span class="hidden sm:inline">{{ k.label }}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ aktiv.hint }}
      </p>
      <!-- phones: it can be swiped - neighbours with arrows (also tappable) and a dot per category -->
      <div class="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm sm:hidden">
        <button
          v-if="prevKat"
          type="button"
          class="flex min-w-0 items-center gap-0.5 justify-self-start text-muted-foreground"
          @click="select(prevKat.key)"
        >
          <ChevronLeft
            class="size-4 shrink-0 animate-[swipe-hint-left_1.6s_ease-in-out_infinite]"
            aria-hidden="true"
          />
          <span class="truncate">{{ prevKat.short }}</span>
        </button>
        <span v-else />
        <span
          class="flex items-center gap-1.5"
          aria-hidden="true"
        >
          <span
            v-for="k in KATEGORIEN"
            :key="k.key"
            class="h-1.5 rounded-full transition-all duration-200"
            :class="k.key === kategorie ? 'w-4 bg-foreground' : 'w-1.5 bg-muted-foreground/40'"
          />
        </span>
        <button
          v-if="nextKat"
          type="button"
          class="flex min-w-0 items-center gap-0.5 justify-self-end text-muted-foreground"
          @click="select(nextKat.key)"
        >
          <span class="truncate">{{ nextKat.short }}</span>
          <ChevronRight
            class="size-4 shrink-0 animate-[swipe-hint-right_1.6s_ease-in-out_infinite]"
            aria-hidden="true"
          />
        </button>
        <span v-else />
      </div>
      <p class="sr-only">
        Wischen wechselt die Kategorie.
      </p>
    </template>

    <!-- one category at a time; cards in a category: wide ones span both columns -->
    <Transition
      :name="swap"
      mode="out-in"
    >
      <section
        :key="kategorie"
        ref="content"
        class="grid grid-cols-1 gap-6 lg:grid-cols-2"
      >
        <AnalyseKategorie :kategorie="kategorie" />
      </section>
    </Transition>

    <!-- the neighbouring categories, out of view (see ghosts) -->
    <div
      v-if="ghosts.length"
      class="pointer-events-none fixed top-0 left-[-400vw]"
      :style="{ width: `${contentWidth}px` }"
      aria-hidden="true"
      inert
    >
      <section
        v-for="k in ghosts"
        :key="k"
        :data-swipe-ghost="k"
        class="grid grid-cols-1 gap-6 lg:grid-cols-2"
      >
        <AnalyseKategorie :kategorie="k" />
      </section>
    </div>
  </AppPage>
</template>

<style>
/* the arrows of the swipe hint nudge outwards now and then (global: used by Tailwind animate-[…] classes) */
@keyframes swipe-hint-left {
  0%, 60%, 100% { transform: translateX(0); }
  75% { transform: translateX(-3px); }
}
@keyframes swipe-hint-right {
  0%, 60%, 100% { transform: translateX(0); }
  75% { transform: translateX(3px); }
}
@media (prefers-reduced-motion: reduce) {
  [class*="swipe-hint-"] {
    animation: none !important;
  }
}
</style>
