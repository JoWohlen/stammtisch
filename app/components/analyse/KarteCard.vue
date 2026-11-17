<script setup lang="ts">
import type { Coords, District, KoelnGeo } from '#shared/types'
import rawGeo from '../../../data/koeln-geo.json'
import { contains, districtPath, fitProjection, labelPoint } from '@/lib/geo'
import { groupBy } from '@/lib/stats'

const geo = rawGeo as KoelnGeo
const { visits } = useStammtisch()

type Level = 'stadtteile' | 'stadtbezirke'
const LEVELS: { key: Level, label: string }[] = [
  { key: 'stadtteile', label: 'Stadtteile' },
  { key: 'stadtbezirke', label: 'Stadtbezirke' },
]
const level = ref<Level>('stadtteile')

/* ---------- restaurants (one per Brauhaus, repeat visits share a location) ---------- */

interface Restaurant {
  name: string
  slug: string
  besuche: number
  coords: Coords | null
  stadtteil: District | null
  stadtbezirk: District | null
}

const restaurants: Restaurant[] = [...groupBy(visits, v => v.slug).values()].map((vs) => {
  const coords = vs.find(v => v.coords)?.coords ?? null
  return {
    name: vs[0]!.brauhaus,
    slug: vs[0]!.slug,
    besuche: vs.length,
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
}

const buildAreas = (ds: District[], key: 'stadtteil' | 'stadtbezirk'): Area[] => ds.map(d => ({
  district: d,
  path: districtPath(d, proj),
  label: labelPoint(d, proj),
  restaurants: inKoeln.filter(r => r[key]?.nummer === d.nummer).sort((a, b) => a.name.localeCompare(b.name, 'de')),
}))

const areasByLevel: Record<Level, Area[]> = {
  stadtteile: buildAreas(geo.stadtteile, 'stadtteil'),
  stadtbezirke: buildAreas(geo.stadtbezirke, 'stadtbezirk'),
}
const bezirkPaths = areasByLevel.stadtbezirke.map(a => a.path)

const areas = computed(() => areasByLevel[level.value])

const dots = inKoeln.map((r) => {
  const [x, y] = proj.project(r.coords!.lng, r.coords!.lat)
  return { r, x, y }
})

/* ---------- color: sequential blue, binned counts ---------- */

/** palette blue 250 → 700, validated as an ordinal ramp on the light surface */
const RAMP = ['#86b6ef', '#3987e5', '#256abf', '#184f95', '#0d366b']
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

const colorOf = (n: number): string | undefined => bins.value.find(b => n >= b.min && n <= b.max)?.color

/* ---------- hover / tap ---------- */

const activeNr = ref<string | null>(null)
const activeArea = computed(() => areas.value.find(a => a.district.nummer === activeNr.value) ?? null)
watch(level, () => (activeNr.value = null))

/** tooltip only for hovers on the map itself, the list just highlights */
const fromMap = ref(false)
const box = ref<HTMLElement | null>(null)
const pointer = ref({ x: 0, y: 0, w: 0, h: 0 })

function onMove(e: PointerEvent, a: Area) {
  activeNr.value = a.district.nummer
  fromMap.value = true
  const rect = box.value?.getBoundingClientRect()
  if (rect) pointer.value = { x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width, h: rect.height }
}

const tooltipStyle = computed(() => {
  const { x, y, w, h } = pointer.value
  const left = x > w / 2
  const below = y < h / 2
  return {
    left: left ? undefined : `${x + 12}px`,
    right: left ? `${w - x + 12}px` : undefined,
    top: below ? `${y + 12}px` : undefined,
    bottom: below ? undefined : `${h - y + 12}px`,
  }
})

/* ---------- ranking (table view of the same data) ---------- */

const ranking = computed(() => areas.value
  .filter(a => a.restaurants.length)
  .sort((a, b) => b.restaurants.length - a.restaurants.length || a.district.name.localeCompare(b.district.name, 'de')))

const plural = (n: number) => `${n} ${n === 1 ? 'Brauhaus' : 'Brauhäuser'}`
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-xl">
        Köln-Karte
      </CardTitle>
      <CardDescription>
        In welchen Vierteln waren wir schon? Je dunkler, desto mehr verschiedene Brauhäuser haben wir dort besucht.
        Brauhäuser außerhalb der Stadtgrenze zählen nicht mit.
      </CardDescription>
      <CardAction>
        <div
          class="inline-flex rounded-lg border p-0.5 text-sm"
          role="radiogroup"
          aria-label="Gliederung"
        >
          <button
            v-for="l in LEVELS"
            :key="l.key"
            type="button"
            role="radio"
            :aria-checked="level === l.key"
            class="rounded-md px-2.5 py-1 transition-colors"
            :class="level === l.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
            @click="level = l.key"
          >
            {{ l.label }}
          </button>
        </div>
      </CardAction>
    </CardHeader>

    <CardContent class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div class="flex flex-col gap-3">
        <div
          ref="box"
          class="relative"
          @pointerleave="activeNr = null"
        >
          <svg
            :viewBox="`0 0 ${proj.width} ${proj.height}`"
            class="block h-auto w-full"
            role="img"
            :aria-label="`Karte der Kölner ${level === 'stadtteile' ? 'Stadtteile' : 'Stadtbezirke'} nach Anzahl besuchter Brauhäuser`"
          >
            <!-- areas -->
            <g fill-rule="evenodd">
              <path
                v-for="a in areas"
                :key="a.district.nummer"
                :d="a.path"
                class="cursor-pointer stroke-foreground/30 transition-[fill-opacity]"
                :class="a.restaurants.length ? '' : 'fill-muted'"
                :style="a.restaurants.length ? { fill: colorOf(a.restaurants.length) } : undefined"
                :fill-opacity="activeNr && activeNr !== a.district.nummer ? 0.6 : 1"
                stroke-width="1"
                stroke-linejoin="round"
                @pointermove="onMove($event, a)"
                @pointerdown="onMove($event, a)"
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
            class="pointer-events-none absolute z-10 w-60 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md"
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
              {{ plural(activeArea.restaurants.length) }}
            </div>
            <ul
              v-if="activeArea.restaurants.length"
              class="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground"
            >
              <li
                v-for="r in activeArea.restaurants"
                :key="r.slug"
              >
                {{ r.name }}<template v-if="r.besuche > 1">
                  ({{ r.besuche }}×)
                </template>
              </li>
            </ul>
          </div>
        </div>

        <!-- legend -->
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span class="inline-flex items-center gap-1.5">
            <span class="size-3 rounded-sm border bg-muted" /> 0
          </span>
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
          <span class="inline-flex items-center gap-1.5">
            <span class="size-2.5 rounded-full bg-foreground" /> Brauhaus
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="h-0.5 w-4 bg-foreground/70" /> Bezirksgrenze
          </span>
        </div>
      </div>

      <!-- ranking -->
      <div class="flex flex-col gap-3">
        <h3 class="text-sm font-medium">
          {{ level === 'stadtteile' ? 'Stadtteile' : 'Stadtbezirke' }} mit Besuchen
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
            @pointerenter="activeNr = a.district.nummer; fromMap = false"
            @pointerleave="activeNr = null"
          >
            <span
              class="size-3 shrink-0 rounded-sm"
              :style="{ background: colorOf(a.restaurants.length) }"
            />
            <span class="min-w-0 flex-1 truncate">{{ a.district.name }}</span>
            <span class="tabular-nums">{{ a.restaurants.length }}</span>
          </li>
        </ol>
        <p class="text-xs text-muted-foreground">
          {{ plural(inKoeln.length) }} in Köln<template v-if="ausserhalb.length">
            · {{ ausserhalb.length }} außerhalb ({{ ausserhalb.map(r => r.name).join(', ') }})
          </template><template v-if="ohneKoordinaten.length">
            · {{ ohneKoordinaten.length }} ohne Koordinaten
          </template>
        </p>
      </div>
    </CardContent>
  </Card>
</template>
