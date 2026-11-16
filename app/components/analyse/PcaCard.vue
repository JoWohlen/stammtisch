<script setup lang="ts">
import { analysePca } from '@/lib/pca'
import { formatNumber } from '@/lib/format'

const { visits } = useStammtisch()

/** static data → compute once */
const r = analysePca(visits)

const pct = (x: number, digits = 0) => `${formatNumber(x * 100, digits)} %`

const TOP = 5
const top = r.importance.slice(0, TOP)
const topShare = top.reduce((s, i) => s + i.share, 0)
/** bars relative to the largest score, so differences stay visible */
const maxShare = top[0]!.share
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-xl">
        Die {{ TOP }} wichtigsten Merkmale
      </CardTitle>
      <CardDescription>
        Worin unterscheiden sich unsere Stammtische am meisten? Je höher der Prozentwert, desto stärker
        prägt das Merkmal, wie ein Abend im Vergleich zu den anderen ausfällt. Alle {{ r.importance.length }}
        Merkmale zusammen ergeben 100 %.
      </CardDescription>
    </CardHeader>

    <CardContent class="flex flex-col gap-3">
      <p class="text-sm text-muted-foreground">
        Diese {{ TOP }} machen zusammen <span class="font-medium text-foreground tabular-nums">{{ pct(topShare) }}</span> aus.
      </p>
      <ol class="flex flex-col gap-2">
        <li
          v-for="(i, idx) in top"
          :key="i.feature.key"
          class="grid grid-cols-[1.25rem_7rem_1fr_3.5rem] items-center gap-2 text-sm"
        >
          <span class="text-xs text-muted-foreground tabular-nums">{{ idx + 1 }}.</span>
          <span class="font-medium">{{ i.feature.label }}</span>
          <span class="h-2 overflow-hidden rounded-full bg-muted">
            <span
              class="block h-full rounded-full bg-primary"
              :style="{ width: `${(i.share / maxShare) * 100}%` }"
            />
          </span>
          <span class="text-right tabular-nums">{{ pct(i.share, 1) }}</span>
        </li>
      </ol>
      <p class="text-xs text-muted-foreground">
        Übrige: {{ r.importance.slice(TOP).map(i => `${i.feature.label} ${pct(i.share, 1)}`).join(' · ') }}
      </p>
      <p class="text-xs text-muted-foreground">
        Ausgewertet über alle {{ r.samples }} Besuche mit einer Hauptkomponentenanalyse (PCA).
      </p>
    </CardContent>
  </Card>
</template>
