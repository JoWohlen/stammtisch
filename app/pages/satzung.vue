<script setup lang="ts">
import { Gavel } from '@lucide/vue'
import { formatDate } from '@/lib/format'

useHead({ title: 'Satzung · Stammtisch-Tracker' })

/** numbered across all resolutions (rule 7 refers back to rule 1) */
const BESCHLUESSE: { date: string, regeln: string[] }[] = [
  {
    date: '2025-07-12',
    regeln: [
      'Wer nach 3 Werktagen seine Schulden nicht zahlt, gibt eine Runde aus.',
      'Wer reserviert, zahlt.',
      'Wer 3-mal in Folge kommt, darf bewerten, muss aber auch zahlen und reservieren.',
      'Wer selbst verschuldet vergisst zu reservieren, zahlt beim nächsten Mal allen Alkohol.',
      'Der Alkohol wird unter allen Alkoholtrinkern aufgeteilt.',
      'Das Trinkgeld wird unter allen geteilt und vom Reservierer bestimmt.',
      'Wer zahlt, ist verantwortlich, die Rechnung zu zahlen, zu posten und auszurechnen. Ab dann zählt Regel 1.',
      'Gründungsmitglieder: Tim, Simon, Jan, Kevin, Mathieu, Lucas und Johannes.',
    ],
  },
  {
    date: '2026-02-28',
    regeln: [
      'Flo wird am 28.02.2026 aufgenommen.',
      'Neue Regeln können einstimmig beim neuen Stammtisch von allen vorhandenen Mitgliedern beschlossen werden.',
      'Regeln zu einzelnen Mitgliedern sind nicht erlaubt.',
      'Wer zu wenig überweist, muss eine Runde Bier ausgeben und natürlich den ausstehenden Rest begleichen.',
    ],
  },
  {
    date: '2026-10-31',
    regeln: [
      'Zum 31.10.2026 nehmen wir Johannes Jr. auf.',
    ],
  },
]

const cards = BESCHLUESSE.reduce<{ date: string, regeln: { nr: number, text: string }[] }[]>((acc, b) => {
  const start = acc.reduce((n, c) => n + c.regeln.length, 1)
  return [...acc, { date: b.date, regeln: b.regeln.map((text, i) => ({ nr: start + i, text })) }]
}, [])
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
