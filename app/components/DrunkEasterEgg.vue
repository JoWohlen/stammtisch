<script setup lang="ts">
import { onKeyStroke, useEventListener, useScrollLock } from '@vueuse/core'
import { BEER_H, BEER_W, bottleRuns, capRuns } from '@/lib/beer-sprite'
import { DRUNK_EVENT, SERVE_BEER_EVENT } from '@/lib/drunk'

/**
 * Easter egg: shaking the phone (or pressing G on a keyboard, or tapping the "Analyse" title on the
 * Bier tab, see pages/analyse.vue) serves a Gilden Kölsch.
 *
 * 1. The page fades to dark and a bottle fades in in the middle; only the bottle can be clicked.
 * 2. A click pops the cap off, then the bottle fades away
 *    while the page fades back in.
 * 3. Then the page is drunk for 12 s: every visible element (text, headings, buttons, icons, charts,
 *    badges, the cards themselves …) wanders about on its own random path and blurs by its own random
 *    amount, swelling and ebbing a random 3 to 7 times. The page can't be clicked, scrolled, swiped or typed into meanwhile, and
 *    no new beer comes: you have to wait until it's over, then everything is as before.
 *
 * Smooth on weak phones too. As nothing can scroll, only what is on screen takes part; everything off
 * screen stays as it is. Each moving element gets one animation of moving and turning only, worked out
 * up front for all 12 s, which the GPU then plays by itself: nothing is computed per frame. Each also
 * gets its own random blur strength and rhythm; on phones with little memory the blur is lighter, and
 * if frames still come too slowly it is dropped and only the movement stays.
 *
 * Shaking works where the browser gives motion data without asking (Android); iPhones only give it
 * after a permission prompt, which we don't show for an easter egg.
 */

const DURATION_MS = 12_000
const RAMP_UP_MS = 2_500
const RAMP_DOWN_MS = 3_000

/** change in acceleration (m/s²) between two readings that counts as a jolt */
const JOLT = 22
/** this many jolts within SHAKE_WINDOW_MS make a shake */
const JOLTS = 3
const SHAKE_WINDOW_MS = 1_000

/** the visible elements that wander about on their own; inside one, the rest moves along with it */
const MOVERS = 'h1, h2, h3, h4, p, li, a, button, label, svg, img, canvas, table, [data-slot="badge"], [role="tab"], [data-slot="card-description"], span'
/** the cards move too (gently), with their content wandering about on top */
const CARDS = '[data-slot="card"]'
/** at most this many elements move (more than a phone screen shows) */
const MAX_MOVERS = 150
/** one keyframe every this many ms; in between they move in a straight line (too short to see) */
const STEP_MS = 125
/** below this frame time (ms) the phone keeps up; above it the blur goes */
const SLOW_FRAME_MS = 28

const root = () => document.documentElement
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** the bottle's pixels (see lib/beer-sprite.ts) */
const BOTTLE = bottleRuns()
const CAP = capRuns()
/** screen pixels per bottle pixel: whole numbers keep the pixel art crisp */
const px = ref(4)

// ---------- the beer ----------

/** idle → offer (bottle shown, waiting for the click) → opening (cap pops) → drinking (bottle fades away) */
const state = ref<'idle' | 'offer' | 'opening' | 'drinking'>('idle')
/** the dark layer over the page */
const dark = ref(false)
const bottle = useTemplateRef<HTMLElement>('bottle')
const cap = useTemplateRef<HTMLElement>('cap')
const plopp = useTemplateRef<HTMLElement>('plopp')
/** the printed parts of both labels: turned in from the side when the bottle arrives */
const button = useTemplateRef<HTMLButtonElement>('button')
const scrollLock = useScrollLock(import.meta.client ? document.body : null)
/** the page behind can't be clicked, focused or scrolled while the bottle is there */
const app = () => document.getElementById('__nuxt')

async function offer() {
  if (state.value !== 'idle' || drunk.value) return
  state.value = 'offer'
  root().classList.add('beer')
  app()?.setAttribute('inert', '')
  scrollLock.value = true
  // the Halsbandsittich (SittichEasterEgg.vue) flies off and stays away
  window.dispatchEvent(new Event(DRUNK_EVENT))
  px.value = Math.max(2, Math.floor(Math.min(window.innerHeight * 0.62, 520) / BEER_H))
  await nextTick()
  requestAnimationFrame(() => (dark.value = true))
  // slowly comes out of the depth
  const arrive = { duration: 2600, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
  bottle.value?.animate(
    reduceMotion()
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
          { opacity: 0, transform: 'translate3d(0, 90px, -700px) rotateX(8deg)' },
          { opacity: 1, offset: 0.4 },
          { opacity: 1, transform: 'none' },
        ],
    arrive,
  )
  button.value?.focus({ preventScroll: true })
}

async function open() {
  if (state.value !== 'offer') return
  state.value = 'opening'
  if (!reduceMotion()) {
    // the cap shoots up tumbling towards the viewer, then falls off the screen
    cap.value?.animate([
      { transform: 'translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) rotateZ(0deg)' },
      { transform: 'translate3d(-20px, -110px, 160px) rotateX(260deg) rotateY(140deg) rotateZ(-40deg)', offset: 0.3, easing: 'cubic-bezier(0.3, 0, 0.7, 1)' },
      { transform: 'translate3d(-70px, 110vh, 80px) rotateX(900deg) rotateY(420deg) rotateZ(-160deg)' },
    ], { duration: 1400, easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)', fill: 'forwards' })
    plopp.value?.animate([
      { opacity: 0, transform: 'translate(-50%, 0) scale(0.3) rotate(-8deg)' },
      { opacity: 1, transform: 'translate(-50%, -28px) scale(1.15) rotate(-8deg)', offset: 0.25 },
      { opacity: 1, transform: 'translate(-50%, -34px) scale(1) rotate(-8deg)', offset: 0.6 },
      { opacity: 0, transform: 'translate(-50%, -48px) scale(1) rotate(-8deg)' },
    ], { duration: 900, easing: 'ease-out', fill: 'forwards' })
    await sleep(450)
  }
  else {
    cap.value?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' })
  }

  // after the pop the bottle fades away and the page comes back
  // the page stays locked (inert, no scrolling) until it is sober again
  state.value = 'drinking'
  dark.value = false
  await bottle.value?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, easing: 'ease-out', fill: 'forwards' })
    .finished.catch(() => {})
  state.value = 'idle'
  root().classList.remove('beer')
  // only now, with the beer drunk, it kicks in
  drink()
}

function closeBeer() {
  if (state.value === 'idle') return
  state.value = 'idle'
  dark.value = false
  root().classList.remove('beer')
  app()?.removeAttribute('inert')
  scrollLock.value = false
}

// ---------- drunk ----------

/** an element's random path: two waves per direction with their own speeds and phases, so nothing moves in sync or repeats */
interface Wave {
  el: Element
  /** size of the movement: px sideways, px up and down, degrees */
  x: number
  y: number
  r: number
  f: [number, number, number, number, number, number]
  ph: [number, number, number, number, number, number]
  /** its own strongest blur (px) and its own rhythm of blurring in and out (0 … 1 at e ms) */
  blur: number
  blurAt: (e: number) => number
}

const drunk = ref(false)
/** clock of the sine waves (never shifted, so the movement stays continuous) */
let t0 = 0
/** clock of the fade in / out */
let start = 0
let waves: Wave[] = []
let anims: Animation[] = []
/** the blur animations, kept apart so a slow phone can drop them */
let blurAnims: Animation[] = []
let timer: ReturnType<typeof setTimeout> | undefined
let fpsRaf = 0

/** 0 → 1 → 0 in a straight line over the 12 s */
const levelAt = (e: number) => e < 0
  ? 0
  : e < RAMP_UP_MS ? e / RAMP_UP_MS : e > DURATION_MS - RAMP_DOWN_MS ? Math.max(0, (DURATION_MS - e) / RAMP_DOWN_MS) : 1
/** the movement eases in and out */
const smooth = (l: number) => l * l * (3 - 2 * l)

const rnd = (a: number, z: number) => a + Math.random() * (z - a)
const sign = () => (Math.random() < 0.5 ? -1 : 1)

/** between its waves the blur doesn't clear up any more than this (share of full blur) */
const BLUR_FLOOR = 0.7

/**
 * An element's blur swells and ebbs a random number of times (3 to 7) over the 12 s, each time a bit
 * differently strong, at an uneven pace. Between the waves it stays fairly blurry (BLUR_FLOOR);
 * only at the very start and end is it sharp. Returns 0 … 1 (share of its strongest blur) at e ms.
 */
function randomBlur(): (e: number) => number {
  const times = 3 + Math.floor(Math.random() * 5)
  const strength = Array.from({ length: times }, () => rnd(0.8, 1))
  // uneven pace: time is bent a little (still always moving forward), so the waves differ in length
  const a = rnd(-0.6, 0.6)
  const b = rnd(-0.3, 0.3)
  const bend = (u: number) => u + (a * Math.sin(2 * Math.PI * u)) / (2 * Math.PI) + (b * Math.sin(4 * Math.PI * u)) / (4 * Math.PI)
  return (e) => {
    const phase = times * bend(Math.min(1, Math.max(0, e / DURATION_MS)))
    const i = Math.min(times - 1, Math.floor(phase))
    // floor → peak → floor once per wave, faded in at the start and out at the end like the movement
    const wave = 0.5 - 0.5 * Math.cos(2 * Math.PI * phase)
    return smooth(levelAt(e)) * (BLUR_FLOOR + (strength[i]! - BLUR_FLOOR) * wave)
  }
}

/** where an element is at t seconds, k = how drunk (0 … 1) */
const waveAt = (w: Wave, t: number, k: number) => {
  const mix = (i: number) => 0.65 * Math.sin(t * w.f[i]! + w.ph[i]!) + 0.35 * Math.sin(t * w.f[i + 1]! + w.ph[i + 1]!)
  return `translate(${(k * w.x * mix(0)).toFixed(2)}px, ${(k * w.y * mix(2)).toFixed(2)}px) rotate(${(k * w.r * mix(4)).toFixed(3)}deg)`
}

/** phones with little memory (Chrome reports it) get a lighter blur right away */
const weakDevice = () => ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4

const onScreen = (el: Element) => {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth
}

/** a random path and a random blur; small things wander further than big ones */
function randomWave(el: Element, size: number, blur: [number, number]): Wave {
  const f = () => rnd(0.5, 2.2)
  const ph = () => rnd(0, 6.28)
  return {
    el,
    x: sign() * rnd(10, 22) * size,
    y: sign() * rnd(6, 14) * size,
    r: sign() * rnd(2, 7) * size,
    f: [f(), f(), f(), f(), f(), f()],
    ph: [ph(), ph(), ph(), ph(), ph(), ph()],
    blur: rnd(...blur) * (weakDevice() ? 0.6 : 1),
    blurAt: randomBlur(),
  }
}

/**
 * Everything visible on screen: every card (gently), and in and around them each text, heading,
 * button, icon, chart … The outermost of those only: a word inside a paragraph moves with its paragraph.
 */
function pickMovers(): Wave[] {
  const scopes = [document.querySelector('main'), document.querySelector('[data-app-bar]')].filter(Boolean) as Element[]
  const found = new Set<Element>()
  for (const scope of scopes) {
    for (const hit of scope.querySelectorAll(MOVERS)) {
      if (!onScreen(hit)) continue
      // a plain inline element (a word in a line) can't be moved on its own: its block moves instead
      // (icons, images and charts can, even inline)
      let el: Element | null = hit
      while (el && el !== scope && !el.matches('svg, img, canvas') && getComputedStyle(el).display === 'inline') el = el.parentElement
      if (el && el !== scope) found.add(el)
    }
  }
  const outermost = [...found].filter((el) => {
    for (let p = el.parentElement; p; p = p.parentElement) if (found.has(p)) return false
    return true
  })
  const cards = [...document.querySelectorAll(`main ${CARDS}`)].filter(onScreen)
  // a card's blur also blurs what's in it, so cards get only a little (their content adds its own)
  return [...cards.map(el => randomWave(el, 0.5, [2, 5])), ...outermost.map(el => randomWave(el, 1, [5, 14]))].slice(0, MAX_MOVERS)
}

/** keyframes from now to the end: `at(t, e)` with t = wave clock (s), e = ms since the fade-in began */
function frames<K>(now: number, at: (t: number, e: number) => K) {
  const left = DURATION_MS - (now - start)
  const n = Math.max(1, Math.ceil(left / STEP_MS))
  const list = Array.from({ length: n + 1 }, (_, i) => {
    const tt = now + (i / n) * left
    return { ...at((tt - t0) / 1000, tt - start), offset: i / n }
  })
  return { list, left }
}

/**
 * Plans all 12 s up front: per element one animation for the movement and one for its blur
 * (separate, so the movement stays on the GPU even where a browser can't do the blur there).
 */
function plan(now: number) {
  const opts = (left: number): KeyframeAnimationOptions => ({ duration: left, easing: 'linear' })
  for (const w of waves) {
    if (!reduceMotion()) {
      const { list, left } = frames(now, (t, e) => ({ transform: waveAt(w, t, smooth(levelAt(e))) }))
      anims.push(w.el.animate(list, opts(left)))
    }
    const { list, left } = frames(now, (_t, e) => ({ filter: `blur(${(w.blur * w.blurAt(e)).toFixed(2)}px)` }))
    blurAnims.push(w.el.animate(list, opts(left)))
  }
  clearTimeout(timer)
  timer = setTimeout(sober, DURATION_MS - (now - start))
}

/** while it fades in: if the frames come too slowly, the blur goes (softly) */
function watchSpeed() {
  let last = 0
  let sum = 0
  let n = 0
  const tick = (now: number) => {
    if (!drunk.value) return
    const e = now - start
    if (last && e > 600) {
      sum += now - last
      n++
    }
    last = now
    if (e < 2000) {
      fpsRaf = requestAnimationFrame(tick)
      return
    }
    if (n && sum / n > SLOW_FRAME_MS) dropBlur()
  }
  fpsRaf = requestAnimationFrame(tick)
}

/** too slow for the blur: every element sharpens up softly, the movement goes on */
function dropBlur() {
  const from = waves.map(w => getComputedStyle(w.el).filter)
  for (const a of blurAnims) a.cancel()
  blurAnims = waves.map((w, i) => w.el.animate(
    [{ filter: from[i] === 'none' ? 'blur(0px)' : from[i]! }, { filter: 'blur(0px)' }],
    { duration: 400, easing: 'ease-out', fill: 'forwards' },
  ))
}

async function drink() {
  if (drunk.value) return
  start = t0 = performance.now()
  waves = pickMovers()
  drunk.value = true
  root().classList.add('drunk')
  await nextTick()
  plan(performance.now())
  watchSpeed()
}

function sober() {
  clearTimeout(timer)
  cancelAnimationFrame(fpsRaf)
  for (const a of anims) a.cancel()
  anims = []
  for (const a of blurAnims) a.cancel()
  blurAnims = []
  waves = []
  drunk.value = false
  root().classList.remove('drunk')
  // the page can be used again
  app()?.removeAttribute('inert')
  scrollLock.value = false
}

// ---------- triggers ----------

// desktop: G, but not while typing in a field or with a modifier (Ctrl+G etc. stay the browser's)
onKeyStroke(['g', 'G'], (ev) => {
  if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat) return
  const t = ev.target as HTMLElement | null
  if (t?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return
  offer()
})

// other places in the app (lib/drunk.ts serveBeer)
useEventListener(import.meta.client ? window : null, SERVE_BEER_EVENT, () => offer())

// phone: a few hard jolts in a row
let last: { x: number, y: number, z: number } | null = null
let jolts: number[] = []
useEventListener(import.meta.client ? window : null, 'devicemotion', (ev: DeviceMotionEvent) => {
  const a = ev.accelerationIncludingGravity
  if (a?.x == null || a.y == null || a.z == null) return
  const cur = { x: a.x, y: a.y, z: a.z }
  if (last) {
    const d = Math.hypot(cur.x - last.x, cur.y - last.y, cur.z - last.z)
    if (d > JOLT) {
      const now = performance.now()
      jolts = [...jolts.filter(t => now - t < SHAKE_WINDOW_MS), now]
      if (jolts.length >= JOLTS) {
        jolts = []
        offer()
      }
    }
  }
  last = cur
}, { passive: true })

onBeforeUnmount(() => {
  closeBeer()
  sober()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="state !== 'idle'"
      class="fixed inset-0 z-[60] grid place-items-center"
      :class="state === 'drinking' ? 'pointer-events-none' : ''"
      role="dialog"
      aria-modal="true"
      aria-label="Ein Gilden Kölsch"
    >
      <!-- the page fades out (slowly) behind the bottle and in again while it is drunk -->
      <div
        class="absolute inset-0 bg-black/85 transition-opacity duration-[1600ms] ease-out"
        :class="dark ? 'opacity-100' : 'opacity-0'"
      />

      <!-- perspective here, every layer below keeps its 3D space; no focus ring (G focuses it from the keyboard) -->
      <button
        ref="button"
        type="button"
        class="relative cursor-pointer outline-none [perspective:1100px] [-webkit-tap-highlight-color:transparent] disabled:cursor-default"
        :disabled="state !== 'offer'"
        aria-label="Flasche öffnen"
        @click="open"
      >
        <div
          ref="bottle"
          class="relative [transform-origin:50%_5%] [transform-style:preserve-3d]"
          :style="{ width: `${BEER_W * px}px`, height: `${BEER_H * px}px` }"
        >
          <!-- gentle tilt and bob the whole time (stopping would make it jump) -->
          <div class="beer-sway absolute inset-0 [transform-style:preserve-3d]">
            <!-- pixel-art bottle, see lib/beer-sprite.ts -->
            <svg
              :viewBox="`0 0 ${BEER_W} ${BEER_H}`"
              class="absolute inset-0 size-full"
              shape-rendering="crispEdges"
              aria-hidden="true"
            >
              <rect
                v-for="(r, i) in BOTTLE"
                :key="i"
                :x="r.x"
                :y="r.y"
                :width="r.w"
                height="1"
                :fill="r.c"
              />
            </svg>

            <!-- the cap on the same grid, its own element so it can tumble off -->
            <svg
              ref="cap"
              :viewBox="`0 0 ${BEER_W} ${BEER_H}`"
              class="absolute inset-0 size-full [transform-origin:50%_2%] [backface-visibility:visible]"
              shape-rendering="crispEdges"
              aria-hidden="true"
            >
              <rect
                v-for="(r, i) in CAP"
                :key="i"
                :x="r.x"
                :y="r.y"
                :width="r.w"
                height="1"
                :fill="r.c"
              />
            </svg>

            <span
              ref="plopp"
              class="pointer-events-none absolute -top-2 left-1/2 font-mono text-2xl font-black tracking-wide text-amber-300 opacity-0 [text-shadow:3px_3px_0_#000]"
              aria-hidden="true"
            >PLOPP!</span>
          </div>
        </div>
      </button>
      <span class="sr-only">Auf die Flasche tippen, um sie zu öffnen.</span>
    </div>
  </Teleport>
</template>

<style scoped>
/* the whole bottle: a slight tilt and moving a little towards the viewer and back */
.beer-sway {
  animation: beer-sway 4.5s ease-in-out infinite;
}
@keyframes beer-sway {
  0%, 100% { transform: rotateZ(-1.5deg) translateZ(0); }
  50% { transform: rotateZ(1.5deg) translateZ(40px); }
}
@media (prefers-reduced-motion: reduce) {
  .beer-sway {
    animation: none;
  }
}
</style>
