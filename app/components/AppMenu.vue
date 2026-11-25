<script setup lang="ts">
import { Award, Beer, ChartLine, ChevronDown, History, House, Menu, Moon, QrCode, ScrollText, Search, Settings, X } from '@lucide/vue'
import { onClickOutside, onKeyStroke, useColorMode } from '@vueuse/core'

const pages = [
  { to: '/', label: 'Übersicht', icon: House },
  { to: '/analyse', label: 'Analyse', icon: ChartLine },
  { to: '/satzung', label: 'Satzung', icon: ScrollText },
  { to: '/awards', label: 'Awards', icon: Award },
  { to: '/timeline', label: 'Timeline', icon: History },
  { to: '/suche', label: 'Suche', icon: Search },
]
/** below the divider, above the settings */
const extras = [
  { to: '/teilen', label: 'Teilen', icon: QrCode },
]

const open = ref(false)
const settingsOpen = ref(false)
const root = useTemplateRef<HTMLElement>('root')

const close = () => {
  open.value = false
  settingsOpen.value = false
}
const toggle = () => (open.value ? close() : (open.value = true))

onClickOutside(root, close)
onKeyStroke('Escape', close)

const route = useRoute()
watch(() => route.path, close)
const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))

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
  <header
    ref="root"
    class="sticky top-0 z-50 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70"
  >
    <div class="relative mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
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
              <NuxtLink
                v-for="p in group"
                :key="p.to"
                :to="p.to"
                class="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors"
                :class="isActive(p.to) ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                :aria-current="isActive(p.to) ? 'page' : undefined"
              >
                <component
                  :is="p.icon"
                  class="size-4"
                  aria-hidden="true"
                />
                {{ p.label }}
              </NuxtLink>
            </template>

            <button
              type="button"
              class="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              :aria-expanded="settingsOpen"
              aria-controls="app-menu-settings"
              @click="settingsOpen = !settingsOpen"
            >
              <Settings
                class="size-4 transition-transform duration-300"
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
                    class="size-4 text-muted-foreground"
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
