<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
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
/** the headline only names pairs with this many shared evenings, so a newcomer's few nights don't win it */
const HEADLINE_SHARED = 10

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

/** each pair once (upper triangle), for the headline */
const pairs = computed(() => members.flatMap((a, i) => members.slice(i + 1).map((b, j) => ({ a: a.name, b: b.name, ...matrix.value[i]![i + 1 + j]! }))).filter(p => p.r != null && p.n >= HEADLINE_SHARED))
const twins = computed(() => [...pairs.value].sort((x, y) => y.r! - x.r!)[0] ?? null)
const strangers = computed(() => [...pairs.value].sort((x, y) => x.r! - y.r!)[0] ?? null)

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
  if (c.r == null) return `${a} & ${b}: nur ${c.n} gemeinsame Abende, zu wenig für einen Wert`
  return `${a} & ${b}: ${fmt(c.r)} über ${c.n} gemeinsame Abende`
})

/** fullscreen on phones, see FullscreenCard */
const full = ref(false)

/**
 * Fullscreen is landscape: the grid sits left and takes the full height, the switch and details go right.
 * With the fixed fullscreen sizes below (name column 5.5rem, header row 4.5rem) a square grid is
 * about 1rem wider than tall, so the measured height sets its width.
 */
const gridBox = useTemplateRef<HTMLElement>('gridBox')
const { height: gridHeight } = useElementSize(gridBox)
const gridWidth = computed(() => (full.value && gridHeight.value ? `${Math.round(gridHeight.value + 16)}px` : undefined))
</script>

<template>
  <FullscreenCard v-model:full="full">
    <Card :class="full && 'min-h-0 gap-2 py-3 sm:gap-2 sm:py-3'">
      <CardHeader>
        <CardTitle class="text-xl">
          Geschmackszwillinge
        </CardTitle>
        <CardDescription v-if="!full">
          Wie ähnlich bewerten je zwei Mitglieder? Verglichen werden alle Abende, die beide bewertet haben:
          Finden beide dieselben Abende besser oder schlechter, ist der Wert nah an +1.
          Gehen ihre Noten gegeneinander, nah an −1.
        </CardDescription>
        <CardAction>
          <FullscreenButton />
        </CardAction>
      </CardHeader>

      <CardContent
        :class="full ? 'grid min-h-0 flex-1 grid-cols-[auto_minmax(13rem,1fr)] grid-rows-[minmax(0,1fr)] gap-4' : 'flex flex-col gap-4'"
      >
        <ScoreKeyTabs
          v-if="!full"
          v-model="key"
        />

        <p
          v-if="!full && twins && strangers"
          class="text-sm"
        >
          Am ähnlichsten bewerten <span class="font-semibold">{{ twins.a }}</span> und <span class="font-semibold">{{ twins.b }}</span> ({{ fmt(twins.r!) }}),
          am wenigsten <span class="font-semibold">{{ strangers.a }}</span> und <span class="font-semibold">{{ strangers.b }}</span> ({{ fmt(strangers.r!) }}).
        </p>

        <!-- normal: fixed columns that fit a phone; numbers in the cells from sm on, on phones tap a cell.
             fullscreen: fixed sizes (a turned phone still matches the portrait breakpoints), width from the height -->
        <div
          ref="gridBox"
          :class="full && 'h-full min-h-0 overflow-hidden'"
        >
          <table
            class="table-fixed border-separate tabular-nums"
            :class="full ? 'border-spacing-0.5 text-[11px]' : 'w-full border-spacing-px text-[10px] sm:border-spacing-0.5 sm:text-xs'"
            :style="full ? { width: gridWidth } : undefined"
            :aria-label="`Ähnlichkeit der ${scoreKeyLabel(key)}-Bewertungen zwischen allen Mitgliedern`"
            @pointerleave="active = null"
          >
            <colgroup>
              <col :class="full ? 'w-[5.5rem]' : 'w-[4.75rem] sm:w-32'">
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
                  class="overflow-hidden pb-1 align-bottom font-medium"
                  :class="full ? 'h-[4.5rem]' : 'h-16 sm:h-20'"
                >
                  <span
                    class="inline-flex items-center gap-1 truncate [writing-mode:vertical-rl] rotate-180"
                    :class="full ? 'max-h-[4.5rem]' : 'max-h-16 sm:max-h-20'"
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
                  class="text-left font-medium"
                  :class="full ? 'pr-2' : 'pr-1 sm:pr-2'"
                >
                  <NuxtLink
                    :to="`/teilnehmer/${a.slug}`"
                    class="flex min-w-0 items-center gap-1 hover:underline sm:gap-1.5"
                  >
                    <span
                      class="size-2 shrink-0 rounded-full"
                      :style="{ backgroundColor: memberColor(a.name) }"
                      aria-hidden="true"
                    />
                    <span class="truncate">{{ a.name }}</span>
                  </NuxtLink>
                </th>
                <td
                  v-for="(c, j) in matrix[i]"
                  :key="j"
                  class="aspect-square rounded-sm p-0 text-center"
                  :class="[
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
                      :class="full ? '' : 'hidden sm:inline'"
                    >{{ fmt(c.r) }}</span>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- fullscreen: everything else in a side panel next to the grid -->
        <div :class="full ? 'flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto' : 'contents'">
          <ScoreKeyTabs
            v-if="full"
            v-model="key"
          />
          <p
            v-if="full && twins && strangers"
            class="text-sm"
          >
            Am ähnlichsten: <span class="font-semibold">{{ twins.a }}</span> & <span class="font-semibold">{{ twins.b }}</span> ({{ fmt(twins.r!) }})<br>
            am wenigsten: <span class="font-semibold">{{ strangers.a }}</span> & <span class="font-semibold">{{ strangers.b }}</span> ({{ fmt(strangers.r!) }})
          </p>

          <p
            class="min-h-5 text-sm"
            :class="full && 'rounded-md border bg-muted/40 p-2'"
            aria-live="polite"
          >
            {{ activeText ?? 'Tipp oder zeig auf ein Feld für den Wert.' }}
          </p>

          <!-- legend: viridis over the values present -->
          <div class="flex flex-col gap-1 text-xs text-muted-foreground">
            <div class="flex items-center gap-2 tabular-nums">
              <span>{{ fmt(range.lo) }}</span>
              <span
                class="h-2.5 max-w-48 flex-1 rounded-full"
                :style="{ background: VIRIDIS_GRADIENT }"
                aria-hidden="true"
              />
              <span>{{ fmt(range.hi) }}</span>
            </div>
            <span>dunkel = am wenigsten ähnlich, gelb = am ähnlichsten · „·“ = weniger als {{ MIN_SHARED }} gemeinsame Abende</span>
          </div>
        </div>
      </CardContent>
    </Card>
  </FullscreenCard>
</template>
