<script setup lang="ts">
import { Beer, CalendarDays, CircleDollarSign, Compass, GlassWater, Hash, Martini, Receipt, Scale, Star, Tag, UserPlus, Users, Wallet } from '@lucide/vue'
import type { Visit } from '#shared/types'
import { type FitOptions, fitForms, formatDate, formatScore } from '@/lib/format'

const props = defineProps<{ visit: Visit }>()

const { getAwards, memberPath } = useStammtisch()

const awards = computed(() => getAwards(props.visit))

const EURO: FitOptions = { digits: 2, suffix: '\u00A0€' }
const dash = (n: number | null, opts?: FitOptions): string | string[] => (n == null ? '–' : fitForms(n, opts))

const heads = computed(() => (props.visit.mitglieder ?? 0) + (props.visit.gaeste ?? 0))
const perHead = (n: number | null) => (n != null && heads.value > 0 ? n / heads.value : null)
const raters = computed(() => new Set(Object.values(props.visit.ratings).flatMap(Object.keys)).size)
const planerPath = computed(() => memberPath(props.visit.planer))

const tiles = computed(() => {
  const v = props.visit
  return [
    { label: 'Mitglieder', icon: Users, value: dash(v.mitglieder) },
    { label: 'Gäste', icon: UserPlus, value: dash(v.gaeste) },
    { label: 'Rechnung', icon: Wallet, value: dash(v.rechnung, EURO) },
    { label: '€ pro Kopf', icon: Receipt, value: dash(perHead(v.rechnung), EURO) },
    { label: 'Preis/Leistung', icon: Scale, value: dash(v.averages.preisLeistung, { digits: 2 }), sub: '€ pro Kopf / Gesamt' },
    { label: 'Biere', icon: Beer, value: dash(v.biere) },
    { label: 'Liter Bier', icon: GlassWater, value: dash(v.liter, { digits: 1, suffix: ' L' }) },
    { label: 'Bierpreis', icon: CircleDollarSign, value: dash(v.bierpreis, EURO) },
    { label: 'Kurze', icon: Martini, value: dash(v.kurze) },
    { label: 'Bier pro Kopf', icon: Beer, value: dash(perHead(v.biere), { digits: 1 }) },
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
          v-if="planerPath"
          variant="outline"
          as-child
        >
          <NuxtLink :to="planerPath">
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
        <AwardBadge
          v-for="a in awards"
          :key="a.key"
          :award="a"
        />
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
