<script setup lang="ts">
import type { Visit } from '#shared/types'
import { formatNumber } from '@/lib/format'
import { groupBy, heads, mean } from '@/lib/stats'

const { visits } = useStammtisch()

/** 'absolut' = the whole table per evening */
type Mode = 'absolut' | 'person'
const MODES: { key: Mode, label: string }[] = [
  { key: 'absolut', label: 'Pro Abend' },
  { key: 'person', label: 'Pro Person' },
]
const mode = ref<Mode>('absolut')

const withLiter = visits.filter((v): v is Visit & { liter: number } => v.liter != null)

/**
 * Per beer: mean liters over every visit (A, B, A = 3 visits, each weighs the same),
 * either for the whole table or per head (Mitglieder + Gäste; visits without a head count are left out).
 */
const rows = computed(() => [...groupBy(withLiter, v => v.bier).entries()]
  .map(([bier, vs]) => {
    const xs = mode.value === 'absolut'
      ? vs.map(v => v.liter)
      : vs.filter(v => heads(v) > 0).map(v => v.liter / heads(v))
    return { bier, besuche: xs.length, liter: xs.length ? mean(xs) : null }
  })
  .filter((r): r is typeof r & { liter: number } => r.liter != null)
  .sort((a, b) => b.liter - a.liter))
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-xl">
        Biersorten
      </CardTitle>
      <CardDescription>
        Wie viel Liter trinken wir im Schnitt an einem Abend, je nachdem welches Bier ausgeschenkt wird?
        Angaben in Ø Liter {{ mode === 'absolut' ? 'pro Abend (ganze Runde)' : 'pro Person und Abend' }}.
        Jeder Besuch zählt, auch wenn wir mehrmals im selben Brauhaus waren.
      </CardDescription>
    </CardHeader>

    <CardContent class="flex flex-col gap-4">
      <Tabs
        v-model="mode"
        class="self-end"
      >
        <TabsList aria-label="Liter zählen">
          <TabsTrigger
            v-for="m in MODES"
            :key="m.key"
            :value="m.key"
            class="px-3"
          >
            {{ m.label }}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <!-- 12 beers → 2 rows of 6 on wide screens -->
      <ol class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <li
          v-for="r in rows"
          :key="r.bier"
          class="flex flex-col gap-1 rounded-lg border p-3"
        >
          <span class="text-sm font-medium">{{ r.bier }}</span>
          <span class="text-2xl font-semibold tabular-nums">{{ formatNumber(r.liter, 1) }} l</span>
          <span class="text-xs text-muted-foreground">
            {{ r.besuche }} {{ r.besuche === 1 ? 'Besuch' : 'Besuche' }}
          </span>
        </li>
      </ol>
    </CardContent>
  </Card>
</template>
