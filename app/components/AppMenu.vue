<script setup lang="ts">
import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { Award, Beer, CalendarDays, ChartLine, ChevronDown, History, House, MapPin, Menu, Moon, QrCode, ScrollText, Search, Settings, Star, Store, Users, X } from '@lucide/vue'
import { onClickOutside, onKeyStroke, useColorMode, useEventListener } from '@vueuse/core'
import { isKategorie, KATEGORIE_KEYS, KATEGORIEN, kategorieRoute, type Kategorie } from '@/lib/analyse-kategorien'
import { ICON_COLOR } from '@/lib/icon-colors'
import { byDate } from '@/lib/stats'

const { participants, visits } = useStammtisch()
/** members in the usual order, Stammtische oldest first */
const memberPaths = participants.map(p => `/teilnehmer/${p.slug}`)
const visitPaths = byDate(visits).map(v => `/brauhaus/${v.slug}?besuch=${v.nr}`)
const rememberOrder = useBrowseList()

const route = useRoute()

/** a section inside a page, folded out under its menu entry */
interface SubEntry { key: string, label: string, to: RouteLocationRaw, icon: Component, color: string, current: () => boolean }

/** icons of the Analyse sections, in the colours used for these things across the app */
const KATEGORIE_ICON: Record<Kategorie, { icon: Component, color: string }> = {
  bewertungen: { icon: Star, color: ICON_COLOR.bewertung },
  termine: { icon: CalendarDays, color: ICON_COLOR.termine },
  bier: { icon: Beer, color: ICON_COLOR.bier },
  orte: { icon: MapPin, color: ICON_COLOR.orte },
}
const aktiveKategorie = computed(() => (isKategorie(route.query.kategorie) ? route.query.kategorie : KATEGORIE_KEYS[0]))
const analyseSub: SubEntry[] = KATEGORIEN.map(k => ({
  key: k.key,
  label: k.label,
  to: kategorieRoute(k.key),
  ...KATEGORIE_ICON[k.key],
  current: () => route.path.startsWith('/analyse') && aktiveKategorie.value === k.key,
}))
/** the two sections of the Awards page (ids as in pages/awards.vue) */
const awardsSub: SubEntry[] = [
  { key: 'brauhaeuser', label: 'Brauhäuser', icon: Store, color: ICON_COLOR.orte },
  { key: 'mitglieder', label: 'Mitglieder', icon: Users, color: ICON_COLOR.personen },
].map(a => ({
  ...a,
  to: `/awards#${a.key}`,
  current: () => route.path.startsWith('/awards') && route.hash === `#${a.key}`,
}))

const pages = [
  { to: '/', label: 'Übersicht', icon: House, color: 'text-sky-500' },
  // straight to the first member / the first Stammtisch; swiping there goes on in this order
  { to: memberPaths[0]!, label: 'Mitglieder', icon: Users, color: ICON_COLOR.personen, section: '/teilnehmer/', browse: memberPaths },
  { to: visitPaths[0]!, label: 'Stammtische', icon: Beer, color: ICON_COLOR.bier, section: '/brauhaus/', browse: visitPaths },
  { to: '/analyse', label: 'Analyse', icon: ChartLine, color: 'text-indigo-500 dark:text-indigo-400', sub: analyseSub },
  { to: '/satzung', label: 'Satzung', icon: ScrollText, color: 'text-orange-500' },
  { to: '/awards', label: 'Awards', icon: Award, color: 'text-yellow-500', sub: awardsSub },
  { to: '/timeline', label: 'Timeline', icon: History, color: 'text-teal-500' },
  { to: '/suche', label: 'Suche', icon: Search, color: 'text-blue-500' },
]
/** below the divider, above the settings */
const extras = [
  { to: '/teilen', label: 'Teilen', icon: QrCode, color: 'text-foreground dark:text-white' },
]

const open = ref(false)
const settingsOpen = ref(false)
/** the entry (its `to`) whose sections are folded out, at most one */
const subOpen = ref<string | null>(null)
const root = useTemplateRef<HTMLElement>('root')
const bar = useTemplateRef<HTMLElement>('bar')

/** the bar slides away while scrolling down and comes back on scrolling up (or near the top) */
const BAR_H = 56
const SCROLL_STEP = 8
const hidden = ref(false)
let lastY = 0
useEventListener(import.meta.client ? window : null, 'scroll', () => {
  const y = window.scrollY
  if (open.value || y < BAR_H) {
    hidden.value = false
    lastY = y
    return
  }
  if (Math.abs(y - lastY) < SCROLL_STEP) return
  hidden.value = y > lastY
  lastY = y
}, { passive: true })
// sticky things below the bar (e.g. the Timeline's year) move up with it
watch(hidden, h => document.documentElement.style.setProperty('--app-header-h', h ? '0px' : `${BAR_H}px`))

const close = () => {
  open.value = false
  settingsOpen.value = false
}
const toggle = () => {
  if (open.value) return close()
  // on a page with sections they are shown right away
  subOpen.value = pages.find(p => 'sub' in p && isActive(p.to))?.to ?? null
  open.value = true
}

onClickOutside(root, close)
onKeyStroke('Escape', close)

// fullPath: the Analyse sections only change the query
watch(() => route.fullPath, () => {
  close()
  hidden.value = false
})
/** `section`: the entry stands for all pages under that path (every member, every Stammtisch) */
const isActive = (to: string, section?: string) =>
  to === '/' ? route.path === '/' : route.path.startsWith(section ?? to)
// 'auto' follows the OS until the switch is flipped once
const mode = useColorMode({ storageKey: 'stammtisch-theme' })
const nightMode = computed({
  get: () => mode.state.value === 'dark',
  set: (v: boolean) => (mode.value = v ? 'dark' : 'light'),
})

/** changing a setting keeps the menu open, so several can be changed in a row */
const toggleNightMode = () => {
  nightMode.value = !nightMode.value
}
</script>

<template>
  <!-- open menu: the page behind is dimmed (the header stays clear); a click on it closes the menu via onClickOutside -->
  <Teleport to="body">
    <div
      class="fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 dark:bg-black/65"
      :class="open ? 'opacity-100' : 'pointer-events-none opacity-0'"
      aria-hidden="true"
    />
  </Teleport>
  <!-- the birds' own layer (above the bar and its blur) slides with the bar, so sitting birds
       disappear with it and come back with it; h-14 + the bar's 1px border = the bar's height -->
  <div
    class="pointer-events-none fixed inset-x-0 top-0 z-[51] h-14 transition-transform duration-200 ease-[cubic-bezier(0.5,1,0.89,1)]"
    :class="hidden ? '-translate-y-[calc(100%+1px)]' : ''"
    aria-hidden="true"
  >
    <div class="relative mx-auto h-full max-w-6xl">
      <SittichEasterEgg
        :bar="bar"
        :bar-hidden="hidden"
        :menu-open="open"
      />
    </div>
  </div>
  <header
    ref="root"
    data-app-bar
    class="sticky top-0 z-50 border-b bg-background/85 backdrop-blur transition-transform duration-200 ease-[cubic-bezier(0.5,1,0.89,1)] supports-[backdrop-filter]:bg-background/70"
    :class="hidden ? '-translate-y-full' : ''"
    @focusin="hidden = false"
  >
    <div
      ref="bar"
      class="relative mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6"
    >
      <NuxtLink
        to="/"
        class="flex items-center gap-2 font-semibold tracking-tight"
      >
        <span class="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Beer
            class="size-4"
            aria-hidden="true"
          />
        </span>
        Stammtisch
      </NuxtLink>

      <button
        type="button"
        class="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent"
        :class="open ? 'bg-accent' : 'bg-background'"
        :aria-expanded="open"
        aria-controls="app-menu-panel"
        @click="toggle"
      >
        <span class="relative size-4">
          <Menu
            class="absolute inset-0 size-4 transition duration-200"
            :class="open ? 'scale-50 rotate-90 opacity-0' : ''"
            aria-hidden="true"
          />
          <X
            class="absolute inset-0 size-4 transition duration-200"
            :class="open ? '' : 'scale-50 -rotate-90 opacity-0'"
            aria-hidden="true"
          />
        </span>
        Menü
      </button>

      <!-- fold-out: grid-rows 0fr → 1fr animates to the content's natural height -->
      <div
        id="app-menu-panel"
        class="absolute top-full right-4 left-4 mt-2 grid transition-all duration-200 ease-out sm:left-auto sm:right-6 sm:w-64"
        :class="open ? 'grid-rows-[1fr] opacity-100' : 'pointer-events-none -translate-y-1 grid-rows-[0fr] opacity-0'"
        :inert="!open"
      >
        <div class="overflow-hidden rounded-xl shadow-lg">
          <nav
            class="flex flex-col gap-0.5 rounded-xl border bg-popover p-1.5 text-popover-foreground"
            aria-label="Hauptmenü"
          >
            <template
              v-for="(group, gi) in [pages, extras]"
              :key="gi"
            >
              <div
                v-if="gi > 0"
                class="mx-2 my-1 h-px bg-border"
              />
              <template
                v-for="p in group"
                :key="p.to"
              >
                <!-- entry with sections: the label opens the page, the chevron folds the sections -->
                <div
                  v-if="'sub' in p"
                  class="flex items-center rounded-md text-sm transition-colors"
                  :class="isActive(p.to) ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                >
                  <NuxtLink
                    :to="p.to"
                    class="flex flex-1 items-center gap-3 py-2 pl-3"
                  >
                    <component
                      :is="p.icon"
                      class="size-4"
                      :class="p.color"
                      aria-hidden="true"
                    />
                    {{ p.label }}
                  </NuxtLink>
                  <button
                    type="button"
                    class="grid h-9 w-10 place-items-center rounded-md"
                    :aria-expanded="subOpen === p.to"
                    :aria-controls="`app-menu-sub-${p.label}`"
                    :aria-label="`${p.label}: Bereiche ${subOpen === p.to ? 'zuklappen' : 'aufklappen'}`"
                    @click="subOpen = subOpen === p.to ? null : p.to"
                  >
                    <ChevronDown
                      class="size-4 transition-transform duration-200"
                      :class="subOpen === p.to ? 'rotate-180' : ''"
                      aria-hidden="true"
                    />
                  </button>
                </div>
                <div
                  v-if="'sub' in p"
                  :id="`app-menu-sub-${p.label}`"
                  class="grid transition-all duration-200 ease-out"
                  :class="subOpen === p.to ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'"
                  :inert="subOpen !== p.to"
                >
                  <div class="flex flex-col gap-0.5 overflow-hidden">
                    <NuxtLink
                      v-for="k in p.sub"
                      :key="k.key"
                      :to="k.to"
                      class="flex items-center gap-2.5 rounded-md py-1.5 pr-3 pl-10 text-sm transition-colors"
                      :class="k.current() ? 'font-medium text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                      :aria-current="k.current() ? 'page' : undefined"
                      @click="close"
                    >
                      <component
                        :is="k.icon"
                        class="size-3.5"
                        :class="k.color"
                        aria-hidden="true"
                      />
                      {{ k.label }}
                    </NuxtLink>
                  </div>
                </div>
                <NuxtLink
                  v-else
                  :to="p.to"
                  class="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors"
                  :class="isActive(p.to, 'section' in p ? p.section : undefined) ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                  :aria-current="isActive(p.to, 'section' in p ? p.section : undefined) ? 'page' : undefined"
                  @click="'browse' in p && p.browse && rememberOrder(p.browse)"
                >
                  <component
                    :is="p.icon"
                    class="size-4"
                    :class="p.color"
                    aria-hidden="true"
                  />
                  {{ p.label }}
                </NuxtLink>
              </template>
            </template>

            <button
              type="button"
              class="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              :aria-expanded="settingsOpen"
              aria-controls="app-menu-settings"
              @click="settingsOpen = !settingsOpen"
            >
              <Settings
                class="size-4 text-zinc-500 transition-transform duration-300 dark:text-zinc-400"
                :class="settingsOpen ? 'rotate-90' : ''"
                aria-hidden="true"
              />
              Einstellungen
              <ChevronDown
                class="ml-auto size-4 transition-transform duration-200"
                :class="settingsOpen ? 'rotate-180' : ''"
                aria-hidden="true"
              />
            </button>

            <div
              id="app-menu-settings"
              class="grid transition-all duration-200 ease-out"
              :class="settingsOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'"
              :inert="!settingsOpen"
            >
              <div class="overflow-hidden">
                <div class="flex items-center gap-3 py-2 pr-3 pl-10 text-sm">
                  <Moon
                    class="size-4 text-indigo-500 dark:text-indigo-400"
                    aria-hidden="true"
                  />
                  <span id="nightmode-label">Nachtmodus</span>
                  <!-- theme is only known in the browser; avoids a hydration mismatch -->
                  <ClientOnly>
                    <button
                      type="button"
                      role="switch"
                      aria-labelledby="nightmode-label"
                      :aria-checked="nightMode"
                      class="relative ml-auto h-5 w-9 shrink-0 rounded-full transition-colors"
                      :class="nightMode ? 'bg-primary' : 'bg-input'"
                      @click="toggleNightMode"
                    >
                      <span
                        class="absolute top-0.5 left-0.5 size-4 rounded-full bg-background shadow-sm transition-transform duration-200"
                        :class="nightMode ? 'translate-x-4' : ''"
                      />
                    </button>
                  </ClientOnly>
                </div>
              </div>
            </div>
          </nav>
        </div>
      </div>
    </div>
  </header>
</template>
