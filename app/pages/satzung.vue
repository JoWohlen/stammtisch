<script setup lang="ts">
import { Gavel } from '@lucide/vue'
import { formatDate } from '@/lib/format'
import { SATZUNG } from '@/lib/satzung'

useHead({ title: 'Satzung · Stammtisch-Tracker' })

const cards = SATZUNG
</script>

<template>
  <AppPage
    title="Satzung"
    description="Die Regeln unseres Stammtischs"
  >
    <Card
      v-for="c in cards"
      :key="c.date"
    >
      <CardHeader>
        <CardTitle class="flex items-center gap-2 text-xl">
          <Gavel
            class="size-5 text-muted-foreground"
            aria-hidden="true"
          />
          {{ c.regeln.length > 1 ? `Regeln ${c.regeln[0]!.nr}–${c.regeln.at(-1)!.nr}` : `Regel ${c.regeln[0]!.nr}` }}
        </CardTitle>
        <CardDescription>
          Beschlossen am {{ formatDate(c.date) }}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol class="flex flex-col divide-y">
          <li
            v-for="r in c.regeln"
            :key="r.nr"
            class="flex gap-4 py-3 first:pt-0 last:pb-0"
          >
            <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums">
              {{ r.nr }}
            </span>
            <span class="pt-0.5 leading-relaxed">{{ r.text }}</span>
          </li>
        </ol>
      </CardContent>
    </Card>
  </AppPage>
</template>
