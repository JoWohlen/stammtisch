<script setup lang="ts">
import { ChevronDown, Store, Users } from '@lucide/vue'
import { AWARD_DEFS, type AwardDef, type AwardScope, type AwardTone } from '@/lib/awards'
import type { Component } from 'vue'
import { formatDate } from '@/lib/format'

useHead({ title: 'Awards · Stammtisch-Tracker' })

const { getAwardMentions } = useStammtisch()

const SECTIONS: { scope: AwardScope, id: string, nav: string, icon: Component, title: string, description: string }[] = [
  { scope: 'brauhaus', id: 'brauhaeuser', nav: 'Brauhäuser', icon: Store, title: 'Brauhaus-Awards', description: 'Werden an einzelne Besuche vergeben. Bei Gleichstand gewinnen alle.' },
  { scope: 'mitglied', id: 'mitglieder', nav: 'Mitglieder', icon: Users, title: 'Mitglieder-Awards', description: 'Werden an Mitglieder vergeben. Bei Gleichstand gewinnen alle.' },
]
// only awards that have been handed out are listed, so new ones show up as a surprise when they happen
const sections = SECTIONS.map(s => ({
  ...s,
  awards: AWARD_DEFS.filter(d => d.scope === s.scope && !d.hidden)
    .map(d => ({ def: d, mentions: getAwardMentions(d.type) }))
    .filter(a => a.mentions.length),
})).filter(s => s.awards.length)
const shown = new Set(sections.flatMap(s => s.awards.map(a => a.def.type)))

const ICON_TONE: Record<AwardTone, string> = {
  good: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  bad: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  neutral: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
}

/** award opened via #type (link from an award badge) gets highlighted and its list unfolded */
const route = useRoute()
const target = ref<string | null>(null)
const openLists = ref(new Set<string>())
const fromHash = () => {
  const t = decodeURIComponent(route.hash.slice(1))
  target.value = shown.has(t) ? t : null
  if (target.value) openLists.value.add(target.value)
}
// after hydration only: the hash never reaches the prerendered HTML
onMounted(fromHash)
watch(() => route.hash, fromHash)

/** md: two columns, so cards 2k and 2k+1 share a row; true if either has its list unfolded */
const rowOpen = (awards: { def: AwardDef }[], i: number) => {
  const start = i - (i % 2)
  return awards.slice(start, start + 2).some(a => openLists.value.has(a.def.type))
}

const setOpen = (d: AwardDef, open: boolean) => {
  if (open) openLists.value.add(d.type)
  else openLists.value.delete(d.type)
}
</script>

<template>
  <AppPage
    title="Awards"
    description="Alle Auszeichnungen für Brauhäuser und Mitglieder, wie sie vergeben werden und wer sie bekommen hat"
  >
    <!-- jump to a section -->
    <nav
      class="flex flex-wrap gap-2"
      aria-label="Award-Bereiche"
    >
      <NuxtLink
        v-for="s in sections"
        :key="s.scope"
        :to="`#${s.id}`"
        class="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-accent"
      >
        <component
          :is="s.icon"
          class="size-4 text-muted-foreground"
          aria-hidden="true"
        />
        {{ s.nav }}
        <span class="text-muted-foreground tabular-nums">{{ s.awards.length }}</span>
      </NuxtLink>
    </nav>

    <section
      v-for="s in sections"
      :id="s.id"
      :key="s.scope"
      class="flex scroll-mt-20 flex-col gap-4"
    >
      <div class="flex flex-col gap-1">
        <h2 class="text-xl font-semibold tracking-tight">
          {{ s.title }}
        </h2>
        <p class="text-sm text-muted-foreground">
          {{ s.description }}
        </p>
      </div>

      <!-- cards in a row share their height (grid stretch); a row with an unfolded list lets go of that -->
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card
          v-for="({ def: d, mentions }, i) in s.awards"
          :id="d.type"
          :key="d.type"
          class="scroll-mt-20 transition-shadow"
          :class="[target === d.type && 'ring-2 ring-primary', rowOpen(s.awards, i) && 'md:self-start']"
        >
          <CardHeader>
            <CardTitle class="flex items-center gap-3 text-lg">
              <span
                class="grid size-9 shrink-0 place-items-center rounded-lg"
                :class="ICON_TONE[d.tone]"
              >
                <component
                  :is="d.icon"
                  class="size-5"
                  aria-hidden="true"
                />
              </span>
              {{ d.label }}
            </CardTitle>
            <CardDescription>{{ d.hint }}</CardDescription>
          </CardHeader>
          <CardContent class="flex flex-1 flex-col gap-3">
            <p
              v-if="d.explain"
              class="text-sm leading-relaxed"
            >
              {{ d.explain }}
            </p>

            <Collapsible
              class="mt-auto"
              :open="openLists.has(d.type)"
              @update:open="setOpen(d, $event)"
            >
              <CollapsibleTrigger class="group flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent">
                {{ mentions.length === 1 ? '1 Erwähnung' : `Alle ${mentions.length} Erwähnungen` }}
                <ChevronDown
                  class="size-4 transition-transform duration-200 group-data-[state=open]:rotate-180"
                  aria-hidden="true"
                />
              </CollapsibleTrigger>
              <CollapsibleContent class="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                <ul class="mt-2 flex flex-col divide-y text-sm">
                  <li
                    v-for="m in mentions"
                    :key="m.key"
                  >
                    <NuxtLink
                      :to="m.to"
                      class="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent"
                    >
                      <span class="flex min-w-0 flex-col">
                        <span class="truncate font-medium">{{ m.title }}</span>
                        <span
                          v-if="m.date || m.note"
                          class="truncate text-xs text-muted-foreground"
                        >
                          {{ [m.date && formatDate(m.date), m.note].filter(Boolean).join(' · ') }}
                        </span>
                      </span>
                      <span
                        v-if="m.detail"
                        class="shrink-0 text-right text-muted-foreground tabular-nums"
                      >{{ m.detail }}</span>
                    </NuxtLink>
                  </li>
                </ul>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      </div>
    </section>
  </AppPage>
</template>
