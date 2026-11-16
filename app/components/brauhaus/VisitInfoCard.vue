<script setup lang="ts">
import { Beer, CalendarDays, CircleDollarSign, Compass, GlassWater, Hash, Martini, Receipt, Scale, Star, Tag, UserPlus, Users, Wallet } from '@lucide/vue'
import type { Visit } from '#shared/types'
import { formatDate, formatEuro, formatNumber, formatScore } from '@/lib/format'

const props = defineProps<{ visit: Visit }>()

const { participants, getAwards } = useStammtisch()

const awards = computed(() => getAwards(props.visit))
const TONE = {
  good: 'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200',
  bad: 'border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200',
  neutral: 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200',
}

const dash = (n: number | null, f: (x: number) => string = x => formatNumber(x)) => (n == null ? '–' : f(n))

const heads = computed(() => (props.visit.mitglieder ?? 0) + (props.visit.gaeste ?? 0))
const perHead = (n: number | null) => (n != null && heads.value > 0 ? n / heads.value : null)
const raters = computed(() => new Set(Object.values(props.visit.ratings).flatMap(Object.keys)).size)
const planerSlug = computed(() => participants.find(p => p.name === props.visit.planer)?.slug ?? null)

const tiles = computed(() => {
  const v = props.visit
  return [
    { label: 'Mitglieder', icon: Users, value: dash(v.mitglieder) },
    { label: 'Gäste', icon: UserPlus, value: dash(v.gaeste) },
    { label: 'Rechnung', icon: Wallet, value: dash(v.rechnung, x => formatEuro(x, true)) },
    { label: '€ pro Kopf', icon: Receipt, value: dash(perHead(v.rechnung), x => formatEuro(x, true)) },
    { label: 'Preis/Leistung', icon: Scale, value: dash(v.averages.preisLeistung, x => formatNumber(x, 2)), sub: '€ pro Kopf / Gesamt' },
    { label: 'Biere', icon: Beer, value: dash(v.biere) },
    { label: 'Liter Bier', icon: GlassWater, value: dash(v.liter, x => `${formatNumber(x, 1)} L`) },
    { label: 'Bierpreis', icon: CircleDollarSign, value: dash(v.bierpreis, x => formatEuro(x, true)) },
    { label: 'Kurze', icon: Martini, value: dash(v.kurze) },
    { label: 'Biere pro Kopf', icon: Beer, value: dash(perHead(v.biere), x => formatNumber(x, 1)) },
  ]
})
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-xl">
        Der Abend
      </CardTitle>
      <CardDescription class="flex flex-wrap gap-2 pt-1">
        <Badge variant="outline">
          <CalendarDays /> {{ formatDate(visit.date) }}
        </Badge>
        <Badge variant="outline">
          <Hash /> Besuch Nr. {{ visit.nr }}
        </Badge>
        <Badge
          v-if="visit.planer && planerSlug"
          variant="outline"
          as-child
        >
          <NuxtLink :to="`/teilnehmer/${planerSlug}`">
            <Compass /> Planer: {{ visit.planer }}
          </NuxtLink>
        </Badge>
        <Badge
          v-else
          variant="outline"
        >
          <Compass /> Planer: {{ visit.planer ?? '–' }}
        </Badge>
        <Badge variant="outline">
          <Tag /> {{ visit.bier ?? '–' }}
        </Badge>
        <Badge variant="outline">
          <Star /> {{ raters }} Bewertungen · Ø {{ formatScore(visit.averages.gesamt) }}
        </Badge>
        <Badge
          v-for="a in awards"
          :key="a.key"
          variant="outline"
          :class="TONE[a.tone]"
          :title="a.hint"
        >
          <component :is="a.icon" /> {{ a.label }}
        </Badge>
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          v-for="t in tiles"
          :key="t.label"
          v-bind="t"
        />
      </div>
    </CardContent>
  </Card>
</template>
