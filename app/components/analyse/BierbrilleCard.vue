<script setup lang="ts">
import { linearFit, type ScoreKey, scoreKeyLabel } from '@/lib/analysis'
import { formatDate, formatNumber, formatScore, formatUpTo1 } from '@/lib/format'
import { heads } from '@/lib/stats'
import type { ScatterPoint } from '@/lib/chart'

/** Bierbrille: liters per head (x) against the group's score (y), one dot per evening. */
const { visits } = useStammtisch()
const key = ref<ScoreKey>('gesamt')

const points = computed<ScatterPoint[]>(() => visits.flatMap((v) => {
  const y = v.averages[key.value]
  if (v.liter == null || !heads(v) || y == null) return []
  const x = v.liter / heads(v)
  return [{
    key: v.nr,
    x,
    y,
    title: v.brauhaus,
    lines: [formatDate(v.date), `${formatUpTo1(x)} L pro Kopf · ${scoreKeyLabel(key.value)} ${formatScore(y)}`],
    to: `/brauhaus/${v.slug}?besuch=${v.nr}`,
  }]
}))

const fit = computed(() => linearFit(points.value.map(p => p.x), points.value.map(p => p.y)))

/** plain-language strength of the link */
const verdict = computed(() => {
  const r = fit.value?.r
  if (r == null) return null
  const a = Math.abs(r)
  const strength = a < 0.1 ? 'praktisch keinen' : a < 0.3 ? 'einen schwachen' : a < 0.5 ? 'einen mittleren' : 'einen deutlichen'
  const dir = a < 0.1 ? '' : r > 0 ? ': je mehr Bier, desto besser die Note' : ': je mehr Bier, desto schlechter die Note'
  return { r, text: `${strength} Zusammenhang${dir}` }
})
/** score change per extra liter per head */
const perLiter = computed(() => (fit.value ? fit.value.slope : null))

const detail = computed(() => [
  verdict.value && `r = ${signed(verdict.value.r)}`,
  perLiter.value != null && `${signed(perLiter.value)} Punkte pro zusätzlichem Liter`,
].filter(Boolean).join(', '))

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${formatNumber(Math.abs(n), 2)}`

/** fullscreen on phones, see FullscreenCard */
const full = ref(false)
</script>

<template>
  <FullscreenCard v-model:full="full">
    <Card :class="full && 'min-h-0 gap-2 py-3 sm:gap-2 sm:py-3'">
      <CardHeader>
        <CardTitle class="text-xl">
          Bierbrille
        </CardTitle>
        <CardDescription v-if="!full">
          Bewerten wir einen Abend besser, je mehr wir getrunken haben? Ein Punkt pro Besuch:
          Liter Bier pro Kopf gegen die Ø Bewertung der Runde, die gestrichelte Linie ist der Trend.
        </CardDescription>
        <CardAction class="flex items-center gap-2">
          <ScoreKeyTabs
            v-if="full"
            v-model="key"
          />
          <FullscreenButton />
        </CardAction>
      </CardHeader>

      <CardContent
        class="flex flex-col gap-4"
        :class="full && 'min-h-0 flex-1'"
      >
        <ScoreKeyTabs
          v-if="!full"
          v-model="key"
        />

        <p
          v-if="!full && verdict"
          class="text-sm"
        >
          Es gibt <span class="font-semibold">{{ verdict.text }}</span> ({{ detail }}).
        </p>

        <AnalyseScatterChart
          :points="points"
          :x-format="x => `${formatUpTo1(x)} L`"
          :y-format="formatScore"
          x-label="Liter Bier pro Kopf"
          :y-label="`Ø ${scoreKeyLabel(key)}`"
          :full="full"
          :label="`Liter Bier pro Kopf gegen die ${scoreKeyLabel(key)}-Bewertung, ${points.length} Besuche`"
        />

        <p
          v-if="!full"
          class="text-xs text-muted-foreground"
        >
          r reicht von −1 bis +1, nah an 0 = kein Zusammenhang. Bei {{ points.length }} Abenden eher Tendenz als Beweis,
          und ein Zusammenhang sagt nicht, was die Ursache ist: Vielleicht trinken wir an guten Abenden einfach mehr.
        </p>
      </CardContent>
    </Card>
  </FullscreenCard>
</template>
