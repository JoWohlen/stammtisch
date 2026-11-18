<script setup lang="ts">
import { Beer, CalendarDays, ChartLine, ChevronRight, Crown, GlassWater, Handshake, MapPin, ScrollText, Search, Trophy, Users, Utensils, Wallet } from '@lucide/vue'
import { fitForms, formatDate, formatEuro, formatNumber, formatScore } from '@/lib/format'

const { overviewStats: s } = useStammtisch()
const EURO = '\u00A0€'
const perVisit = (n: number) => n / Math.max(s.besuche, 1)

const tiles = [
  { label: 'Besuche', icon: CalendarDays, value: formatNumber(s.besuche), sub: s.ersterBesuch ? `seit ${formatDate(s.ersterBesuch)}` : undefined },
  { label: 'Teilnehmer', icon: Users, value: formatNumber(s.teilnehmer), sub: 'Personen mit Bewertung' },
  { label: 'Biere gesamt', icon: Beer, value: fitForms(s.biere), sub: `Ø ${formatNumber(perVisit(s.biere), 1)} pro Abend` },
  { label: 'Liter Bier', icon: GlassWater, value: fitForms(s.liter, { digits: 1, suffix: ' L' }), sub: `Ø ${formatNumber(perVisit(s.liter), 1)} L pro Abend` },
  { label: 'Gesamtkosten', icon: Wallet, value: fitForms(s.kosten, { suffix: EURO }), sub: `Ø ${formatEuro(perVisit(s.kosten))} pro Abend` },
]

const b = s.bestesBrauhaus
const categories = b
  ? [
      { label: 'Location', icon: MapPin, value: b.location },
      { label: 'Service', icon: Handshake, value: b.service },
      { label: 'Essen/Trinken', icon: Utensils, value: b.essen },
    ]
  : []
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-xl whitespace-nowrap sm:text-2xl">
        Auf einen Blick
      </CardTitle>
      <CardDescription
        v-if="s.ersterBesuch && s.letzterBesuch"
        class="max-sm:col-start-1"
      >
        {{ formatDate(s.ersterBesuch) }} – {{ formatDate(s.letzterBesuch) }}<span class="max-sm:hidden"> · </span>
        <span class="max-sm:block">{{ s.besuche }} Stammtische</span>
      </CardDescription>
      <CardAction class="flex flex-wrap justify-end gap-2 max-sm:col-start-1 max-sm:row-span-1 max-sm:row-start-3 max-sm:mt-2 max-sm:grid max-sm:grid-cols-3 max-sm:justify-self-stretch">
        <NuxtLink
          to="/suche"
          class="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 max-sm:gap-1.5 max-sm:px-2 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
        >
          <Search
            class="size-4"
            aria-hidden="true"
          />
          Suche
        </NuxtLink>
        <NuxtLink
          to="/satzung"
          class="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 max-sm:gap-1.5 max-sm:px-2 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
        >
          <ScrollText
            class="size-4"
            aria-hidden="true"
          />
          Satzung
        </NuxtLink>
        <NuxtLink
          to="/analyse"
          class="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 max-sm:gap-1.5 max-sm:px-2 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
        >
          <ChartLine
            class="size-4"
            aria-hidden="true"
          />
          Analyse
          <ChevronRight
            class="size-4 max-sm:hidden"
            aria-hidden="true"
          />
        </NuxtLink>
      </CardAction>
    </CardHeader>

    <CardContent class="flex flex-col gap-6">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          v-for="(t, i) in tiles"
          :key="t.label"
          v-bind="t"
          :class="i === tiles.length - 1 ? 'col-span-2 sm:col-span-1' : ''"
        />
      </div>

      <Separator />

      <div class="grid gap-3 md:grid-cols-2">
        <NuxtLink
          v-if="b"
          :to="`/brauhaus/${b.slug}?besuch=${b.nr}`"
          class="group flex flex-col gap-3 rounded-lg border-2 border-amber-400 bg-amber-50 p-4 transition-colors hover:bg-amber-100 dark:border-amber-500/60 dark:bg-amber-500/10 dark:hover:bg-amber-500/15"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex flex-col gap-1">
              <span class="flex items-center gap-2 text-sm text-muted-foreground">
                <Trophy
                  class="size-4 text-amber-500"
                  aria-hidden="true"
                />
                Bestes Brauhaus
              </span>
              <span class="text-2xl font-semibold tracking-tight">{{ b.name }}</span>
            </div>
            <Badge
              variant="outline"
              class="bg-background text-sm tabular-nums"
            >
              {{ formatScore(b.gesamt) }} / 5
            </Badge>
          </div>
          <div class="grid flex-1 grid-cols-3 gap-2">
            <div
              v-for="c in categories"
              :key="c.label"
              class="flex flex-col justify-center rounded-md border border-amber-300 bg-background px-2.5 py-1.5 dark:border-amber-500/40"
            >
              <span class="flex items-center gap-1 truncate text-xs text-muted-foreground">
                <component
                  :is="c.icon"
                  class="size-3 shrink-0"
                  aria-hidden="true"
                />
                {{ c.label }}
              </span>
              <span class="text-lg font-semibold tabular-nums">{{ formatScore(c.value) }}</span>
            </div>
          </div>
          <span class="flex items-center gap-1 text-xs text-muted-foreground">
            Bester Abend · {{ formatDate(b.date) }}
            <ChevronRight
              class="size-3 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </NuxtLink>

        <NuxtLink
          v-if="s.besterPlaner"
          :to="`/teilnehmer/${s.besterPlaner.slug}`"
          class="group flex flex-col gap-3 rounded-lg border-2 border-violet-400 bg-violet-50 p-4 transition-colors hover:bg-violet-100 dark:border-violet-500/60 dark:bg-violet-500/10 dark:hover:bg-violet-500/15"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex flex-col gap-1">
              <span class="flex items-center gap-2 text-sm text-muted-foreground">
                <Crown
                  class="size-4 text-violet-500"
                  aria-hidden="true"
                />
                Bester Planer
              </span>
              <span class="text-2xl font-semibold tracking-tight">{{ s.besterPlaner.name }}</span>
            </div>
            <Badge
              variant="outline"
              class="bg-background text-sm tabular-nums"
            >
              {{ formatScore(s.besterPlaner.gesamt) }} / 5
            </Badge>
          </div>
          <ol class="flex flex-1 flex-col divide-y divide-violet-200 rounded-md border border-violet-300 bg-background dark:divide-violet-500/20 dark:border-violet-500/40">
            <li
              v-for="(v, i) in s.besterPlaner.topBesuche"
              :key="v.slug + v.date"
              class="flex flex-1 items-center gap-2 px-2.5 py-1"
            >
              <span class="w-4 shrink-0 text-xs font-semibold text-violet-600 tabular-nums dark:text-violet-300">{{ i + 1 }}.</span>
              <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ v.brauhaus }}</span>
              <span class="hidden text-xs text-muted-foreground sm:inline">{{ formatDate(v.date) }}</span>
              <span class="text-sm font-semibold tabular-nums">{{ formatScore(v.gesamt) }}</span>
            </li>
          </ol>
          <span class="flex items-center gap-1 text-xs text-muted-foreground">
            Ø Gesamt aus {{ s.besterPlaner.besuche }} geplanten {{ s.besterPlaner.besuche === 1 ? 'Abend' : 'Abenden' }}
            <ChevronRight
              class="size-3 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </NuxtLink>
      </div>
    </CardContent>
  </Card>
</template>
