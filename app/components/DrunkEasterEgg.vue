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
 * 3. Then the page is drunk for 10 s: everything on screen sways smoothly, each block on its own, and
 *    goes blurry. Fades in over 3 s and out over the last 4 s (eased), then everything is as before.
 *    Meanwhile the page can't be clicked, scrolled, swiped or typed into, and no new beer comes.
 *
 * Made for weak phones too. As nothing can scroll, only what is on screen takes part: the visible
 * blocks (cards, and whatever else is on screen outside cards) each get one animation, worked out up
 * front as keyframes (moving and turning only), which the GPU plays by itself; nothing is computed per
 * frame and nothing off screen moves. The blur is one screen-sized layer in front (backdrop-filter)
 * that only fades; on phones with little memory it is lighter, and if frames still come too slowly
 * it is dropped and only the swaying stays.
 *
 * Shaking works where the browser gives motion data without asking (Android); iPhones only give it
 * after a permission prompt, which we don't show for an easter egg.
 */

const DURATION_MS = 10_000
const RAMP_UP_MS = 3_000
const RAMP_DOWN_MS = 4_000

/** change in acceleration (m/s²) between two readings that counts as a jolt */
const JOLT = 22
/** this many jolts within SHAKE_WINDOW_MS make a shake */
const JOLTS = 3
const SHAKE_WINDOW_MS = 1_000

/** at most this many blocks move (a phone screen has far fewer) */
const MAX_MOVERS = 40
/** blocks containing a card are split further, down to this depth */
const MAX_DEPTH = 5
/** one keyframe every this many ms; in between they move in a straight line (too short to see) */
const STEP_MS = 100
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

/** speed, phase and size of an element's swaying, so nothing moves in sync */
interface Wave { el: HTMLElement, f: number, ph: number, ax: number, ay: number, ar: number }

const drunk = ref(false)
/** the blurry layer in front of the page */
const haze = useTemplateRef<HTMLElement>('haze')
/** clock of the sine waves (never shifted, so the movement stays continuous) */
let t0 = 0
/** clock of the fade in / out */
let start = 0
let waves: Wave[] = []
let anims: Animation[] = []
let hazeAnim: Animation | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let fpsRaf = 0

/** 0 → 1 → 0 in a straight line over the 10 s */
const levelAt = (e: number) => e < 0
  ? 0
  : e < RAMP_UP_MS ? e / RAMP_UP_MS : e > DURATION_MS - RAMP_DOWN_MS ? Math.max(0, (DURATION_MS - e) / RAMP_DOWN_MS) : 1
/** the movement eases in and out; the blur even more softly, so it creeps in and out */
const smooth = (l: number) => l * l * (3 - 2 * l)
const smoother = (l: number) => l ** 3 * (l * (6 * l - 15) + 10)

const rnd = (a: number, z: number) => a + Math.random() * (z - a)
const sign = () => (Math.random() < 0.5 ? -1 : 1)

/**
 * A block's position: the slow drift of the whole page (the same for all) plus its own wave on top;
 * t in seconds, k = how drunk (0 … 1)
 */
const blockAt = (w: Wave, t: number, k: number) => {
  const x = Math.sin(t * 0.9) * 20 + w.ax * Math.sin(t * w.f + w.ph) * 14
  const y = Math.sin(t * 1.3 + 1) * 8 + w.ay * Math.cos(t * w.f * 1.3 + w.ph) * 10
  const r = Math.sin(t * 0.7 + 0.5) * 2 + w.ar * Math.sin(t * w.f * 0.8 + w.ph) * 3.5
  return `translate(${(k * x).toFixed(2)}px, ${(k * y).toFixed(2)}px) rotate(${(k * r).toFixed(3)}deg)`
}

const onScreen = (el: Element) => {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth
}

/**
 * The blocks on screen that sway: every card, plus the pieces outside cards (title, tabs, text …);
 * a block holding cards is split into its children instead, so each card moves on its own.
 * Together they cover what is visible; everything off screen stays as it is.
 */
function pickMovers(): Wave[] {
  const blocks: HTMLElement[] = []
  const walk = (parent: Element, depth: number) => {
    for (const el of parent.children) {
      if (!(el instanceof HTMLElement) || !onScreen(el)) continue
      const split = depth < MAX_DEPTH && !el.matches('[data-slot="card"]') && el.querySelector('[data-slot="card"]')
      if (split) walk(el, depth + 1)
      else blocks.push(el)
    }
  }
  const main = document.querySelector('main')
  if (main) walk(main, 0)
  const bar = document.querySelector('[data-app-bar] > div')
  if (bar) walk(bar, MAX_DEPTH)
  return blocks.slice(0, MAX_MOVERS)
    .map(el => ({ el, f: rnd(0.6, 1.7), ph: rnd(0, 6.28), ax: sign() * rnd(0.5, 1.3), ay: sign() * rnd(0.5, 1.3), ar: sign() * rnd(0.4, 1.3) }))
}

/** phones with little memory (Chrome reports it) get a lighter blur right away */
const weakDevice = () => ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4

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

/** plans all 10 s up front: one animation per block and one for the blur */
function plan(now: number) {
  const opts = (left: number): KeyframeAnimationOptions => ({ duration: left, easing: 'linear' })
  if (!reduceMotion()) {
    for (const w of waves) {
      const { list, left } = frames(now, (t, e) => ({ transform: blockAt(w, t, smooth(levelAt(e))) }))
      anims.push(w.el.animate(list, opts(left)))
    }
  }
  if (haze.value) {
    if (weakDevice()) {
      haze.value.style.setProperty('backdrop-filter', 'blur(1.5px)')
      haze.value.style.setProperty('-webkit-backdrop-filter', 'blur(1.5px)')
    }
    const { list, left } = frames(now, (_t, e) => ({ opacity: smoother(levelAt(e)).toFixed(3) }))
    hazeAnim = haze.value.animate(list, opts(left))
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
    if (last && e > 1200) {
      sum += now - last
      n++
    }
    last = now
    if (e < 2800) {
      fpsRaf = requestAnimationFrame(tick)
      return
    }
    if (n && sum / n > SLOW_FRAME_MS) dropHaze()
  }
  fpsRaf = requestAnimationFrame(tick)
}

function dropHaze() {
  const el = haze.value
  if (!el || !hazeAnim) return
  const from = getComputedStyle(el).opacity
  hazeAnim.cancel()
  hazeAnim = el.animate([{ opacity: from }, { opacity: 0 }], { duration: 400, easing: 'ease-out', fill: 'forwards' })
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
  hazeAnim?.cancel()
  hazeAnim = null
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
    <!-- the blur: one screen-sized layer in front of the page (over the bar too), only its opacity changes -->
    <div
      v-if="drunk"
      ref="haze"
      class="pointer-events-none fixed inset-0 z-[55] opacity-0 backdrop-blur-[3px]"
      aria-hidden="true"
    />
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
