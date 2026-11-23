<script setup lang="ts">
import type { Coords, District, KoelnGeo } from '#shared/types'
import rawGeo from '../../../data/koeln-geo.json'
import { contains, districtPath, fitProjection, labelPoint } from '@/lib/geo'
import type { Ref } from 'vue'
import { createReusableTemplate, useElementSize, useEventListener } from '@vueuse/core'
import { groupBy, mean } from '@/lib/stats'
import { formatScore } from '@/lib/format'
import { rampGradient, scoreScale } from '@/lib/score-color'

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

/** ColorBrewer YlOrBr light amber → dark brown: ordinal, and clearly apart from the blue Rhine */
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

/* ---------- color: Ø Bewertung, red → amber (Ø of the districts) → green, like the score tiles ---------- */

const scoreRange = computed(() => scoreScale(areas.value.map(a => a.score)))

const colorOfScore = (s: number): string => scoreRange.value!.color(s)
const gradient = rampGradient()

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
  if (gesturing.value) return
  if (pinned.value) return clear()
  show(e, a)
  pinned.value = true
}

/** a tap on the map outside every district */
function onMapTap(e: PointerEvent) {
  if (gesturing.value) return
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

/** touch/pen: a tap on a list entry highlights (and pins) its district on the map, a second tap releases it */
function onListTap(e: PointerEvent, a: Area) {
  if (e.pointerType === 'mouse') return
  if (pinned.value && activeNr.value === a.district.nummer) return clear()
  activeNr.value = a.district.nummer
  fromMap.value = false
  pinned.value = true
}

const tip = ref<HTMLElement | null>(null)
const tipSize = useElementSize(tip, undefined, { box: 'border-box' })

const tipList = ref<HTMLElement | null>(null)

/** mouse: the tooltip follows the cursor and can't be reached, so the wheel over the map scrolls its list (only while it can scroll) */
function onWheel(e: WheelEvent) {
  const el = tipList.value
  if (!el || !activeArea.value || !fromMap.value) return
  const canScroll = e.deltaY > 0
    ? el.scrollTop + el.clientHeight < el.scrollHeight - 1
    : el.scrollTop > 0
  if (!canScroll) return
  e.preventDefault()
  el.scrollTop += e.deltaY
}
useEventListener(box, 'wheel', onWheel, { passive: false })
// a new district starts at the top of its list
watch(activeNr, () => tipList.value?.scrollTo({ top: 0 }))

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

/* ---------- two-finger zoom ---------- */

/** max zoom factor */
const MAX_ZOOM = 8
const svgEl = ref<SVGSVGElement | null>(null)
/**
 * height of the visible part at zoom 1, in map units: the whole map normally; in fullscreen the map
 * fills the width up to the list, so a wide screen shows a horizontal band of it (panned by one finger)
 */
const baseH = computed(() => {
  const { width: w, height: h } = mapAreaSize
  return full.value && w.value && h.value ? Math.min(proj.height, proj.width * h.value / w.value) : proj.height
})
/** smallest zoom: the whole map in view (below 1 only in fullscreen, where 1 = the band filling the width) */
const minK = computed(() => baseH.value / proj.height)
/** keep the visible part inside the map; a part bigger than the map (zoomed out) is centred on it */
function clampView(k: number, x: number, y: number) {
  const clamp = (v: number, over: number) => over < 0 ? over / 2 : Math.max(0, Math.min(v, over))
  return { k, x: clamp(x, proj.width - proj.width / k), y: clamp(y, proj.height - baseH.value / k) }
}
/** zoom factor and top-left corner of the visible part, in map units */
const view = ref({ k: 1, x: 0, y: 0 })
const viewBox = computed(() => {
  const { k, x, y } = view.value
  return `${x} ${y} ${proj.width / k} ${baseH.value / k}`
})
/** strokes, dots and labels keep their on-screen size while zoomed */
const px = (n: number) => n / view.value.k

/** a finger's position on the drawn map, 0..1 on both axes (the fullscreen may be turned by 90°) */
function local(t: Touch) {
  const r = svgEl.value!.getBoundingClientRect()
  return rotated.value
    ? { x: (t.clientY - r.top) / r.height, y: (r.right - t.clientX) / r.width }
    : { x: (t.clientX - r.left) / r.width, y: (t.clientY - r.top) / r.height }
}
const midDist = (a: Touch, b: Touch) => {
  const p = local(a)
  const q = local(b)
  return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, d: Math.hypot((p.x - q.x) * proj.width, (p.y - q.y) * baseH.value) }
}

/** pinch in progress: the map point under the fingers' midpoint and the distance at its start */
let pinch: { mx: number, my: number, d: number, k: number } | null = null
/** one-finger drag in fullscreen (the screen doesn't scroll there): where it started, on screen and in the view */
let drag: { sx: number, sy: number, vx: number, vy: number, moved: boolean } | null = null
/** finger travel (in px) before a touch counts as a drag instead of a tap */
const DRAG_SLOP = 8
/** true from the second finger (or a drag) until all fingers are up: the lifting fingers must not count as a tap */
const gesturing = ref(false)

function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 1 && full.value) {
    const t = e.touches[0]!
    drag = { sx: t.clientX, sy: t.clientY, vx: view.value.x, vy: view.value.y, moved: false }
    return
  }
  if (e.touches.length !== 2) return
  e.preventDefault()
  drag = null
  const { x, y, d } = midDist(e.touches[0]!, e.touches[1]!)
  const { k, x: vx, y: vy } = view.value
  pinch = { mx: vx + x * proj.width / k, my: vy + y * baseH.value / k, d: Math.max(d, 1), k }
  gesturing.value = true
  clear()
}

function onTouchMove(e: TouchEvent) {
  if (drag && e.touches.length === 1) {
    e.preventDefault()
    const t = e.touches[0]!
    if (!drag.moved && Math.hypot(t.clientX - drag.sx, t.clientY - drag.sy) < DRAG_SLOP) return
    if (!drag.moved) {
      drag.moved = true
      gesturing.value = true
      clear()
    }
    // screen px → map units (turned by 90°: screen y runs along the map's x axis)
    const r = svgEl.value!.getBoundingClientRect()
    const [dx, dy] = rotated.value
      ? [t.clientY - drag.sy, drag.sx - t.clientX]
      : [t.clientX - drag.sx, t.clientY - drag.sy]
    const [w, h] = rotated.value ? [r.height, r.width] : [r.width, r.height]
    const { k } = view.value
    view.value = clampView(k, drag.vx - dx * proj.width / k / w, drag.vy - dy * baseH.value / k / h)
    return
  }
  if (!pinch || e.touches.length !== 2) return
  e.preventDefault()
  const { x, y, d } = midDist(e.touches[0]!, e.touches[1]!)
  const k = Math.min(MAX_ZOOM, Math.max(minK.value, pinch.k * d / pinch.d))
  // keep the map point that started under the fingers under them (zoom + pan in one)
  view.value = clampView(k, pinch.mx - x * proj.width / k, pinch.my - y * baseH.value / k)
}

function onTouchEnd(e: TouchEvent) {
  if (e.touches.length < 2) pinch = null
  if (e.touches.length === 0) {
    drag = null
    gesturing.value = false
  }
}

useEventListener(svgEl, 'touchstart', onTouchStart, { passive: false })
useEventListener(svgEl, 'touchmove', onTouchMove, { passive: false })
useEventListener(svgEl, 'touchend', onTouchEnd)
useEventListener(svgEl, 'touchcancel', onTouchEnd)

/** zoomed out: the whole map, centred */
const resetZoom = () => (view.value = clampView(minK.value, 0, 0))

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

/** the Gliederung/Färbung toggles: in the header normally, next to the map in fullscreen */
const [DefineToggles, ReuseToggles] = createReusableTemplate<{ wide?: boolean, only?: number }>()

/** fullscreen: the map takes the biggest size that fits the space left of the list (no vertical scrolling) */
const mapArea = ref<HTMLElement | null>(null)
const mapAreaSize = useElementSize(mapArea)
/** fullscreen: as wide as the space up to the list; a tall area (rare) keeps the whole map */
const fullMapStyle = computed(() => ({
  width: `${Math.min(mapAreaSize.width.value, mapAreaSize.height.value * proj.width / baseH.value)}px`,
}))
// entering/leaving fullscreen or resizing changes the band: start again from the centred, unzoomed map
watch(baseH, resetZoom)
</script>

<template>
  <FullscreenCard
    v-model:full="full"
    v-model:rotated="rotated"
  >
    <!-- single root, so the page's class still lands on FullscreenCard -->
    <DefineToggles v-slot="{ wide, only }">
      <Tabs
        v-for="t in only == null ? TOGGLES : [TOGGLES[only]!]"
        :key="t.label"
        v-model="t.model.value"
        :class="wide ? 'w-full' : 'max-sm:w-full'"
      >
        <!-- wide: two equal halves (grid), so the split lines up across both toggles -->
        <TabsList
          :aria-label="t.label"
          :class="wide ? 'grid w-full grid-cols-2' : 'max-sm:w-full'"
        >
          <TabsTrigger
            v-for="o in t.options"
            :key="o.key"
            :value="o.key"
            class="px-3"
          >
            {{ o.label }}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </DefineToggles>

    <!-- fullscreen: tighter, and min-h-0 + overflow-hidden so the screen itself never scrolls -->
    <Card :class="full && 'min-h-0 gap-2 overflow-hidden py-3 sm:gap-2 sm:py-3'">
      <!-- fullscreen: no header; the title sits above the map, so the right column starts at the very top -->
      <CardHeader v-if="!full">
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
        <!-- grid: both toggles as wide as the wider one, the options inside share it equally -->
        <CardAction class="grid gap-2 max-sm:col-span-2 max-sm:col-start-1 max-sm:row-span-1 max-sm:row-start-3 max-sm:mt-2 max-sm:justify-self-stretch">
          <ReuseToggles wide />
        </CardAction>
      </CardHeader>

      <!-- fullscreen: map on the left over both rows, toggles and list on the right -->
      <CardContent
        class="grid"
        :class="full
          ? 'min-h-0 flex-1 grid-cols-[minmax(0,1fr)_14rem] grid-rows-[auto_minmax(0,1fr)] gap-x-4 gap-y-3'
          : 'gap-4'"
      >
        <div
          class="flex flex-col gap-3"
          :class="full && 'row-span-2 min-h-0'"
        >
          <CardTitle
            v-if="full"
            class="text-xl"
          >
            Köln-Karte
          </CardTitle>
          <div
            ref="mapArea"
            :class="full && 'flex min-h-0 flex-1 justify-center'"
          >
            <div
              ref="box"
              class="relative"
              :style="full ? fullMapStyle : undefined"
              @pointerleave="onLeave"
              @pointerup="onMapTap"
            >
              <!--
                one finger scrolls the page (fullscreen: pans the map), two fingers zoom/pan the map
                (touch-action: no browser pinch here, in fullscreen no browser gestures at all)
              -->
              <!-- data-no-swipe: dragging over the map must not switch the Analyse category -->
              <svg
                ref="svgEl"
                data-no-swipe
                :viewBox="viewBox"
                class="block h-auto w-full select-none [-webkit-touch-callout:none]"
                :class="full ? 'touch-none' : 'touch-pan-x touch-pan-y'"
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
                      :stroke-width="px(1)"
                      stroke-linejoin="round"
                      @pointermove="onMove($event, a)"
                      @pointerup="onTap($event, a)"
                    />
                  </g>

                  <!-- Stadtbezirk borders on top, always visible -->
                  <g
                    class="pointer-events-none fill-none stroke-foreground/70"
                    :stroke-width="px(2)"
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
                    :stroke-width="px(3)"
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
                    :stroke-width="rheinWidth + px(2)"
                  />
                  <!-- hovered district: its outline continues along the bank (3 px, only inside the district) -->
                  <path
                    v-if="activeArea"
                    :d="rheinPath"
                    class="stroke-foreground"
                    :stroke-width="rheinWidth + px(6)"
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
                    :r="px(4.5)"
                    class="fill-foreground stroke-background"
                    :stroke-width="px(2)"
                  />
                </g>

                <!-- Bezirk names -->
                <g
                  v-if="level === 'stadtbezirke'"
                  class="pointer-events-none fill-foreground font-medium"
                  :font-size="px(22)"
                  text-anchor="middle"
                >
                  <text
                    v-for="a in areas"
                    :key="a.district.nummer"
                    :x="a.label[0]"
                    :y="a.label[1]"
                    class="stroke-background"
                    :stroke-width="px(5)"
                    paint-order="stroke"
                  >{{ a.district.name }}</text>
                </g>
              </svg>

              <button
                v-if="view.k > minK + 1e-6"
                type="button"
                class="absolute top-2 right-2 rounded-md border bg-background/90 px-2 py-1 text-xs shadow-sm"
                @click="resetZoom"
              >
                Zoom zurücksetzen
              </button>

              <!-- tooltip -->
              <div
                v-if="activeArea && fromMap"
                ref="tip"
                class="absolute z-10 w-60 max-w-full rounded-lg border bg-popover p-3 text-popover-foreground shadow-md"
                :class="pinned ? 'pointer-events-auto' : 'pointer-events-none'"
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
                <!-- long lists scroll: touch-swipe once pinned, mouse wheel while hovering (see onWheel) -->
                <ul
                  v-if="activeArea.restaurants.length"
                  ref="tipList"
                  class="mt-1 flex max-h-40 touch-pan-y flex-col gap-0.5 overflow-y-auto overscroll-contain pr-1 text-xs text-muted-foreground"
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
              <span class="text-muted-foreground">(Mitte = Ø {{ formatScore(scoreRange.avg) }})</span>
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="size-2.5 rounded-full bg-foreground" /> Brauhaus
            </span>
            <!-- fullscreen: self-explanatory, room is short -->
            <template v-if="!full">
              <span class="inline-flex items-center gap-1.5">
                <span class="h-0.5 w-4 bg-foreground/70" /> Bezirksgrenze
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="h-1.5 w-4 rounded-full bg-[oklch(0.42_0.12_255)] dark:bg-[oklch(0.5_0.13_255)]" /> Rhein
              </span>
            </template>
          </div>
        </div>

        <div
          v-if="full"
          class="col-start-2 row-start-1 flex flex-col gap-2"
        >
          <div class="flex items-center gap-2">
            <ReuseToggles
              wide
              :only="0"
            />
            <FullscreenButton />
          </div>
          <ReuseToggles
            wide
            :only="1"
          />
        </div>

        <!-- ranking only in fullscreen (scrolls on its own, the screen does not); normally just the notes below the map -->
        <div
          class="flex flex-col gap-3"
          :class="full && 'col-start-2 row-start-2 min-h-0 overflow-y-auto overscroll-contain'"
        >
          <h3
            v-if="full"
            class="text-sm font-medium"
          >
            {{ level === 'stadtteile' ? 'Stadtteile' : 'Stadtbezirke' }} {{ mode === 'anzahl' ? 'mit Besuchen' : 'nach Ø Bewertung' }}
          </h3>
          <p
            v-if="!ranking.length"
            class="text-sm text-muted-foreground"
          >
            Noch keine Brauhäuser mit Koordinaten in Köln. Trag sie in der Spalte „Koordinaten“ im Blatt
            „General“ ein (aus Google Maps kopiert, z. B. <span class="tabular-nums">50.93836, 6.95995</span>).
          </p>
          <!-- tappable rows: no text selection / iOS callout when tapping a name on mobile -->
          <ol
            v-else-if="full"
            class="flex flex-col gap-1.5 text-sm select-none [-webkit-touch-callout:none]"
          >
            <li
              v-for="a in ranking"
              :key="a.district.nummer"
              class="-mx-1 flex cursor-default items-center gap-2 rounded px-1"
              :class="activeNr === a.district.nummer && 'bg-muted'"
              @pointerenter="onListEnter($event, a)"
              @pointerleave="onLeave"
              @pointerup="onListTap($event, a)"
            >
              <span
                class="size-3 shrink-0 rounded-sm"
                :style="{ background: fillOf(a) }"
              />
              <span class="min-w-0 flex-1 truncate">{{ a.district.name }}</span>
              <span class="tabular-nums">{{ mode === 'anzahl' ? a.restaurants.length : formatScore(a.score) }}</span>
            </li>
          </ol>
          <p
            v-if="!full"
            class="text-xs text-muted-foreground"
          >
            {{ plural(inKoeln.length) }} in Köln<template v-if="ausserhalb.length">
              · {{ ausserhalb.length }} außerhalb ({{ ausserhalb.map(r => r.name).join(', ') }})
            </template><template v-if="ohneKoordinaten.length">
              · {{ ohneKoordinaten.length }} ohne Koordinaten
            </template>
          </p>
          <!-- OSM attribution stays, also in fullscreen -->
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
