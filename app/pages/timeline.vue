<script setup lang="ts">
import { CalendarPlus, TreePine } from '@lucide/vue'
import { formatDate } from '@/lib/format'
import { ICON_COLOR } from '@/lib/icon-colors'
import { memberColor } from '@/lib/members'
import { nextPlaner, weihnachtsessenNext } from '@/lib/planer-rotation'
import { scoreScale } from '@/lib/score-color'
import { buildTimeline, type TimelineEvent } from '@/lib/timeline'

useHead({ title: 'Timeline · Stammtisch-Tracker' })

const { visits, getAwards, memberPath, overviewStats: s } = useStammtisch()
const years = buildTimeline(visits, getAwards, memberPath)
/** dot colour = Ø Gesamt on the same red → amber → green ramp as everywhere else */
const scale = scoreScale(visits.map(v => v.averages.gesamt))
/** whoever is next in the planning rotation (skipped members first) */
const naechster = nextPlaner(visits)
/** depends on today's date, so only decided in the browser (the page is prerendered) */
const weihnachten = ref(false)
onMounted(() => (weihnachten.value = weihnachtsessenNext(visits)))

const description = s.ersterBesuch && s.letzterBesuch
  ? `${s.besuche} Stammtische vom ${formatDate(s.ersterBesuch)} bis ${formatDate(s.letzterBesuch)}`
  : undefined

const to = (slug: string, nr: number) => `/brauhaus/${slug}?besuch=${nr}`
/** ‹ › and swiping on the Brauhaus page then follow the timeline */
const rememberOrder = useBrowseList()
const paths = years.flatMap(y => y.entries.map(e => to(e.visit.slug, e.visit.nr)))

const TONE: Record<TimelineEvent['tone'], string> = {
  gold: 'bg-amber-300 text-black',
  silber: 'bg-zinc-300 text-black',
  bronze: 'bg-orange-300 text-black',
  neutral: 'bg-muted text-foreground',
}
</script>

<template>
  <AppPage
    title="Timeline"
    :description="description"
  >
    <section
      v-for="y in years"
      :key="y.year"
      :aria-labelledby="`jahr-${y.year}`"
    >
      <!-- the year stays visible below the app header while its evenings scroll by -->
      <h2
        :id="`jahr-${y.year}`"
        class="sticky top-[var(--app-header-h,3.5rem)] z-10 transition-[top] duration-200 ease-out -mx-4 bg-background/90 px-4 py-2 text-xl font-semibold tracking-tight backdrop-blur sm:-mx-6 sm:px-6"
      >
        {{ y.year }}
        <span class="ml-1 text-sm font-normal text-muted-foreground">{{ y.entries.length }} Stammtische</span>
      </h2>

      <ol class="relative mt-2 mb-4 ml-3 border-l-2 border-border">
        <li
          v-for="e in y.entries"
          :key="e.visit.nr"
          class="relative pl-6"
          :class="e.events.length ? 'py-3' : 'py-1.5'"
        >
          <!-- dot on the line: bigger for evenings with a highlight -->
          <span
            class="absolute top-1/2 left-0 -translate-x-[calc(50%+1px)] -translate-y-1/2 rounded-full ring-4 ring-background"
            :class="e.events.length ? 'size-4' : 'size-2.5'"
            :style="{ background: e.visit.averages.gesamt != null && scale ? scale.color(e.visit.averages.gesamt) : 'var(--muted-foreground)' }"
            aria-hidden="true"
          />

          <div :class="e.events.length ? 'rounded-lg border bg-card p-3 shadow-xs' : ''">
            <NuxtLink
              :to="to(e.visit.slug, e.visit.nr)"
              class="group flex items-baseline gap-3"
              @click="rememberOrder(paths)"
            >
              <span class="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">{{ formatDate(e.visit.date) }}</span>
              <span
                class="min-w-0 flex-1 truncate group-hover:underline group-hover:underline-offset-2"
                :class="e.events.length ? 'font-semibold' : 'text-sm'"
              >{{ e.visit.brauhaus }}</span>
            </NuxtLink>

            <ul
              v-if="e.events.length"
              class="mt-2 flex flex-wrap gap-1.5"
            >
              <li
                v-for="ev in e.events"
                :key="ev.key"
              >
                <component
                  :is="ev.to ? resolveComponent('NuxtLink') : 'span'"
                  :to="ev.to"
                  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                  :class="[TONE[ev.tone], ev.to ? 'hover:underline hover:underline-offset-2' : '']"
                >
                  <component
                    :is="ev.icon"
                    class="size-3.5"
                    aria-hidden="true"
                  />
                  {{ ev.label }}
                </component>
              </li>
            </ul>
          </div>
        </li>
      </ol>
    </section>

    <div
      v-if="weihnachten"
      class="mx-auto flex w-fit flex-col items-center gap-1 rounded-lg border bg-card px-4 py-2.5 text-sm shadow-xs"
    >
      <span class="flex items-center gap-2">
        <TreePine
          class="size-4 text-emerald-600 dark:text-emerald-500"
          aria-hidden="true"
        />
        <span class="text-muted-foreground">Als Nächstes:</span>
        <span class="font-semibold">Weihnachtsessen 🎄</span>
      </span>
      <span
        v-if="naechster"
        class="flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        danach plant
        <span
          class="size-2 rounded-full"
          :style="{ backgroundColor: memberColor(naechster) }"
          aria-hidden="true"
        />
        <span class="font-medium text-foreground">{{ naechster }}</span>
      </span>
    </div>
    <div
      v-else-if="naechster"
      class="mx-auto flex w-fit items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm shadow-xs"
    >
      <CalendarPlus
        class="size-4"
        :class="ICON_COLOR.planer"
        aria-hidden="true"
      />
      <span class="text-muted-foreground">Als Nächstes plant</span>
      <span class="flex items-center gap-1.5 font-semibold">
        <span
          class="size-2 rounded-full"
          :style="{ backgroundColor: memberColor(naechster) }"
          aria-hidden="true"
        />
        {{ naechster }}
      </span>
    </div>

    <p class="text-center text-sm text-muted-foreground">
      Fortsetzung folgt … 🍺
    </p>
  </AppPage>
</template>
