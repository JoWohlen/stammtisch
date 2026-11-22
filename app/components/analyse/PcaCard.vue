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
        Was macht einen Abend anders als die anderen? Manche Dinge sind fast jedes Mal gleich,
        andere schwanken stark von Abend zu Abend. Je länger der Balken, desto mehr unterscheiden sich
        unsere Stammtische genau darin.
      </CardDescription>
    </CardHeader>

    <CardContent class="flex flex-col gap-3">
      <p class="text-sm text-muted-foreground">
        Diese {{ TOP }} erklären zusammen <span class="font-medium text-foreground tabular-nums">{{ pct(topShare) }}</span> davon, wie unterschiedlich unsere Abende sind.
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
        Weniger wichtig: {{ r.importance.slice(TOP).map(i => `${i.feature.label} ${pct(i.share, 1)}`).join(' · ') }}
      </p>
    </CardContent>
  </Card>
</template>
