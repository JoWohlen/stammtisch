<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { formatDate } from '@/lib/format'
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
/** slide direction of the last switch, for the transition */
const dir = ref<'next' | 'prev'>('next')
/** the current category's content, nudged when swiping past the first / last one */
const content = ref<HTMLElement | null>(null)

// ?kategorie=… keeps the tab on reload and in shared links (read after hydration, the prerendered page shows the first)
const route = useRoute()
const router = useRouter()
onMounted(() => {
  const q = route.query.kategorie
  if (isKategorie(q)) kategorie.value = q
  peek()
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

/** switches the visible category, sliding in the right direction */
function show(k: Kategorie) {
  if (k === kategorie.value) return false
  dir.value = keys.indexOf(k) > keys.indexOf(kategorie.value) ? 'next' : 'prev'
  kategorie.value = k
  window.scrollTo({ top: 0, behavior: 'smooth' })
  return true
}

function select(k: Kategorie) {
  if (show(k)) router.replace({ query: { ...route.query, kategorie: k === keys[0] ? undefined : k } })
}

// links from the app menu change only the query, the page stays mounted
watch(() => route.query.kategorie, (q) => {
  if (!route.path.startsWith('/analyse')) return // leaving the page
  show(isKategorie(q) ? q : keys[0]!)
})

// swipe left → next category, right → previous (charts that scroll or pan themselves are left alone)
useHorizontalSwipe((d) => {
  const i = keys.indexOf(kategorie.value) + (d === 'left' ? 1 : -1)
  const k = keys[i]
  if (k) select(k)
  else edgeBump(d, content.value)
})
</script>

<template>
  <AppPage title="Analyse">
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
      :name="`slide-${dir}`"
      mode="out-in"
    >
      <section
        :key="kategorie"
        ref="content"
        class="grid grid-cols-1 gap-6 lg:grid-cols-2"
      >
        <template v-if="kategorie === 'bewertungen'">
          <AnalyseScoreTimelineCard class="lg:col-span-2" />
          <AnalysePreisLeistungCard class="lg:col-span-2" />
          <AnalyseKonsensCard class="lg:col-span-2" />
          <AnalyseGeschmackCard class="lg:col-span-2" />
          <AnalyseNotenverteilungCard class="lg:col-span-2" />
          <AnalysePcaCard class="lg:col-span-2" />
          <AnalysePlanerBiasCard class="lg:col-span-2" />
        </template>
        <template v-else-if="kategorie === 'termine'">
          <AnalyseAnwesenheitCard class="lg:col-span-2" />
          <AnalyseSaisonCard />
          <AnalyseRhythmusCard />
        </template>
        <template v-else-if="kategorie === 'bier'">
          <AnalyseBierpreisCard />
          <AnalyseBierbrilleCard />
          <AnalyseBierBewertungCard class="lg:col-span-2" />
          <AnalyseBierCard class="lg:col-span-2" />
        </template>
        <template v-else>
          <AnalyseKarteCard class="lg:col-span-2" />
        </template>
      </section>
    </Transition>
  </AppPage>
</template>

<style scoped>
.slide-next-enter-active,
.slide-next-leave-active,
.slide-prev-enter-active,
.slide-prev-leave-active {
  transition: transform 180ms ease, opacity 180ms ease;
}
.slide-next-enter-from,
.slide-prev-leave-to {
  transform: translateX(2rem);
  opacity: 0;
}
.slide-next-leave-to,
.slide-prev-enter-from {
  transform: translateX(-2rem);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .slide-next-enter-active,
  .slide-next-leave-active,
  .slide-prev-enter-active,
  .slide-prev-leave-active {
    transition: none;
  }
}
</style>

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
