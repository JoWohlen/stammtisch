<script setup lang="ts">
import { formatNumber, formatUpTo1 } from '@/lib/format'
import { memberColor } from '@/lib/members'
import { computePlanerBias } from '@/lib/planer-bias'

const { visits, participants } = useStammtisch()

const rows = computePlanerBias(visits, participants)

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${formatNumber(Math.abs(n), 2)}`

/** axis from −0,5 (further only if someone is below that) up to the highest value, in 0,5 steps */
const TICK = 0.5
const values = rows.flatMap(r => [r.geplant, r.fremd])
const MIN = Math.min(-TICK, Math.floor(Math.min(...values) / TICK) * TICK)
const MAX = Math.max(TICK, Math.ceil(Math.max(...values) / TICK) * TICK)
const ticks = Array.from({ length: Math.round((MAX - MIN) / TICK) + 1 }, (_, i) => MIN + i * TICK)
const tickLabel = (t: number) => (t === 0 ? '0' : `${t > 0 ? '+' : '−'}${formatUpTo1(Math.abs(t))}`)
const pos = (n: number) => `${((n - MIN) / (MAX - MIN)) * 100}%`

/** below this many planned evenings a single night decides the value → faded, never the headline */
const MIN_N = 3
const top = rows.find(r => r.geplantN >= MIN_N)

const abende = (n: number) => `${n} ${n === 1 ? 'Abend' : 'Abende'}`
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-xl">
        Eigenlob
      </CardTitle>
      <CardDescription>
        Bewertet jemand die Abende, die man selbst geplant hat, anders als die übrigen?
        Jede Stimme zählt relativ zum Ø der anderen am selben Abend, damit die Qualität des Brauhauses herausfällt.
        Der Bonus ist der Abstand zwischen den beiden Punkten.
      </CardDescription>
    </CardHeader>

    <CardContent class="flex flex-col gap-4">
      <p
        v-if="top && top.bonus > 0"
        class="text-sm"
      >
        Am meisten Eigenlob verteilt <span class="font-semibold">{{ top.name }}</span>:
        die eigenen Abende bekommen {{ signed(top.geplant) }} gegenüber dem Rest der Gruppe, fremde {{ signed(top.fremd) }}.
      </p>

      <!-- legend -->
      <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span class="inline-flex items-center gap-1.5">
          <span class="size-2.5 rounded-full border-2 border-muted-foreground bg-card" /> fremd geplant
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="size-2.5 rounded-full bg-foreground" /> selbst geplant
        </span>
      </div>

      <ol class="flex flex-col gap-3">
        <li
          v-for="r in rows"
          :key="r.name"
          class="grid grid-cols-[5.5rem_1fr_4rem] items-center gap-3 sm:grid-cols-[8rem_1fr_5rem]"
          :class="r.geplantN < MIN_N ? 'opacity-50' : ''"
        >
          <NuxtLink
            :to="`/teilnehmer/${r.slug}`"
            class="flex flex-col truncate text-sm font-medium hover:underline"
          >
            {{ r.name }}
            <span
              class="text-xs font-normal text-muted-foreground"
              :title="r.geplantN < r.geplantTotal ? `${abende(r.geplantTotal - r.geplantN)} selbst nicht bewertet` : undefined"
            >
              {{ r.geplantTotal }} geplant<template v-if="r.geplantN < r.geplantTotal"> · {{ r.geplantN }} bewertet</template>
            </span>
          </NuxtLink>

          <div
            class="relative h-6"
            :aria-label="`${r.name}: eigene Abende ${signed(r.geplant)}, fremde ${signed(r.fremd)}`"
            role="img"
          >
            <div
              class="absolute inset-y-0 w-px bg-muted-foreground/50"
              :style="{ left: pos(0) }"
            />
            <div class="absolute inset-x-0 top-1/2 h-px bg-border" />
            <div
              class="absolute top-1/2 h-1 -translate-y-1/2 rounded-full opacity-40"
              :style="{
                left: pos(Math.min(r.geplant, r.fremd)),
                width: `calc(${pos(Math.max(r.geplant, r.fremd))} - ${pos(Math.min(r.geplant, r.fremd))})`,
                background: memberColor(r.name),
              }"
            />
            <span
              class="absolute top-1/2 size-3 -translate-1/2 rounded-full border-2 bg-card"
              :style="{ left: pos(r.fremd), borderColor: memberColor(r.name) }"
              :title="`fremd geplant: ${signed(r.fremd)} (${abende(r.fremdN)})`"
            />
            <span
              class="absolute top-1/2 size-3.5 -translate-1/2 rounded-full"
              :style="{ left: pos(r.geplant), background: memberColor(r.name) }"
              :title="`selbst geplant: ${signed(r.geplant)} (${abende(r.geplantN)})`"
            />
          </div>

          <div class="text-right">
            <div
              class="text-sm font-semibold tabular-nums"
              :class="r.bonus < 0 ? 'text-muted-foreground' : ''"
            >
              {{ signed(r.bonus) }}
            </div>
            <div class="text-xs text-muted-foreground">
              Bonus
            </div>
          </div>
        </li>
      </ol>

      <!-- axis -->
      <div class="grid grid-cols-[5.5rem_1fr_4rem] gap-3 sm:grid-cols-[8rem_1fr_5rem]">
        <div class="relative col-start-2 h-4 text-[11px] text-muted-foreground tabular-nums">
          <span
            v-for="t in ticks"
            :key="t"
            class="absolute -translate-x-1/2"
            :style="{ left: pos(t) }"
          >{{ tickLabel(t) }}</span>
        </div>
      </div>

      <p class="text-xs text-muted-foreground">
        Abweichung in Punkten von der Gruppe · rechts von 0 = großzügiger als die anderen.
        Gezählt werden nur Abende, die man selbst bewertet hat.
        Jeder hat nur wenige Abende geplant, also eher Tendenz als Beweis · blass = weniger als {{ MIN_N }} bewertete eigene Abende.
      </p>
    </CardContent>
  </Card>
</template>
