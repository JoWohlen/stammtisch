<script setup lang="ts">
import { pearson, type ScoreKey, scoreKeyLabel, vote } from '@/lib/analysis'
import { formatNumber } from '@/lib/format'
import { memberColor } from '@/lib/members'

/**
 * Geschmackszwillinge: for every pair of members, how alike their votes go up and down
 * over the evenings both rated (Pearson r). +1 = always the same tendency, 0 = unrelated, −1 = opposite.
 */
const { visits, participants } = useStammtisch()
const key = ref<ScoreKey>('gesamt')

/** fewer shared evenings than this → no value, the correlation would be noise */
const MIN_SHARED = 5

const members = participants

const matrix = computed(() => members.map(a => members.map((b) => {
  if (a.name === b.name) return { r: null, n: 0, self: true }
  const pairs = visits.flatMap((v) => {
    const x = vote(v, a.name, key.value)
    const y = vote(v, b.name, key.value)
    return x != null && y != null ? [[x, y] as const] : []
  })
  const r = pairs.length >= MIN_SHARED ? pearson(pairs.map(p => p[0]), pairs.map(p => p[1])) : null
  return { r, n: pairs.length, self: false }
})))

/** viridis (perceptually even, colour-blind safe), dark purple → teal → yellow */
const VIRIDIS = ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725']
const hex = (h: string) => [1, 3, 5].map(i => Number.parseInt(h.slice(i, i + 2), 16))
function viridis(t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (VIRIDIS.length - 1)
  const i = Math.min(VIRIDIS.length - 2, Math.floor(x))
  const a = hex(VIRIDIS[i]!)
  const b = hex(VIRIDIS[i + 1]!)
  const f = x - i
  return `rgb(${a.map((c, k) => Math.round(c + (b[k]! - c) * f)).join(' ')})`
}
const VIRIDIS_GRADIENT = `linear-gradient(to right, ${VIRIDIS.join(', ')})`

/** the scale spans the values present in the chosen category, so differences stay visible */
const range = computed(() => {
  const rs = matrix.value.flat().map(c => c.r).filter((r): r is number => r != null)
  return rs.length ? { lo: Math.min(...rs), hi: Math.max(...rs) } : { lo: 0, hi: 1 }
})
const pos = (r: number) => (r - range.value.lo) / (range.value.hi - range.value.lo || 1)
const cellBg = (r: number | null) => (r == null ? 'transparent' : viridis(pos(r)))
/** the dark (purple/blue) half takes white text, the light (green/yellow) half black */
const cellText = (r: number | null) => (r == null ? 'text-muted-foreground' : pos(r) < 0.55 ? 'text-white' : 'text-black')

const fmt = (r: number) => `${r < 0 ? '−' : ''}${formatNumber(Math.abs(r), 2)}`

const active = ref<{ i: number, j: number } | null>(null)
const activeText = computed(() => {
  if (!active.value) return null
  const { i, j } = active.value
  const c = matrix.value[i]![j]!
  const a = members[i]!.name
  const b = members[j]!.name
  if (c.self) return null
  if (c.r == null) return { pair: `${a} & ${b}`, text: 'zu selten zusammen da', extra: `${c.n} Abende zusammen` }
  return { pair: `${a} & ${b}`, text: describe(c.r), extra: [standing(c.r), `${c.n} Abende zusammen`].filter(Boolean).join(' · ') }
})

/** the correlation in a few plain words */
function describe(r: number): string {
  if (r >= 0.7) return 'fast gleicher Geschmack'
  if (r >= 0.5) return 'sehr ähnlicher Geschmack'
  if (r >= 0.3) return 'eher ähnlicher Geschmack'
  if (r >= 0.1) return 'kaum ähnlich'
  if (r > -0.1) return 'kein Zusammenhang'
  if (r > -0.3) return 'eher unterschiedlich'
  return 'gegensätzlicher Geschmack'
}

/** where the pair stands among all pairs with a value, in this category */
function standing(r: number): string {
  const all = matrix.value.flatMap((row, i) => row.slice(i + 1)).map(c => c.r).filter((x): x is number => x != null)
  if (all.length < 5) return ''
  const share = all.filter(x => x > r).length / all.length
  if (share < 0.15) return 'eins der ähnlichsten Paare'
  if (share > 0.85) return 'eins der unähnlichsten Paare'
  return ''
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-xl">
        Geschmackszwillinge
      </CardTitle>
      <CardDescription>
        Wie ähnlich bewerten je zwei Mitglieder?
        Finden beide dieselben Abende besser oder schlechter, ist der Wert nah an +1.
        Gehen ihre Noten gegeneinander, nah an −1.
      </CardDescription>
    </CardHeader>

    <CardContent class="flex flex-col gap-4">
      <AnalyseScoreKeyTabs
        v-model="key"
        stretch="mobile"
      />
      <!-- color scale -->
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <span>unähnlich</span>
        <span
          class="h-2.5 flex-1 rounded-full"
          :style="{ background: VIRIDIS_GRADIENT }"
          aria-hidden="true"
        />
        <span>ähnlich</span>
      </div>

      <!-- fixed columns that fit a phone; numbers in the cells from sm on, on phones tap a cell -->
      <div>
        <table
          class="table-fixed border-separate tabular-nums w-full select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] border-spacing-px text-[10px] sm:border-spacing-0.5 sm:text-xs"
          :aria-label="`Ähnlichkeit der ${scoreKeyLabel(key)}-Bewertungen zwischen allen Mitgliedern`"
          @pointerleave="active = null"
        >
          <colgroup>
            <col class="w-[4.75rem] sm:w-32">
            <col
              v-for="m in members"
              :key="m.slug"
            >
          </colgroup>
          <thead>
            <tr>
              <th />
              <th
                v-for="m in members"
                :key="m.slug"
                scope="col"
                class="overflow-hidden pb-1 align-bottom font-medium h-16 sm:h-20"
              >
                <span
                  class="inline-flex items-center gap-1 truncate [writing-mode:vertical-rl] rotate-180 max-h-16 sm:max-h-20"
                >
                  <span
                    class="size-2 rounded-full"
                    :style="{ backgroundColor: memberColor(m.name) }"
                    aria-hidden="true"
                  />
                  {{ m.name }}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(a, i) in members"
              :key="a.slug"
            >
              <th
                scope="row"
                class="text-left font-medium pr-1 sm:pr-2"
              >
                <div class="flex min-w-0 items-center gap-1 sm:gap-1.5">
                  <span
                    class="size-2 shrink-0 rounded-full"
                    :style="{ backgroundColor: memberColor(a.name) }"
                    aria-hidden="true"
                  />
                  <span class="truncate">{{ a.name }}</span>
                </div>
              </th>
              <td
                v-for="(c, j) in matrix[i]"
                :key="j"
                class="rounded-sm p-0 text-center"
                :class="[
                  'aspect-square',
                  c.self ? 'bg-muted/40' : cellText(c.r),
                  active && active.i === i && active.j === j && !c.self ? 'ring-2 ring-foreground' : '',
                ]"
                :style="c.self ? undefined : { backgroundColor: cellBg(c.r) }"
                :title="c.self ? undefined : (c.r == null ? `${a.name} & ${members[j]!.name}: zu wenig gemeinsame Abende (${c.n})` : `${a.name} & ${members[j]!.name}: ${fmt(c.r)} (${c.n} Abende)`)"
                @pointerenter="active = { i, j }"
                @click="active = { i, j }"
              >
                <template v-if="!c.self">
                  <span
                    v-if="c.r == null"
                    aria-hidden="true"
                  >·</span>
                  <span
                    v-else
                    class="hidden sm:inline"
                  >{{ fmt(c.r) }}</span>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        class="min-h-16 rounded-md border bg-muted/40 px-3 py-2 text-sm"
        aria-live="polite"
      >
        <template v-if="activeText">
          <div class="text-xs text-muted-foreground">
            {{ activeText.pair }}
          </div>
          <div class="font-semibold">
            {{ activeText.text }}
          </div>
          <div class="text-xs text-muted-foreground">
            {{ activeText.extra }}
          </div>
        </template>
        <span
          v-else
          class="text-muted-foreground"
        >Tipp auf ein Feld.</span>
      </div>
    </CardContent>
  </Card>
</template>
