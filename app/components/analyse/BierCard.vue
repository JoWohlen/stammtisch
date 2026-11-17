<script setup lang="ts">
import type { Visit } from '#shared/types'
import { formatNumber } from '@/lib/format'
import { groupBy, mean } from '@/lib/stats'

const { visits } = useStammtisch()

const withLiter = visits.filter((v): v is Visit & { liter: number } => v.liter != null)

/** Per beer: mean liters over every visit (A, B, A = 3 visits, each weighs the same). */
const rows = [...groupBy(withLiter, v => v.bier).entries()]
  .map(([bier, vs]) => ({ bier, besuche: vs.length, liter: mean(vs.map(v => v.liter)) }))
  .sort((a, b) => b.liter - a.liter)
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-xl">
        Biersorten
      </CardTitle>
      <CardDescription>
        Wie viel Liter trinken wir im Schnitt an einem Abend, je nachdem welches Bier ausgeschenkt wird?
        Angaben in Ø Liter pro Abend. Jeder Besuch zählt, auch wenn wir mehrmals im selben Brauhaus waren.
      </CardDescription>
    </CardHeader>

    <CardContent>
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
