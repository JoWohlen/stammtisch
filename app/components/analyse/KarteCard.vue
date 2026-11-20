<script setup lang="ts">
import type { Coords, District, KoelnGeo } from '#shared/types'
import rawGeo from '../../../data/koeln-geo.json'
import { contains, districtPath, fitProjection, labelPoint } from '@/lib/geo'
import type { Ref } from 'vue'
import { useElementSize } from '@vueuse/core'
import { groupBy, mean } from '@/lib/stats'
import { formatScore } from '@/lib/format'
import { scoreColor, scoreGradient } from '@/lib/score-color'

const geo = rawGeo as KoelnGeo
const { visits } = useStammtisch()

type Level = 'stadtteile' | 'stadtbezirke'
const LEVELS: { key: Level, label: string }[] = [
  { key: 'stadtteile', label: 'Stadtteile' },
  { key: 'stadtbezirke', label: 'Stadtbezirke' },
]
const level = ref<Level>('stadtteile')

type Mode = 'anzahl' | 'bewertung'
const MODES: { key: Mode, label: string }[] = [
  { key: 'anzahl', label: 'Anzahl' },
  { key: 'bewertung', label: 'Ø Bewertung' },
]
const mode = ref<Mode>('anzahl')

const TOGGLES = [
  { label: 'Gliederung', options: LEVELS, model: level },
  { label: 'Färbung', options: MODES, model: mode },
] as { label: string, options: { key: string, label: string }[], model: Ref<string> }[]

/* ---------- restaurants (one per Brauhaus, repeat visits share a location) ---------- */

interface Restaurant {
  name: string
  slug: string
  besuche: number
  /** Ø Gesamt over all rated visits, null if never rated */
  gesamt: number | null
  coords: Coords | null
  stadtteil: District | null
  stadtbezirk: District | null
}

const restaurants: Restaurant[] = [...groupBy(visits, v => v.slug).values()].map((vs) => {
  const coords = vs.find(v => v.coords)?.coords ?? null
  const scores = vs.map(v => v.averages.gesamt).filter((x): x is number => x != null)
  return {
    name: vs[0]!.brauhaus,
    slug: vs[0]!.slug,
    besuche: vs.length,
    gesamt: scores.length ? mean(scores) : null,
    coords,
    stadtteil: coords ? geo.stadtteile.find(d => contains(d, coords)) ?? null : null,
    stadtbezirk: coords ? geo.stadtbezirke.find(d => contains(d, coords)) ?? null : null,
  }
})

/** only restaurants inside Cologne count */
const inKoeln = restaurants.filter(r => r.stadtteil)
const ausserhalb = restaurants.filter(r => r.coords && !r.stadtteil)
const ohneKoordinaten = restaurants.filter(r => !r.coords)

/* ---------- geometry ---------- */

const WIDTH = 1000
const proj = fitProjection(geo.stadtbezirke, WIDTH)

interface Area {
  district: District
  path: string
  label: [number, number]
  restaurants: Restaurant[]
  /** Ø of the rated restaurants' Ø Gesamt (each Brauhaus counts once), null if none rated */
  score: number | null
}

const buildAreas = (ds: District[], key: 'stadtteil' | 'stadtbezirk'): Area[] => ds.map((d) => {
  const restaurants = inKoeln.filter(r => r[key]?.nummer === d.nummer).sort((a, b) => a.name.localeCompare(b.name, 'de'))
  const scores = restaurants.map(r => r.gesamt).filter((x): x is number => x != null)
  return {
    district: d,
    path: districtPath(d, proj),
    label: labelPoint(d, proj),
    restaurants,
    score: scores.length ? mean(scores) : null,
  }
})

const areasByLevel: Record<Level, Area[]> = {
  stadtteile: buildAreas(geo.stadtteile, 'stadtteil'),
  stadtbezirke: buildAreas(geo.stadtbezirke, 'stadtbezirk'),
}
const bezirkPaths = areasByLevel.stadtbezirke.map(a => a.path)

/** Rhine centre line, drawn about as wide as the river really is (~350 m in Cologne) */
const rheinPath = `M${geo.rhein.map(([lng, lat]) => proj.project(lng, lat).join(' ')).join('L')}`
const pxPerMeter = (() => {
  const [lng, lat] = geo.rhein[0]!
  return Math.abs(proj.project(lng, lat)[1] - proj.project(lng, lat + 1000 / 111_320)[1]) / 1000
})()
const rheinWidth = Math.max(4, Math.round(350 * pxPerMeter))

/** unique ids for the river mask / hover clip (several maps on one page must not share them) */
const uid = useId()
const maskId = `${uid}-ohne-rhein`
const clipId = `${uid}-aktiv`

const areas = computed(() => areasByLevel[level.value])

const dots = inKoeln.map((r) => {
  const [x, y] = proj.project(r.coords!.lng, r.coords!.lat)
  return { r, x, y }
})

/* ---------- color: sequential amber (beer), binned counts ---------- */

/** ColorBrewer YlOrBr light amber → dark brown: ordinal, and clearly apart from the blue Rhine and the green scores */
const RAMP = ['#fec44f', '#fe9929', '#ec7014', '#cc4c02', '#8c2d04']
const EDGES = [1, 2, 3, 5, 10, 20, 50]

interface Bin { min: number, max: number, color: string, label: string }

const bins = computed<Bin[]>(() => {
  const max = Math.max(0, ...areas.value.map(a => a.restaurants.length))
  if (max === 0) return []
  // one bin per count while they fit, otherwise widening ranges
  const edges = max <= RAMP.length
    ? Array.from({ length: max }, (_, i) => i + 1)
    : EDGES.filter(e => e <= max).slice(0, RAMP.length)
  // spread the used bins over the whole ramp so the darkest step always means "most"
  const pick = (i: number) => RAMP[edges.length === 1 ? RAMP.length - 1 : Math.round((i * (RAMP.length - 1)) / (edges.length - 1))]!
  return edges.map((min, i) => {
    const next = edges[i + 1]
    const hi = next == null ? max : next - 1
    return { min, max: hi, color: pick(i), label: min === hi ? String(min) : next == null ? `${min}+` : `${min}–${hi}` }
  })
})

const colorOfCount = (n: number): string | undefined => bins.value.find(b => n >= b.min && n <= b.max)?.color

/* ---------- color: Ø Bewertung, green like the score tiles, stretched over the districts' range ---------- */

const scoreRange = computed(() => {
  const xs = areas.value.map(a => a.score).filter((x): x is number => x != null)
  return xs.length ? { min: Math.min(...xs), max: Math.max(...xs) } : null
})

const colorOfScore = (s: number): string => {
  const r = scoreRange.value!
  const f = r.max > r.min ? (s - r.min) / (r.max - r.min) : 1
  return scoreColor(f)
}
const gradient = scoreGradient()

/** fill of an area in the current mode, undefined = no data (muted) */
const fillOf = (a: Area): string | undefined => mode.value === 'anzahl'
  ? (a.restaurants.length ? colorOfCount(a.restaurants.length) : undefined)
  : (a.score != null ? colorOfScore(a.score) : undefined)

/* ---------- hover / tap ---------- */

const activeNr = ref<string | null>(null)
const activeArea = computed(() => areas.value.find(a => a.district.nummer === activeNr.value) ?? null)
/** tooltip only for hovers on the map itself, the list just highlights */
const fromMap = ref(false)
/** touch: a tapped district stays open until the next tap anywhere on the map */
const pinned = ref(false)
const box = ref<HTMLElement | null>(null)
const pointer = ref({ x: 0, y: 0, w: 0, h: 0 })

function clear() {
  activeNr.value = null
  pinned.value = false
}
watch(level, clear)

function show(e: PointerEvent, a: Area) {
  activeNr.value = a.district.nummer
  fromMap.value = true
  const rect = box.value?.getBoundingClientRect()
  if (!rect) return
  // turned 90° clockwise: screen y runs along the map's x axis, screen x against its y axis
  pointer.value = rotated.value
    ? { x: e.clientY - rect.top, y: rect.right - e.clientX, w: rect.height, h: rect.width }
    : { x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width, h: rect.height }
}

/** mouse: follow the cursor (unless a district was pinned by touch) */
function onMove(e: PointerEvent, a: Area) {
  if (e.pointerType === 'mouse' && !pinned.value) show(e, a)
}

/**
 * touch/pen: a tap opens and pins a district; while one is open, the next tap anywhere on the map
 * (another district, the info box above it, the river) only closes it, so another district takes a second tap
 */
function onTap(e: PointerEvent, a: Area) {
  if (e.pointerType === 'mouse') return
  e.stopPropagation()
  if (pinned.value) return clear()
  show(e, a)
  pinned.value = true
}

/** a tap on the map outside every district */
function onMapTap(e: PointerEvent) {
  if (e.pointerType !== 'mouse' && pinned.value) clear()
}

/** hover only — touch "leaves" right after every tap */
function onLeave(e: PointerEvent) {
  if (e.pointerType === 'mouse' && !pinned.value) activeNr.value = null
}

function onListEnter(e: PointerEvent, a: Area) {
  if (e.pointerType !== 'mouse' || pinned.value) return
  activeNr.value = a.district.nummer
  fromMap.value = false
}

const tip = ref<HTMLElement | null>(null)
const tipSize = useElementSize(tip, undefined, { box: 'border-box' })

/** next to the pointer, on the side with more room, then clamped so it never leaves the map (= the screen) */
const tooltipStyle = computed(() => {
  const GAP = 12
  const { x, y, w, h } = pointer.value
  const tw = tipSize.width.value
  const th = tipSize.height.value
  const clamp = (v: number, max: number) => Math.max(0, Math.min(v, Math.max(0, max)))
  const left = x > w / 2 ? x - GAP - tw : x + GAP
  const top = y > h / 2 ? y - GAP - th : y + GAP
  return {
    left: `${clamp(left, w - tw)}px`,
    top: `${clamp(top, h - th)}px`,
    // hidden for the one frame before its size is known
    visibility: tw ? undefined : 'hidden' as const,
  }
})

/* ---------- ranking (table view of the same data) ---------- */

const ranking = computed(() => {
  const byName = (a: Area, b: Area) => a.district.name.localeCompare(b.district.name, 'de')
  return mode.value === 'anzahl'
    ? areas.value.filter(a => a.restaurants.length).sort((a, b) => b.restaurants.length - a.restaurants.length || byName(a, b))
    : areas.value.filter(a => a.score != null).sort((a, b) => b.score! - a.score! || byName(a, b))
})

const plural = (n: number) => `${n} ${n === 1 ? 'Brauhaus' : 'Brauhäuser'}`

/** fullscreen on phones: the map shrinks to fit the screen height, see FullscreenCard */
const full = ref(false)
/** fullscreen turned by 90° (iPhone held upright): pointer coordinates must be turned back */
const rotated = ref(false)
</script>

<template>
  <FullscreenCard
    v-model:full="full"
    v-model:rotated="rotated"
  >
    <Card>
      <CardHeader>
        <CardTitle class="text-xl">
          Köln-Karte
        </CardTitle>
        <CardDescription class="max-sm:col-start-1">
          <template v-if="mode === 'anzahl'">
            In welchen Vierteln waren wir schon? Je dunkler, desto mehr verschiedene Brauhäuser haben wir dort besucht.
          </template>
          <template v-else>
            Wo schmeckt's am besten? Je dunkler, desto höher die Ø Gesamtbewertung der Brauhäuser dort (jedes Brauhaus zählt einmal).
          </template>
          Brauhäuser außerhalb der Stadtgrenze zählen nicht mit.
        </CardDescription>
        <div class="col-start-2 row-start-1 justify-self-end sm:hidden">
          <FullscreenButton />
        </div>
        <CardAction class="flex flex-col items-end gap-2 max-sm:col-start-1 max-sm:row-span-1 max-sm:row-start-3 max-sm:mt-2 max-sm:justify-self-stretch">
          <div
            v-for="t in TOGGLES"
            :key="t.label"
            class="inline-flex rounded-lg border p-0.5 text-sm max-sm:flex max-sm:w-full"
            role="radiogroup"
            :aria-label="t.label"
          >
            <button
              v-for="o in t.options"
              :key="o.key"
              type="button"
              role="radio"
              :aria-checked="t.model.value === o.key"
              class="rounded-md px-2.5 py-1 transition-colors max-sm:flex-1"
              :class="t.model.value === o.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
              @click="t.model.value = o.key"
            >
              {{ o.label }}
            </button>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div class="flex flex-col gap-3">
          <div
            ref="box"
            class="relative"
            :class="full && 'mx-auto w-full'"
            :style="full ? { maxWidth: `calc((var(--fs-height) - 9rem) * ${proj.width / proj.height})` } : undefined"
            @pointerleave="onLeave"
            @pointerup="onMapTap"
          >
            <svg
              :viewBox="`0 0 ${proj.width} ${proj.height}`"
              class="block h-auto w-full"
              role="img"
              :aria-label="`Karte der Kölner ${level === 'stadtteile' ? 'Stadtteile' : 'Stadtbezirke'} nach ${mode === 'anzahl' ? 'Anzahl besuchter Brauhäuser' : 'Ø Bewertung der Brauhäuser'}`"
            >
              <defs>
                <!-- everything district-related ends at the riverbank: the river band is cut out -->
                <mask
                  :id="maskId"
                  maskUnits="userSpaceOnUse"
                  x="0"
                  y="0"
                  :width="proj.width"
                  :height="proj.height"
                >
                  <rect
                    :width="proj.width"
                    :height="proj.height"
                    fill="white"
                  />
                  <path
                    :d="rheinPath"
                    fill="none"
                    stroke="black"
                    :stroke-width="rheinWidth"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                  />
                </mask>
                <clipPath
                  v-if="activeArea"
                  :id="clipId"
                >
                  <path
                    :d="activeArea.path"
                    clip-rule="evenodd"
                  />
                </clipPath>
              </defs>

              <g :mask="`url(#${maskId})`">
                <!-- areas -->
                <g fill-rule="evenodd">
                  <path
                    v-for="a in areas"
                    :key="a.district.nummer"
                    :d="a.path"
                    class="cursor-pointer stroke-foreground/30 transition-[fill-opacity]"
                    :class="fillOf(a) ? '' : 'fill-muted'"
                    :style="fillOf(a) ? { fill: fillOf(a) } : undefined"
                    :fill-opacity="activeNr && activeNr !== a.district.nummer ? 0.6 : 1"
                    stroke-width="1"
                    stroke-linejoin="round"
                    @pointermove="onMove($event, a)"
                    @pointerup="onTap($event, a)"
                  />
                </g>

                <!-- Stadtbezirk borders on top, always visible -->
                <g
                  class="pointer-events-none fill-none stroke-foreground/70"
                  stroke-width="2"
                  stroke-linejoin="round"
                >
                  <path
                    v-for="(d, i) in bezirkPaths"
                    :key="i"
                    :d="d"
                  />
                </g>

                <!-- hovered area outline -->
                <path
                  v-if="activeArea"
                  :d="activeArea.path"
                  class="pointer-events-none fill-none stroke-foreground"
                  stroke-width="3"
                  stroke-linejoin="round"
                />
              </g>

              <!-- Rhine: a band 2 px wider than the water = 1 px border on each bank (like the Stadtteil borders) -->
              <g
                class="pointer-events-none fill-none"
                stroke-linejoin="round"
                stroke-linecap="round"
              >
                <path
                  :d="rheinPath"
                  class="stroke-foreground/30"
                  :stroke-width="rheinWidth + 2"
                />
                <!-- hovered district: its outline continues along the bank (3 px, only inside the district) -->
                <path
                  v-if="activeArea"
                  :d="rheinPath"
                  class="stroke-foreground"
                  :stroke-width="rheinWidth + 6"
                  :clip-path="`url(#${clipId})`"
                />
                <path
                  :d="rheinPath"
                  class="stroke-[oklch(0.42_0.12_255)] dark:stroke-[oklch(0.5_0.13_255)]"
                  :stroke-width="rheinWidth"
                />
              </g>

              <!-- restaurants -->
              <g class="pointer-events-none">
                <circle
                  v-for="d in dots"
                  :key="d.r.slug"
                  :cx="d.x"
                  :cy="d.y"
                  r="4.5"
                  class="fill-foreground stroke-background"
                  stroke-width="2"
                />
              </g>

              <!-- Bezirk names -->
              <g
                v-if="level === 'stadtbezirke'"
                class="pointer-events-none fill-foreground text-[22px] font-medium"
                text-anchor="middle"
              >
                <text
                  v-for="a in areas"
                  :key="a.district.nummer"
                  :x="a.label[0]"
                  :y="a.label[1]"
                  class="stroke-background"
                  stroke-width="5"
                  paint-order="stroke"
                >{{ a.district.name }}</text>
              </g>
            </svg>

            <!-- tooltip -->
            <div
              v-if="activeArea && fromMap"
              ref="tip"
              class="pointer-events-none absolute z-10 w-60 max-w-full rounded-lg border bg-popover p-3 text-popover-foreground shadow-md"
              :style="tooltipStyle"
            >
              <div class="font-semibold leading-tight">
                {{ activeArea.district.name }}
              </div>
              <div
                v-if="level === 'stadtteile'"
                class="mt-0.5 text-xs text-muted-foreground"
              >
                Bezirk {{ activeArea.district.stadtbezirk }}
              </div>
              <div class="mt-2 text-sm tabular-nums">
                {{ plural(activeArea.restaurants.length) }}<template v-if="mode === 'bewertung'">
                  · Ø {{ formatScore(activeArea.score) }}
                </template>
              </div>
              <ul
                v-if="activeArea.restaurants.length"
                class="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground"
              >
                <li
                  v-for="r in activeArea.restaurants"
                  :key="r.slug"
                >
                  <span class="flex justify-between gap-2">
                    <span>{{ r.name }}<template v-if="r.besuche > 1"> ({{ r.besuche }}×)</template></span>
                    <span
                      v-if="mode === 'bewertung'"
                      class="tabular-nums"
                    >{{ formatScore(r.gesamt) }}</span>
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <!-- legend -->
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span class="inline-flex items-center gap-1.5">
              <span class="size-3 rounded-sm border bg-muted" /> {{ mode === 'anzahl' ? '0' : 'keine Bewertung' }}
            </span>
            <template v-if="mode === 'anzahl'">
              <span
                v-for="b in bins"
                :key="b.label"
                class="inline-flex items-center gap-1.5 tabular-nums"
              >
                <span
                  class="size-3 rounded-sm"
                  :style="{ background: b.color }"
                /> {{ b.label }}
              </span>
            </template>
            <span
              v-else-if="scoreRange"
              class="inline-flex items-center gap-1.5 tabular-nums"
            >
              Ø {{ formatScore(scoreRange.min) }}
              <span
                class="h-3 w-20 rounded-sm"
                :style="{ background: gradient }"
              />
              {{ formatScore(scoreRange.max) }}
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="size-2.5 rounded-full bg-foreground" /> Brauhaus
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="h-0.5 w-4 bg-foreground/70" /> Bezirksgrenze
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="h-1.5 w-4 rounded-full bg-[oklch(0.42_0.12_255)] dark:bg-[oklch(0.5_0.13_255)]" /> Rhein
            </span>
          </div>
        </div>

        <!-- ranking -->
        <div class="flex flex-col gap-3">
          <h3 class="text-sm font-medium">
            {{ level === 'stadtteile' ? 'Stadtteile' : 'Stadtbezirke' }} {{ mode === 'anzahl' ? 'mit Besuchen' : 'nach Ø Bewertung' }}
          </h3>
          <p
            v-if="!ranking.length"
            class="text-sm text-muted-foreground"
          >
            Noch keine Brauhäuser mit Koordinaten in Köln. Trag sie in der Spalte „Koordinaten“ im Blatt
            „General“ ein (aus Google Maps kopiert, z. B. <span class="tabular-nums">50.93836, 6.95995</span>).
          </p>
          <ol
            v-else
            class="flex flex-col gap-1.5 text-sm"
          >
            <li
              v-for="a in ranking"
              :key="a.district.nummer"
              class="flex items-center gap-2"
              @pointerenter="onListEnter($event, a)"
              @pointerleave="onLeave"
            >
              <span
                class="size-3 shrink-0 rounded-sm"
                :style="{ background: fillOf(a) }"
              />
              <span class="min-w-0 flex-1 truncate">{{ a.district.name }}</span>
              <span class="tabular-nums">{{ mode === 'anzahl' ? a.restaurants.length : formatScore(a.score) }}</span>
            </li>
          </ol>
          <p class="text-xs text-muted-foreground">
            {{ plural(inKoeln.length) }} in Köln<template v-if="ausserhalb.length">
              · {{ ausserhalb.length }} außerhalb ({{ ausserhalb.map(r => r.name).join(', ') }})
            </template><template v-if="ohneKoordinaten.length">
              · {{ ohneKoordinaten.length }} ohne Koordinaten
            </template>
          </p>
          <p class="text-xs text-muted-foreground">
            Rhein: ©
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener"
              class="underline underline-offset-2 hover:text-foreground"
            >OpenStreetMap-Mitwirkende</a>
          </p>
        </div>
      </CardContent>
    </Card>
  </FullscreenCard>
</template>
